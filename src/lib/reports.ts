import { jsPDF } from "jspdf";
import { brandedTable as autoTable,setReportTableBrand } from './report-table-theme';
import type { ReportBrand,ReportPrivacy } from './report-brand';
import { formatTime, eventLabel, ageAtDec31, ageGroup } from "./swim";
import { MEMBER_ROLES, type MemberRole } from "./club";
import { exportFilename } from "./file-delivery";
import { rankedAthleteRecords } from "./athlete-records";
import { appendAthleteProgressCharts } from "./athlete-progress-pdf";
import { athleteMinimum } from "./athlete-minimum";
import { athleteComparisons, comparisonLabel } from "./athlete-comparison";
import type { QualificationStandard } from "./standard-rules";
import { standardSourceNote, STANDARD_AGE_NOTE, type StandardVersion } from "./standard-versions";
import { latestMeetAchievements, achievementLabels, type Achievement } from './achievements';

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
  doc.setProperties({ title, author: "Swim Lane Coach", creator: "Swim Lane Coach" });
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(subtitle, 14, 23);
  doc.setTextColor(0);
}

function brandedOutput(doc: jsPDF) {
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(90);
    doc.text("Swim Lane Coach · Compatible con Meet Manager y Team Manager", 14, doc.internal.pageSize.getHeight() - 6);
  }
  return doc.output("blob");
}

/** Official results sheet ("listado de marcas"). */
export function resultsPdf(meetName: string, meta: string, rows: ReportRow[],brand?:ReportBrand) {
  const doc = new jsPDF({ orientation: "landscape" });
  setReportTableBrand(doc,brand);
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
  return new File([brandedOutput(doc)], exportFilename(meetName, "_marcas.pdf"), { type: "application/pdf" });
}

/** Pre-entry sheet ("pre-inscripciones") with seed times, ready to send. */
export function entriesPdf(meetName: string, meta: string, rows: ReportRow[],brand?:ReportBrand) {
  const doc = new jsPDF({ orientation: "landscape" });
  setReportTableBrand(doc,brand);
  header(doc, `Pre-inscripción — ${meetName}`, meta);
  autoTable(doc, {
    startY: 28,
    head: [["#", "Atleta", "Club", "G", "Edad", "Prueba", "Tiempo de inscripción"]],
    body: rows.map((r, i) => [i + 1, r.athlete, r.club, r.gender ?? "—", r.age ?? "—", r.event, formatTime(r.seedMs)]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [12, 74, 110] },
  });
  return new File([brandedOutput(doc)], exportFilename(meetName, "_preinscripcion.pdf"), { type: "application/pdf" });
}

export interface AthleteReportResult {
  final_time_ms: number | null; seed_time_ms: number | null; is_dq: boolean; course: string | null; round: string | null; place: number | null; aqua_points: number | null; points_scored?: number | null;
  events: { distance: number; stroke: number; is_relay?: boolean } | null;
  meets: { name: string; start_date: string | null } | null;
  splits: { split_distance: number; cumulative_time_ms: number; lap_time_ms: number | null }[];
}
export interface MeetPointsSummary { name: string; date: string | null; swims: number; points: number; }
/** Scoring points earned per meet inside the report window; meets without points are omitted. */
export function meetPointsSummary(results: readonly AthleteReportResult[]): MeetPointsSummary[] {
  const byMeet = new Map<string, MeetPointsSummary>();
  for (const r of results) {
    const name = r.meets?.name;
    if (!name) continue;
    const entry = byMeet.get(name) ?? { name, date: r.meets?.start_date ?? null, swims: 0, points: 0 };
    entry.swims += 1;
    entry.points += r.points_scored ?? 0;
    byMeet.set(name, entry);
  }
  return [...byMeet.values()].filter((m) => m.points > 0).sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}

