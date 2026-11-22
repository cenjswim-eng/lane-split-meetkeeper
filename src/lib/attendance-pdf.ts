/**
 * Generador de Reporte Oficial de Asistencia en PDF — Cuadro Resumido y Consolidado
 * Ubicación: src/lib/attendance-pdf.ts
 *
 * Simplifica toda la información en un solo cuadro maestro compacto y elegante,
 * eliminando recuadros redundantes y reduciendo la extensión del reporte a una sola página.
 */

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
): File {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  setReportTableBrand(doc, brand);
  setProfessionalReportTheme(doc);

  const identity = brand ?? neutralBrand();
  const summary = attendanceSummary(rows);
  const primaryFill = identity.primary ? (identity.primary as any) : [12, 74, 110];

  // Metadatos oficiales del documento
  doc.setProperties({
    title: `Reporte Resumido de Asistencia — ${title}`,
    author: identity.name,
    creator: 'Swim Lane Coach',
    keywords: 'control-asistencia-resumido-v2',
  });

  // Encabezado institucional unificado (Limpio y formal, sin recuadros flotantes)
  const headingY = reportHeading(
    doc,
    'Control Oficial de Asistencia a Entrenamientos',
    `${identity.name} · ${title} · Período: ${from} al ${to}`,
    brand
  );

  const pctValue = summary.percentage == null ? '—' : `${summary.percentage}%`;
  const pctColor: [number, number, number] =
    summary.percentage == null
      ? [100, 116, 139]
      : summary.percentage >= 80
      ? [16, 120, 60] // verde esmeralda
      : summary.percentage >= 60
      ? [180, 100, 10] // ámbar
      : [185, 28, 28]; // rojo

  const evalLabel =
    summary.percentage == null
      ? 'Sin datos'
      : summary.percentage >= 85
      ? 'Excelente (≥85%)'
      : summary.percentage >= 70
      ? 'Aceptable (≥70%)'
      : summary.percentage >= 50
      ? 'Regular'
      : 'Baja asistencia';

  const isSingleSwimmer = athletes.length === 1;
  const activeSwimmers = athletes.filter((a) => rows.some((r) => r.athlete_id === a.id));
  const swimmersToDisplay = activeSwimmers.length > 0 ? activeSwimmers : athletes;

  // Extraer notas e incidencias relevantes de manera condensada
  const notesRows = rows.filter((r) => r.notes && r.notes.trim() && r.notes.trim() !== '—');
  const incidentsSummary =
    notesRows.length > 0
      ? notesRows
          .slice(0, 8)
          .map((r) => {
            const ath = athletes.find((a) => a.id === r.athlete_id);
            const athName = ath ? `${ath.last_name}` : '';
            return `• ${r.training_date} (${trainingSessions[r.session] ?? r.session}${athName ? ` · ${athName}` : ''} · ${attendanceStatus[r.status] ?? r.status}): ${r.notes.trim()}`;
          })
          .join('   |   ') + (notesRows.length > 8 ? `   |   (+${notesRows.length - 8} notas adicionales)` : '')
      : 'Sin incidencias ni justificaciones especiales registradas en el período.';

  // Status badges formatter
  const statusLabel = (st: string) => {
    switch (st) {
      case 'present': return '✓ Presente';
      case 'late': return '± Tarde';
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

  // Generación de CUADRO ÚNICO CONSOLIDADO (Sin tablas separadas ni recuadros dispersos)
  if (!isSingleSwimmer) {
    // CASO MULTI-ATLETA (GRUPO / CLUB COMPLETO)
    const tableBody = swimmersToDisplay.map((a, idx) => {
      const s = attendanceSummary(rows.filter((r) => r.athlete_id === a.id));
      const swimmerPct = s.percentage == null ? '—' : `${s.percentage}%`;
      const swimmerRating =
        s.percentage == null
          ? '—'
          : s.percentage >= 85
          ? 'Excelente (≥85%)'
          : s.percentage >= 70
          ? 'Aceptable'
          : 'Baja asistencia';

      return [
        { content: String(idx + 1), styles: { halign: 'center', fontSize: 8 } },
        { content: `${a.last_name}, ${a.first_name}`, styles: { fontStyle: 'bold', fontSize: 8 } },
        { content: String(s.total), styles: { halign: 'center', fontSize: 8 } },
        { content: String(s.present), styles: { halign: 'center', fontSize: 8, textColor: [16, 120, 60] } },
        { content: String(s.late), styles: { halign: 'center', fontSize: 8, textColor: [180, 100, 10] } },
        { content: String(s.absent), styles: { halign: 'center', fontSize: 8, textColor: s.absent > 0 ? [185, 28, 28] : [100, 116, 139] } },
        { content: String(s.excused), styles: { halign: 'center', fontSize: 8, textColor: [37, 99, 235] } },
        {
          content: swimmerPct,
          styles: {
            halign: 'center',
            fontSize: 8.5,
            fontStyle: 'bold',
            textColor: (s.percentage ?? 0) >= 80 ? [16, 120, 60] : (s.percentage ?? 0) >= 60 ? [180, 100, 10] : [185, 28, 28],
          },
        },
        { content: swimmerRating, styles: { halign: 'center', fontSize: 7.5 } },
      ];
    });

    brandedTable(doc, {
      startY: headingY,
      margin: { left: 14, right: 14, bottom: 20 },
      head: [
        [
          {
            content: `CUADRO RESUMIDO DE ASISTENCIA — ${title.toUpperCase()}`,
            colSpan: 9,
            styles: {
              fillColor: primaryFill,
              textColor: 255,
              fontSize: 9.5,
              fontStyle: 'bold',
              halign: 'left',
              cellPadding: 3,
            },
          },
        ],
        [
          {
            content: `PERÍODO EVALUADO\nDel ${from} al ${to}`,
            colSpan: 2,
            styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.5 },
          },
          {
            content: `SESIONES PROGRAMADAS\n${summary.total} Registros (${summary.attended} Asistió: ${summary.present} P · ${summary.late} T)`,
            colSpan: 3,
            styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.5 },
          },
          {
            content: `INASISTENCIAS\n${summary.absent} Ausencias  |  ${summary.excused} Justificadas`,
            colSpan: 2,
            styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.5 },
          },
          {
            content: `EFECTIVIDAD GLOBAL\n${pctValue}`,
            colSpan: 2,
            styles: {
              fillColor: (summary.percentage ?? 0) >= 80 ? [220, 252, 231] : (summary.percentage ?? 0) >= 60 ? [254, 243, 199] : [254, 226, 226],
              textColor: pctColor,
              fontStyle: 'bold',
              fontSize: 8.5,
              halign: 'center',
              cellPadding: 2.5,
            },
          },
        ],
        [
          { content: '#', styles: { halign: 'center', cellWidth: 10, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          { content: 'Nadador / Atleta', styles: { cellWidth: 62, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          { content: 'Sesiones', styles: { halign: 'center', cellWidth: 20, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          { content: 'Presente', styles: { halign: 'center', cellWidth: 22, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          { content: 'Tarde', styles: { halign: 'center', cellWidth: 18, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          { content: 'Ausente', styles: { halign: 'center', cellWidth: 20, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          { content: 'Justificada', styles: { halign: 'center', cellWidth: 22, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          { content: '% Asistencia', styles: { halign: 'center', cellWidth: 26, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          { content: 'Evaluación Técnica', styles: { halign: 'center', cellWidth: 'auto', fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
        ],
      ],
      body: tableBody,
      foot: [
        [
          { content: 'TOTALES', colSpan: 2, styles: { fontStyle: 'bold', halign: 'center', fillColor: reportPrint.surface, fontSize: 8 } },
          { content: String(summary.total), styles: { halign: 'center', fontStyle: 'bold', fillColor: reportPrint.surface, fontSize: 8 } },
          { content: String(summary.present), styles: { halign: 'center', fontStyle: 'bold', fillColor: reportPrint.surface, fontSize: 8, textColor: [16, 120, 60] } },
          { content: String(summary.late), styles: { halign: 'center', fontStyle: 'bold', fillColor: reportPrint.surface, fontSize: 8, textColor: [180, 100, 10] } },
          { content: String(summary.absent), styles: { halign: 'center', fontStyle: 'bold', fillColor: reportPrint.surface, fontSize: 8, textColor: [185, 28, 28] } },
          { content: String(summary.excused), styles: { halign: 'center', fontStyle: 'bold', fillColor: reportPrint.surface, fontSize: 8, textColor: [37, 99, 235] } },
          { content: pctValue, styles: { halign: 'center', fontStyle: 'bold', fillColor: reportPrint.surface, fontSize: 8.5, textColor: pctColor } },
          { content: evalLabel, styles: { halign: 'center', fontStyle: 'bold', fillColor: reportPrint.surface, fontSize: 7.5 } },
        ],
        [
          { content: 'Incidencias del Período:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], fontSize: 7.5, cellPadding: 2.5 } },
          { content: incidentsSummary, colSpan: 8, styles: { fontSize: 7.5, cellPadding: 2.5 } },
        ],
        [
          { content: 'Certificación Técnica:', styles: { fontStyle: 'bold', fillColor: [248, 250, 252], fontSize: 7.5, cellPadding: 3 } },
          {
            content: `Firma del Entrenador: _________________________________________        Fecha de Emisión: ${new Date().toLocaleDateString('es-VE')}`,
            colSpan: 8,
            styles: { fontSize: 7.5, cellPadding: 3, fontStyle: 'bold' },
          },
        ],
      ],
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: reportPrint.rule,
        lineWidth: 0.15,
        overflow: 'linebreak',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });
  } else {
    // CASO INDIVIDUAL (UN SOLO ATLETA)
    const singleAthlete = athletes[0]!;
    const athleteRows = rows.filter((r) => r.athlete_id === singleAthlete.id);

    const bodyRows = athleteRows.length > 0 ? athleteRows.map((r, i) => [
      { content: String(i + 1), styles: { halign: 'center', fontSize: 8 } },
      { content: r.training_date, styles: { halign: 'center', fontSize: 8 } },
      { content: trainingSessions[r.session] ?? r.session, styles: { halign: 'center', fontSize: 8 } },
      { content: statusLabel(r.status), styles: { halign: 'center', fontSize: 8, ...statusStyle(r.status) } },
      { content: r.notes && r.notes.trim() ? r.notes.trim() : '—', styles: { fontSize: 7.5 } },
    ]) : [
      [
        { content: 'Sin sesiones de entrenamiento registradas en el período evaluado.', colSpan: 5, styles: { halign: 'center', fontSize: 8, textColor: [100, 116, 139] } },
      ],
    ];

    brandedTable(doc, {
      startY: headingY,
      margin: { left: 14, right: 14, bottom: 20 },
      head: [
        [
          {
            content: `CUADRO RESUMIDO DE ASISTENCIA — ${title.toUpperCase()}`,
            colSpan: 5,
            styles: {
              fillColor: primaryFill,
              textColor: 255,
              fontSize: 9.5,
              fontStyle: 'bold',
              halign: 'left',
              cellPadding: 3,
            },
          },
        ],
        [
          {
            content: `PERÍODO EVALUADO\nDel ${from} al ${to}`,
            colSpan: 1,
            styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.5 },
          },
          {
            content: `SESIONES CONVOCADAS\n${summary.total} Registros (${summary.attended} Asistió: ${summary.present} P · ${summary.late} T)`,
            colSpan: 2,
            styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.5 },
          },
          {
            content: `INASISTENCIAS\n${summary.absent} Ausencias · ${summary.excused} Justificadas`,
            colSpan: 1,
            styles: { fillColor: [241, 245, 249], textColor: [15, 23, 42], fontStyle: 'bold', fontSize: 7.5, halign: 'center', cellPadding: 2.5 },
          },
          {
            content: `EFECTIVIDAD GLOBAL\n${pctValue}`,
            colSpan: 1,
            styles: {
              fillColor: (summary.percentage ?? 0) >= 80 ? [220, 252, 231] : (summary.percentage ?? 0) >= 60 ? [254, 243, 199] : [254, 226, 226],
              textColor: pctColor,
              fontStyle: 'bold',
              fontSize: 8.5,
              halign: 'center',
              cellPadding: 2.5,
            },
          },
        ],
        [
          { content: '#', styles: { halign: 'center', cellWidth: 12, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          { content: 'Fecha', styles: { halign: 'center', cellWidth: 28, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          { content: 'Sesión', styles: { halign: 'center', cellWidth: 32, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          { content: 'Estado de Asistencia', styles: { halign: 'center', cellWidth: 42, fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
          { content: 'Observación / Justificación', styles: { halign: 'left', fillColor: [30, 41, 59], textColor: 255, fontStyle: 'bold', fontSize: 8 } },
        ],
      ],
      body: bodyRows,
      foot: [
        [
          { content: 'Evaluación:', styles: { fontStyle: 'bold', fillColor: reportPrint.surface, fontSize: 8, cellPadding: 2.5 } },
          { content: `${evalLabel}. Cumplimiento del ${pctValue} en ${summary.total} sesiones programadas.`, colSpan: 4, styles: { fontSize: 7.5, cellPadding: 2.5 } },
        ],
        [
          { content: 'Certificación:', styles: { fontStyle: 'bold', fillColor: reportPrint.surface, fontSize: 8, cellPadding: 3 } },
          {
            content: `Firma del Entrenador: _________________________________________        Fecha: ${new Date().toLocaleDateString('es-VE')}`,
            colSpan: 4,
            styles: { fontSize: 7.5, cellPadding: 3, fontStyle: 'bold' },
          },
        ],
      ],
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 2,
        lineColor: reportPrint.rule,
        lineWidth: 0.15,
        overflow: 'linebreak',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
    });
  }

  // Pie de página educativo y numeración
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFontSize(7);
    doc.setTextColor(reportPrint.muted);
    doc.text(
      'Asistencia calculada: (presentes + tarde) / sesiones convocadas. Documento oficial generado por Swim Lane Coach.',
      14,
      doc.internal.pageSize.getHeight() - 10
    );
    doc.text(
      `Página ${page} de ${totalPages}`,
      doc.internal.pageSize.getWidth() - 14,
      doc.internal.pageSize.getHeight() - 10,
      { align: 'right' }
    );
  }

  finishReport(doc, brand);
  return new File([doc.output('blob')], exportFilename(title, '_asistencia.pdf'), { type: 'application/pdf' });
}
