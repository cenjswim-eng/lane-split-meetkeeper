import type { ParsedAthlete, ParsedFile, ParsedResult, ParsedTeam } from "@/lib/hytek/types";
import { parseTime } from "@/lib/swim";
import { normalizeTeamCode } from "@/data/fevedaClubs";

/** Pure readers that turn PDF results (Meet Manager text or AI-extracted JSON) into the shared ParsedFile shape. */

const STROKE_WORDS: [RegExp, number][] = [
  [/individual medley|\bIM\b|\bCI\b|combinado|medley/i, 5],
  [/freestyle|\bfree\b|libre/i, 1],
  [/backstroke|\bback\b|espalda/i, 2],
  [/breaststroke|\bbreast\b|pecho/i, 3],
  [/butterfly|\bfly\b|mariposa/i, 4],
];
const TIME = String.raw`(?:\d{1,2}:)?\d{1,2}\.\d{1,2}`;
const STATUS_CODES = String.raw`DQ|DSQ|DES|DESC|NS|NP|SCR|BAJ|BAJA|FOR|DFS|DNF|RET`;
const PLACE_RE = String.raw`(?:\d{1,3}[\.\-\)]?|#\d{1,3}|-{1,3}|\*?\d{1,3}|[A-Za-z]\d{1,3})?`;
const HEAT_LANE_RE = String.raw`(?:\d{1,2}[-/]\d{1,2}\s+|[Hh]\d{1,2}\s+[Ll]\d{1,2}\s+)?`;
const ATH_ID_RE = String.raw`(?:\b[VEPJvepj]?[-]?\d{5,9}\b\s+)?`;
const AGE_RE = String.raw`(\d{1,2}|FR|SO|JR|SR|5Y|GR|-{1,2})`;
const TIME_OR_STATUS = String.raw`[xXJ]?(${TIME}|${STATUS_CODES})`;
const SEED_TIME = String.raw`[xXJ]?(${TIME}|NT|NS)?`;

// 1. Línea estándar Meet Manager con coma y edad: "1 1-4 Perez, Juan 12 PISBO 28.50 28.10 9.0"
const RESULT_LINE = new RegExp(
  String.raw`^\s*(${PLACE_RE})\s+${HEAT_LANE_RE}${ATH_ID_RE}([^,\d]+?),\s*([^\d]+?)\s+${AGE_RE}\s+(.+?)\s+${SEED_TIME}\s*${TIME_OR_STATUS}\s*[A-Za-z!*$%]{0,3}\s*(?:\d+(?:\.\d+)?)?\s*$`
);

// 2. Línea sin coma: "1 Juan Perez 12 HOGAR CANARIO 28.50 28.10"
const RESULT_LINE_NO_COMMA = new RegExp(
  String.raw`^\s*(${PLACE_RE})\s+${HEAT_LANE_RE}${ATH_ID_RE}([A-Za-zÀ-ÿ'.-]+(?:\s+[A-Za-zÀ-ÿ'.-]+){1,4})\s+${AGE_RE}\s+(.+?)\s+${SEED_TIME}\s*${TIME_OR_STATUS}\s*[A-Za-z!*$%]{0,3}\s*(?:\d+(?:\.\d+)?)?\s*$`
);

// 3. Línea con coma pero sin columna de edad: "1 Perez, Juan PISBO 28.50 28.10"
const RESULT_LINE_NO_AGE = new RegExp(
  String.raw`^\s*(${PLACE_RE})\s+${HEAT_LANE_RE}${ATH_ID_RE}([^,\d]+?),\s*([A-Za-zÀ-ÿ'.-]+(?:\s+[A-Za-zÀ-ÿ'.-]+)?)\s+([A-Za-z0-9_-]+(?:\s+[A-Za-z0-9_-]+)*)\s+${SEED_TIME}\s*${TIME_OR_STATUS}\s*[A-Za-z!*$%]{0,3}\s*(?:\d+(?:\.\d+)?)?\s*$`
);

const SPLIT_LINE = new RegExp(String.raw`^\s+(?:(?:\d{2,4}m?:\s*)?${TIME}(?:\s*\(${TIME}\))?\s*)+$`);

