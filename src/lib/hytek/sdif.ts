import { parseTime, parseSwimTime, sdifTime } from "../swim";
import { col, courseFromCode, mdyToIso, type ParsedFile, type ParsedResult } from "./types";

/** Parser for SDIF v3 files (.SD3 / .CL2), the USA Swimming standard exported by Meet Manager. */
export function parseSdif(text: string): ParsedFile {
  const out: ParsedFile = {
    format: "SDIF",
    meet: { name: "Competencia sin nombre", location: null, startDate: null, endDate: null, course: "LCM" },
    teams: [],
    athletes: [],
    results: [],
    warnings: [],
    warningDetails: [],
  };
  let teamCode: string | null = null;
  const seen = new Set<string>();
  let last: ParsedResult[] = [];

  for (const [index, raw] of text.split(/\r\n|\n|\r/).entries()) {
    if (!raw.trim()) continue;
    const line = raw.padEnd(160, " ");
    const type = line.slice(0, 2);
    const warn = (message: string) => { out.warnings.push(`Línea ${index + 1} (${type}): ${message}`); out.warningDetails?.push({ lineNumber: index + 1, lineCode: type, message, rawLine: raw }); };
    if (type === "B1") {
      out.meet.name = col(line, 12, 41) || out.meet.name;
      out.meet.location = [col(line, 86, 105), col(line, 106, 107)].filter(Boolean).join(", ") || null;
      out.meet.startDate = mdyToIso(col(line, 122, 129));
      out.meet.endDate = mdyToIso(col(line, 130, 137));
      out.meet.course = courseFromCode(col(line, 150, 150), "LCM");
    } else if (type === "C1") {
      last = [];
      // Legacy CL2 places team code at 18; standard SDIF at 12. Detect the empty reserved field.
      const standard = Boolean(col(line, 12, 17));
      teamCode = standard ? col(line, 12, 17) : col(line, 18, 23);
      out.teams.push({ code: teamCode, name: standard ? col(line, 18, 47) : col(line, 24, 53) || teamCode, lsc: null });
    } else if (type === "D0") {
      const fullName = col(line, 12, 39);
      const [lastName = "", firstRest = ""] = fullName.split(",").map((s) => s.trim());
      const firstName = firstRest;
      const uss = col(line, 40, 51) || null;
      const birth = mdyToIso(col(line, 56, 63));
      const gender = col(line, 66, 66).toUpperCase() || null;
      last = [];
      if (!firstName || !lastName || !["M", "F", "X"].includes(gender ?? "") || !Number.isInteger(Number(col(line, 68, 71))) || Number(col(line, 68, 71)) <= 0 || ![1,2,3,4,5,6,7].includes(Number(col(line, 72, 72)))) { warn("Atleta o prueba con campos no reconocidos; se omite este registro."); continue; }
      if (col(line,56,63) && !birth) warn("Fecha de nacimiento inválida; requiere revisión.");
      const key = uss ? `SDIF:${uss}` : `SDIF:${lastName}|${firstName}|${birth ?? ""}`;
      if (!seen.has(key)) {
        seen.add(key);
        out.athletes.push({ key, tmId: null, federationId: uss, firstName, lastName, birthDate: birth, gender, teamCode });
      }
      const ageCode = col(line, 77, 80);
      const lo = /^\d\d/.test(ageCode) ? Number(ageCode.slice(0, 2)) : null;
      const hiRaw = ageCode.slice(2, 4);
      const hi = /^\d\d$/.test(hiRaw) ? Number(hiRaw) : null;
      const base = {
        athleteKey: key,
        eventNumber: col(line, 73, 76) || null,
        distance: Number(col(line, 68, 71)) || 0,
        stroke: Number(col(line, 72, 72)) || 1,
        gender: col(line, 67, 67).toUpperCase() || gender,
        minAge: lo,
        maxAge: hi,
        seedMs: parseTime(col(line, 89, 96)),
      };
      last = [];
      const prelim = col(line, 98, 105);
      const finals = col(line, 116, 123);
      const seedCourse = courseFromCode(col(line,97,97),out.meet.course);
      const statusOf = (value: string): NonNullable<ParsedResult["status"]> => { const t = parseSwimTime(value); if(t.status === "INVALID") { warn("Tiempo inválido; no reemplazará marcas existentes."); return "NT"; } if (["DQ","NS","SCR","DNF"].includes(t.status)) warn(`Estado ${t.status}: ${firstName} ${lastName}.`); return t.status; };
      if (prelim) {
        const r: ParsedResult = { ...base, finalMs: parseTime(prelim), status: statusOf(prelim), course: courseFromCode(col(line, 106, 106), seedCourse), place: Number(col(line, 133, 135)) || null, isDq: /DQ/i.test(prelim), round: "P", splits: [] };
        out.results.push(r);
        last.push(r);
      }
      if (finals || !prelim) {
        const r: ParsedResult = { ...base, finalMs: parseTime(finals), status: statusOf(finals), course: courseFromCode(col(line, 124, 124), seedCourse), place: Number(col(line, 136, 138)) || null, isDq: /DQ/i.test(finals), round: "F", splits: [] };
        out.results.push(r);
        last.push(r);
      }
    } else if (type === "G0") {
      const splitDist = Number(col(line, 59, 62)) || 50;
      const isCumulative = col(line, 63, 63).toUpperCase() !== "I";
      const seq = Number(col(line, 56, 56)) || 1;
      const round = col(line, 144, 144).toUpperCase() === "P" ? "P" : "F";
      const target = last.find((r) => r.round === round) ?? last[last.length - 1];
      if (!target) { warn("Parciels sans résultat individuel précédent; registre ignoré."); continue; }
      let acc = target.splits.at(-1)?.cumulative_ms ?? 0;
      for (let i = 0; i < 10; i++) {
        const ms = parseTime(line.slice(63 + i * 8, 71 + i * 8));
        if (!ms) continue;
        const n = (seq - 1) * 10 + i + 1;
        acc = isCumulative ? ms : acc + ms;
        if (n * splitDist > target.distance || target.splits.some(s=>s.distance === n*splitDist) || acc <= (target.splits.at(-1)?.cumulative_ms ?? 0)) { warn("Parcial incompatible o no creciente; se omite."); continue; }
        target.splits.push({ distance: n * splitDist, cumulative_ms: acc });
      }
    } else if (!["A0","A1","C2","D3","Z0"].includes(type)) {
      last = [];
      warn("Registro no compatible con pruebas individuales; se omite.");
    }
  }
  return out;
}

