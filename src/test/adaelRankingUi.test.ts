/**
 * Pruebas Unitarias para Frontend y Exportaciones — Ranking ADAEL 2026 (Agente 3)
 * Ubicación: src/test/adaelRankingUi.test.ts
 */

import { describe, it, expect } from 'vitest';
import {
  getFevedaNationalStandard,
  compareAthleteWithStandard,
} from '@/lib/adael-ranking/national-standards-feveda';
import { generateAdaelRankingPdf } from '@/lib/adael-ranking/export-ranking-pdf';
import { generateAdaelRankingExcel } from '@/lib/adael-ranking/export-ranking-excel';
import type { RankedAthleteItem } from '@/services/adaelRanking';

describe('Agente 3: Marcas Mínimas Nacionales FEVEDA', () => {
  it('encuentra la Marca A Nacional para 100m Libre Masculino Juvenil A (15 años) en LCM', () => {
    const std = getFevedaNationalStandard({
      course: 'LCM',
      gender: 'M',
      distance: 100,
      stroke: 'FREE',
      age: 15,
      standardType: 'A',
    });

    expect(std).not.toBeNull();
    expect(std?.standardLabel).toBe('Marca A Nacional');
    expect(std?.timeMs).toBe(57500); // 57.50s
    expect(std?.formattedTime).toBe('57.50');
  });

  it('calcula la Marca B (+3.5%) para 100m Libre Masculino Juvenil A en LCM', () => {
    const std = getFevedaNationalStandard({
      course: 'LCM',
      gender: 'M',
      distance: 100,
      stroke: 'FREE',
      age: 15,
      standardType: 'B',
    });

    expect(std).not.toBeNull();
    expect(std?.standardLabel).toBe('Marca B Nacional');
    expect(std?.timeMs).toBe(Math.round(57500 * 1.035)); // ~59.51s
  });

  it('aplica conversión para Piscina Corta (25m SCM)', () => {
    const stdLcm = getFevedaNationalStandard({
      course: 'LCM',
      gender: 'M',
      distance: 50,
      stroke: 'FREE',
      age: 17,
      standardType: 'A',
    });
    const stdScm = getFevedaNationalStandard({
      course: 'SCM',
      gender: 'M',
      distance: 50,
      stroke: 'FREE',
      age: 17,
      standardType: 'A',
    });

    expect(stdLcm).not.toBeNull();
    expect(stdScm).not.toBeNull();
    expect(stdScm!.timeMs).toBeLessThan(stdLcm!.timeMs);
  });

  it('compara correctamente el tiempo de un nadador contra la Marca Mínima', () => {
    const standard = getFevedaNationalStandard({
      course: 'LCM',
      gender: 'M',
      distance: 100,
      stroke: 'FREE',
      age: 15,
      standardType: 'A',
    }); // 57500 ms (57.50s)

    // Caso 1: Nadador supera la marca (56.80s vs 57.50s = -0.70s)
    const compQual = compareAthleteWithStandard(56800, standard);
    expect(compQual).not.toBeNull();
    expect(compQual?.isQualified).toBe(true);
    expect(compQual?.difMs).toBe(-700);
    expect(compQual?.formattedDiff).toBe('-0.70s');

    // Caso 2: Nadador no alcanza la marca (58.90s vs 57.50s = +1.40s)
    const compNot = compareAthleteWithStandard(58900, standard);
    expect(compNot).not.toBeNull();
    expect(compNot?.isQualified).toBe(false);
    expect(compNot?.difMs).toBe(1400);
    expect(compNot?.formattedDiff).toBe('+1.40s');
  });
});

