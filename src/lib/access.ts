import { Buffer } from "buffer";
import { courseFromCode } from "./hytek/types";
import type { ParsedFile, ParsedResult } from "./hytek/types";
import { parseTime } from "./swim";

export type AccessRow = Record<string, unknown>;
export interface AccessTable { name: string; columns: string[]; rows: AccessRow[] }
export interface AccessDatabase { name: string; tables: AccessTable[] }
export type AccessTimeUnit = "seconds" | "centiseconds" | "milliseconds";

/** The reader is loaded only after file selection, never during SSR. */
export async function readAccessFile(file: File): Promise<AccessDatabase> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (bytes.length < 4096 || new TextDecoder().decode(bytes.slice(4, 19)) !== "Standard Jet DB" || bytes[20] !== 1) {
    throw new Error("El archivo no es una base Access Jet DB 4.0 válida (.mdb).");
  }
  // mdb-reader's browser implementation uses Buffer internally.
  Object.assign(globalThis, { Buffer });
  if (typeof window !== "undefined") {
    const { default: process } = await import("vite-plugin-node-polyfills/shims/process");
    Object.assign(globalThis, { process, global: globalThis });
  }
  const { default: MDBReader } = await import("mdb-reader");
  try {
    const reader = new MDBReader(Buffer.from(bytes));
    const tables = reader.getTableNames().map((name) => {
      const table = reader.getTable(name);
      return { name, columns: table.getColumnNames(), rows: table.getData() };
    });
    return { name: file.name, tables };
  } catch {
    throw new Error("No se pudo leer Access. Comprueba que no esté dañado; si requiere contraseña, exporta una copia sin protección desde Meet Manager.");
  }
}

const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/gi, "").toLowerCase();
function field(row: AccessRow, ...names: string[]): unknown {
  for (const name of names) {
    const key = Object.keys(row).find((k) => norm(k) === norm(name));
    if (key !== undefined && row[key] != null && row[key] !== "") return row[key];
  }
  return null;
}
const str = (v: unknown): string => v == null ? "" : String(v).trim();
const num = (v: unknown): number | null => v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v);
function date(v: unknown): string | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return `${v.getUTCFullYear()}-${String(v.getUTCMonth() + 1).padStart(2, "0")}-${String(v.getUTCDate()).padStart(2, "0")}`;
  const s = str(v);
  return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : null;
}
function gender(v: unknown): string | null {
  const s = str(v).toUpperCase();
  return ["F", "FEMALE", "FEMENINO"].includes(s) ? "F" : ["M", "MALE", "MASCULINO"].includes(s) ? "M" : null;
}
export function accessTime(row: AccessRow, unit: AccessTimeUnit, msNames: string[], names: string[]): number | null {
  const ms = num(field(row, ...msNames));
  if (ms != null) return ms > 0 ? Math.round(ms) : null;
  const v = field(row, ...names);
  if (typeof v === "string" && /[:.]/.test(v)) return parseTime(v);
  const n = num(v);
  return n != null && n > 0 ? Math.round(n * (unit === "milliseconds" ? 1 : unit === "centiseconds" ? 10 : 1000)) : null;
}