export function splitFullName(raw: string): { first: string; last: string } {
  const trimmed = raw.trim();
  if (trimmed.includes(",")) {
    const [l, ...rest] = trimmed.split(",");
    return {
      last: l.trim(),
      first: rest.join(",").trim() || "Atleta",
    };
  }

  const tokens = trimmed.split(/\s+/).filter(Boolean);
  if (tokens.length <= 1) {
    return { first: tokens[0] || "Atleta", last: "Desconocido" };
  }
  if (tokens.length === 2) {
    return { first: tokens[0], last: tokens[1] };
  }

  const prefixIdx = tokens.findIndex(
    (t, i) => i > 0 && /^(de|del|la|los|las|san|santa|da|dos|das)$/i.test(t)
  );
  if (prefixIdx > 0) {
    return {
      first: tokens.slice(0, prefixIdx).join(" "),
      last: tokens.slice(prefixIdx).join(" "),
    };
  }

  if (tokens.length === 3) {
    return {
      first: tokens.slice(0, 2).join(" "),
      last: tokens[2],
    };
  }

  const mid = Math.floor(tokens.length / 2);
  return {
    first: tokens.slice(0, mid).join(" "),
    last: tokens.slice(mid).join(" "),
  };
}

export function parseLineFallback(line: string): {
  placeRaw?: string;
  last?: string;
  first?: string;
  age?: string;
  teamRaw?: string;
  seedRaw?: string;
  finalRaw?: string;
} | null {
  const trimmed = line.trim();
  const timeOrStatusPattern = new RegExp(
    String.raw`\b((?:\d{1,2}:)?\d{1,2}\.\d{1,2}|DQ|DSQ|DES|DESC|NS|NP|SCR|BAJ|BAJA|FOR|DFS|DNF|RET)\b`,
    "i"
  );
  if (!timeOrStatusPattern.test(trimmed)) return null;

  const rawTokens = trimmed.split(/\s+/).filter(Boolean);
  if (rawTokens.length < 3) return null;

  const tokens = [...rawTokens];

  // 1. Quitar sufijo de puntos o flags al final (ej. 9.0, 10, q, Q, *)
  if (tokens.length > 2) {
    const lastTok = tokens[tokens.length - 1];
    if (/^\d+(?:\.\d+)?$/.test(lastTok) || /^[a-z!*$%]{1,3}$/i.test(lastTok)) {
      const prevTok = tokens[tokens.length - 2];
      if (timeOrStatusPattern.test(prevTok)) {
        tokens.pop();
      }
    }
  }

  // 2. Extraer tiempo oficial / final
  if (tokens.length < 2) return null;
  const finalCand = tokens.pop()!.replace(/^[xXJ]/, "");
  if (!timeOrStatusPattern.test(finalCand)) return null;
  const finalRaw = finalCand;

  // 3. Extraer tiempo de inscripción (seed), si existe
  let seedRaw: string | undefined;
  if (tokens.length > 1) {
    const prev = tokens[tokens.length - 1];
    if (new RegExp(String.raw`^[xXJ]?(?:(?:\d{1,2}:)?\d{1,2}\.\d{1,2}|NT|NS)$`, "i").test(prev)) {
      seedRaw = tokens.pop()!.replace(/^[xXJ]/, "");
    }
  }

  // 4. Extraer lugar al inicio, si existe
  let placeRaw: string | undefined;
  if (tokens.length > 0 && /^(?:\d{1,3}[\.\-\)]?|#\d{1,3}|-{1,3}|\*?\d{1,3}|[A-Za-z]\d{1,3})$/.test(tokens[0])) {
    placeRaw = tokens.shift();
  }

  // 5. Extraer heat/lane opcional al inicio (ej. 1-4, 2/3, H1 L4)
  if (tokens.length > 0 && /^\d{1,2}[-/]\d{1,2}$/.test(tokens[0])) {
    tokens.shift();
  } else if (tokens.length > 1 && /^[Hh]\d{1,2}$/.test(tokens[0]) && /^[Ll]\d{1,2}$/.test(tokens[1])) {
    tokens.shift();
    tokens.shift();
  }

  // 6. Extraer Cédula / ID de atleta si existe
  if (tokens.length > 0 && /^[VEPJvepj]?[-]?\d{5,9}$/.test(tokens[0])) {
    tokens.shift();
  }

  if (tokens.length === 0) return null;

  // 7. Buscar si hay token de edad (\d{1,2} o categoría FR/SO/JR/SR)
  let age: string | undefined;
  let ageIdx = -1;
  for (let i = 0; i < tokens.length; i++) {
    if (/^(?:\d{1,2}|FR|SO|JR|SR|5Y|GR|-{1,2})$/i.test(tokens[i])) {
      if (i > 0 && i < tokens.length) {
        ageIdx = i;
        age = tokens[i];
        break;
      }
    }
  }

  let nameRaw = "";
  let teamRaw = "";

  if (ageIdx !== -1) {
    nameRaw = tokens.slice(0, ageIdx).join(" ");
    teamRaw = tokens.slice(ageIdx + 1).join(" ");
  } else {
    if (tokens.length >= 2) {
      teamRaw = tokens.pop()!;
      nameRaw = tokens.join(" ");
    } else {
      nameRaw = tokens[0] || "Atleta Desconocido";
      teamRaw = "CLUB";
    }
  }

  if (!nameRaw) return null;
  if (!teamRaw) teamRaw = "CLUB";

  const { first, last } = splitFullName(nameRaw);

  return {
    placeRaw,
    last,
    first,
    age,
    teamRaw,
    seedRaw,
    finalRaw,
  };
}

