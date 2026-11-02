import { type ExportRow } from "@/lib/hytek/sdif";
import { buildMeetManagerEntries } from "@/lib/hytek/meet-manager-entries";
import { coachQuery } from "@/lib/coach-data";
import { exportFilename } from "@/lib/file-delivery";
import { entriesPdf, type ReportRow } from "@/lib/reports";
import { eventLabel, ageAtDec31 } from "@/lib/swim";

type CoachData = Awaited<ReturnType<typeof coachQuery.queryFn & {}>>;
export function prepareEntries(data: CoachData, meetId: string, kind: "sd3" | "pdf") {
  const meet = data.meets.find(m => m.id === meetId);
  if (!meet) throw new Error("Selecciona una competencia.");
  const teams = new Map<string, string>();
  const rows: ExportRow[] = data.entries.filter(e => e.meet_id === meetId).flatMap(e => {
    const athlete = data.athletes.find(a => a.id === e.athlete_id);
    const event = data.events.find(ev => ev.id === e.event_id && ev.meet_id === meetId);
    if (!athlete || !event) return [];
    if (athlete.teams) teams.set(athlete.teams.code, athlete.teams.name);
    return [{ athlete: { ...athlete, team_code: athlete.teams?.code ?? null }, event, seed_time_ms: e.seed_time_ms, final_time_ms: null, is_dq: false, place: null, aqua_points: null, course: meet.course, round: "F", splits: [] }];
  });
  if (!rows.length) throw new Error("No hay inscripciones guardadas para esta competencia.");
  if (kind === "sd3") return new File([buildMeetManagerEntries(meet, rows, [...teams].map(([code, name]) => ({ code, name })))], exportFilename(meet.name, "_inscripciones.sd3"), { type: "application/octet-stream" });
  const report: ReportRow[] = rows.map(r => ({ athlete: `${r.athlete.last_name}, ${r.athlete.first_name}`, club: teams.get(r.athlete.team_code ?? "") ?? "Sin equipo", age: ageAtDec31(r.athlete.birth_date, Number(meet.start_date?.slice(0, 4) ?? new Date().getFullYear())), gender: r.athlete.gender, event: eventLabel(r.event.distance, r.event.stroke), seedMs: r.seed_time_ms, finalMs: null, isDq: false, place: null, points: null }));
  return entriesPdf(meet.name, `${meet.start_date ?? ""} · ${meet.course}`, report);
}