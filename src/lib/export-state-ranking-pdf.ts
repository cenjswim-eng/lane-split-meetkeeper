/**
 * Generador de PDF Oficial — Ranking Estadal por Edades
 * Ubicación: src/lib/export-state-ranking-pdf.ts
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { RankedSwimResult, StateRankingSummary, RankingFilters } from './state-ranking';

export interface GenerateStateRankingPdfParams {
  rankedItems: RankedSwimResult[];
  summary: StateRankingSummary;
  filters: RankingFilters;
  eventLabel: string;
  categoryLabel: string;
  courseLabel: string;
  genderLabel: string;
  activeClubName?: string;
}

export function generateStateRankingPdf({
  rankedItems,
  summary,
  filters,
  eventLabel,
  categoryLabel,
  courseLabel,
  genderLabel,
  activeClubName = 'Mi Club',
}: GenerateStateRankingPdfParams): File {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Encabezado Oficial Estadal
  doc.setFillColor(30, 58, 138); // Azul institucional #1E3A8A
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Acento dorado inferior
  doc.setFillColor(217, 119, 6); // Ámbar dorado #D97706
  doc.rect(0, 24, pageWidth, 2, 'F');

  // Textos del encabezado
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(`RANKING ESTADAL OFICIAL — ASOCIACIÓN ${summary.activeState.toUpperCase()}`, 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(224, 231, 255);
  doc.text(`FEDERACIÓN VENEZOLANA DE DEPORTES ACUÁTICOS (FEVEDA) — TEMPORADA ${filters.referenceYear}`, 14, 18);

  // Fecha y Club en el extremo derecho del encabezado
  doc.setFontSize(8.5);
  doc.text(`Club Activo: ${activeClubName} (${summary.myClubCode})`, pageWidth - 14, 11, { align: 'right' });
  doc.text(`Fecha Emisión: ${new Date().toLocaleDateString('es-VE')}`, pageWidth - 14, 18, { align: 'right' });

  // 2. Franja de Filtros y Parámetros
  doc.setFillColor(243, 244, 246);
  doc.rect(14, 29, pageWidth - 28, 12, 'F');
  doc.setDrawColor(229, 231, 235);
  doc.rect(14, 29, pageWidth - 28, 12, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(31, 41, 55);
  doc.text('Parámetros:', 18, 36.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(75, 85, 99);
  const filterSummary = `Prueba: ${eventLabel}  |  Piscina: ${courseLabel}  |  Género: ${genderLabel}  |  Categoría: ${categoryLabel}  |  Estado: ${summary.activeState}`;
  doc.text(filterSummary, 42, 36.5);

  // 3. Tarjeta de KPIs y Métricas de "Mi Club" vs Rivales
  doc.setFillColor(239, 246, 255); // Azul tenue #EFF6FF
  doc.roundedRect(14, 44, pageWidth - 28, 14, 2, 2, 'F');
  doc.setDrawColor(191, 219, 254);
  doc.roundedRect(14, 44, pageWidth - 28, 14, 2, 2, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(30, 58, 138);

  // Desglose de Top 8
  const top8DistText = summary.top8ClubDistribution.length > 0
    ? summary.top8ClubDistribution.map(c => `${c.clubCode}: ${c.count}`).join(' · ')
    : 'Sin datos';

  doc.text(`En Top 8 Estadal (${summary.myClubCode}): ${summary.myClubTop8Count} atleta(s)`, 18, 50.5);
  doc.text(`Brecha vs #1: ${summary.myClubLeaderGapText}`, 18, 55);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(55, 65, 81);
  doc.text(`Dominancia Top 8 por Club: ${top8DistText}`, pageWidth - 18, 52.5, { align: 'right' });

  // 4. Tabla de Posiciones
  const tableData = rankedItems.map((item) => [
    item.rank === 1 ? '1 🥇' : item.rank === 2 ? '2 🥈' : item.rank === 3 ? '3 🥉' : `#${item.rank}`,
    item.isMyClub ? `★ ${item.athleteName}` : item.athleteName,
    String(item.age),
    item.isMyClub ? `${item.clubCode} (MI CLUB)` : item.clubCode,
    item.timeFormatted,
    item.diffFromLeader,
    item.diffVsMyClub,
    item.aquaPoints ? String(item.aquaPoints) : '—',
    item.meetName || 'Oficial',
    item.meetDate || '—',
  ]);

  autoTable(doc, {
    startY: 61,
    head: [[
      'Pos',
      'Atleta',
      'Edad',
      'Club',
      'Tiempo',
      'Dif. #1',
      `Dif. ${summary.myClubCode}`,
      'Puntos AQUA',
      'Torneo Oficial',
      'Fecha',
    ]],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'center',
      cellPadding: 2,
    },
    bodyStyles: {
      fontSize: 8,
      cellPadding: 2,
      textColor: [31, 41, 55],
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 16 },
      1: { halign: 'left', cellWidth: 54 },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'center', cellWidth: 32 },
      4: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
      5: { halign: 'center', cellWidth: 18 },
      6: { halign: 'center', cellWidth: 22 },
      7: { halign: 'center', cellWidth: 22 },
      8: { halign: 'left', cellWidth: 52 },
      9: { halign: 'center', cellWidth: 20 },
    },
    didParseCell: (data) => {
      if (data.section === 'body') {
        const item = rankedItems[data.row.index];
        if (item) {
          // Resaltado de podio
          if (item.rank === 1) {
            data.cell.styles.fillColor = [254, 249, 195]; // Oro tenue #FEF9C3
          } else if (item.rank === 2) {
            data.cell.styles.fillColor = [243, 244, 246]; // Plata #F3F4F6
          } else if (item.rank === 3) {
            data.cell.styles.fillColor = [254, 237, 213]; // Bronce #FFEDD5
          }

          // Resaltado especial para Mi Club
          if (item.isMyClub) {
            data.cell.styles.textColor = [30, 58, 138];
            data.cell.styles.fontStyle = 'bold';
            if (item.rank > 3) {
              data.cell.styles.fillColor = [239, 246, 255]; // Azul suave
            }
          }
        }
      }
    },
    didDrawPage: (data) => {
      // Pie de página
      doc.setFontSize(7.5);
      doc.setTextColor(156, 163, 175);
      const pageStr = `Página ${doc.getNumberOfPages()}`;
      doc.text(
        'SwimLaneCoach — Ranking Estadal Oficial FEVEDA · Basado en mejores marcas personales oficiales.',
        14,
        pageHeight - 6
      );
      doc.text(pageStr, pageWidth - 14, pageHeight - 6, { align: 'right' });
    },
  });

  const cleanEvent = eventLabel.replace(/[^a-z0-9]/gi, '_');
  const cleanState = summary.activeState.replace(/[^a-z0-9]/gi, '_');
  const filename = `Ranking_Estadal_${cleanState}_${cleanEvent}_${filters.course}_${filters.referenceYear}.pdf`;

  const blob = doc.output('blob');
  return new File([blob], filename, { type: 'application/pdf' });
}