function isoFromMdy(m: string, d: string, y: string) {
  const dt = new Date(Date.UTC(+y, +m - 1, +d));
  return dt.getUTCMonth() === +m - 1 && dt.getUTCDate() === +d ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : null;
}

export function parseEventHeader(line: string) {
  let m = line.match(
    /^\s*(?:#\s*)?(?:event|evento|prueba)\s*(?:n[°oº]\.?\s*|nro\.?\s*|no\.?\s*|num\.?\s*|#\s*)?(\d+[A-Z]?)\s*[:.-]*\s+(.*)$/i
  );
  let eventNumber = "1";
  let rest = "";

  if (m) {
    eventNumber = m[1] || "1";
    rest = m[2] || "";
  } else {
    // También admitir encabezados directos como "#1 50m Libre Femenino 12-13" o "1.- 50 Libre Masculino"
    const directMatch = line.match(/^\s*(?:#\s*(\d+[A-Z]?)|(\d+[A-Z]?)\s*[:.-]*)\s*(.*)$/i);
    if (directMatch && directMatch[3]) {
      const candidateRest = directMatch[3];
      const distCheck = candidateRest.match(
        /\b(25|50|100|200|400|800|1500|1650)\s*(?:m\b|mts?\b|metros?\b|\b)/i
      );
      const strokeCheck = STROKE_WORDS.find(([re]) => re.test(candidateRest));
      if (distCheck && strokeCheck) {
        eventNumber = directMatch[1] || directMatch[2] || "1";
        rest = candidateRest;
      }
    }
  }

  if (!rest) return null;
  if (/relay|relevo/i.test(rest)) return { relay: true as const };
  const dist = rest.match(/\b(25|50|100|200|400|800|1500|1650)\s*(?:m\b|mts?\b|metros?\b|\b)/i);
  const stroke = STROKE_WORDS.find(([re]) => re.test(rest))?.[1];
  if (!dist || !stroke) return null;
  const gender = /girls|women|female|mujeres|damas|\bfem|niñas|hembras|\b[Ff]\b|\([Ff]\)/i.test(rest)
    ? "F"
    : /boys|\bmen\b|male|hombres|varones|caballeros|\bmasc|niños|\b[Mm]\b|\([Mm]\)/i.test(rest)
    ? "M"
    : /mixed|mixto/i.test(rest)
    ? "X"
    : null;

  let minAge: number | null = null,
    maxAge: number | null = null;

  // 1. Detección por nombre de categoría oficial (FEVEDA / World Aquatics)
  // Nota: Pre-Infantil debe evaluarse antes que Infantil para evitar falsos positivos
  if (/pre[- ]?infantil\s*a\b/i.test(rest)) {
    minAge = 7;
    maxAge = 7;
  } else if (/pre[- ]?infantil\s*b\b/i.test(rest)) {
    minAge = 8;
    maxAge = 8;
  } else if (/pre[- ]?infantil\s*c\b/i.test(rest)) {
    minAge = 9;
    maxAge = 9;
  } else if (/pre[- ]?infantil/i.test(rest)) {
    minAge = 7;
    maxAge = 9;
  } else if (/(?<!pre[- ]?)infantil\s*a\b/i.test(rest)) {
    minAge = 10;
    maxAge = 11;
  } else if (/(?<!pre[- ]?)infantil\s*b\b/i.test(rest)) {
    minAge = 12;
    maxAge = 13;
  } else if (/juvenil\s*a\b/i.test(rest)) {
    minAge = 14;
    maxAge = 15;
  } else if (/juvenil\s*b\b/i.test(rest)) {
    minAge = 16;
    maxAge = 18;
  } else if (/m[aá]xima|abierto|open|\bsenior\b/i.test(rest)) {
    minAge = 19;
    maxAge = 99;
  } else if (/\bmaster\b/i.test(rest)) {
    minAge = 25;
    maxAge = 99;
  }

  // 2. Detección por rangos numéricos si no fue establecido por nombre
  if (minAge === null) {
    const range = rest.match(/\b(\d{1,2})\s*-\s*(\d{1,2})\b/);
    const over = rest.match(/\b(\d{1,2})\s*(?:&|y|and|\+)?\s*(?:over|mayores|mas|más|\bO\b|\+)/i);
    const under = rest.match(/\b(\d{1,2})\s*(?:&|y|and)?\s*(?:under|menores|-)/i);
    const singleAge = rest.match(/\b(\d{1,2})\s*(?:a[ñn]os?|yr?s?)\b/i);

    if (range) {
      minAge = +range[1]!;
      maxAge = +range[2]!;
    } else if (over) {
      minAge = +over[1]!;
      maxAge = 99;
    } else if (under) {
      minAge = 0;
      maxAge = +under[1]!;
    } else if (singleAge) {
      minAge = +singleAge[1]!;
      maxAge = +singleAge[1]!;
    }
  }

  const course = /yard|yarda/i.test(rest)
    ? "SCY"
    : /\bSC\b|short course|piscina corta|25\s*m/i.test(rest)
    ? "SCM"
    : /\bLC\b|long course|piscina larga|50\s*m/i.test(rest)
    ? "LCM"
    : null;

  return { relay: false as const, number: eventNumber, distance: +dist[1]!, stroke, gender, minAge, maxAge, course };
}

/** Reads a Meet Manager "Results" report from PDF text lines. Lines it cannot recognise are reported, never guessed. */
export function parseMeetManagerResults(lines: string[], fallbackName: string, defaultCourse = "LCM"): ParsedFile {
  const warnings: string[] = [];
  const today = new Date().toISOString().slice(0, 10);
  let meetName = "", startDate: string | null = null, endDate: string | null = null;
  for (const line of lines.slice(0, 40)) {
    if (/^\s*(?:#\s*)?(?:event|evento|prueba)\s+/i.test(line)) break;
    const slashDates = [...line.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)];
    if (slashDates.length) {
      startDate = isoFromMdy(slashDates[0]![1]!, slashDates[0]![2]!, slashDates[0]![3]!);
      const last = slashDates[slashDates.length - 1]!;
      endDate = isoFromMdy(last[1]!, last[2]!, last[3]!);
      meetName = line.split(/\s+-\s+|\s{2,}/)[0]!.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4}).*/, "").trim();
      break;
    }
    const dashDates = [...line.matchAll(/(\d{1,2})-(\d{1,2})-(\d{4})/g)];
    if (dashDates.length) {
      startDate = isoFromMdy(dashDates[0]![1]!, dashDates[0]![2]!, dashDates[0]![3]!);
      const last = dashDates[dashDates.length - 1]!;
      endDate = isoFromMdy(last[1]!, last[2]!, last[3]!);
      meetName = line.split(/\s+-\s+|\s{2,}/)[0]!.replace(/(\d{1,2})-(\d{1,2})-(\d{4}).*/, "").trim();
      break;
    }
  }
  if (!startDate) {
    startDate = today;
    endDate = today;
  }
  const teams = new Map<string, ParsedTeam>(), athletes = new Map<string, ParsedAthlete>(), results: ParsedResult[] = [];
  let event: ReturnType<typeof parseEventHeader> = null, skipped = 0, relays = 0;
  const courses = new Set<string>();
  for (const rawLine of lines) {
    const line = rawLine.replace(/(\d),(\d{1,2})(?!\d)/g, "$1.$2");
    const header = parseEventHeader(line);
    if (header) { event = header; if (header.relay) relays++; else if (header.course) courses.add(header.course); continue; }
    if (!event || event.relay) continue;
    if (SPLIT_LINE.test(line) && results.length && results[results.length - 1]!.distance === event.distance) {
      const last = results[results.length - 1]!;
      const cum = [...line.replace(/\([^)]*\)/g, " ").matchAll(new RegExp(TIME, "g"))].map((t) => parseTime(t[0])).filter((v): v is number => v != null);
      for (const ms of cum) last.splits.push({ distance: 0, cumulative_ms: ms });
      continue;
    }
    let placeRaw: string | undefined;
    let last: string | undefined;
    let first: string | undefined;
    let age: string | undefined;
    let teamRaw: string | undefined;
    let seedRaw: string | undefined;
    let finalRaw: string | undefined;

    const m = line.match(RESULT_LINE);
    if (m) {
      [, placeRaw, last, first, age, teamRaw, seedRaw, finalRaw] = m;
    } else {
      const m2 = line.match(RESULT_LINE_NO_COMMA);
      if (m2) {
        let nameRaw: string;
        [, placeRaw, nameRaw, age, teamRaw, seedRaw, finalRaw] = m2;
        const splitted = splitFullName(nameRaw);
        last = splitted.last;
        first = splitted.first;
      } else {
        const m3 = line.match(RESULT_LINE_NO_AGE);
        if (m3) {
          [, placeRaw, last, first, teamRaw, seedRaw, finalRaw] = m3;
        } else {
          const fallback = parseLineFallback(line);
          if (fallback) {
            ({ placeRaw, last, first, age, teamRaw, seedRaw, finalRaw } = fallback);
          } else {
            if (/^\s*\d{1,3}\s+\S+/.test(line)) skipped++;
            continue;
          }
        }
      }
    }
    const normClub = normalizeTeamCode(teamRaw!.trim(), teamRaw!.trim());
    const code = normClub.code;
    const teamName = normClub.name;
    teams.set(code, { code, name: teamName });
    const key = `pdf:${last!.trim().toLowerCase()}|${first!.trim().toLowerCase()}|${code}`;

    // Cálculo de fecha de nacimiento estimada a partir de la edad y año del torneo
    const meetYear = startDate ? Number(startDate.slice(0, 4)) : new Date().getFullYear();
    let numAge = /^\d{1,2}$/.test(age?.trim() || "") ? Number(age.trim()) : null;
    if (!numAge) {
      if (event.minAge && event.maxAge) {
        // En categorías por rango (ej. 10-11, 12-13, 14-15), tomar la edad de la prueba para que coincida en el ranking
        numAge = event.minAge;
      } else if (event.minAge) {
        numAge = event.minAge;
      } else if (event.maxAge) {
        numAge = event.maxAge;
      }
    }
    const estimatedBirthDate = numAge ? `${meetYear - numAge}-01-01` : `${meetYear - 14}-01-01`;

    const existingAth = athletes.get(key);
    if (!existingAth) {
      athletes.set(key, {
        key,
        tmId: null,
        federationId: null,
        firstName: first!.trim(),
        lastName: last!.trim(),
        birthDate: estimatedBirthDate,
        gender: event.gender === "X" ? null : event.gender,
        teamCode: code,
      });
    } else {
      if ((!existingAth.birthDate || existingAth.birthDate.endsWith("-01-01")) && numAge) {
        existingAth.birthDate = `${meetYear - numAge}-01-01`;
      }
      if (!existingAth.gender && event.gender && event.gender !== "X") {
        existingAth.gender = event.gender;
      }
    }
    const dq = /^(DQ|DSQ|DES|DESC|DFS|DNF)$/i.test(finalRaw!);
    const noSwim = /^(NS|SCR|NP|BAJ|BAJA|FOR|RET)$/i.test(finalRaw!);
    const placeNum = placeRaw ? parseInt(placeRaw.replace(/[^\d]/g, ""), 10) || null : null;
    results.push({
      athleteKey: key,
      eventNumber: event.number,
      distance: event.distance,
      stroke: event.stroke,
      gender: event.gender,
      minAge: event.minAge,
      maxAge: event.maxAge,
      seedMs: seedRaw && seedRaw !== "NT" ? parseTime(seedRaw) : null,
      finalMs: dq || noSwim ? null : parseTime(finalRaw),
      course: event.course ?? defaultCourse,
      place: placeNum,
      isDq: dq,
      round: "F",
      splits: [],
    });
  }
  for (const r of results) {
    const n = r.splits.length;
    // Keep splits only when they divide the race evenly and end on the final time; distances follow from the count.
    if (!n || r.distance % n !== 0 || (r.finalMs != null && r.splits[n - 1]!.cumulative_ms !== r.finalMs)) { r.splits = []; continue; }
    r.splits = r.splits.map((sp, i) => ({ distance: (r.distance / n) * (i + 1), cumulative_ms: sp.cumulative_ms }));
  }
  if (skipped) warnings.push(`${skipped} líneas parecían resultados pero no se pudieron leer; revisa el PDF original.`);
  if (relays) warnings.push(`${relays} pruebas de relevo omitidas.`);
  if (!results.length) warnings.push("No se reconoció el formato de resultados de Meet Manager en este PDF.");
  warnings.push("Los PDF no incluyen fecha de nacimiento: revisa posibles atletas repetidos.");
  return { format: "PDF", meet: { name: meetName || fallbackName || "Torneo de Natación", location: null, startDate, endDate: endDate || startDate, course: courses.size === 1 ? [...courses][0]! : (defaultCourse || "LCM") }, teams: [...teams.values()], athletes: [...athletes.values()], results, warnings };
}

