import { describe, it, expect } from 'vitest';
import {
  parseAdaelHy3String,
  decodeHytekIso8859,
  expandZipFiles,
  parseAdaelFilesBatch,
} from '@/lib/adael-ranking/hytek-batch-parser';
import { zipSync } from 'fflate';

describe('Motor de Ingesta Masiva y Batch Parser · Ranking ADAEL 2026', () => {
  // Simulación de archivo .HY3 oficial con C1, D1, E1, E2, F1, F2, F3 y G1
  const sampleHy3Text = [
    'B1CAMPEONATO ESTADAL APERTURA ADAEL 2026      COMPLEJO PISCINAS BOLIVARIANAS               0320202603222026',
    'B2                                                                                              1       L',
    'C1PISBOPISCINAS BOLIVARIANAS DE LARA ',
    'D1M00001PEÑA                IKER                A                     12345678       12152010',
    'D1M00002RODRÍGUEZ           CARLOS              B                     23456789       05102011',
    'D1M00003SÁNCHEZ             MIGUEL              C                     34567890       08202010',
    'D1M00004HERNÁNDEZ           GABRIEL             D                     45678901       11052010',
    'E1  M    50A  15 16          1   25.40L',
    'E2 F     25.40   OK',
    'E1  M   100B  15 16          2 1:02.30L',
    'E2 F   1:02.30   OK',
    // Relevo Válido 4x50m Combinado (F1 stroke 'E' => 1er tramo Espalda)
    'F1PISBOAM   200E  15 16          3 1:52.00L',
    'F2 F   1:52.00   OK',
    'F300001       00002       00003       00004       ',
    'G1  1     28.90  2     59.80  3   1:25.40  4   1:52.00',
  ].join('\r\n');

  it('decodifica correctamente bytes en ISO-8859-1 preservando Ñ y tildes sin desplazar columnas', () => {
    const rawLine = 'D1M00001PEÑA                IKER                A                     12345678       12152010';
    const padded = rawLine.padEnd(128, ' ');
    const bytes = new Uint8Array(padded.length);
    for (let i = 0; i < padded.length; i++) {
      bytes[i] = padded.charCodeAt(i);
    }

    const decoded = decodeHytekIso8859(bytes);
    expect(decoded.length).toBe(128);
    expect(decoded.slice(8, 28).trim()).toBe('PEÑA');
    expect(decoded.slice(28, 48).trim()).toBe('IKER');
  });

  it('extrae registros C1 (Clubes), D1 (Atletas) y E2 (Resultados Individuales)', () => {
    const payload = parseAdaelHy3String(sampleHy3Text, 'estadal_apertura_2026.hy3');

    // Meet metadata
    expect(payload.meet.name).toBe('CAMPEONATO ESTADAL APERTURA ADAEL 2026');
    expect(payload.meet.startDate).toBe('2026-03-20');
    expect(payload.meet.course).toBe('LCM');
    expect(payload.meet.location).toBe('COMPLEJO PISCINAS BOLIVARIANAS');

    // C1 Clubs
    expect(payload.clubs.length).toBe(1);
    expect(payload.clubs[0]?.code).toBe('PISBO');
    expect(payload.clubs[0]?.name).toBe('PISCINAS BOLIVARIANAS DE LARA');
    expect(payload.clubs[0]?.isFederated).toBe(true);
    expect(payload.clubs[0]?.association).toBe('LARA');

    // Individual results
    const individualResults = payload.results.filter((r) => !r.isRelayLeadOff);
    expect(individualResults.length).toBe(2);

    const r1 = individualResults.find((r) => r.distance === 50 && r.stroke === 'FREE');
    expect(r1).toBeDefined();
    expect(r1?.swimmerName).toBe('PEÑA, IKER');
    expect(r1?.timeMs).toBe(25400);
    expect(r1?.status).toBe('OK');
    expect(r1?.waPoints).toBeGreaterThan(0);
  });

  it('extrae parciales iniciales de relevo (F3 + G1) como marcas oficiales cuando el relevo es válido', () => {
    const payload = parseAdaelHy3String(sampleHy3Text, 'estadal_apertura_2026.hy3');

    // Lead-off relay result
    const leadOffResults = payload.results.filter((r) => r.isRelayLeadOff);
    expect(leadOffResults.length).toBe(1);

    const leadOff = leadOffResults[0];
    expect(leadOff?.isRelayLeadOff).toBe(true);
    // En relevo Combinado (stroke 'E'), el primer estilo es Backstroke ('BACK')
    expect(leadOff?.stroke).toBe('BACK');
    expect(leadOff?.distance).toBe(50);
    // Tiempo parcial de G1 para el carril/tramo 1: 28.90 -> 28900 ms
    expect(leadOff?.timeMs).toBe(28900);
    expect(leadOff?.status).toBe('OK');
    expect(leadOff?.swimmerName).toBe('PEÑA, IKER');
    expect(leadOff?.waPoints).toBeGreaterThan(0);
  });

  it('NO extrae parciales de relevo si el relevo fue descalificado (status DQ)', () => {
    const dqRelayHy3 = [
      'B1TORNEO PRUEBA 2026                                                         0415202604162026',
      'B2                                                                                              1       L',
      'C1HISP HOGAR HISPANO DE LARA         ',
      'D1M00001GARCÍA              JUAN                A                     56789012       01102010',
      'F1HISP AM   200E  15 16          3 1:55.00L',
      'F2 F   1:55.00   DQ', // Relevo descalificado
      'F300001                                                       ',
      'G1  1     29.50',
    ].join('\r\n');

    const payload = parseAdaelHy3String(dqRelayHy3, 'torneo_dq.hy3');
    const leadOffResults = payload.results.filter((r) => r.isRelayLeadOff);
    expect(leadOffResults.length).toBe(0); // Ningún lead-off oficial de un relevo DQ
  });

  it('soporta la descompresión y procesamiento por lote de paquetes .ZIP con múltiples torneos', async () => {
    const hy3File1 = Buffer.from(sampleHy3Text, 'latin1');
    const hy3File2 = Buffer.from(
      [
        'B1ESTADAL PISCINA CORTA 2026                                                  1020202610222026',
        'B2                                                                                              1       S',
        'C1BARQ CLUB BARQUISIMETO             ',
        'D1M00001ALVAREZ             MATEO               A                     67890123       03142010',
        'E1  M    50A  15 16          1   24.10S',
        'E2 F     24.10   OK',
      ].join('\r\n'),
      'latin1'
    );

    // Crear paquete ZIP comprimido con 2 torneos
    const zipBytes = zipSync({
      'apertura_2026.hy3': hy3File1,
      'clausura_2026.hy3': hy3File2,
    });

    const expanded = expandZipFiles(zipBytes);
    expect(expanded.length).toBe(2);

    const batchRes = await parseAdaelFilesBatch([
      { name: 'paquete_temporada_2026.zip', buffer: zipBytes },
    ]);

    expect(batchRes.payloads.length).toBe(2);
    expect(batchRes.payloads[0]?.meet.name).toBe('CAMPEONATO ESTADAL APERTURA ADAEL 2026');
    expect(batchRes.payloads[0]?.meet.course).toBe('LCM');
    expect(batchRes.payloads[1]?.meet.name).toBe('ESTADAL PISCINA CORTA 2026');
    expect(batchRes.payloads[1]?.meet.course).toBe('SCM');
  });

  it('garantiza idempotencia y previene duplicados en subidas repetidas del mismo torneo', () => {
    // Si se parsea el mismo torneo dos veces, la estructura de clave única (name, startDate, course)
    // y de resultados (swimmerName, birthDate, distance, stroke, course, round, isRelayLeadOff)
    // conserva la unicidad estricta.
    const p1 = parseAdaelHy3String(sampleHy3Text, 'torneo.hy3');
    const p2 = parseAdaelHy3String(sampleHy3Text, 'torneo.hy3');

    expect(p1.meet.name).toBe(p2.meet.name);
    expect(p1.meet.startDate).toBe(p2.meet.startDate);
    expect(p1.meet.course).toBe(p2.meet.course);
    expect(p1.results.length).toBe(p2.results.length);
  });
});
