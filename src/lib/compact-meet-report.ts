import { athleteMinimum } from "./athlete-minimum";
import { STROKES } from "./swim";
import type { QualificationStandard } from "./standard-rules";
import { compactTime, formatTimeDiff, timeDiffMs } from "@/utils/timeDiffUtils";

export type TargetMode = "pb" | "national" | "tournament" | "manual";
export interface CompactResult {
  id: string; athlete_id: string; meet_id: string; event_id: string | null;
  final_time_ms: number | null; is_dq: boolean; status: string; course: string | null;
  events: { distance: number; stroke: number; is_relay: boolean } | null;
  meets: { id: string; name: string; start_date: string | null } | null;
}
export interface CompactAthlete { id: string; first_name: string; last_name: string; birth_date: string | null; gender: string | null; club_id: string | null }
export interface CompactEvent { id: string; course: string | null; qualifying_times_ms: unknown; gender: string | null; min_age: number | null; max_age: number | null }
export interface CompactRow {
  id: string; athleteId: string; athlete: string; event: string; meet: string; date: string | null;
  dateEstimated: boolean; course: string | null; officialMs: number | null; status: string;
  pbMs: number | null; previousPbMs: number | null; pbDiffMs: number | null;
  targetMs: number | null; targetDiffMs: number | null; newPb: boolean;
}
export interface RowEdit { targetMs?: number | null; date?: string }
export const compactHeaders = ["Prueba", "Competencia", "Fecha", "Tiempo oficial", "PB histórico", "Diff PB", "Estado de marca"];
export const courseLabel = (course: string | null) => course === "LCM" ? "50m" : course === "SCM" ? "25m" : course === "SCY" ? "25yd" : "—";
export function compactDate(date: string | null) { return date ? date.slice(0,10).split("-").reverse().join("/") : "—"; }
const valid = (r: CompactResult) => !r.is_dq && ["OK", "OFFICIAL", ""].includes(r.status) && r.final_time_ms != null && r.final_time_ms > 0;
const sameEvent = (a: CompactResult, b: CompactResult) => a.athlete_id === b.athlete_id && !!a.events && !!b.events && !b.events.is_relay && a.events.distance === b.events.distance && a.events.stroke === b.events.stroke && a.course === b.course;

/** No guessing course, sex or age keys in imported event minima. */
export function tournamentTarget(event: CompactEvent | undefined, result: CompactResult, athlete: CompactAthlete): number | null {
  if (!event || event.course !== result.course || (event.gender && event.gender !== athlete.gender)) return null;
  const year = Number(result.meets?.start_date?.slice(0,4));
  const age = athlete.birth_date ? year - Number(athlete.birth_date.slice(0,4)) : null;
  if ((event.min_age != null || event.max_age != null) && (age == null || !Number.isFinite(age) || (event.min_age != null && age < event.min_age) || (event.max_age != null && age > event.max_age))) return null;
  const values = event.qualifying_times_ms;
  if (!values || typeof values !== "object" || Array.isArray(values)) return null;
  const key = result.course === "LCM" ? "L" : result.course === "SCM" ? "S" : result.course === "SCY" ? "Y" : "";
  const value = (values as Record<string, unknown>)[key];
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

export function compactReportRows(results: CompactResult[], athletes: CompactAthlete[], selectedMeets: string[], mode: TargetMode, standards: readonly QualificationStandard[], events: CompactEvent[], edits: Record<string, RowEdit> = {}, athleteId = "", clubId = "") {
  const byAthlete = new Map(athletes.map(a => [a.id, a]));
  const byEvent = new Map(events.map(e => [e.id, e]));
  return results.filter(r => selectedMeets.includes(r.meet_id) && (!athleteId || r.athlete_id === athleteId) && r.events && !r.events.is_relay).flatMap(r => {
    const athlete = byAthlete.get(r.athlete_id);
    if (!athlete || (clubId && athlete.club_id !== clubId) || !r.events) return [];
    const date = edits[r.id]?.date || r.meets?.start_date || null;
    // Strictly earlier dates: same-day ordering is unknown; never compare against future swims.
    const history = results.filter(h => sameEvent(r,h) && valid(h));
    const previous = history.filter(h => (edits[h.id]?.date || h.meets?.start_date || "") && date && (edits[h.id]?.date || h.meets?.start_date || "") < date);
    const best = (list: CompactResult[]) => list.reduce<number | null>((min,h) => h.final_time_ms == null ? min : min == null ? h.final_time_ms : Math.min(min,h.final_time_ms), null);
    const previousPbMs = best(previous), pbMs = best(history), officialMs = valid(r) ? r.final_time_ms : null;
    const pbDiffMs = officialMs != null && previousPbMs != null ? timeDiffMs(officialMs,previousPbMs) : null;
    const standardResult = { ...r, meets: { start_date: date } };
    let targetMs = mode === "pb" ? previousPbMs : mode === "national" ? athleteMinimum(athlete,standardResult,standards)?.limit_ms ?? null : mode === "tournament" ? tournamentTarget(byEvent.get(r.event_id ?? ""),standardResult,athlete) : null;
    if (edits[r.id]?.targetMs !== undefined) targetMs = edits[r.id]?.targetMs ?? null;
    return [{id:r.id,athleteId:athlete.id,athlete:`${athlete.last_name}, ${athlete.first_name}`,event:`${r.events.distance}m ${STROKES[r.events.stroke] ?? r.events.stroke}`,meet:r.meets?.name ?? "Sin competencia",date,dateEstimated:!edits[r.id]?.date,course:r.course,officialMs,status:r.is_dq?"DQ":r.status || "NT",pbMs,previousPbMs,pbDiffMs,targetMs,targetDiffMs:officialMs != null && targetMs != null ? timeDiffMs(officialMs,targetMs):null,newPb:pbDiffMs != null && pbDiffMs < 0} satisfies CompactRow];
  }).sort((a,b) => a.athlete.localeCompare(b.athlete) || (a.date ?? "").localeCompare(b.date ?? "") || a.event.localeCompare(b.event));
}
export function compactKpis(rows: CompactRow[]) {
  const swum = rows.filter(r => !["NS","SCR","NT"].includes(r.status));
  const pbs = swum.filter(r => r.newPb).length;
  return { swims:swum.length,pbs,pbPercent:swum.length ? Math.round(pbs * 100 / swum.length):0,targets:swum.filter(r=>r.targetDiffMs != null && r.targetDiffMs <= 0).length,savedMs:swum.reduce((sum,r)=>sum+(r.pbDiffMs != null && r.pbDiffMs<0 ? -r.pbDiffMs:0),0) };
}
export function pbLabel(row: CompactRow) { return row.pbDiffMs == null ? "—" : `${formatTimeDiff(row.pbDiffMs)}s${row.newPb ? " (Nuevo PB)" : ""}`; }
export function targetLabel(row: CompactRow) {
  if (row.targetMs == null) return "N/A";
  const status = row.targetDiffMs == null ? "Sin tiempo válido" : row.targetDiffMs <= 0 ? `LOGRADA (${formatTimeDiff(row.targetDiffMs)}s)` : `Faltó ${formatTimeDiff(row.targetDiffMs)}s`;
  return `${compactTime(row.targetMs)} · ${status}`;
}
export function compactCells(row: CompactRow): string[] { return [row.event,`${row.meet} · ${courseLabel(row.course)}`,`${compactDate(row.date)}${row.dateEstimated ? " *" : ""}`,row.officialMs == null ? row.status : compactTime(row.officialMs),compactTime(row.pbMs),pbLabel(row),targetLabel(row)]; }