import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatTime, eventLabel, ageAtDec31, ageGroup } from "./swim";
import { MEMBER_ROLES, type MemberRole } from "./club";
import { exportFilename } from "./file-delivery";
import { rankedAthleteRecords } from "./athlete-records";

export interface ReportRow {
  athlete: string;
  club: string;
  gender: string | null;
  age: number | null;
  event: string;
  seedMs: number | null;
  finalMs: number | null;
  isDq: boolean;
  place: number | null;
  points: number | null;
}

function header(doc: jsPDF, title: string, subtitle: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(subtitle, 14, 23);
  doc.setTextColor(0);
}

/** Official results sheet ("listado de marcas"). */
export function resultsPdf(meetName: string, meta: string, rows: ReportRow[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  header(doc, `Listado de marcas — ${meetName}`, meta);
  autoTable(doc, {
    startY: 28,
    head: [["#", "Atleta", "Club", "G", "Edad", "Prueba", "Sembrado", "Final", "Puesto", "AQUA"]],
    body: rows.map((r, i) => [
      i + 1,
      r.athlete,
      r.club,
      r.gender ?? "—",
      r.age ?? "—",
      r.event,
      formatTime(r.seedMs),
      r.isDq ? "DQ" : formatTime(r.finalMs),
      r.place ?? "—",
      r.points ?? "—",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [12, 74, 110] },
  });
  return new File([doc.output("blob")], exportFilename(meetName, "_marcas.pdf"), { type: "application/pdf" });
}

/** Pre-entry sheet ("pre-inscripciones") with seed times, ready to send. */
export function entriesPdf(meetName: string, meta: string, rows: ReportRow[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  header(doc, `Pre-inscripción — ${meetName}`, meta);
  autoTable(doc, {
    startY: 28,
    head: [["#", "Atleta", "Club", "G", "Edad", "Prueba", "Tiempo de inscripción"]],
    body: rows.map((r, i) => [i + 1, r.athlete, r.club, r.gender ?? "—", r.age ?? "—", r.event, formatTime(r.seedMs)]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [12, 74, 110] },
  });
  return new File([doc.output("blob")], exportFilename(meetName, "_preinscripcion.pdf"), { type: "application/pdf" });
}

export interface AthleteReportResult {
  final_time_ms: number | null; seed_time_ms: number | null; is_dq: boolean; course: string | null; round: string | null; place: number | null; aqua_points: number | null;
  events: { distance: number; stroke: number } | null;
  meets: { name: string; start_date: string | null } | null;
  splits: { split_distance: number; cumulative_time_ms: number; lap_time_ms: number | null }[];
}
export function athleteProgressPdf(athlete: { first_name: string; last_name: string; birth_date: string | null; federation_id: string | null; teams: { name: string } | null }, results: AthleteReportResult[]) {
  const ranked = rankedAthleteRecords(results);
  const doc = new jsPDF({ orientation: "landscape" });
  const name = `${athlete.first_name} ${athlete.last_name}`;
  const year = new Date().getFullYear();
  header(doc, "Seguimiento individual — últimos 9 meses", name);
  autoTable(doc, { startY: 28, head: [["Club", "Nacimiento", "Categoría al 31/12", "ID federativo"]], body: [[athlete.teams?.name ?? "Sin club", athlete.birth_date ?? "—", `${ageGroup(ageAtDec31(athlete.birth_date, year))} (${year})`, athlete.federation_id ?? "—"]], styles: { fontSize: 9 } });
  const best = new Map<string, AthleteReportResult>();
  for (const r of ranked) {
    if (!r.events || r.is_dq || r.final_time_ms == null) continue;
    const key = `${eventLabel(r.events.distance, r.events.stroke)} ${r.course ?? ""}`;
    const prev = best.get(key);
    if (!prev || r.final_time_ms < (prev.final_time_ms ?? Infinity)) best.set(key, r);
  }
  const y = () => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 28;
  autoTable(doc, { startY: y() + 10, head: [["Mejores marcas", "Tiempo", "AQUA", "Competencia"]], body: [...best].map(([key,r]) => [key, formatTime(r.final_time_ms), r.aqua_points ?? "—", r.meets?.name ?? "—"]), styles: { fontSize: 8 } });
  const sorted = ranked;
  autoTable(doc, { startY: y() + 10, head: [["Fecha", "Competencia", "Prueba", "Piscina", "Ronda", "Sembrado", "Final", "Puesto", "AQUA"]], body: sorted.map((r) => [r.meets?.start_date ?? "—", r.meets?.name ?? "—", r.events ? eventLabel(r.events.distance,r.events.stroke) : "—", r.course ?? "—", r.round ?? "F", formatTime(r.seed_time_ms), r.is_dq ? "DQ" : formatTime(r.final_time_ms), r.place ?? "—", r.aqua_points ?? "—"]), styles: { fontSize: 8 } });
  const splits = sorted.flatMap((r) => r.splits.map((s) => [r.meets?.start_date ?? "—", r.events ? eventLabel(r.events.distance,r.events.stroke) : "—", `${s.split_distance} m`, formatTime(s.cumulative_time_ms), formatTime(s.lap_time_ms)]));
  if (splits.length) autoTable(doc, { startY: y() + 10, head: [["Fecha", "Prueba", "Distancia", "Acumulado", "Parcial"]], body: splits, styles: { fontSize: 8 } });
  return new File([doc.output("blob")], exportFilename(name, "_seguimiento.pdf"), { type: "application/pdf" });
}

export function clubRosterPdf(name: string, members: { first_name: string; last_name: string; member_role: string; active: boolean; email: string | null; phone: string | null }[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  header(doc, `Registro del club — ${name}`, new Date().toLocaleDateString("es-VE"));
  autoTable(doc, { startY: 28, head: [["Integrante", "Tipo", "Estado", "Correo", "Teléfono"]], body: members.map((m) => [`${m.first_name} ${m.last_name}`, MEMBER_ROLES[m.member_role as MemberRole] ?? m.member_role, m.active ? "Activo" : "Inactivo", m.email ?? "—", m.phone ?? "—"]), styles: { fontSize: 9 } });
  return new File([doc.output("blob")], exportFilename(name, "_integrantes.pdf"), { type: "application/pdf" });
}
