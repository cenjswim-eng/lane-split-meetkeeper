import type { ParsedAthlete, ParsedFile, ParsedResult, ParsedTeam } from "@/lib/hytek/types";
import { parseTime } from "@/lib/swim";

/** Pure readers that turn PDF results (Meet Manager text or AI-extracted JSON) into the shared ParsedFile shape. */

const STROKE_WORDS: [RegExp, number][] = [
  [/individual medley|\bIM\b|combinado|medley/i, 5],
  [/freestyle|\bfree\b|libre/i, 1],
  [/backstroke|\bback\b|espalda/i, 2],
  [/breaststroke|\bbreast\b|pecho/i, 3],
  [/butterfly|\bfly\b|mariposa/i, 4],
];
const TIME = String.raw`(?:\d{1,2}:)?\d{1,2}\.\d{2}`;
const RESULT_LINE = new RegExp(String.raw`^\s*(\d{1,3}|-{1,3}|\*\d{1,3})?\s+([^,\d]+?),\s*([^\d]+?)\s+(\d{1,2})\s+(.+?)\s+(${TIME}|NT)?\s*(${TIME}|DQ|NS|SCR|DFS|DNF)\s*[A-Za-z]{0,2}\s*(?:\d+)?\s*$`);

function isoFromMdy(m: string, d: string, y: string) {
  const dt = new Date(Date.UTC(+y, +m - 1, +d));
  return dt.getUTCMonth() === +m - 1 && dt.getUTCDate() === +d ? `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}` : null;
}

export function parseEventHeader(line: string) {
  const m = line.match(/^\s*(?:#\s*)?(?:event|evento|prueba)\s+(\d+[A-Z]?)\s+(.*)$/i);
  if (!m) return null;
  const rest = m[2]!;
  if (/relay|relevo/i.test(rest)) return { relay: true as const };
  const dist = rest.match(/\b(25|50|100|200|400|800|1500|1650)\b/);
  const stroke = STROKE_WORDS.find(([re]) => re.test(rest))?.[1];
  if (!dist || !stroke) return null;
  const gender = /girls|women|female|mujeres|damas|femenino|niñas/i.test(rest) ? "F" : /boys|\bmen\b|male|hombres|varones|masculino|niños/i.test(rest) ? "M" : /mixed|mixto/i.test(rest) ? "X" : null;
  let minAge: number | null = null, maxAge: number | null = null;
  const range = rest.match(/\b(\d{1,2})\s*-\s*(\d{1,2})\b/);
  const over = rest.match(/\b(\d{1,2})\s*(?:&|y|and)\s*(?:over|mayores|más)/i);
  const under = rest.match(/\b(\d{1,2})\s*(?:&|y|and)\s*(?:under|menores)/i);
  if (range) { minAge = +range[1]!; maxAge = +range[2]!; } else if (over) minAge = +over[1]!; else if (under) maxAge = +under[1]!;
  const course = /yard|yarda/i.test(rest) ? "SCY" : /\bSC\b|short course|piscina corta|25\s*m/i.test(rest) ? "SCM" : /\bLC\b|long course|piscina larga|50\s*m/i.test(rest) ? "LCM" : null;
  return { relay: false as const, number: m[1]!, distance: +dist[1]!, stroke, gender, minAge, maxAge, course };
}

/** Reads a Meet Manager "Results" report from PDF text lines. Lines it cannot recognise are reported, never guessed. */
export function parseMeetManagerResults(lines: string[], fallbackName: string, defaultCourse = "LCM"): ParsedFile {
  const warnings: string[] = [];
  let meetName = "", startDate: string | null = null, endDate: string | null = null;
  for (const line of lines.slice(0, 12)) {
    const dates = [...line.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)];
    if (dates.length) {
      startDate = isoFromMdy(dates[0]![1]!, dates[0]![2]!, dates[0]![3]!);
      const last = dates[dates.length - 1]!;
      endDate = isoFromMdy(last[1]!, last[2]!, last[3]!);
      meetName = line.split(/\s+-\s+|\s{2,}/)[0]!.replace(/(\d{1,2})\/(\d{1,2})\/(\d{4}).*/, "").trim();
      break;
    }
  }
  const teams = new Map<string, ParsedTeam>(), athletes = new Map<string, ParsedAthlete>(), results: ParsedResult[] = [];
  let event: ReturnType<typeof parseEventHeader> = null, skipped = 0, relays = 0;
  const courses = new Set<string>();
  for (const line of lines) {
    const header = parseEventHeader(line);
    if (header) { event = header; if (header.relay) relays++; else if (header.course) courses.add(header.course); continue; }
    if (!event || event.relay) continue;
    const m = line.match(RESULT_LINE);
    if (!m) { if (/^\s*\d{1,3}\s+\S+,/.test(line)) skipped++; continue; }
    const [, placeRaw, last, first, age, teamRaw, seedRaw, finalRaw] = m;
    const team = teamRaw!.trim().replace(/\s+/g, " ");
    const code = team.toUpperCase().slice(0, 16);
    teams.set(code, { code, name: team });
    const key = `pdf:${last!.trim().toLowerCase()}|${first!.trim().toLowerCase()}|${code}`;
    if (!athletes.has(key)) athletes.set(key, { key, tmId: null, federationId: null, firstName: first!.trim(), lastName: last!.trim(), birthDate: null, gender: event.gender === "X" ? null : event.gender, teamCode: code });
    const dq = /^(DQ|DFS|DNF)$/.test(finalRaw!);
    const noSwim = /^(NS|SCR)$/.test(finalRaw!);
    results.push({ athleteKey: key, eventNumber: event.number, distance: event.distance, stroke: event.stroke, gender: event.gender, minAge: event.minAge, maxAge: event.maxAge, seedMs: seedRaw && seedRaw !== "NT" ? parseTime(seedRaw) : null, finalMs: dq || noSwim ? null : parseTime(finalRaw), course: event.course ?? defaultCourse, place: placeRaw && /^\*?\d+$/.test(placeRaw) ? +placeRaw.replace("*", "") : null, isDq: dq, round: "F", splits: [] });
    void age;
  }
  if (skipped) warnings.push(`${skipped} líneas parecían resultados pero no se pudieron leer; revisa el PDF original.`);
  if (relays) warnings.push(`${relays} pruebas de relevo omitidas.`);
  if (!results.length) warnings.push("No se reconoció el formato de resultados de Meet Manager en este PDF.");
  warnings.push("Los PDF no incluyen fecha de nacimiento: revisa posibles atletas repetidos.");
  return { format: "PDF", meet: { name: meetName || fallbackName, location: null, startDate, endDate, course: courses.size === 1 ? [...courses][0]! : defaultCourse }, teams: [...teams.values()], athletes: [...athletes.values()], results, warnings };
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
