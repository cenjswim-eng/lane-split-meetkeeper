import { standardApplies, type QualificationStandard } from "./standard-rules";

/** Matches the same season/category/event/course as the athlete profile. */
export function athleteMinimum(
  athlete: { birth_date: string | null; gender?: string | null },
  result: { final_time_ms: number | null; is_dq: boolean; course: string | null; events: { distance: number; stroke: number; is_relay?: boolean } | null; meets: { start_date: string | null } | null },
  standards: readonly QualificationStandard[],
) {
  if (!result.events || result.events.is_relay || !result.course) return null;
  const year = Number(result.meets?.start_date?.slice(0, 4));
  if (!Number.isInteger(year) || year < 1900) return null;
  const event = result.events;
  const standard = standards.filter(s =>
    s.distance === event.distance && s.stroke === event.stroke && s.course === result.course &&
    (!s.gender || s.gender === athlete.gender) && standardApplies(s, athlete.birth_date, year),
  ).sort((a, b) => Number(b.season_year != null) - Number(a.season_year != null) || a.qualifying_time_ms - b.qualifying_time_ms)[0];
  if (!standard) return null;
  const valid = !result.is_dq && result.final_time_ms != null && result.final_time_ms > 0;
  return {
    limit_ms: standard.qualifying_time_ms,
    remaining_ms: valid && result.final_time_ms != null ? Math.max(0, result.final_time_ms - standard.qualifying_time_ms) : null,
  };
}