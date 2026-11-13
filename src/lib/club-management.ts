import type { coachQuery } from "./coach-data";

export type ClubCoachData = Awaited<ReturnType<typeof coachQuery.queryFn & {}>>;
export function scopeClubData(data: ClubCoachData, clubId: string, links: { club_id: string; meet_id: string }[]): ClubCoachData {
  const athletes = data.athletes.filter(a => a.club_id === clubId);
  const athleteIds = new Set(athletes.map(a => a.id));
  const meetIds = new Set(links.filter(l => l.club_id === clubId).map(l => l.meet_id));
  return {
    ...data, athletes,
    meets: data.meets.filter(m => meetIds.has(m.id)),
    events: data.events.filter(e => meetIds.has(e.meet_id)),
    entries: data.entries.filter(e => athleteIds.has(e.athlete_id) && meetIds.has(e.meet_id)),
    results: data.results.filter(r => athleteIds.has(r.athlete_id)),
  };
}