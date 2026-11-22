/**
 * Pruebas Unitarias para Extracción de Clubes desde PDF y Generación de Ranking
 * Ubicación: src/test/adaelClubPdfExtractor.test.ts
 */

import { describe, it, expect } from 'vitest';
import { parseClubPdfLines } from '@/lib/adael-ranking/club-pdf-extractor';
import { getAdaelRanking2026, type RawSwimRecord } from '@/services/adaelRanking';

describe('Módulo: Extractor de Clubes desde PDF (ADAEL 2026)', () => {
  it('extrae clubes en formato tabular con pipes o espacios múltiples', () => {
    const sampleLines = [
      'ASOCIACIÓN DE DEPORTES ACUÁTICOS DEL ESTADO LARA',
      'LISTADO OFICIAL DE CLUBES AFILIADOS - TEMPORADA 2026',
      'N° | CÓDIGO | NOMBRE DEL CLUB | ASOCIACIÓN | ESTATUS',
      '1 | PISBO | Club Piscinas Bolivarianas de Lara | LARA | Afiliado 2026',
      '2 | HISP | Club Hogar Hispano de Lara | LARA | Solvente',
      '3 | BARQ | Club Barquisimeto | LARA | Afiliado',
    ];

    const clubs = parseClubPdfLines(sampleLines);

    expect(clubs.length).toBe(3);

    const pisbo = clubs.find((c) => c.code === 'PISBO');
    expect(pisbo).toBeDefined();
    expect(pisbo?.name).toContain('Piscinas Bolivarianas');
    expect(pisbo?.association).toBe('LARA');
    expect(pisbo?.isFederated).toBe(true);

    const hisp = clubs.find((c) => c.code === 'HISP');
    expect(hisp).toBeDefined();
    expect(hisp?.code).toBe('HISP');
  });

  it('extrae clubes con código entre corchetes o paréntesis', () => {
    const sampleLines = [
      '1. Club Deportivo Lara [CDLARA] - Estado Lara',
      '2. Club Aqualara (AQUALARA) - Lara',
      '3. Centro Social Larense [CSLAR] - Lara',
    ];

    const clubs = parseClubPdfLines(sampleLines);

    expect(clubs.length).toBe(3);
    expect(clubs.some((c) => c.code === 'CDLARA')).toBe(true);
    expect(clubs.some((c) => c.code === 'AQUALARA')).toBe(true);
    expect(clubs.some((c) => c.code === 'CSLAR')).toBe(true);
  });

  it('extrae clubes con código al inicio con guión o dos puntos', () => {
    const sampleLines = [
      'TRIL - Club Triatlón Lara',
      'TARL: Club Tarpones de Lara',
      'PALM - Club Las Palmas de Lara',
    ];

    const clubs = parseClubPdfLines(sampleLines);

    expect(clubs.length).toBe(3);
    expect(clubs.find((c) => c.code === 'TRIL')?.name).toContain('Triatlón Lara');
    expect(clubs.find((c) => c.code === 'TARL')?.name).toContain('Tarpones de Lara');
    expect(clubs.find((c) => c.code === 'PALM')?.name).toContain('Las Palmas');
  });

  it('deduplica clubes si aparecen repetidos en varias páginas del documento', () => {
    const sampleLines = [
      'PISBO - Club Piscinas Bolivarianas',
      'PISBO | Piscinas Bolivarianas de Lara | LARA',
      'HISP - Hogar Hispano',
      'HISP [HISP] - Club Hogar Hispano',
    ];

    const clubs = parseClubPdfLines(sampleLines);

    expect(clubs.length).toBe(2);
    expect(clubs.filter((c) => c.code === 'PISBO').length).toBe(1);
    expect(clubs.filter((c) => c.code === 'HISP').length).toBe(1);
  });

  it('utiliza el listado de clubes extraído del PDF para filtrar resultados y crear el ranking', async () => {
    // 1. Simular clubes extraídos del PDF (solo PISBO y BARQ seleccionados)
    const pdfLines = [
      '1. PISBO - Piscinas Bolivarianas de Lara',
      '2. BARQ - Club Barquisimeto',
    ];
    const extractedClubs = parseClubPdfLines(pdfLines);
    const whitelistCodes = extractedClubs.map((c) => c.code); // ['BARQ', 'PISBO']

    // 2. Base de resultados con múltiples clubes (PISBO, BARQ, HISP, CDLARA)
    const testRecords: RawSwimRecord[] = [
      {
        resultId: 'r1',
        swimmerId: 'sw_1',
        swimmerName: 'Alejandro Morales',
        gender: 'M',
        birthDate: '2011-04-15',
        clubCode: 'PISBO', // Incluido en el PDF
        meetName: 'Torneo 1',
        meetDate: '2026-03-14',
        distance: 100,
        stroke: 'FREE',
        course: 'LCM',
        timeMs: 56800,
        status: 'OK',
      },
      {
        resultId: 'r2',
        swimmerId: 'sw_2',
        swimmerName: 'Santiago Rodríguez',
        gender: 'M',
        birthDate: '2011-08-20',
        clubCode: 'HISP', // NO incluido en el PDF
        meetName: 'Torneo 1',
        meetDate: '2026-03-14',
        distance: 100,
        stroke: 'FREE',
        course: 'LCM',
        timeMs: 57200,
        status: 'OK',
      },
      {
        resultId: 'r3',
        swimmerId: 'sw_3',
        swimmerName: 'Carlos Mendoza',
        gender: 'M',
        birthDate: '2012-01-10',
        clubCode: 'BARQ', // Incluido en el PDF
        meetName: 'Torneo 1',
        meetDate: '2026-03-14',
        distance: 100,
        stroke: 'FREE',
        course: 'LCM',
        timeMs: 57950,
        status: 'OK',
      },
    ];

    // 3. Generar ranking pasando la whitelist de clubes extraídos del PDF
    const ranked = await getAdaelRanking2026(
      {
        distance: 100,
        stroke: 'FREE',
        course: 'LCM',
        gender: 'M',
        clubWhitelist: whitelistCodes,
      },
      testRecords
    );

    // Debe incluir únicamente nadadores de PISBO y BARQ, excluyendo a HISP
    expect(ranked.length).toBe(2);
    expect(ranked.some((r) => r.clubCode === 'PISBO')).toBe(true);
    expect(ranked.some((r) => r.clubCode === 'BARQ')).toBe(true);
    expect(ranked.some((r) => r.clubCode === 'HISP')).toBe(false);

    // Verificar orden oficial y asignación de puestos
    expect(ranked[0]?.rank).toBe(1);
    expect(ranked[0]?.swimmerName).toBe('Alejandro Morales');
    expect(ranked[1]?.rank).toBe(2);
    expect(ranked[1]?.swimmerName).toBe('Carlos Mendoza');
  });
});
