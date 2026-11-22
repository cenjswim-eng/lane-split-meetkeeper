/**
 * Generador de PDF Oficial — Ranking Federado ADAEL 2026
 * Ubicación: src/lib/adael-ranking/export-ranking-pdf.ts
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { RankedAthleteItem, AdaelRankingFilters } from '@/services/adaelRanking';
import type { NationalStandardResult } from './national-standards-feveda';

export interface GenerateAdaelPdfParams {
  rankedItems: RankedAthleteItem[];
  filters: AdaelRankingFilters;
  meetsCount: number;
  lastUpdatedDate: string;
  selectedStandard?: NationalStandardResult | null;
  eventName: string;
  categoryName: string;
}

export function generateAdaelRankingPdf({
  rankedItems,
  filters,
  meetsCount,
  lastUpdatedDate,
  selectedStandard,
  eventName,
  categoryName,
}: GenerateAdaelPdfParams): File {
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  // 1. Encabezado Oficial ADAEL Lara
  doc.setFillColor(30, 58, 138); // Azul institucional #1E3A8A
  doc.rect(0, 0, pageWidth, 24, 'F');

  // Acento dorado inferior
  doc.setFillColor(217, 119, 6); // Ámbar dorado #D97706
  doc.rect(0, 24, pageWidth, 2, 'F');

  // Textos del encabezado
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text('ASOCIACIÓN DE DEPORTES ACUÁTICOS DEL ESTADO LARA (ADAEL)', 14, 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(224, 231, 255);
  doc.text('RANKING OFICIAL NATACIÓN FEDERADA — TEMPORADA 2026 (FEVEDA / WORLD AQUATICS)', 14, 18);

  // Fecha y Torneos en el extremo derecho del encabezado
  doc.setFontSize(8.5);
  doc.text(`Torneos Computados: ${meetsCount}`, pageWidth - 14, 11, { align: 'right' });
  doc.text(`Fecha de Emisión: ${new Date().toLocaleDateString('es-VE')}`, pageWidth - 14, 18, { align: 'right' });

  // 2. Ficha Técnica / Metadatos de la Prueba
  doc.setTextColor(31, 41, 55);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(`Prueba: ${eventName} — ${filters.course === 'LCM' ? 'Piscina Larga (50m LCM)' : 'Piscina Corta (25m SCM)'}`, 14, 34);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(75, 85, 99);

  const genderLabel = filters.gender === 'F' ? 'Femenino' : filters.gender === 'M' ? 'Masculino' : 'Ambos Sexos';
  const ageModeLabel = filters.ageMode === 'MEET_DATE' ? 'Edad al día del torneo' : 'Edad al 31/12/2026 (Oficial FEVEDA)';
  const clubLabel = filters.clubCode && filters.clubCode !== 'all' ? `Club: ${filters.clubCode}` : 'Todos los Clubes ADAEL';

  doc.text(`Categoría: ${categoryName}  ·  Rama: ${genderLabel}  ·  ${ageModeLabel}  ·  ${clubLabel}`, 14, 40);

  if (selectedStandard) {
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(4, 120, 87); // Verde esmeralda
    doc.text(`Referencia Clasificatoria: ${selectedStandard.standardLabel} (${selectedStandard.formattedTime})`, 14, 46);
  }

  // 3. Preparación de Filas de la Tabla
  const head = [
    [
      'Pos',
      'Tiempo',
      'Puntos WA',
      'Atleta',
      'Edad',
      'Club',
      'Torneo',
      'Fecha',
      selectedStandard ? 'Dif. Marca' : 'Registro',
    ],
  ];

  const body = rankedItems.map((item) => {
    let diffStr = '—';
    if (selectedStandard && item.timeMs > 0) {
      const diffMs = item.timeMs - selectedStandard.timeMs;
      const isOk = diffMs <= 0;
      const sec = Math.abs(diffMs / 1000).toFixed(2);
      diffStr = isOk ? `✓ -${sec}s` : `+${sec}s`;
    } else if (item.isRelayLeadOff) {
      diffStr = 'Relevo (1er tramo)';
    }

    const posStr = item.rank === 1 ? '🥇 1' : item.rank === 2 ? '🥈 2' : item.rank === 3 ? '🥉 3' : `${item.rank}`;

    return [
      posStr,
      item.formattedTime + (item.isRelayLeadOff ? ' *' : ''),
      item.waPoints ? `${item.waPoints} pts` : '—',
      item.swimmerName,
      `${item.age} años`,
      item.clubCode,
      item.meetName,
      item.meetDate,
      diffStr,
    ];
  });

  const startY = selectedStandard ? 50 : 45;

  autoTable(doc, {
    head,
    body,
    startY,
    theme: 'grid',
    margin: { left: 14, right: 14, bottom: 25 },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: 2.2,
      textColor: [31, 41, 55],
      lineColor: [229, 231, 235],
      lineWidth: 0.1,
    },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      halign: 'center',
    },
    alternateRowStyles: {
      fillColor: [249, 250, 251],
    },
    columnStyles: {
      0: { halign: 'center', fontStyle: 'bold', cellWidth: 14 },
      1: { halign: 'center', fontStyle: 'bold', cellWidth: 22 },
      2: { halign: 'center', cellWidth: 22 },
      3: { fontStyle: 'bold', cellWidth: 55 },
      4: { halign: 'center', cellWidth: 18 },
      5: { halign: 'center', fontStyle: 'bold', cellWidth: 20 },
      6: { cellWidth: 'auto' },
      7: { halign: 'center', cellWidth: 22 },
      8: { halign: 'center', cellWidth: 28 },
    },
    didParseCell: (data) => {
      // Estilo de podio para las 3 primeras filas del ranking
      if (data.section === 'body') {
        const rowIndex = data.row.index;
        if (rowIndex === 0) {
          data.cell.styles.fillColor = [254, 243, 199]; // Dorado claro
        } else if (rowIndex === 1) {
          data.cell.styles.fillColor = [241, 245, 249]; // Plateado suave
        } else if (rowIndex === 2) {
          data.cell.styles.fillColor = [255, 237, 213]; // Bronce suave
        }

        // Columna de diferencia de marca
        if (data.column.index === 8 && typeof data.cell.raw === 'string' && data.cell.raw.startsWith('✓')) {
          data.cell.styles.textColor = [4, 120, 87];
          data.cell.styles.fontStyle = 'bold';
        }
      }
    },
    didDrawPage: (data) => {
      // Pie de página oficial en cada página
      const totalPages = (doc as any).internal.getNumberOfPages();
      const currentPage = (doc as any).internal.getCurrentPageInfo().pageNumber;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);

      doc.text(
        '* Marca lograda en primer tramo de relevo reglamentario (Lead-off). Documento oficial generado por swimlanecoach.app para ADAEL Lara.',
        14,
        pageHeight - 12
      );

      doc.text(
        `Página ${currentPage} de ${totalPages}`,
        pageWidth - 14,
        pageHeight - 12,
        { align: 'right' }
      );

      // Línea divisoria inferior
      doc.setDrawColor(229, 231, 235);
      doc.line(14, pageHeight - 16, pageWidth - 14, pageHeight - 16);
    },
  });

  // 4. Bloque de Firmas y Validación Institucional en la última página
  const finalY = (doc as any).lastAutoTable.finalY + 12;
  if (finalY < pageHeight - 25) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(75, 85, 99);

    const sigLeft = 45;
    const sigRight = pageWidth - 90;

    doc.line(sigLeft, finalY + 12, sigLeft + 55, finalY + 12);
    doc.text('COMISIÓN TÉCNICA ADAEL', sigLeft + 7, finalY + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Validador Oficial Temporada 2026', sigLeft + 6, finalY + 20);

    doc.line(sigRight, finalY + 12, sigRight + 55, finalY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('SECRETARÍA GENERAL ADAEL', sigRight + 4, finalY + 16);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('Asociación Deportes Acuáticos Lara', sigRight + 5, finalY + 20);
  }

  const cleanEvent = eventName.replace(/\s+/g, '_');
  const filename = `Ranking_Oficial_ADAEL_2026_${cleanEvent}_${filters.course}.pdf`;
  return new File([doc.output('blob')], filename, { type: 'application/pdf' });
}
