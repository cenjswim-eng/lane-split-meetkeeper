import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { loadStandardVersions } from "./standard-version-data";

export const coachQuery = queryOptions({ queryKey: ["coach-data"], queryFn: async () => {
  const [athletes, meets, events, standards, entries, clubs, teams] = await Promise.all([
    supabase.from("athletes").select("*, teams(id, code, name, lsc), clubs(id, team_code, full_name, name, region_lsc, region, is_unattached)").order("last_name"),
    supabase.from("meets").select("*").order("start_date", { ascending: false }),
    supabase.from("events").select("*").eq("is_relay", false).order("distance"),
    loadStandardVersions(),
    supabase.from("meet_entries").select("*"),
    supabase.from("clubs").select("*").order("name"),
    supabase.from("teams").select("*").order("name"),
  ]);
  for (const response of [athletes, meets, events, standards, entries]) if (response.error) throw response.error;
  const results = [];
  for (let offset = 0; ; offset += 1000) {
    const page = await supabase.from("results").select("id, athlete_id, origin_team, scoring_club_id, seed_time_ms, final_time_ms, is_dq, course, round, place, aqua_points, points_scored, meets(id, name, start_date), events(distance, stroke, is_relay), athletes(first_name, last_name, gender, birth_date, club_id, team_id), splits(split_distance, cumulative_time_ms, lap_time_ms)").order("id").range(offset, offset + 999);
    if (page.error) throw page.error;
    results.push(...page.data);
    if (page.data.length < 1000) break;
  }
  return {
    athletes: athletes.data ?? [],
    meets: meets.data ?? [],
    events: events.data ?? [],
    standards: standards.data,
    versions: standards.versions,
    activeVersion: standards.activeVersion,
    entries: entries.data ?? [],
    clubs: clubs.data ?? [],
    teams: teams.data ?? [],
    results,
  };
} });