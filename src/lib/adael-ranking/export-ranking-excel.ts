/**
 * Generador de Hoja de Cálculo Excel (.xlsx) — Ranking Federado ADAEL 2026
 * Ubicación: src/lib/adael-ranking/export-ranking-excel.ts
 */

import ExcelJS from 'exceljs';
import type { RankedAthleteItem, AdaelRankingFilters } from '@/services/adaelRanking';
import type { NationalStandardResult } from './national-standards-feveda';

export interface GenerateAdaelExcelParams {
  rankedItems: RankedAthleteItem[];
  filters: AdaelRankingFilters;
  meetsCount: number;
  lastUpdatedDate: string;
  selectedStandard?: NationalStandardResult | null;
  eventName: string;
  categoryName: string;
}

export async function generateAdaelRankingExcel({
  rankedItems,
  filters,
  meetsCount,
  lastUpdatedDate,
  selectedStandard,
  eventName,
  categoryName,
}: GenerateAdaelExcelParams): Promise<File> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Swim Lane Coach — ADAEL Lara';
  workbook.created = new Date();

  const sheetName = `${eventName.slice(0, 20)} ${filters.course}`.replace(/[:\\/?*[\]]/g, '_');
  const worksheet = workbook.addWorksheet(sheetName.slice(0, 31), {
    views: [{ state: 'frozen', ySplit: 7 }],
    properties: { tabColor: { argb: '1E3A8A' } },
  });

  // 1. Título y Encabezado Institucional
  worksheet.mergeCells('A1:R1');
  const titleCell = worksheet.getCell('A1');
  titleCell.value = 'ASOCIACIÓN DE DEPORTES ACUÁTICOS DEL ESTADO LARA (ADAEL)';
  titleCell.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FFFFFF' } };
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells('A2:R2');
  const subTitleCell = worksheet.getCell('A2');
  subTitleCell.value = `RANKING OFICIAL NATACIÓN FEDERADA — TEMPORADA 2026 | ${eventName} (${filters.course === 'LCM' ? '50m Piscina Larga' : '25m Piscina Corta'})`;
  subTitleCell.font = { name: 'Calibri', size: 11, bold: true, color: { argb: '1E3A8A' } };
  subTitleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EEF2FF' } };
  subTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 22;

  // 2. Ficha de Filtros y Metadatos (Filas 3 a 5)
  const genderLabel = filters.gender === 'F' ? 'Femenino' : filters.gender === 'M' ? 'Masculino' : 'Todos';
  const ageModeLabel = filters.ageMode === 'MEET_DATE' ? 'Edad al día del evento' : 'Edad al 31/12/2026 (Oficial FEVEDA)';
  const clubLabel = filters.clubCode && filters.clubCode !== 'all' ? filters.clubCode : 'Todos los Clubes Afiliados';

  worksheet.getCell('A3').value = `Categoría: ${categoryName}`;
  worksheet.getCell('E3').value = `Rama: ${genderLabel}`;
  worksheet.getCell('I3').value = `Cálculo de Edad: ${ageModeLabel}`;
  worksheet.getCell('M3').value = `Club: ${clubLabel}`;

  worksheet.getCell('A4').value = `Torneos Computados: ${meetsCount}`;
  worksheet.getCell('E4').value = `Total Atletas Clasificados: ${rankedItems.length}`;
  worksheet.getCell('I4').value = `Fecha de Emisión: ${new Date().toLocaleDateString('es-VE')}`;
  worksheet.getCell('M4').value = selectedStandard
    ? `Corte Ref.: ${selectedStandard.standardLabel} (${selectedStandard.formattedTime})`
    : 'Corte Ref.: Ninguno';

  worksheet.getRow(3).font = { name: 'Calibri', size: 9, bold: true, color: { argb: '374151' } };
  worksheet.getRow(4).font = { name: 'Calibri', size: 9, bold: true, color: { argb: '374151' } };
  worksheet.getRow(5).height = 8; // Espaciador

  // 3. Encabezados de Columna (Fila 7)
  const headers = [
    'Puesto',
    'Tiempo Oficial',
    'Tiempo (ms)',
    'Puntos WA',
    'Nombre del Atleta',
    'Sexo',
    'Fecha Nac.',
    'Edad',
    'Categoría Federativa',
    'Código Club',
    'Nombre del Club',
    'Asociación',
    'Torneo Oficial 2026',
    'Fecha Torneo',
    '1er Tramo Relevo',
    'Marca Ref.',
    'Diferencia',
    'Estatus Marca',
  ];

  const headerRow = worksheet.getRow(7);
  headerRow.values = headers;
  headerRow.height = 24;
  headerRow.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFF' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };

  for (let col = 1; col <= headers.length; col++) {
    const cell = headerRow.getCell(col);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '1E3A8A' } };
    cell.border = {
      top: { style: 'thin', color: { argb: 'CBD5E1' } },
      bottom: { style: 'medium', color: { argb: '0F172A' } },
      left: { style: 'thin', color: { argb: 'CBD5E1' } },
      right: { style: 'thin', color: { argb: 'CBD5E1' } },
    };
  }

  // 4. Datos del Ranking
  rankedItems.forEach((item, index) => {
    let diffStr = '—';
    let estatusStr = '—';

    if (selectedStandard && item.timeMs > 0) {
      const diffMs = item.timeMs - selectedStandard.timeMs;
      const isQualified = diffMs <= 0;
      const sec = Math.abs(diffMs / 1000).toFixed(2);
      diffStr = isQualified ? `-${sec}s` : `+${sec}s`;
      estatusStr = isQualified ? 'CLASIFICADO' : 'NO ALCANZADA';
    }

    const rowData = [
      item.rank,
      item.formattedTime,
      item.timeMs,
      item.waPoints || 0,
      item.swimmerName,
      item.gender,
      item.birthDate,
      item.age,
      item.categoryLabel,
      item.clubCode,
      item.clubName,
      item.associationCode,
      item.meetName,
      item.meetDate,
      item.isRelayLeadOff ? 'SÍ (Lead-off)' : 'NO',
      selectedStandard ? selectedStandard.formattedTime : '—',
      diffStr,
      estatusStr,
    ];

    const row = worksheet.addRow(rowData);
    row.height = 20;

    // Estilos de celda
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' }; // Puesto
    row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' }; // Tiempo
    row.getCell(2).font = { bold: true };
    row.getCell(3).alignment = { horizontal: 'right', vertical: 'middle' };  // Ms
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' }; // WA Points
    row.getCell(5).alignment = { horizontal: 'left', vertical: 'middle' };   // Atleta
    row.getCell(6).alignment = { horizontal: 'center', vertical: 'middle' }; // Sexo
    row.getCell(7).alignment = { horizontal: 'center', vertical: 'middle' }; // Nac
    row.getCell(8).alignment = { horizontal: 'center', vertical: 'middle' }; // Edad
    row.getCell(10).alignment = { horizontal: 'center', vertical: 'middle' }; // Club code
    row.getCell(10).font = { bold: true };
    row.getCell(12).alignment = { horizontal: 'center', vertical: 'middle' }; // Lara
    row.getCell(14).alignment = { horizontal: 'center', vertical: 'middle' }; // Fecha
    row.getCell(15).alignment = { horizontal: 'center', vertical: 'middle' }; // Lead-off
    row.getCell(16).alignment = { horizontal: 'center', vertical: 'middle' }; // Marca ref
    row.getCell(17).alignment = { horizontal: 'center', vertical: 'middle' }; // Dif
    row.getCell(18).alignment = { horizontal: 'center', vertical: 'middle' }; // Estatus

    // Podio (Top 3) colores suaves
    if (index === 0) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FEF3C7' } }; // Oro
    } else if (index === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F1F5F9' } }; // Plata
    } else if (index === 2) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDD5' } }; // Bronce
    } else if (index % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } }; // Alternante
    }

    // Color del estatus clasificatorio
    if (estatusStr === 'CLASIFICADO') {
      row.getCell(18).font = { bold: true, color: { argb: '047857' } }; // Verde
      row.getCell(17).font = { bold: true, color: { argb: '047857' } };
    }

    // Bordes delgados para cada celda
    for (let c = 1; c <= headers.length; c++) {
      row.getCell(c).border = {
        top: { style: 'thin', color: { argb: 'E2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'E2E8F0' } },
        left: { style: 'thin', color: { argb: 'E2E8F0' } },
        right: { style: 'thin', color: { argb: 'E2E8F0' } },
      };
    }
  });

  // 5. Configurar ancho automático de columnas
  worksheet.columns = [
    { width: 10 }, // Puesto
    { width: 15 }, // Tiempo Oficial
    { width: 13 }, // Tiempo ms
    { width: 13 }, // Puntos WA
    { width: 30 }, // Nombre Atleta
    { width: 8 },  // Sexo
    { width: 14 }, // Nac.
    { width: 8 },  // Edad
    { width: 22 }, // Categoría
    { width: 14 }, // Club Code
    { width: 32 }, // Club Name
    { width: 14 }, // Asoc
    { width: 35 }, // Torneo
    { width: 14 }, // Fecha
    { width: 18 }, // Lead-off
    { width: 14 }, // Marca Ref.
    { width: 14 }, // Dif
    { width: 18 }, // Estatus
  ];

  // 6. Filtros automáticos en fila 7
  worksheet.autoFilter = {
    from: { row: 7, column: 1 },
    to: { row: Math.max(7, rankedItems.length + 7), column: headers.length },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const cleanEvent = eventName.replace(/\s+/g, '_');
  const filename = `Ranking_Oficial_ADAEL_2026_${cleanEvent}_${filters.course}.xlsx`;

  return new File([buffer], filename, {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
}