/** Conservative supported-schema mapping. Unknown tables remain available in the original MDB. */
export function normalizeAccess(db: AccessDatabase, unit: AccessTimeUnit, fallbackCourse: string): ParsedFile[] {
  const table = (...names: string[]) => db.tables.find((t) => names.some((n) => norm(t.name) === norm(n)));
  const athletes = table("athletes", "athlete", "atletas", "swimmers");
  if (!athletes) return [];
  const teams = table("teams", "team", "clubes");
  const meets = table("meets", "meet", "competencias");
  const events = table("events", "event", "pruebas");
  const resultTables = [table("results", "result", "resultados"), table("entries", "entry", "inscripciones")].filter((t): t is AccessTable => t !== undefined);
  const splits = table("splits", "split", "parciales");
  const id = (r: AccessRow, ...names: string[]) => str(field(r, ...names, "id"));
  const teamCode = (r: AccessRow) => str(field(r, "code", "team_code", "tcode", "team_abbr"));
  const teamMap = new Map((teams?.rows ?? []).map((r) => [id(r, "team_id", "team_no", "team"), teamCode(r)]));
  const eventMap = new Map((events?.rows ?? []).map((r) => [id(r, "event_id", "event_no"), r]));
  const meetRows = meets?.rows.length ? meets.rows : [{}];
  return meetRows.map((meet, meetIndex) => {
    const meetId = id(meet, "meet_id", "meet_no");
    const courseRaw = str(field(meet, "course", "meet_course"));
    const course = ["LCM", "SCM", "SCY"].includes(courseRaw.toUpperCase()) ? courseRaw.toUpperCase() : courseFromCode(courseRaw, fallbackCourse);
    const p: ParsedFile = {
      format: "MDB", meet: { name: str(field(meet, "name", "meet_name", "mname")) || `${db.name.replace(/\.mdb$/i, "")}${meetRows.length > 1 ? ` ${meetIndex + 1}` : ""}`, location: str(field(meet, "location", "meet_location")) || null, startDate: date(field(meet, "start_date", "startDate", "meet_start")), endDate: date(field(meet, "end_date", "endDate", "meet_end")), course },
      teams: (teams?.rows ?? []).filter((r) => teamCode(r)).map((r) => ({ code: teamCode(r), name: str(field(r, "name", "team_name", "tname")) || teamCode(r) })),
      athletes: [], results: [], warnings: [],
    };
    const keys = new Map<string, string>();
    for (const [i, a] of athletes.rows.entries()) {
      const firstName = str(field(a, "first_name", "first", "fname", "nombre"));
      const lastName = str(field(a, "last_name", "last", "lname", "apellido"));
      if (!firstName || !lastName) continue;
      const localId = id(a, "athlete_id", "athlete_no", "athlete", "ath_no") || `row-${i}`;
      const code = str(field(a, "team_code", "tcode")) || teamMap.get(str(field(a, "team_id", "team_no", "team"))) || null;
      const key = `MDB:${localId}`;
      keys.set(localId, key);
      p.athletes.push({ key, tmId: str(field(a, "tm_athlete_id")) || null, federationId: str(field(a, "federation_id", "reg_no", "registration_id")) || null, firstName, lastName, birthDate: date(field(a, "birth_date", "birth", "dob")), gender: gender(field(a, "gender", "sex")), teamCode: code });
    }
    let skipped = 0;
    for (const source of resultTables) for (const r of source.rows) {
      const event = eventMap.get(str(field(r, "event_id", "event_no"))) ?? r;
      const rowMeet = str(field(r, "meet_id", "meet_no")) || str(field(event, "meet_id", "meet_no"));
      if (meetRows.length > 1 && rowMeet !== meetId) { if (!rowMeet) skipped++; continue; }
      const athleteKey = keys.get(str(field(r, "athlete_id", "athlete_no", "athlete", "ath_no")));
      const distance = num(field(event, "distance", "event_dist", "dist"));
      const stroke = num(field(event, "stroke", "event_stroke"));
      if (!athleteKey || !distance || !stroke || stroke < 1 || stroke > 5) { skipped++; continue; }
      const roundRaw = str(field(r, "round")).toUpperCase();
      const result: ParsedResult = { athleteKey, distance, stroke, eventNumber: str(field(event, "event_number", "event_no")) || null, gender: gender(field(event, "gender", "sex", "event_sex")), minAge: num(field(event, "min_age", "low_age")), maxAge: num(field(event, "max_age", "high_age")), seedMs: accessTime(r, unit, ["seed_time_ms"], ["seed_time", "seed"]), finalMs: accessTime(r, unit, ["final_time_ms"], ["final_time", "time", "result_time"]), course: str(field(r, "course")) ? courseFromCode(str(field(r, "course")), course) : course, place: num(field(r, "place", "rank")), isDq: ["true", "1", "dq", "-1"].includes(str(field(r, "is_dq", "dq")).toLowerCase()), round: roundRaw === "P" || roundRaw === "S" ? roundRaw : "F", splits: [] };
      const resultId = id(r, "result_id");
      if (resultId) for (const s of splits?.rows ?? []) {
        if (str(field(s, "result_id")) !== resultId) continue;
        const d = num(field(s, "split_distance", "distance"));
        const ms = accessTime(s, unit, ["cumulative_time_ms"], ["cumulative_time", "time"]);
        if (d && ms) result.splits.push({ distance: d, cumulative_ms: ms });
      }
      result.splits.sort((a, b) => a.distance - b.distance);
      p.results.push(result);
    }
    if (p.athletes.length !== athletes.rows.length) p.warnings.push(`${athletes.rows.length - p.athletes.length} atletas sin nombre completo no se importarán.`);
    if (skipped) p.warnings.push(`${skipped} nados sin relación reconocida, distancia o estilo válido no se importarán (incluye relevos).`);
    const recognized = new Set([athletes, teams, meets, events, splits, ...resultTables].filter(Boolean));
    const extra = db.tables.filter((t) => !recognized.has(t));
    if (extra.length) p.warnings.push(`Tablas fuera de esta importación: ${extra.map((t) => t.name).join(", ")}.`);
    if (!courseRaw) p.warnings.push(`Piscina no indicada: se usará ${fallbackCourse}.`);
    return p;
  });
}