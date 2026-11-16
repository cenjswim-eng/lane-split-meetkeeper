import { type ExportRow } from "@/lib/hytek/sdif";
import { buildMeetManagerEntries } from "@/lib/hytek/meet-manager-entries";
import type { coachQuery } from "@/lib/coach-data";
import { exportFilename } from "@/lib/file-delivery";
import { entriesPdf, type ReportRow } from "@/lib/reports";
import { eventLabel, ageAtDec31 } from "@/lib/swim";
import { exportToHy3 } from '@/lib/swim-io/exporters';
import type { ReportBrand } from './report-brand';

type CoachData = Awaited<ReturnType<typeof coachQuery.queryFn & {}>>;
export function prepareEntries(data: CoachData, meetId: string, kind: "sd3" | "hy3" | "pdf", clubId?: string,brand?:ReportBrand) {
  const meet = data.meets.find(m => m.id === meetId);
  if (!meet) throw new Error("Selecciona una competencia.");
  const teams = new Map<string, string>();
  const rows: ExportRow[] = data.entries.filter(e => e.meet_id === meetId && e.status !== 'SCR' && (!clubId || data.athletes.some(a => a.id === e.athlete_id && a.club_id === clubId))).flatMap(e => {
    const athlete = data.athletes.find(a => a.id === e.athlete_id);
    const event = data.events.find(ev => ev.id === e.event_id && ev.meet_id === meetId);
    if (!athlete || !event) throw new Error("Una inscripción no tiene atleta o prueba disponible. Revisa las inscripciones antes de exportar.");
    const code = athlete.is_unattached || athlete.clubs?.is_unattached ? "UN" : athlete.clubs?.team_code ?? athlete.teams?.code ?? null;
    if (code) teams.set(code, athlete.clubs?.full_name ?? athlete.teams?.name ?? code);
    return [{ athlete: { ...athlete, team_code: code }, event, seed_time_ms: e.seed_time_ms, final_time_ms: null, is_dq: false, place: null, aqua_points: null, course: e.seed_course ?? event.course ?? meet.course, round: "F", splits: [] }];
  });
  if (!rows.length) throw new Error("No hay inscripciones guardadas para esta competencia.");
  if (kind === "sd3") return new File([buildMeetManagerEntries(meet, rows, [...teams].map(([code, name]) => ({ code, name })))], exportFilename(meet.name, "_inscripciones.sd3"), { type: "application/octet-stream" });
  if (kind === 'hy3') {
    // Each team has its own C1 block; never relabel athletes from another club.
    const codes = [...new Set(rows.map(r => r.athlete.team_code ?? 'UN'))];
    const clubs = codes.map(code => ({ code, name: teams.get(code) ?? 'Unattached' }));
    const first = clubs[0];
    if (!first) throw new Error('No hay clubes para exportar.');
    return new File([exportToHy3(meet, first, rows.map(r=>({...r,athlete:{...r.athlete,team_code:r.athlete.team_code ?? 'UN'}})), clubs)], exportFilename(meet.name, '_inscripciones.hy3'), { type: 'application/octet-stream' });
  }
  const report: ReportRow[] = rows.map(r => ({ athlete: `${r.athlete.last_name}, ${r.athlete.first_name}`, club: teams.get(r.athlete.team_code ?? "") ?? "Sin equipo", age: ageAtDec31(r.athlete.birth_date, Number(meet.start_date?.slice(0, 4) ?? new Date().getFullYear())), gender: r.athlete.gender, event: eventLabel(r.event.distance, r.event.stroke), seedMs: r.seed_time_ms, finalMs: null, isDq: false, place: null, points: null }));
  return entriesPdf(meet.name, `${meet.start_date ?? ""} · ${meet.course}`, report,brand);
}