/* ---------------- Export ---------------- */
const pad = (s: string | number | null | undefined, n: number) => String(s ?? "").slice(0, n).padEnd(n, " ");
const isoToMdy = (iso: string | null) => (iso ? `${iso.slice(5, 7)}${iso.slice(8, 10)}${iso.slice(0, 4)}` : "");
const COURSE_CODE: Record<string, string> = { LCM: "L", SCM: "S", SCY: "Y" };

export interface ExportRow {
  athlete: { first_name: string; last_name: string; federation_id: string | null; birth_date: string | null; gender: string | null; team_code: string | null };
  event: { event_number: string | null; distance: number; stroke: number; gender: string | null; min_age: number | null; max_age: number | null };
  seed_time_ms: number | null;
  final_time_ms: number | null;
  is_dq: boolean;
  place: number | null;
  aqua_points: number | null;
  course: string | null;
  round: string | null;
  splits: { split_distance: number; cumulative_time_ms: number }[];
}

export function buildSd3(meet: { name: string; location: string | null; start_date: string | null; end_date: string | null; course: string }, rows: ExportRow[], teams: { code: string; name: string }[], kind: "results" | "entries" = "results"): string {
  const L = (s: string) => s.padEnd(160, " ").slice(0, 160);
  const today = isoToMdy(new Date().toISOString().slice(0, 10));
  const lines: string[] = [];
  lines.push(L(`A102${pad(kind === "entries" ? "Inscripciones" : "Resultados", 30)}${pad("Swim Lane Coach", 20)}${pad("1.0", 10)}${pad("", 20)}${pad("", 12)}${today}`));
  lines.push(L(`B1${pad("", 9)}${pad(meet.name, 30)}${pad("", 44)}${pad(meet.location, 20)}${pad("", 16)}${isoToMdy(meet.start_date).padEnd(8)}${isoToMdy(meet.end_date ?? meet.start_date).padEnd(8)}${pad("", 4)}${pad("", 8)}${COURSE_CODE[meet.course] ?? "L"}`));
  let count = 0;
  const byTeam = new Map<string, ExportRow[]>();
  for (const r of rows) {
    const k = r.athlete.team_code ?? "UNAT";
    const group = byTeam.get(k) ?? [];
    group.push(r);
    byTeam.set(k, group);
  }
  for (const [code, list] of byTeam) {
    const name = teams.find((t) => t.code === code)?.name ?? code;
    lines.push(L(`C1${pad("", 9)}${pad("", 6)}${pad(code, 6)}${pad(name, 30)}`));
    for (const r of list) {
      const e = r.event;
      const age = `${e.min_age ? String(e.min_age).padStart(2, "0") : "UN"}${e.max_age && e.max_age < 99 ? String(e.max_age).padStart(2, "0") : "OV"}`;
      const course = COURSE_CODE[r.course ?? meet.course] ?? "L";
      const timeStr = kind === "entries" ? pad("", 8) : r.is_dq ? "DQ".padStart(8) : sdifTime(r.final_time_ms);
      const isPrelim = r.round === "P";
      const name = `${r.athlete.last_name}, ${r.athlete.first_name}`;
      let d = "D0" + pad("", 9) + pad(name, 28) + pad(r.athlete.federation_id, 12) + " " + pad("", 3) + pad(isoToMdy(r.athlete.birth_date), 8) + pad("", 2) + pad(r.athlete.gender, 1) + pad(e.gender, 1) + String(e.distance).padStart(4) + String(e.stroke) + pad(e.event_number, 4) + age + pad(isoToMdy(meet.start_date), 8) + sdifTime(r.seed_time_ms) + (r.seed_time_ms ? course : " ");
      d += kind === "entries" ? pad("", 9) : isPrelim ? timeStr + course : pad("", 9);
      d += pad("", 9);
      d += kind === "entries" || isPrelim ? pad("", 9) : timeStr + course;
      d += pad("", 8);
      d += kind === "entries" ? pad("", 6) : isPrelim ? String(r.place ?? "").padStart(3) + pad("", 3) : pad("", 3) + String(r.place ?? "").padStart(3);
      d += kind === "entries" ? pad("", 4) : String(r.aqua_points ?? "").padStart(4);
      lines.push(L(d));
      count++;
      const sp = [...r.splits].sort((a, b) => a.split_distance - b.split_distance);
      if (sp.length && kind !== "entries") {
        const total = sp.length;
        const firstSplit = sp[0];
        if (!firstSplit) continue;
        const dist = firstSplit.split_distance;
        for (let i = 0; i < total; i += 10) {
          const chunk = sp.slice(i, i + 10).map((s) => sdifTime(s.cumulative_time_ms)).join("");
          const g = "G0" + pad("", 13) + pad(name, 28) + pad(r.athlete.federation_id, 12) + String(Math.floor(i / 10) + 1) + String(total).padStart(2) + String(dist).padStart(4) + "C" + chunk.padEnd(80) + (isPrelim ? "P" : "F");
          lines.push(L(g));
        }
      }
    }
  }
  lines.push(L(`Z0${pad("", 9)}${pad("", 2)}${String(count).padStart(3)}`));
  return lines.join("\r\n") + "\r\n";
}