export interface AiSwim {
  first_name: string; last_name: string; birth_date: string | null; gender: string | null; team: string | null;
  event_number: string | null; distance: number; stroke: number; course: string | null;
  seed_time: string | null; final_time: string | null; place: number | null; is_dq: boolean;
  splits: { distance: number; cumulative_time: string }[];
}
export interface AiResults { meet: { name: string; location: string | null; start_date: string | null; end_date: string | null; course: string | null }; swims: AiSwim[] }

const iso = (v: string | null) => { const m = v?.match(/^(\d{4})-(\d{2})-(\d{2})$/); return m ? isoFromMdy(m[2]!, m[3]!, m[1]!) : null; };
const courseOf = (v: string | null | undefined) => (v === "LCM" || v === "SCM" || v === "SCY" ? v : null);

/** Validates AI output strictly: swims without a valid distance, stroke or name are dropped and counted. */
export function aiResultsToParsed(ai: AiResults, fallbackName: string, defaultCourse = "LCM"): ParsedFile {
  const teams = new Map<string, ParsedTeam>(), athletes = new Map<string, ParsedAthlete>(), results: ParsedResult[] = [];
  let dropped = 0;
  const meetCourse = courseOf(ai.meet.course) ?? defaultCourse;
  for (const s of ai.swims) {
    const first = s.first_name?.trim(), last = s.last_name?.trim();
    if (!first || !last || ![25, 50, 100, 200, 400, 800, 1500, 1650].includes(s.distance) || ![1, 2, 3, 4, 5].includes(s.stroke)) { dropped++; continue; }
    const code = s.team?.trim() ? s.team.trim().toUpperCase().slice(0, 16) : null;
    if (code) teams.set(code, { code, name: s.team!.trim() });
    const birth = iso(s.birth_date);
    const key = `pdf:${last.toLowerCase()}|${first.toLowerCase()}|${birth ?? code ?? ""}`;
    const gender = s.gender === "F" || s.gender === "M" ? s.gender : null;
    if (!athletes.has(key)) athletes.set(key, { key, tmId: null, federationId: null, firstName: first, lastName: last, birthDate: birth, gender, teamCode: code });
    const splits = (s.splits ?? []).map((x) => ({ distance: x.distance, cumulative_ms: parseTime(x.cumulative_time) })).filter((x): x is { distance: number; cumulative_ms: number } => x.cumulative_ms != null && x.distance > 0 && x.distance <= s.distance);
    results.push({ athleteKey: key, eventNumber: s.event_number, distance: s.distance, stroke: s.stroke, gender, minAge: null, maxAge: null, seedMs: parseTime(s.seed_time), finalMs: s.is_dq ? null : parseTime(s.final_time), course: courseOf(s.course) ?? meetCourse, place: s.place && s.place > 0 ? s.place : null, isDq: !!s.is_dq, round: "F", splits });
  }
  const warnings = ["Datos leídos con inteligencia artificial: revisa el resumen antes de importar."];
  if (dropped) warnings.push(`${dropped} nados descartados por datos incompletos.`);
  if (!results.length) warnings.push("No se encontraron resultados individuales en este PDF.");
  return { format: "PDF", meet: { name: ai.meet.name?.trim() || fallbackName, location: ai.meet.location, startDate: iso(ai.meet.start_date), endDate: iso(ai.meet.end_date), course: meetCourse }, teams: [...teams.values()], athletes: [...athletes.values()], results, warnings };
}