describe('Agente 3: Exportaciones Oficiales PDF y Excel', () => {
  const sampleRankedItems: RankedAthleteItem[] = [
    {
      rank: 1,
      swimmerId: 'AD-001',
      swimmerName: 'Alejandro Morales',
      gender: 'M',
      birthDate: '2011-04-15',
      age: 15,
      categoryLabel: 'Juvenil A (14-15 años)',
      singleAgeLabel: '15 años',
      clubCode: 'PISBO',
      clubName: 'Club Piscinas Bolivarianas de Lara',
      associationCode: 'LARA',
      meetName: 'I Invitacional ADAEL Lara 2026',
      meetDate: '2026-03-14',
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      timeMs: 56800,
      formattedTime: '56.80',
      status: 'OK',
      isExhibition: false,
      isRelayLeadOff: false,
      waPoints: 610,
    },
    {
      rank: 2,
      swimmerId: 'AD-002',
      swimmerName: 'Santiago Rodríguez',
      gender: 'M',
      birthDate: '2011-08-20',
      age: 15,
      categoryLabel: 'Juvenil A (14-15 años)',
      singleAgeLabel: '15 años',
      clubCode: 'HISP',
      clubName: 'Club Hogar Hispano de Lara',
      associationCode: 'LARA',
      meetName: 'I Invitacional ADAEL Lara 2026',
      meetDate: '2026-03-14',
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      timeMs: 57200,
      formattedTime: '57.20',
      status: 'OK',
      isExhibition: false,
      isRelayLeadOff: false,
      waPoints: 598,
    },
    {
      rank: 3,
      swimmerId: 'AD-003',
      swimmerName: 'Gabriel Torrealba',
      gender: 'M',
      birthDate: '2011-11-05',
      age: 15,
      categoryLabel: 'Juvenil A (14-15 años)',
      singleAgeLabel: '15 años',
      clubCode: 'CDLARA',
      clubName: 'Club Deportivo Lara',
      associationCode: 'LARA',
      meetName: 'I Invitacional ADAEL Lara 2026',
      meetDate: '2026-03-14',
      distance: 100,
      stroke: 'FREE',
      course: 'LCM',
      timeMs: 58400,
      formattedTime: '58.40',
      status: 'OK',
      isExhibition: false,
      isRelayLeadOff: true, // Lead-off split
      waPoints: 561,
    },
  ];

  it('genera correctamente el documento PDF Oficial ADAEL con firmas y podio', () => {
    const standard = getFevedaNationalStandard({
      course: 'LCM',
      gender: 'M',
      distance: 100,
      stroke: 'FREE',
      age: 15,
      standardType: 'A',
    });

    const pdfFile = generateAdaelRankingPdf({
      rankedItems: sampleRankedItems,
      filters: {
        distance: 100,
        stroke: 'FREE',
        course: 'LCM',
        gender: 'M',
        category: 'JUVENIL_A',
      },
      meetsCount: 3,
      lastUpdatedDate: '2026-03-14',
      selectedStandard: standard,
      eventName: '100m Libre',
      categoryName: 'Juvenil A (14-15 años)',
    });

    expect(pdfFile).toBeDefined();
    expect(pdfFile.name).toContain('Ranking_Oficial_ADAEL_2026');
    expect(pdfFile.name).toContain('.pdf');
    expect(pdfFile.type).toBe('application/pdf');
    expect(pdfFile.size).toBeGreaterThan(1000); // Contenido binario válido
  });

  it('genera correctamente la Hoja de Cálculo Excel (.xlsx) con metadatos y fórmulas', async () => {
    const standard = getFevedaNationalStandard({
      course: 'LCM',
      gender: 'M',
      distance: 100,
      stroke: 'FREE',
      age: 15,
      standardType: 'A',
    });

    const excelFile = await generateAdaelRankingExcel({
      rankedItems: sampleRankedItems,
      filters: {
        distance: 100,
        stroke: 'FREE',
        course: 'LCM',
        gender: 'M',
        category: 'JUVENIL_A',
      },
      meetsCount: 3,
      lastUpdatedDate: '2026-03-14',
      selectedStandard: standard,
      eventName: '100m Libre',
      categoryName: 'Juvenil A (14-15 años)',
    });

    expect(excelFile).toBeDefined();
    expect(excelFile.name).toContain('Ranking_Oficial_ADAEL_2026');
    expect(excelFile.name).toContain('.xlsx');
    expect(excelFile.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(excelFile.size).toBeGreaterThan(1000);
  });
});
