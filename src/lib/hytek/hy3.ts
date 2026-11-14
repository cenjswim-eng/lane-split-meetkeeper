import { parseTime, parseSwimTime } from "../swim";
import { col, courseFromCode, mdyToIso, type ParsedFile, type ParsedResult } from "./types";

const HY3_STROKE: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };

/**
 * Parser for Hy-Tek Meet Manager / Team Manager HY3 files (results and entries).
 * Fixed-width records; first two chars are the record type.
 */
export function parseHy3(text: string): ParsedFile {
  const out: ParsedFile = {
    format: "HY3",
    meet: { name: "Competencia sin nombre", location: null, startDate: null, endDate: null, course: "LCM" },
    teams: [],
    athletes: [],
    results: [],
    warnings: [],
    warningDetails: [],
  };
  let teamCode: string | null = null;
  let athleteKey: string | null = null;
  let current: ParsedResult | null = null;
  const athleteGender = new Map<string, string>();
  let hasFinalRecord = false;

  for (const [index, rawLine] of text.split(/\r\n|\n|\r/).entries()) {
    if (!rawLine.trim()) continue;
    const line = rawLine.padEnd(132, " ");
    const type = line.slice(0, 2);
    const warn = (message: string) => {
      out.warnings.push(`Línea ${index + 1} (${type}): ${message}`);
      out.warningDetails?.push({ lineNumber: index + 1, lineCode: type, message, rawLine });
    };
    switch (type) {
      case "B1":
        out.meet.name = col(line, 3, 47) || out.meet.name;
        out.meet.location = col(line, 48, 92) || null;
        out.meet.startDate = mdyToIso(col(line, 93, 100));
        out.meet.endDate = mdyToIso(col(line, 101, 108));
        break;
      case "B2": {
        const c = col(line, 99, 99);
        if (c) out.meet.course = courseFromCode(c, out.meet.course);
        break;
      }
      case "C1":
        athleteKey = null;
        current = null;
        teamCode = col(line, 3, 7);
        if (!out.teams.some(t => t.code === teamCode)) out.teams.push({ code: teamCode, name: col(line, 8, 37) || teamCode });
        break;
      case "D1": {
        current = null;
        const id = col(line, 4, 8);
        const gender = col(line, 3, 3).toUpperCase() || null;
        const firstName = col(line, 29, 48);
        const lastName = col(line, 9, 28);
        const rawBirth = col(line, 89, 96);
        const birthDate = mdyToIso(rawBirth);
        if (!id || !firstName || !lastName || !["M", "F", "X"].includes(gender ?? "")) {
          athleteKey = null;
          current = null;
          warn("Un atleta tiene campos HY3 no reconocidos y no se importará. Usa el archivo CL2/SD3 de resultados para ese atleta.");
          break;
        }
        if (rawBirth && !birthDate) warn(`${firstName} ${lastName}: fecha de nacimiento inválida; se conservarán sus tiempos sin actualizar la fecha.`);
        athleteKey = `HY3:${teamCode ?? ""}:${id}`;
        const existing = out.athletes.find(a => a.key === athleteKey);
        if (existing && (existing.firstName !== firstName || existing.lastName !== lastName || (existing.birthDate && birthDate && existing.birthDate !== birthDate))) {
          warn("El ID HY3 corresponde a identidades diferentes. Se omite este bloque para no asignar tiempos a otro atleta.");
          athleteKey = null;
          break;
        }
        athleteGender.set(athleteKey, gender ?? "");
        if (!existing) out.athletes.push({
          key: athleteKey,
          tmId: athleteKey,
          federationId: col(line, 70, 83) || null,
          lastName,
          firstName,
          birthDate,
          gender,
          teamCode,
        });
        break;
      }
      case "E1": {
        current = null;
        hasFinalRecord = false;
        if (!athleteKey) { warn("Prueba sin un nadador D1 válido previo; no se importará."); break; }
        const stroke = HY3_STROKE[col(line, 22, 22)];
        const distance = Number(col(line, 16, 21));
        if (!stroke || !Number.isInteger(distance) || distance <= 0) { warn("Distancia o estilo no reconocidos; no se importará esta prueba."); break; }
        const seed = parseSwimTime(col(line, 43, 50));
        if (seed.status === "INVALID") warn("Tiempo de inscripción inválido; se omitirá ese tiempo.");
        const minAge = Number(col(line, 23, 25)) || null;
        const maxAge = Number(col(line, 26, 28)) || null;
        current = {
          athleteKey,
          eventNumber: col(line, 39, 42) || null,
          distance,
          stroke,
          gender: col(line, 14, 14) || athleteGender.get(athleteKey) || null,
          minAge: minAge && minAge < 100 ? minAge : null,
          maxAge: maxAge && maxAge < 100 ? maxAge : null,
          seedMs: seed.timeMs,
          finalMs: null,
          course: courseFromCode(col(line, 51, 51), out.meet.course),
          place: null,
          isDq: false,
          status: "NT",
          round: "F",
          splits: [],
        };
        // Entry-only files: keep the seed as a result row
        out.results.push(current);
        break;
      }
      case "E2": {
        if (!current) { warn("Resultado sin prueba E1 válida previa; no se importará."); break; }
        const round = col(line, 3, 3) as "P" | "F" | "S";
        const timeRaw = col(line, 4, 11);
        const code = col(line, 13, 15).toUpperCase();
        let target: ParsedResult = current;
        if (hasFinalRecord && round && round !== current.round) {
          target = { ...current, splits: [], finalMs: null, place: null, isDq: false };
          out.results.push(target);
        }
        target.round = round === "P" || round === "S" ? round : "F";
        const final = parseSwimTime(timeRaw);
        if (final.status === "INVALID") warn("Tiempo final inválido; no se reemplazará una marca existente con este valor.");
        target.finalMs = final.timeMs;
        target.course = courseFromCode(col(line, 12, 12), target.course ?? out.meet.course);
        target.isDq = code === "Q" || code.includes("DQ") || final.status === "DQ";
        if (target.isDq) target.finalMs = null;
        target.status = target.isDq ? "DQ" : ["NS", "SCR", "DNF"].includes(final.status) ? final.status as "NS" | "SCR" | "DNF" : code === "S" || code === "NS" ? "NS" : final.timeMs == null ? "NT" : "OK";
        if (["DQ", "NS", "SCR", "DNF"].includes(target.status)) warn(`Estado ${target.status}: ${out.athletes.find(a => a.key === target.athleteKey)?.firstName ?? "Atleta"}, prueba ${target.eventNumber ?? target.distance}.`);
        const place = Number(col(line, 30, 33));
        target.place = place > 0 ? place : null;
        current = target;
        hasFinalRecord = true;
        break;
      }
      case "G1": {
        if (!current) { warn("Parciales sin prueba válida previa; no se importarán."); break; }
        const interval = current.course === "SCM" || current.course === "SCY" ? 25 : 50;
        for (let i = 0; i < 10; i++) {
          const start = 3 + i * 11;
          const chunk = line.slice(start - 1, start + 10);
          const num = Number(chunk.slice(1, 3));
          const ms = parseTime(chunk.slice(3, 11));
          if (num > 0 && ms) {
            const distance = num * interval;
            if (distance > current.distance || current.splits.some(s => s.distance === distance && s.cumulative_ms !== ms)) {
              warn("Parcial incompatible con la distancia de la prueba o duplicado con otro tiempo; se omitirá.");
            } else if (!current.splits.some(s => s.distance === distance)) current.splits.push({ distance, cumulative_ms: ms });
          }
        }
        break;
      }
      case "F1":
      case "F2":
      case "F3":
        current = null;
        warn("Registro de relevo no compatible con resultados individuales; se omitirá.");
        break;
    }
  }
  // Retain every supported split, including 25 m, without inventing lap times.
  for (const r of out.results) {
    r.splits.sort((a, b) => a.distance - b.distance);
    let previous = 0;
    r.splits = r.splits.filter(s => {
      if (s.cumulative_ms <= previous) { out.warnings.push("Parcial no creciente omitido para evitar un tiempo de tramo negativo."); return false; }
      previous = s.cumulative_ms;
      return true;
    });
  }
  return out;
}
