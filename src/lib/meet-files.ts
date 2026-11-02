import { supabase } from "@/integrations/supabase/client";
import { buildSd3, type ExportRow } from "@/lib/hytek/sdif";
import { entriesPdf, resultsPdf, type ReportRow } from "@/lib/reports";
import { ageAtDec31, eventLabel } from "@/lib/swim";
import { exportFilename } from "@/lib/file-delivery";

export async function exportMeet(meet: { id: string; name: string; location: string | null; start_date: string | null; end_date: string | null; course: string }) {
  const { data, error } = await supabase
    .from("results")
    .select("seed_time_ms, final_time_ms, is_dq, place, aqua_points, course, round, athletes(first_name, last_name, federation_id, birth_date, gender, teams(code, name)), events(event_number, distance, stroke, gender, min_age, max_age), splits(split_distance, cumulative_time_ms)")
    .eq("meet_id", meet.id);
  if (error) throw error;
  const teams = new Map<string, string>();
  const rows: ExportRow[] = data
    .flatMap((r) => {
      if (!r.athletes || !r.events) return [];
      const t = r.athletes.teams;
      if (t) teams.set(t.code, t.name);
      return [{ ...r, athlete: { ...r.athletes, team_code: t?.code ?? null }, event: r.events }];
    });
  const text = buildSd3(meet, rows, [...teams].map(([code, name]) => ({ code, name })));
  return new File([text], exportFilename(meet.name, ".sd3"), { type: "application/octet-stream" });
}

export async function reportRows(meetId: string): Promise<ReportRow[]> {
  const { data, error } = await supabase
    .from("results")
    .select("seed_time_ms, final_time_ms, is_dq, place, aqua_points, athletes(first_name, last_name, birth_date, gender, teams(name)), events(distance, stroke)")
    .eq("meet_id", meetId);
  if (error) throw error;
  const year = new Date().getFullYear();
  return data
    .flatMap((r): ReportRow[] => {
      if (!r.athletes || !r.events) return [];
      return [{
      athlete: `${r.athletes.last_name}, ${r.athletes.first_name}`,
      club: r.athletes.teams?.name ?? "—",
      gender: r.athletes.gender,
      age: ageAtDec31(r.athletes.birth_date, year),
      event: eventLabel(r.events.distance, r.events.stroke),
      seedMs: r.seed_time_ms,
      finalMs: r.final_time_ms,
      isDq: r.is_dq,
      place: r.place,
      points: r.aqua_points,
    }]; })
    .sort((a, b) => a.event.localeCompare(b.event) || (a.place ?? 99) - (b.place ?? 99));
}

export async function exportPdf(meet: { id: string; name: string; location: string | null; start_date: string | null; course: string }, kind: "results" | "entries") {
  const rows = await reportRows(meet.id);
  const meta = `${meet.location ?? ""} · ${meet.start_date ?? ""} · ${meet.course}`;
  return kind === "results" ? resultsPdf(meet.name, meta, rows) : entriesPdf(meet.name, meta, rows);
}

