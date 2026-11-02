import { rankedAthleteRecords } from "@/lib/athlete-records";
import { ageAtDec31, ageGroup } from "@/lib/swim";

export interface DashboardResult {
  id: string;
  athlete_id: string;
  final_time_ms: number | null;
  is_dq: boolean;
  course: string | null;
  meets: { id: string; name: string; start_date: string | null } | null;
  events: { distance: number; stroke: number; is_relay: boolean } | null;
  athletes: { first_name: string; last_name: string; gender: string | null; birth_date: string | null } | null;
}

export interface DashboardStandard {
  id: string;
  course: string;
  distance: number;
  stroke: number;
  gender: string | null;
  age_group: string | null;
  qualifying_time_ms: number;
}

/** One best mark per athlete/event/course; counts qualifying marks, not repeated swims. */
export function dashboardSummary(results: DashboardResult[], standards: DashboardStandard[], now = new Date()) {
  const recent = rankedAthleteRecords(results, now).filter(r => r.athletes && r.events && !r.events.is_relay && r.events.stroke >= 1 && r.events.stroke <= 5);
  const best = new Map<string, DashboardResult>();
  for (const r of recent) {
    if (!r.events || !r.course) continue;
    const key = `${r.athlete_id}-${r.events.distance}-${r.events.stroke}-${r.course}`;
    if (!best.has(key)) best.set(key, r);
  }
  const qualified = new Set<string>();
  for (const [key, r] of best) {
    if (!r.events || !r.athletes || r.final_time_ms == null || !r.meets?.start_date) continue;
    const category = ageGroup(ageAtDec31(r.athletes.birth_date, Number(r.meets.start_date.slice(0, 4))));
    if (standards.some(s => s.distance === r.events?.distance && s.stroke === r.events.stroke && s.course === r.course && (!s.gender || s.gender === r.athletes?.gender) && (!s.age_group || (category !== "—" && s.age_group === category)) && s.qualifying_time_ms > 0 && (r.final_time_ms ?? Infinity) <= s.qualifying_time_ms)) qualified.add(key);
  }
  const months = Array.from({ length: 10 }, (_, index) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 9 + index, 1));
    return { month: date.toISOString().slice(0, 7), label: date.toLocaleDateString("es", { month: "short", timeZone: "UTC" }), swims: 0, bests: 0 };
  });
  for (const r of recent) {
    const month = months.find(m => m.month === r.meets?.start_date?.slice(0, 7));
    if (month) month.swims++;
  }
  for (const r of best.values()) {
    const month = months.find(m => m.month === r.meets?.start_date?.slice(0, 7));
    if (month) month.bests++;
  }
  return { recent, bestCount: best.size, qualifiedCount: qualified.size, months, latest: [...recent].sort((a, b) => (b.meets?.start_date ?? "").localeCompare(a.meets?.start_date ?? "") || a.id.localeCompare(b.id)).slice(0, 6) };
}