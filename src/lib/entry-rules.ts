import { ageAtDec31, ageGroup } from "@/lib/swim";
import { rankedAthleteRecords } from "@/lib/athlete-records";
import type { DashboardResult, DashboardStandard } from "@/lib/dashboard-summary";
import { standardApplies } from "@/lib/standard-rules";

export function entrySeed(results: DashboardResult[], athleteId: string, distance: number, stroke: number, course: string, meetDate: string | null, now = new Date()) {
  return rankedAthleteRecords(results, now).find(r => r.athlete_id === athleteId && r.events?.distance === distance && r.events.stroke === stroke && !r.events.is_relay && r.course === course && (!meetDate || (r.meets?.start_date ?? "") < meetDate))?.final_time_ms ?? null;
}

export function entryMinimum(standards: DashboardStandard[], athlete: { birth_date: string | null; gender: string | null }, event: { distance: number; stroke: number }, course: string, meetDate: string | null, seed: number | null) {
  const year = Number(meetDate?.slice(0, 4) ?? new Date().getFullYear());
  const applicable = standards.filter(s => s.distance === event.distance && s.stroke === event.stroke && s.course === course && (!s.gender || s.gender === athlete.gender) && standardApplies(s, athlete.birth_date, year));
  const limit = applicable.length ? Math.min(...applicable.map(s => s.qualifying_time_ms)) : null;
  return { limit, status: limit == null ? "unconfigured" : seed == null ? "no-time" : seed <= limit ? "met" : "not-met" } as const;
}

export function internalRanking(results: DashboardResult[], now = new Date()) {
  const best = new Map<string, DashboardResult>();
  for (const r of rankedAthleteRecords(results, now)) {
    if (!r.events || r.events.is_relay || !r.athletes || !r.course) continue;
    const category = ageGroup(ageAtDec31(r.athletes.birth_date, now.getFullYear()));
    const key = `${r.athlete_id}-${r.events.distance}-${r.events.stroke}-${r.course}-${r.athletes.gender}-${category}`;
    if (!best.has(key)) best.set(key, r);
  }
  const groups = new Map<string, DashboardResult[]>();
  for (const r of best.values()) {
    const category = ageGroup(ageAtDec31(r.athletes?.birth_date ?? null, now.getFullYear()));
    const key = `${r.events?.stroke}-${r.events?.distance}-${r.course}-${r.athletes?.gender}-${category}`;
    const group = groups.get(key) ?? []; group.push(r); groups.set(key, group);
  }
  return [...groups].sort(([a], [b]) => a.localeCompare(b)).flatMap(([, group]) => {
    const sorted = group.sort((a, b) => (a.final_time_ms ?? Infinity) - (b.final_time_ms ?? Infinity));
    return sorted.map((r, index) => ({ ...r, rank: sorted.findIndex(other => other.final_time_ms === r.final_time_ms) + 1, category: ageGroup(ageAtDec31(r.athletes?.birth_date ?? null, now.getFullYear())) }));
  });
}

/** One athlete, one best stored AQUA score; repeated swims cannot inflate rank. */
export function aquaRanking<T extends DashboardResult & { aqua_points: number | null }>(results: T[], now = new Date()) {
  const best = new Map<string, T>();
  for (const r of rankedAthleteRecords(results, now)) {
    if (!r.athletes || !r.events || r.events.is_relay || r.events.stroke < 1 || r.events.stroke > 5 || !r.course || r.aqua_points == null || !Number.isFinite(r.aqua_points) || r.aqua_points <= 0) continue;
    const previous = best.get(r.athlete_id);
    if (!previous || (r.aqua_points ?? 0) > (previous.aqua_points ?? 0)) best.set(r.athlete_id, r);
  }
  const sorted = [...best.values()].sort((a, b) => (b.aqua_points ?? 0) - (a.aqua_points ?? 0) || `${a.athletes?.last_name} ${a.athletes?.first_name}`.localeCompare(`${b.athletes?.last_name} ${b.athletes?.first_name}`) || a.athlete_id.localeCompare(b.athlete_id));
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || r.aqua_points !== sorted[i - 1]?.aqua_points) rank = i + 1;
    return { ...r, rank };
  });
}