export function athleteProgressPdf(athlete: { first_name: string; last_name: string; birth_date: string | null; gender?: string | null; federation_id: string | null; teams: { name: string } | null }, results: AthleteReportResult[], standards: readonly QualificationStandard[] = [], source: StandardVersion | null = null, achievements: readonly Achievement[] = [],brand?:ReportBrand,privacy?:ReportPrivacy) {
  const ranked = rankedAthleteRecords(results);
  const comparisons = athleteComparisons(ranked);
  const doc = new jsPDF({ orientation: "landscape" });
  setReportTableBrand(doc,brand);
  const name = `${athlete.first_name} ${athlete.last_name}`;
  const year = new Date().getFullYear();
  const age = ageAtDec31(athlete.birth_date, year);
  const category = standards.find(s => age != null && (s.age_min == null || age >= s.age_min) && (s.age_max == null || age <= s.age_max) && s.age_group && (!s.gender || s.gender === athlete.gender))?.age_group ?? ageGroup(age);
  header(doc, "Seguimiento individual — últimos 9 meses", name);
  autoTable(doc, { startY: 28, margin: { bottom: 25 }, head: [["Club", "Nacimiento", "Categoría al 31/12 (generación)", "ID federativo"]], body: [[athlete.teams?.name ?? "Sin club", privacy&&!privacy.birthDate?'—':athlete.birth_date ?? "—", `${category} (${year})`, athlete.federation_id ?? "—"]], styles: { fontSize: 9 } });
  const best = new Map<string, AthleteReportResult>();
  for (const r of ranked) {
    if (!r.events || r.is_dq || r.final_time_ms == null) continue;
    const key = `${eventLabel(r.events.distance, r.events.stroke)} ${r.course ?? ""}`;
    const prev = best.get(key);
    if (!prev || r.final_time_ms < (prev.final_time_ms ?? Infinity)) best.set(key, r);
  }
  const y = () => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 28;
  const latestDate = results.map(r=>r.meets?.start_date??'').sort().at(-1);
  const lastAchievements = latestMeetAchievements(achievements.filter(a=>a.achieved_on===latestDate));
  if(lastAchievements.length) autoTable(doc,{startY:y()+8,margin:{bottom:25},head:[['Logros de la última competencia','Prueba / piscina','Tiempo','Mejora / mínima']],body:lastAchievements.map(a=>[`${a.meets?.name??''} · ${achievementLabels[a.kind]}`,`${eventLabel(a.distance,a.stroke)} ${a.course}`,formatTime(a.time_ms),a.kind==='pb'?`${((a.improvement_ms??0)/1000).toFixed(3)} s`:a.kind==='minimum'?formatTime(a.minimum_ms):'Primera marca']),styles:{fontSize:8}});
  const minimumCells = (r: AthleteReportResult) => {
    const minimum = athleteMinimum(athlete, r, standards);
    if (!minimum) return ["—", "—"];
    const margin = minimum.limit_ms - (r.final_time_ms ?? minimum.limit_ms);
    return [formatTime(minimum.limit_ms), minimum.remaining_ms == null ? "No válido" : minimum.remaining_ms > 0 ? `Faltan ${(minimum.remaining_ms / 1000).toFixed(2)} s` : margin === 0 ? "Hizo marca: igualó la mínima" : `Hizo marca: ${(margin / 1000).toFixed(2)} s por debajo`];
  };
  const comparisonCells = (r: AthleteReportResult) => {
    const comparison = comparisons.get(r);
    return [comparison ? `${formatTime(comparison.previous_ms)} (${comparison.previous_date})` : "—", comparisonLabel(comparison)];
  };
  autoTable(doc, { startY: y() + 10, margin: { bottom: 25 }, head: [["Mejores marcas", "Tiempo", "AQUA", "Competencia", "Anterior (fecha)", "Variación", "Mínima", "Diferencia con mínima"]], body: [...best].map(([key,r]) => [key, formatTime(r.final_time_ms), r.aqua_points ?? "—", r.meets?.name ?? "—", ...comparisonCells(r), ...minimumCells(r)]), styles: { fontSize: 8 } });
  doc.setFontSize(8);
  doc.text("Variación: respecto a la mejor marca de la fecha de competencia anterior, misma prueba y piscina, dentro de los últimos 9 meses.", 14, y() + 5);
  const meetPoints = meetPointsSummary(ranked);
  if (meetPoints.length) {
    autoTable(doc, { startY: y() + 10, margin: { bottom: 25 }, head: [["Puntos por competencia", "Fecha", "Pruebas", "Puntos"]], body: [...meetPoints.map((m) => [m.name, m.date ?? "—", m.swims, m.points]), ["Total del periodo", "", meetPoints.reduce((n, m) => n + m.swims, 0), meetPoints.reduce((n, m) => n + m.points, 0)]], styles: { fontSize: 8 } });
    doc.setFontSize(8);
    doc.text("Puntos de premiación del torneo en vivo (finales); distintos de la puntuación AQUA.", 14, y() + 5);
  }
  const sorted = ranked;
  autoTable(doc, { startY: y() + 10, margin: { bottom: 25 }, head: [["Fecha", "Competencia", "Prueba", "Piscina", "Ronda", "Sembrado", "Final", "Puesto", "AQUA", "Puntos", "Anterior (fecha)", "Variación", "Mínima", "Diferencia con mínima"]], body: sorted.map((r) => [r.meets?.start_date ?? "—", r.meets?.name ?? "—", r.events ? eventLabel(r.events.distance,r.events.stroke) : "—", r.course ?? "—", r.round ?? "F", formatTime(r.seed_time_ms), r.is_dq ? "DQ" : formatTime(r.final_time_ms), r.place ?? "—", r.aqua_points ?? "—", r.points_scored ?? "—", ...comparisonCells(r), ...minimumCells(r)]), styles: { fontSize: 7, cellPadding: 1.5 } });
  const splits = sorted.flatMap((r) => r.splits.map((s) => [r.meets?.start_date ?? "—", r.events ? eventLabel(r.events.distance,r.events.stroke) : "—", `${s.split_distance} m`, formatTime(s.cumulative_time_ms), formatTime(s.lap_time_ms)]));
  if (splits.length) autoTable(doc, { startY: y() + 10, margin: { bottom: 25 }, head: [["Fecha", "Prueba", "Distancia", "Acumulado", "Parcial"]], body: splits, styles: { fontSize: 8 } });
  appendAthleteProgressCharts(doc, name, ranked,undefined,brand);
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(90);
    const note = doc.splitTextToSize(`${standardSourceNote(source)}\n${STANDARD_AGE_NOTE}`, 268);
    doc.text(note, 14, doc.internal.pageSize.getHeight() - 12 - (note.length - 1) * 2.5);
  }
  return new File([brandedOutput(doc)], exportFilename(name, "_seguimiento.pdf"), { type: "application/pdf" });
}

export function clubRosterPdf(name: string, members: { first_name: string; last_name: string; member_role: string; active: boolean; email: string | null; phone: string | null }[],brand?:ReportBrand) {
  const doc = new jsPDF({ orientation: "landscape" });
  setReportTableBrand(doc,brand);
  header(doc, `Registro del club — ${name}`, new Date().toLocaleDateString("es-VE"));
  autoTable(doc, { startY: 28, head: [["Integrante", "Tipo", "Estado", "Correo", "Teléfono"]], body: members.map((m) => [`${m.first_name} ${m.last_name}`, MEMBER_ROLES[m.member_role as MemberRole] ?? m.member_role, m.active ? "Activo" : "Inactivo", m.email ?? "—", m.phone ?? "—"]), styles: { fontSize: 9 } });
  return new File([brandedOutput(doc)], exportFilename(name, "_integrantes.pdf"), { type: "application/pdf" });
}
