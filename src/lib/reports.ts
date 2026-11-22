import { reportHeading, reportMetrics, finishReport, reportPrint } from './report-layout';
import { attendanceSummary,attendanceStatus,trainingSessions,type AttendanceReport } from './attendance';
import { jsPDF } from "jspdf";
import { brandedTable as autoTable,setReportTableBrand,setProfessionalReportTheme } from './report-table-theme';
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
    doc.textWithLink("Generado con Swim Lane Coach", 14, doc.internal.pageSize.getHeight() - 6, {url: "https://swimlanecoach.app/?utm_source=report&utm_medium=referral&utm_campaign=pdf"});
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

export function renderAttendanceSummaryBox(doc: jsPDF, athleteName: string, attendance: AttendanceReport, brand?: ReportBrand, _startY = 16) {
  const summary = attendanceSummary(attendance.rows);
  setProfessionalReportTheme(doc);
  const headingY = reportHeading(
    doc,
    'Control Oficial de Asistencia a Entrenamientos',
    `${athleteName} · Período: ${attendance.from} al ${attendance.to}`,
    brand
  );

  const primaryFill = brand?.primary ? (brand.primary as any) : [12, 74, 110];
  const pctStr = summary.percentage == null ? "—" : `${summary.percentage}%`;
  const pctColor = (summary.percentage ?? 0) >= 80 ? [16, 120, 60] : (summary.percentage ?? 0) >= 60 ? [180, 100, 10] : [185, 28, 28];

  const statusLabel = (st: string) => {
    switch (st) {
      case 'present': return '✓ Presente';
      case 'late': return '⏱ Tarde';
      case 'absent': return '✗ Ausente';
      case 'excused': return '✉ Justificada';
      default: return '—';
    }
  };

  const statusStyle = (st: string) => {
    switch (st) {
      case 'present': return { textColor: [16, 120, 60] as [number, number, number], fontStyle: 'bold' as const };
      case 'late': return { textColor: [180, 100, 10] as [number, number, number], fontStyle: 'bold' as const };
      case 'absent': return { textColor: [185, 28, 28] as [number, number, number], fontStyle: 'bold' as const };
      case 'excused': return { textColor: [37, 99, 235] as [number, number, number], fontStyle: 'bold' as const };
      default: return { textColor: [100, 116, 139] as [number, number, number], fontStyle: 'normal' as const };
    }
  };

  const notesRows = attendance.rows.filter(r => r.notes && r.notes.trim() && r.notes.trim() !== "—");
  const observationsSummary = notesRows.length > 0
    ? notesRows.map(r => `• ${r.training_date} (${trainingSessions[r.session] ?? r.session} · ${attendanceStatus[r.status] ?? r.status}): ${r.notes.trim()}`).join("  |  ")
    : "Sin incidencias ni observaciones registradas en el período.";

  const evaluationText = summary.total === 0
    ? "Sin registros de asistencia en el período."
    : (summary.percentage ?? 0) >= 85
      ? `Excelente cumplimiento (${pctStr}). El atleta demuestra constancia y regularidad en los entrenamientos.`
      : (summary.percentage ?? 0) >= 70
        ? `Cumplimiento regular (${pctStr}). Se sugiere reforzar la puntualidad y asistencia continua.`
        : `Atención requerida (${pctStr}). Asistencia por debajo del mínimo recomendado para el rendimiento deportivo.`;

  // UN SOLO CUADRO CONSOLIDADO (Sin recuadros repetitivos)
  autoTable(doc, {
    startY: headingY,
    margin: { left: 14, right: 14, bottom: 25 },
    head: [
      [
        {
          content: `CUADRO CONSOLIDADO DE ASISTENCIA INDIVIDUAL — ${athleteName.toUpperCase()}`,
          colSpan: 4,
          styles: {
            fillColor: primaryFill,
            textColor: 255,
            fontSize: 9.5,
            fontStyle: 'bold',
            halign: 'left',
            cellPadding: 3,
          }
        }
      ],
      [
        {
          content: `PERÍODO EVALUADO\nDel ${attendance.from} al ${attendance.to}`,
          styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.5 }
        },
        {
          content: `SESIONES PROGRAMADAS\n${summary.total} Totales  |  ${summary.attended} Asistió (${summary.present} P · ${summary.late} T)`,
          styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.5 }
        },
        {
          content: `INASISTENCIAS\n${summary.absent} Ausencias  |  ${summary.excused} Justificadas`,
          styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.5 }
        },
        {
          content: `EFECTIVIDAD GLOBAL\n${pctStr}`,
          styles: {
            fillColor: (summary.percentage ?? 0) >= 80 ? [220, 252, 231] : (summary.percentage ?? 0) >= 60 ? [254, 243, 199] : [254, 226, 226],
            textColor: pctColor,
            fontStyle: 'bold',
            fontSize: 8.5,
            halign: 'center',
            cellPadding: 2.5,
          }
        }
      ],
      [
        { content: "Fecha", styles: { halign: 'center', cellWidth: 32, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
        { content: "Sesión", styles: { halign: 'center', cellWidth: 35, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
        { content: "Estado de Asistencia", styles: { halign: 'center', cellWidth: 42, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
        { content: "Observación / Novedad", styles: { halign: 'left', fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } }
      ]
    ],
    body: attendance.rows.length > 0 ? attendance.rows.map((r) => [
      { content: r.training_date, styles: { halign: 'center', fontSize: 8 } },
      { content: trainingSessions[r.session] ?? r.session, styles: { halign: 'center', fontSize: 8 } },
      { content: statusLabel(r.status), styles: { halign: 'center', fontSize: 8, ...statusStyle(r.status) } },
      { content: r.notes && r.notes.trim() ? r.notes.trim() : '—', styles: { fontSize: 7.5 } }
    ]) : [
      [
        { content: 'Sin sesiones de entrenamiento registradas en el período evaluado.', colSpan: 4, styles: { halign: 'center', fontSize: 8, textColor: [100, 116, 139] } }
      ]
    ],
    foot: [
      [
        { content: "Evaluación de Cumplimiento:", styles: { fontStyle: "bold", fillColor: reportPrint.surface, fontSize: 8, cellPadding: 3 } },
        { content: `${evaluationText}\n${observationsSummary}`, colSpan: 3, styles: { fontSize: 7.5, cellPadding: 3 } }
      ],
      [
        { content: "Certificación Técnica:", styles: { fontStyle: "bold", fillColor: reportPrint.surface, fontSize: 8, cellPadding: 3.5 } },
        {
          content: `Firma del Entrenador: _________________________________________        Fecha de Emisión: ${new Date().toLocaleDateString('es-VE')}`,
          colSpan: 3,
          styles: { fontSize: 7.5, cellPadding: 3.5, fontStyle: 'bold' }
        }
      ]
    ],
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: reportPrint.rule,
      lineWidth: 0.2,
      overflow: "linebreak",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });
}

export function athleteAttendancePdf(athlete: { first_name: string; last_name: string; teams?: { name: string } | null }, attendance: AttendanceReport, brand?: ReportBrand): File {
  const doc = new jsPDF({ orientation: "landscape" });
  setReportTableBrand(doc, brand);
  const name = `${athlete.first_name} ${athlete.last_name}`;
  renderAttendanceSummaryBox(doc, name, attendance, brand, 16);
  finishReport(doc, brand);
  return new File([doc.output("blob")], exportFilename(name, "_asistencia.pdf"), { type: "application/pdf" });
}

export function dailyAttendancePdf(options: {
  date: string;
  session: keyof typeof trainingSessions;
  clubName: string;
  rows: { athleteName: string; status: keyof typeof attendanceStatus | ''; notes: string }[];
  brand?: ReportBrand | undefined;
}): File {
  const doc = new jsPDF({ orientation: "landscape" });
  setReportTableBrand(doc, options.brand);
  setProfessionalReportTheme(doc);
  const headingY = reportHeading(
    doc,
    'Control Oficial de Asistencia a Entrenamientos',
    `${options.clubName} · Fecha: ${options.date} · Sesión: ${trainingSessions[options.session]}`,
    options.brand
  );

  const registered = options.rows.filter(r => r.status);
  const counts = { present: 0, late: 0, absent: 0, excused: 0 };
  for (const r of registered) {
    if (r.status in counts) counts[r.status as keyof typeof counts]++;
  }
  const total = registered.length;
  const attended = counts.present + counts.late;
  const percentage = total ? Math.round((attended / total) * 100) : null;
  const pctStr = percentage == null ? "—" : `${percentage}%`;

  const primaryFill = options.brand?.primary ? (options.brand.primary as any) : [12, 74, 110];
  const pctColor = (percentage ?? 0) >= 80 ? [16, 120, 60] : (percentage ?? 0) >= 60 ? [180, 100, 10] : [185, 28, 28];

  const statusLabel = (st: string) => {
    switch (st) {
      case 'present': return '✓ Presente';
      case 'late': return '⏱ Tarde';
      case 'absent': return '✗ Ausente';
      case 'excused': return '✉ Justificada';
      default: return '— Sin registrar';
    }
  };

  const statusStyle = (st: string) => {
    switch (st) {
      case 'present': return { textColor: [16, 120, 60] as [number, number, number], fontStyle: 'bold' as const };
      case 'late': return { textColor: [180, 100, 10] as [number, number, number], fontStyle: 'bold' as const };
      case 'absent': return { textColor: [185, 28, 28] as [number, number, number], fontStyle: 'bold' as const };
      case 'excused': return { textColor: [37, 99, 235] as [number, number, number], fontStyle: 'bold' as const };
      default: return { textColor: [100, 116, 139] as [number, number, number], fontStyle: 'normal' as const };
    }
  };

  const notesRows = options.rows.filter(r => r.notes && r.notes.trim() && r.notes.trim() !== "—");
  const observationsSummary = notesRows.length > 0
    ? notesRows.map(r => `• ${r.athleteName} (${r.status ? attendanceStatus[r.status as keyof typeof attendanceStatus] : 'Sin estado'}): ${r.notes.trim()}`).join("  |  ")
    : "Sin novedades ni incidencias reportadas en la sesión.";

  // UN SOLO CUADRO MAESTRO CONSOLIDADO (Sin recuadros repetitivos)
  autoTable(doc, {
    startY: headingY,
    margin: { left: 14, right: 14, bottom: 25 },
    head: [
      [
        {
          content: `CUADRO RESUMIDO DE ASISTENCIA — ${options.clubName.toUpperCase()}`,
          colSpan: 4,
          styles: {
            fillColor: primaryFill,
            textColor: 255,
            fontSize: 9.5,
            fontStyle: 'bold',
            halign: 'left',
            cellPadding: 3,
          }
        }
      ],
      [
        {
          content: `FECHA Y SESIÓN\n${options.date} · ${trainingSessions[options.session]}`,
          styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.5 }
        },
        {
          content: `CONVOCADOS Y PRESENTES\n${total} Registrados  |  ${attended} Asistieron (${counts.present} P · ${counts.late} T)`,
          styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.5 }
        },
        {
          content: `AUSENTES Y JUSTIFICADAS\n${counts.absent} Ausentes  |  ${counts.excused} Justificadas`,
          styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.5 }
        },
        {
          content: `EFECTIVIDAD DE LA SESIÓN\n${pctStr}`,
          styles: {
            fillColor: (percentage ?? 0) >= 80 ? [220, 252, 231] : (percentage ?? 0) >= 60 ? [254, 243, 199] : [254, 226, 226],
            textColor: pctColor,
            fontStyle: 'bold',
            fontSize: 8.5,
            halign: 'center',
            cellPadding: 2.5,
          }
        }
      ],
      [
        { content: "#", styles: { halign: 'center', cellWidth: 12, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
        { content: "Atleta / Nadador", styles: { halign: 'left', cellWidth: 70, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
        { content: "Estado de Asistencia", styles: { halign: 'center', cellWidth: 42, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
        { content: "Observación / Novedad en Entrenamiento", styles: { halign: 'left', fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } }
      ]
    ],
    body: options.rows.length > 0 ? options.rows.map((r, i) => [
      { content: String(i + 1), styles: { halign: 'center', fontSize: 8 } },
      { content: r.athleteName, styles: { fontStyle: 'bold', fontSize: 8 } },
      { content: statusLabel(r.status), styles: { halign: 'center', fontSize: 8, ...statusStyle(r.status) } },
      { content: r.notes && r.notes.trim() ? r.notes.trim() : '—', styles: { fontSize: 7.5 } }
    ]) : [
      [
        { content: 'No hay nadadores registrados para esta sesión.', colSpan: 4, styles: { halign: 'center', fontSize: 8, textColor: [100, 116, 139] } }
      ]
    ],
    foot: [
      [
        { content: "Observaciones Generales de la Sesión:", styles: { fontStyle: "bold", fillColor: reportPrint.surface, fontSize: 8, cellPadding: 3 } },
        { content: observationsSummary, colSpan: 3, styles: { fontSize: 7.5, cellPadding: 3 } }
      ],
      [
        { content: "Certificación Técnica:", styles: { fontStyle: "bold", fillColor: reportPrint.surface, fontSize: 8, cellPadding: 3.5 } },
        {
          content: `Firma del Entrenador Responsable: _________________________________________        Fecha de Emisión: ${new Date().toLocaleDateString('es-VE')}`,
          colSpan: 3,
          styles: { fontSize: 7.5, cellPadding: 3.5, fontStyle: 'bold' }
        }
      ]
    ],
    theme: "grid",
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: reportPrint.rule,
      lineWidth: 0.2,
      overflow: "linebreak",
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
  });

  finishReport(doc, options.brand);
  return new File([doc.output("blob")], exportFilename(`asistencia_${options.date}_${options.session}`, ".pdf"), { type: "application/pdf" });
}

export function athleteProgressPdf(athlete: { first_name: string; last_name: string; birth_date: string | null; gender?: string | null; federation_id: string | null; teams: { name: string } | null }, results: AthleteReportResult[], standards: readonly QualificationStandard[] = [], source: StandardVersion | null = null, achievements: readonly Achievement[] = [],brand?:ReportBrand,privacy?:ReportPrivacy,attendance?:AttendanceReport) {
  const ranked = rankedAthleteRecords(results);
  const comparisons = athleteComparisons(ranked);
  const doc = new jsPDF({ orientation: "landscape" });
  setReportTableBrand(doc,brand);
  const name = `${athlete.first_name} ${athlete.last_name}`;
  const year = new Date().getFullYear();
  const age = ageAtDec31(athlete.birth_date, year);
  const category = standards.find(s => age != null && (s.age_min == null || age >= s.age_min) && (s.age_max == null || age <= s.age_max) && s.age_group && (!s.gender || s.gender === athlete.gender))?.age_group ?? ageGroup(age);
  setProfessionalReportTheme(doc);
  const headingY = reportHeading(doc, 'Seguimiento individual', `${name} · Últimos 9 meses`, brand);
  const contentY = reportMetrics(doc, [
    {label: 'Resultados vigentes', value: String(ranked.length)},
    {label: 'Competencias', value: String(new Set(ranked.map(r => `${r.meets?.name}|${r.meets?.start_date}`)).size)},
    {label: 'Pruebas / piscina', value: String(new Set(ranked.filter(r=>r.events&&!r.is_dq&&r.final_time_ms!=null).map(r=>`${r.events?.distance}|${r.events?.stroke}|${r.course}`)).size)},
    {label: 'Puntos de competencia', value: String(ranked.reduce((sum,r)=>sum+(r.points_scored??0),0))},
  ], headingY, brand);

  const primaryFill = brand?.primary ? (brand.primary as any) : [12, 74, 110];

  autoTable(doc, {
    startY: contentY,
    margin: { bottom: 25 },
    head: [["Club Oficial", "Fecha de Nacimiento", "Categoría al 31/12 (generación)", "ID Federativo"]],
    body: [[
      athlete.teams?.name ?? "Sin club",
      privacy && !privacy.birthDate ? "—" : athlete.birth_date ?? "—",
      `${category} (${year})`,
      athlete.federation_id ?? "—"
    ]],
    headStyles: { fillColor: primaryFill, fontStyle: "bold" },
    styles: { fontSize: 8.5, cellPadding: 2.5 }
  });

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
  if(lastAchievements.length) autoTable(doc,{
    startY:y()+8,
    margin:{bottom:25},
    head:[['Logros de la última competencia','Prueba / piscina','Tiempo','Mejora / mínima']],
    body:lastAchievements.map(a=>[`${a.meets?.name??''} · ${achievementLabels[a.kind]}`,`${eventLabel(a.distance,a.stroke)} ${a.course}`,formatTime(a.time_ms),a.kind==='pb'?`${((a.improvement_ms??0)/1000).toFixed(3)} s`:a.kind==='minimum'?formatTime(a.minimum_ms):'Primera marca']),
    headStyles: { fillColor: primaryFill, fontStyle: "bold" },
    styles:{fontSize:8, cellPadding: 2}
  });

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

  autoTable(doc, {
    startY: y() + 9,
    margin: { bottom: 25 },
    head: [["Mejores marcas", "Tiempo", "AQUA", "Competencia", "Anterior (fecha)", "Variación", "Mínima", "Diferencia con mínima"]],
    body: [...best].map(([key,r]) => [key, formatTime(r.final_time_ms), r.aqua_points ?? "—", r.meets?.name ?? "—", ...comparisonCells(r), ...minimumCells(r)]),
    headStyles: { fillColor: primaryFill, fontStyle: "bold" },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 40 },
      1: { fontStyle: "bold", halign: "right", cellWidth: 22 },
      2: { halign: "center", cellWidth: 16 },
      3: { cellWidth: "auto" },
      4: { cellWidth: 32 },
      5: { cellWidth: 26 },
      6: { cellWidth: 22, halign: "right" },
      7: { cellWidth: 38 },
    },
    styles: { fontSize: 8, cellPadding: 2 }
  });

  doc.setFontSize(7.5);
  doc.setTextColor(reportPrint.muted);
  doc.text("Variación: respecto a la mejor marca de la fecha de competencia anterior, misma prueba y piscina, dentro de los últimos 9 meses.", 14, y() + 4.5);

  const meetPoints = meetPointsSummary(ranked);
  if (meetPoints.length) {
    autoTable(doc, {
      startY: y() + 8,
      margin: { bottom: 25 },
      head: [["Puntos por competencia", "Fecha", "Pruebas", "Puntos"]],
      body: [...meetPoints.map((m) => [m.name, m.date ?? "—", m.swims, m.points]), ["Total del periodo", "", meetPoints.reduce((n, m) => n + m.swims, 0), meetPoints.reduce((n, m) => n + m.points, 0)]],
      headStyles: { fillColor: primaryFill, fontStyle: "bold" },
      styles: { fontSize: 8, cellPadding: 2 }
    });
    doc.setFontSize(7.5);
    doc.setTextColor(reportPrint.muted);
    doc.text("Puntos de premiación del torneo en vivo (finales); distintos de la puntuación AQUA.", 14, y() + 4.5);
  }

  const sorted = ranked;
  autoTable(doc, {
    startY: y() + 8,
    margin: { bottom: 25 },
    head: [["Fecha", "Competencia", "Prueba", "Piscina", "Ronda", "Sembrado", "Final", "Puesto", "AQUA", "Puntos", "Anterior (fecha)", "Variación", "Mínima", "Diferencia con mínima"]],
    body: sorted.map((r) => [r.meets?.start_date ?? "—", r.meets?.name ?? "—", r.events ? eventLabel(r.events.distance,r.events.stroke) : "—", r.course ?? "—", r.round ?? "F", formatTime(r.seed_time_ms), r.is_dq ? "DQ" : formatTime(r.final_time_ms), r.place ?? "—", r.aqua_points ?? "—", r.points_scored ?? "—", ...comparisonCells(r), ...minimumCells(r)]),
    headStyles: { fillColor: primaryFill, fontStyle: "bold" },
    styles: { fontSize: 7, cellPadding: 1.5 }
  });

  const splits = sorted.flatMap((r) => r.splits.map((s) => [r.meets?.start_date ?? "—", r.events ? eventLabel(r.events.distance,r.events.stroke) : "—", `${s.split_distance} m`, formatTime(s.cumulative_time_ms), formatTime(s.lap_time_ms)]));
  if (splits.length) autoTable(doc, {
    startY: y() + 8,
    margin: { bottom: 25 },
    head: [["Fecha", "Prueba", "Distancia", "Acumulado", "Parcial"]],
    body: splits,
    headStyles: { fillColor: primaryFill, fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2 }
  });
  if (attendance) {
    doc.addPage();
    renderAttendanceSummaryBox(doc, name, attendance, brand, 16);
  }
  appendAthleteProgressCharts(doc, name, ranked,undefined,brand);
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(90);
    const note = doc.splitTextToSize(`${standardSourceNote(source)}\n${STANDARD_AGE_NOTE}`, 268);
    doc.text(note, 14, doc.internal.pageSize.getHeight() - 12 - (note.length - 1) * 2.5);
  }
  finishReport(doc, brand);
  return new File([doc.output("blob")], exportFilename(name, "_seguimiento.pdf"), { type: "application/pdf" });
}

export function clubRosterPdf(name: string, members: { first_name: string; last_name: string; member_role: string; active: boolean; email: string | null; phone: string | null }[],brand?:ReportBrand) {
  const doc = new jsPDF({ orientation: "landscape" });
  setReportTableBrand(doc,brand);
  header(doc, `Registro del club — ${name}`, new Date().toLocaleDateString("es-VE"));
  autoTable(doc, { startY: 28, head: [["Integrante", "Tipo", "Estado", "Correo", "Teléfono"]], body: members.map((m) => [`${m.first_name} ${m.last_name}`, MEMBER_ROLES[m.member_role as MemberRole] ?? m.member_role, m.active ? "Activo" : "Inactivo", m.email ?? "—", m.phone ?? "—"]), styles: { fontSize: 9 } });
  return new File([brandedOutput(doc)], exportFilename(name, "_integrantes.pdf"), { type: "application/pdf" });
}
