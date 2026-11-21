import { jsPDF } from 'jspdf';
import { reportHeading, finishReport, reportPrint } from './report-layout';
import { brandedTable, setReportTableBrand, setProfessionalReportTheme } from './report-table-theme';
import { neutralBrand, type ReportBrand } from './report-brand';
import { attendanceSummary, attendanceStatus, trainingSessions, type AttendanceRow } from './attendance';
import { exportFilename } from './file-delivery';

export function attendancePdf(
  title: string,
  from: string,
  to: string,
  rows: readonly AttendanceRow[],
  athletes: readonly { id: string; first_name: string; last_name: string }[],
  brand?: ReportBrand
) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  setReportTableBrand(doc, brand);
  setProfessionalReportTheme(doc);

  const identity = brand ?? neutralBrand();
  const summary = attendanceSummary(rows);
  const pageWidth = doc.internal.pageSize.getWidth(); // 297 mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 210 mm

  // Properties & metadata
  doc.setProperties({
    title: 'Reporte de asistencia',
    author: identity.name,
    creator: 'Swim Lane Coach',
    keywords: 'swim-lane-coach-editorial-v1',
  });

  // Top header layout
  const headerY = 12;

  // Category Pill Badge
  doc.setFillColor(identity.primary);
  if (typeof doc.roundedRect === 'function') {
    doc.roundedRect(14, headerY, 68, 5.5, 1.5, 1.5, 'F');
  } else {
    doc.rect(14, headerY, 68, 5.5, 'F');
  }
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('CONTROL OFICIAL DE ASISTENCIA', 17, headerY + 4);

  // Club Name in primary bold
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(identity.primary);
  doc.text(identity.name.toUpperCase(), 86, headerY + 4);

  // Main Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(reportPrint.ink);
  doc.text('Reporte de Asistencia', 14, headerY + 13);

  // Subtitle with date range and group
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(reportPrint.muted);
  doc.text(`Período: ${from} a ${to}   ·   Grupo / Atleta: ${title}`, 14, headerY + 19);

  // KPI Dashboard Cards
  const cardY = headerY + 23;
  const cardHeight = 22;
  const marginX = 14;
  const availableW = pageWidth - marginX * 2; // 269 mm

  // Card 1: Attendance Gauge & Progress Bar (82 mm)
  const c1W = 82;
  doc.setFillColor(reportPrint.surface);
  doc.setDrawColor(reportPrint.rule);
  doc.setLineWidth(0.3);
  if (typeof doc.roundedRect === 'function') {
    doc.roundedRect(marginX, cardY, c1W, cardHeight, 2, 2, 'FD');
  } else {
    doc.rect(marginX, cardY, c1W, cardHeight, 'FD');
  }

  // Accent line on left of Card 1
  doc.setFillColor(identity.primary);
  doc.rect(marginX, cardY, 2, cardHeight, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(reportPrint.muted);
  doc.text('ÍNDICE DE ASISTENCIA DEL PERÍODO', marginX + 6, cardY + 5.5);

  const pctValue = summary.percentage == null ? '—' : `${summary.percentage}%`;
  const pctColor =
    summary.percentage == null
      ? [88, 104, 115]
      : summary.percentage >= 80
      ? [8, 115, 60] // emerald
      : summary.percentage >= 60
      ? [180, 110, 0] // amber
      : [180, 40, 30]; // rose

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(pctColor[0], pctColor[1], pctColor[2]);
  doc.text(pctValue, marginX + 6, cardY + 13);

  // Evaluation pill tag
  const evalLabel =
    summary.percentage == null
      ? 'Sin datos'
      : summary.percentage >= 85
      ? 'EXCELENTE'
      : summary.percentage >= 70
      ? 'BUENA'
      : summary.percentage >= 50
      ? 'REGULAR'
      : 'BAJA';

  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  const evalW = doc.getTextWidth(evalLabel) + 5;
  doc.setFillColor(pctColor[0], pctColor[1], pctColor[2]);
  if (typeof doc.roundedRect === 'function') {
    doc.roundedRect(marginX + 28, cardY + 8.5, evalW, 5, 1, 1, 'F');
  } else {
    doc.rect(marginX + 28, cardY + 8.5, evalW, 5, 'F');
  }
  doc.setTextColor(255, 255, 255);
  doc.text(evalLabel, marginX + 30.5, cardY + 12.2);

  // Vector Progress Bar inside Card 1
  const barX = marginX + 6;
  const barY = cardY + 16.5;
  const barW = c1W - 12; // 70 mm
  const barH = 3;
  doc.setFillColor('#E2E8F0');
  if (typeof doc.roundedRect === 'function') {
    doc.roundedRect(barX, barY, barW, barH, 1, 1, 'F');
  } else {
    doc.rect(barX, barY, barW, barH, 'F');
  }

  if (summary.percentage != null && summary.percentage > 0) {
    const fillW = Math.min(barW, Math.max(2, (summary.percentage / 100) * barW));
    doc.setFillColor(pctColor[0], pctColor[1], pctColor[2]);
    if (typeof doc.roundedRect === 'function') {
      doc.roundedRect(barX, barY, fillW, barH, 1, 1, 'F');
    } else {
      doc.rect(barX, barY, fillW, barH, 'F');
    }
  }

  // Cards 2, 3, 4
  const otherCardW = (availableW - c1W - 9) / 3;

  const statCards = [
    {
      title: 'REGISTROS / SESIONES',
      val: String(summary.total),
      sub: 'Convocatorias computadas',
      color: identity.primary,
    },
    {
      title: 'ASISTENCIAS CUMPLIDAS',
      val: String(summary.attended),
      sub: `${summary.present} presentes · ${summary.late} tarde`,
      color: '#059669',
    },
    {
      title: 'AUSENCIAS Y JUSTIFICADAS',
      val: `${summary.absent} / ${summary.excused}`,
      sub: `${summary.absent} ausentes · ${summary.excused} justificadas`,
      color: summary.absent > 0 ? '#E11D48' : '#64748B',
    },
  ];

  statCards.forEach((c, idx) => {
    const x = marginX + c1W + 3 + idx * (otherCardW + 3);
    doc.setFillColor(reportPrint.surface);
    doc.setDrawColor(reportPrint.rule);
    doc.setLineWidth(0.3);
    if (typeof doc.roundedRect === 'function') {
      doc.roundedRect(x, cardY, otherCardW, cardHeight, 2, 2, 'FD');
    } else {
      doc.rect(x, cardY, otherCardW, cardHeight, 'FD');
    }

    doc.setFillColor(c.color);
    doc.rect(x, cardY, 2, cardHeight, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(reportPrint.muted);
    doc.text(c.title, x + 5, cardY + 5.5);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(reportPrint.ink);
    doc.text(c.val, x + 5, cardY + 13.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(reportPrint.muted);
    doc.text(c.sub, x + 5, cardY + 18.5);
  });

  const tableStartY = cardY + cardHeight + 6;

  // Swimmers Summary Table
  const activeSwimmers = athletes.filter((a) => rows.some((r) => r.athlete_id === a.id));
  const swimmerRows = (activeSwimmers.length > 0 ? activeSwimmers : athletes).map((a) => {
    const s = attendanceSummary(rows.filter((r) => r.athlete_id === a.id));
    const pct = s.percentage == null ? '—' : `${s.percentage}%`;
    const rating =
      s.percentage == null
        ? '—'
        : s.percentage >= 85
        ? 'Excelente (≥85%)'
        : s.percentage >= 70
        ? 'Aceptable'
        : 'Baja asistencia';
    return [`${a.last_name}, ${a.first_name}`, s.total, s.present, s.late, s.absent, s.excused, pct, rating];
  });

  brandedTable(doc, {
    startY: tableStartY,
    margin: { left: 14, right: 14, bottom: 20 },
    head: [['Nadador / Atleta', 'Registros', 'Presentes', 'Tarde', 'Ausentes', 'Justificadas', '% Asistencia', 'Evaluación']],
    body: swimmerRows,
    styles: { fontSize: 8, cellPadding: 2.2 },
    columnStyles: {
      0: { cellWidth: 55, fontStyle: 'bold' },
      1: { cellWidth: 22, halign: 'center' },
      2: { cellWidth: 24, halign: 'center' },
      3: { cellWidth: 20, halign: 'center' },
      4: { cellWidth: 22, halign: 'center' },
      5: { cellWidth: 26, halign: 'center' },
      6: { cellWidth: 28, halign: 'center', fontStyle: 'bold' },
      7: { cellWidth: 'auto', halign: 'center' },
    },
  });

  const names = new Map(athletes.map((a) => [a.id, `${a.last_name}, ${a.first_name}`]));
  const y = () => (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 34;

  if (rows.length) {
    const nextY = y() + 7;
    if (nextY > pageHeight - 45) {
      doc.addPage();
    }
    const currentTableY = nextY > pageHeight - 45 ? 20 : nextY;

    brandedTable(doc, {
      startY: currentTableY,
      margin: { left: 14, right: 14, bottom: 20 },
      head: [['Fecha', 'Sesión', 'Nadador', 'Estado de Asistencia', 'Observación / Nota']],
      body: rows.map((r) => [
        r.training_date,
        trainingSessions[r.session] || r.session,
        names.get(r.athlete_id) ?? 'Nadador',
        attendanceStatus[r.status] || r.status,
        r.notes || '—',
      ]),
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 26, halign: 'center' },
        1: { cellWidth: 28, halign: 'center' },
        2: { cellWidth: 55, fontStyle: 'bold' },
        3: { cellWidth: 38, halign: 'center' },
        4: { cellWidth: 'auto' },
      },
    });
  } else {
    doc.setFontSize(9.5);
    doc.setTextColor(reportPrint.muted);
    doc.text('Sin asistencia registrada en el periodo seleccionado.', 14, y() + 8);
  }

  // Educational footer note on every page
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(reportPrint.muted);
    doc.text(
      'Asistencia: presentes + tarde / registros. Los días sin registrar no cuentan como ausencia.',
      14,
      doc.internal.pageSize.getHeight() - 14
    );
  }

  finishReport(doc, brand);
  return new File([doc.output('blob')], exportFilename(title, '_asistencia.pdf'), { type: 'application/pdf' });
}
