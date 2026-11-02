import { sdifTime } from "@/lib/swim";
import type { ExportRow } from "./sdif";

type Meet = { name: string; location: string | null; start_date: string | null; end_date: string | null; course: string };
const courses: Record<string, string> = { LCM: "L", SCM: "S", SCY: "Y" };
const ascii = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7e]/g, " ");
const date = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  const parsed = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return "";
  return `${value.slice(5, 7)}${value.slice(8, 10)}${value.slice(0, 4)}`;
};

/** USA Swimming SDIF v3, April 28 1998: 160 ASCII bytes, 1-based field positions. */
function record(type: string, fields: [number, number, string | number, boolean?][]) {
  const line = Array<string>(160).fill(" ");
  for (const [start, width, raw, right] of [[1, 2, type], [3, 1, "1"], ...fields] as [number, number, string | number, boolean?][]) {
    const value = ascii(String(raw));
    if (value.length > width) throw new Error(`El campo ${type} (${start}) supera ${width} caracteres.`);
    const padded = right ? value.padStart(width) : value.padEnd(width);
    for (let index = 0; index < width; index++) line[start - 1 + index] = padded[index] ?? " ";
  }
  return line.join("");
}

/** Dedicated registration file, not a results file with empty final-time fields. */
export function buildMeetManagerEntries(meet: Meet, rows: ExportRow[], teams: { code: string; name: string }[], now = new Date()) {
  if (!date(meet.start_date)) throw new Error("La competencia necesita una fecha de inicio válida.");
  const course = courses[meet.course];
  if (!course) throw new Error("Piscina no admitida para exportar inscripciones.");
  if (!rows.length) throw new Error("No hay inscripciones para exportar.");
  const grouped = new Map<string, ExportRow[]>();
  const swimmers = new Set<string>();
  const identities = new Set<string>();
  for (const row of rows) {
    const a = row.athlete, e = row.event;
    const name = `${a.last_name}, ${a.first_name}`;
    if (!a.first_name.trim() || !a.last_name.trim() || !date(a.birth_date) || (a.gender !== "M" && a.gender !== "F")) throw new Error(`${name}: completa nombre, nacimiento y sexo antes de exportar a Meet Manager.`);
    if (!e.event_number?.trim()) throw new Error(`${name}: falta el número de prueba de Meet Manager.`);
    if (!Number.isInteger(e.distance) || e.distance <= 0 || e.distance > 9999 || ![1, 2, 3, 4, 5].includes(e.stroke)) throw new Error(`${name}: prueba individual no admitida.`);
    if (e.gender && !["M", "F", "X"].includes(e.gender)) throw new Error(`${name}: sexo de prueba no admitido.`);
    if (e.gender && e.gender !== "X" && e.gender !== a.gender) throw new Error(`${name}: el sexo no coincide con la prueba ${e.event_number}.`);
    if (row.seed_time_ms != null && (!Number.isInteger(row.seed_time_ms) || row.seed_time_ms <= 0)) throw new Error(`${name}: tiempo de inscripción inválido.`);
    if (row.course && row.course !== meet.course) throw new Error(`${name}: la marca de inscripción pertenece a otra piscina.`);
    const code = a.team_code?.trim() || "UN";
    if (code.length > 6 || !/^[A-Za-z0-9 ]+$/.test(code)) throw new Error(`${name}: el código de equipo debe tener hasta seis caracteres ASCII.`);
    const swimmer = `${code}|${name}|${a.birth_date}|${a.gender}`;
    const identity = `${swimmer}|${e.event_number}|${e.distance}|${e.stroke}`;
    if (identities.has(identity)) throw new Error(`${name}: inscripción duplicada en la prueba ${e.event_number}.`);
    identities.add(identity); swimmers.add(swimmer);
    const group = grouped.get(code) ?? []; group.push(row); grouped.set(code, group);
  }
  const lines = [
    record("A0", [[4, 8, "V3.0"], [12, 2, "01"], [44, 20, "Natacion pro"], [64, 10, "1.0"], [106, 8, date(now.toISOString().slice(0, 10))]]),
    record("B1", [[12, 30, ascii(meet.name).slice(0, 30)], [86, 20, ascii(meet.location ?? "").slice(0, 20)], [122, 8, date(meet.start_date)], [130, 8, date(meet.end_date ?? meet.start_date)], [150, 1, course]]),
  ];
  for (const [code, group] of grouped) {
    const teamCode = code.length <= 4 ? code.padStart(6) : code;
    const name = teams.find(t => t.code === code)?.name ?? (code === "UN" ? "Unattached" : code);
    lines.push(record("C1", [[12, 6, teamCode], [18, 30, ascii(name).slice(0, 30)], [48, 16, ascii(name).slice(0, 16)]]));
    const unique = new Set(group.map(r => `${r.athlete.first_name}|${r.athlete.last_name}|${r.athlete.birth_date}|${r.athlete.gender}`));
    lines.push(record("C2", [[12, 6, teamCode], [60, 6, group.length, true], [66, 6, unique.size, true], [72, 5, 0, true], [77, 6, 0, true], [83, 6, 0, true], [89, 16, ascii(name).slice(0, 16)]]));
    for (const r of group) {
      const a = r.athlete, e = r.event;
      const ageCode = `${e.min_age == null || e.min_age === 0 ? "UN" : String(e.min_age).padStart(2, "0")}${e.max_age == null || e.max_age >= 99 ? "OV" : String(e.max_age).padStart(2, "0")}`;
      lines.push(record("D0", [[12, 28, `${a.last_name}, ${a.first_name}`], [40, 12, a.federation_id ?? ""], [52, 1, code === "UN" ? "U" : "A"], [56, 8, date(a.birth_date)], [66, 1, a.gender ?? ""], [67, 1, e.gender ?? a.gender ?? ""], [68, 4, e.distance, true], [72, 1, e.stroke], [73, 4, e.event_number ?? ""], [77, 4, ageCode], [81, 8, date(meet.start_date)], [89, 8, r.seed_time_ms == null ? "NT" : sdifTime(r.seed_time_ms), true], [97, 1, course]]));
    }
  }
  lines.push(record("Z0", [[12, 2, "01"], [44, 3, 1, true], [47, 3, 1, true], [50, 4, grouped.size * 2, true], [54, 4, grouped.size, true], [58, 6, rows.length, true], [64, 6, swimmers.size, true], [70, 5, 0, true], [75, 6, 0, true], [81, 6, 0, true]]));
  return lines.join("\r\n") + "\r\n";
}