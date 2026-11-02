import { ageAtDec31, ageGroup } from "@/lib/swim";
import { rankedAthleteRecords } from "@/lib/athlete-records";
import type { DashboardResult, DashboardStandard } from "@/lib/dashboard-summary";

export function entrySeed(results: DashboardResult[], athleteId: string, distance: number, stroke: number, course: string, meetDate: string | null, now = new Date()) {
  return rankedAthleteRecords(results, now).find(r => r.athlete_id === athleteId && r.events?.distance === distance && r.events.stroke === stroke && !r.events.is_relay && r.course === course && (!meetDate || (r.meets?.start_date ?? "") < meetDate))?.final_time_ms ?? null;
}

export function entryMinimum(standards: DashboardStandard[], athlete: { birth_date: string | null; gender: string | null }, event: { distance: number; stroke: number }, course: string, meetDate: string | null, seed: number | null) {
  const category = ageGroup(ageAtDec31(athlete.birth_date, Number(meetDate?.slice(0, 4) ?? new Date().getFullYear())));
  const applicable = standards.filter(s => s.distance === event.distance && s.stroke === event.stroke && s.course === course && (!s.gender || s.gender === athlete.gender) && (!s.age_group || (category !== "—" && s.age_group === category)));
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