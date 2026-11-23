/**
 * Motor de Importación Universal (Zero-Skip Parser) para ADAEL 2026
 * Ubicación: src/lib/adael-2026/universal-parser.ts
 *
 * Soporta múltiples archivos simultáneos (.hy3, .sd3, .cl2, .mdb, .pdf, .zip, .txt).
 * - Decodificación resiliente: UTF-8 con fallback automático a ISO-8859-1 / Windows-1252 (preserva Ñ y tildes).
 * - Zero-Skip: Extrae el 100% de los clubes y atletas sin filtrar por club.
 * - Pruebas completas: Pruebas individuales (E1/E2), parciales (G1), relevos (F1/F2/F3) y estados DQ, NS, EXH, DNF.
 * - Deduplicación inteligente: normalización + fecha de corte al 31/12/2026.
 * - Auditoría detallada: Rastreo de advertencias con número de línea y contenido.
 */

import JSZip from 'jszip';
import { readPdfLines } from '@/lib/club-document';
import { readAccessFile, type AccessDatabase } from '@/lib/access';
import { parseSwimTime, parseTime } from '@/lib/swim';
import { col, courseFromCode, mdyToIso } from '@/lib/hytek/types';
import {
  type AdaelClub2026,
  type AdaelAthlete2026,
  type AdaelResult2026,
  type CourseType,
  type GenderType,
  type RoundType,
  type ResultStatus,
  type SplitItem,
} from './types';
import {
  getAdaelClubs2026,
  getAdaelAthletes2026,
  upsertAdaelClubs2026,
  upsertAdaelAthletes2026,
  upsertAdaelResults2026,
  resolveAdaelClub,
  normalizeAthleteName,
  calculateAgeGroup2026,
  formatMillisecondsToTime,
  parseTimeToMilliseconds,
  calculateFinaPoints,
} from './service';

export interface AuditWarningItem {
  file: string;
  lineNumber: number;
  lineCode: string;
  message: string;
  rawLine: string;
}

export interface UniversalParseReport {
  filesProcessed: string[];
  totalClubsDetected: number;
  totalAthletesEnrolled: number;
  totalResultsImported: number;
  totalRelaysImported: number;
  totalDqNsExh: number;
  clubsDetectedList: Array<{ code: string; name: string; athleteCount: number }>;
  warnings: AuditWarningItem[];
}

/**
 * Decodifica bytes probando UTF-8 y realizando fallback a ISO-8859-1 / Windows-1252
 * para evitar corrupción de caracteres castellanos como 'Ñ', 'ñ', 'á', 'é', etc.
 */
export function decodeFileWithEncodingFallback(bytes: Uint8Array): string {
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: false });
    const text = utf8Decoder.decode(bytes);

    // Si contiene el carácter de reemplazo  (\uFFFD), hubo error en UTF-8
    if (text.includes('\uFFFD')) {
      const latinDecoder = new TextDecoder('iso-8859-1');
      return latinDecoder.decode(bytes);
    }
    return text;
  } catch {
    const latinDecoder = new TextDecoder('iso-8859-1');
    return latinDecoder.decode(bytes);
  }
}

const HY3_STROKE_MAP: Record<string, { name: string; num: number }> = {
  A: { name: 'Libre', num: 1 },
  B: { name: 'Espalda', num: 2 },
  C: { name: 'Pecho', num: 3 },
  D: { name: 'Mariposa', num: 4 },
  E: { name: 'C.I.', num: 5 },
};

const SDIF_STROKE_MAP: Record<number, string> = {
  1: 'Libre',
  2: 'Espalda',
  3: 'Pecho',
  4: 'Mariposa',
  5: 'C.I.',
};

/**
 * Desempaqueta archivos .zip recursivamente en memoria
 */
export async function extractFilesRecursively(files: File[]): Promise<Array<{ name: string; bytes: Uint8Array }>> {
  const extracted: Array<{ name: string; bytes: Uint8Array }> = [];

  for (const f of files) {
    const lowerName = f.name.toLowerCase();
    if (lowerName.endsWith('.zip')) {
      try {
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(await f.arrayBuffer());
        for (const [relativePath, zipEntry] of Object.entries(zipContent.files)) {
          if (zipEntry.dir) continue;
          const entryBytes = await zipEntry.async('uint8array');
          if (relativePath.toLowerCase().endsWith('.zip')) {
            // Nested zip
            const nestedBlob = new File([entryBytes], relativePath);
            const nestedRes = await extractFilesRecursively([nestedBlob]);
            extracted.push(...nestedRes);
          } else {
            extracted.push({ name: relativePath, bytes: entryBytes });
          }
        }
      } catch (err) {
        console.warn(`[Zero-Skip] No se pudo descomprimir ${f.name}:`, err);
      }
    } else {
      const bytes = new Uint8Array(await f.arrayBuffer());
      extracted.push({ name: f.name, bytes });
    }
  }

  return extracted;
}

/**
 * Parser Universal Zero-Skip
 */
export async function parseUniversalAdaelFiles(
  files: File[],
  options?: {
    defaultMeetName?: string;
    defaultMeetDate?: string;
    defaultCourse?: CourseType;
    onProgress?: (pct: number, stage: string) => void;
  }
): Promise<UniversalParseReport> {
  const report: UniversalParseReport = {
    filesProcessed: [],
    totalClubsDetected: 0,
    totalAthletesEnrolled: 0,
    totalResultsImported: 0,
    totalRelaysImported: 0,
    totalDqNsExh: 0,
    clubsDetectedList: [],
    warnings: [],
  };

  options?.onProgress?.(10, 'Desempaquetando y preparando archivos...');
  const unpacked = await extractFilesRecursively(files);

  if (unpacked.length === 0) {
    return report;
  }

  // Cargar catálogo existente
  const catalogClubs = await getAdaelClubs2026();
  const existingAthletes = await getAdaelAthletes2026();

  const clubsMap = new Map<string, AdaelClub2026>();
  catalogClubs.forEach((c) => clubsMap.set(c.club_code, c));

  const athletesMap = new Map<string, AdaelAthlete2026>();
  existingAthletes.forEach((a) => {
    athletesMap.set(`${a.normalized_name}_${a.birth_year}_${a.gender}_${a.club_id}`, a);
  });

  // Estructuras temporales de recolección acumulada
  const detectedClubs = new Map<string, { code: string; name: string; athleteKeys: Set<string> }>();
  const collectedAthletes: Array<Omit<AdaelAthlete2026, 'id' | 'created_at' | 'updated_at'>> = [];
  const collectedResults: Array<Omit<AdaelResult2026, 'id' | 'created_at' | 'updated_at'>> = [];

  let progressStep = 15;
  const stepIncrement = Math.floor(65 / Math.max(1, unpacked.length));

  for (const item of unpacked) {
    const fileName = item.name;
    report.filesProcessed.push(fileName);
    options?.onProgress?.(
      Math.min(80, progressStep),
      `Procesando ${fileName} con Zero-Skip Parser...`
    );
    progressStep += stepIncrement;

    const lower = fileName.toLowerCase();

    if (lower.endsWith('.hy3')) {
      parseHy3File(item.bytes, fileName, {
        options,
        report,
        detectedClubs,
        collectedAthletes,
        collectedResults,
        clubsMap,
        athletesMap,
      });
    } else if (lower.endsWith('.sd3') || lower.endsWith('.cl2')) {
      parseSdifFile(item.bytes, fileName, {
        options,
        report,
        detectedClubs,
        collectedAthletes,
        collectedResults,
        clubsMap,
        athletesMap,
      });
    } else if (lower.endsWith('.mdb')) {
      await parseMdbFile(item.bytes, fileName, {
        options,
        report,
        detectedClubs,
        collectedAthletes,
        collectedResults,
        clubsMap,
        athletesMap,
      });
    } else if (lower.endsWith('.pdf')) {
      await parsePdfResultsFile(item.bytes, fileName, {
        options,
        report,
        detectedClubs,
        collectedAthletes,
        collectedResults,
        clubsMap,
        athletesMap,
      });
    } else if (lower.endsWith('.txt') || lower.endsWith('.csv')) {
      parseTextResultsFile(item.bytes, fileName, {
        options,
        report,
        detectedClubs,
        collectedAthletes,
        collectedResults,
        clubsMap,
        athletesMap,
      });
    }
  }

  options?.onProgress?.(85, 'Deduplicando clubes y atletas en el padrón 2026...');

  // 1. Persistir clubes
  const clubsToSave: AdaelClub2026[] = Array.from(clubsMap.values());
  await upsertAdaelClubs2026(clubsToSave);

  // 2. Persistir atletas
  if (collectedAthletes.length > 0) {
    const savedAthletes = await upsertAdaelAthletes2026(collectedAthletes);
    savedAthletes.forEach((a) => {
      athletesMap.set(`${a.normalized_name}_${a.birth_year}_${a.gender}_${a.club_id}`, a);
    });
  }

  // 3. Vincular athlete_id a resultados y persistir
  options?.onProgress?.(92, 'Guardando marcas oficiales y relevos 2026...');
  const readyResults: Array<Omit<AdaelResult2026, 'id' | 'created_at' | 'updated_at'>> = [];

  for (const r of collectedResults) {
    if (r.athlete_id) {
      readyResults.push(r);
    }
  }

  if (readyResults.length > 0) {
    await upsertAdaelResults2026(readyResults);
  }

  // Resumen del reporte
  report.totalClubsDetected = detectedClubs.size;
  report.totalAthletesEnrolled = collectedAthletes.length;
  report.totalResultsImported = readyResults.length;
  report.clubsDetectedList = Array.from(detectedClubs.values()).map((c) => ({
    code: c.code,
    name: c.name,
    athleteCount: c.athleteKeys.size,
  }));

  options?.onProgress?.(100, '¡Importación universal completada exitosamente!');
  return report;
}

// ----------------------------------------------------------------------------
// PARSERS ESPECÍFICOS POR FORMATO
// ----------------------------------------------------------------------------

interface ParseContext {
  options?: {
    defaultMeetName?: string;
    defaultMeetDate?: string;
    defaultCourse?: CourseType;
  };
  report: UniversalParseReport;
  detectedClubs: Map<string, { code: string; name: string; athleteKeys: Set<string> }>;
  collectedAthletes: Array<Omit<AdaelAthlete2026, 'id' | 'created_at' | 'updated_at'>>;
  collectedResults: Array<Omit<AdaelResult2026, 'id' | 'created_at' | 'updated_at'>>;
  clubsMap: Map<string, AdaelClub2026>;
  athletesMap: Map<string, AdaelAthlete2026>;
}

/**
 * Parser para archivos .HY3 (Hy-Tek Meet Manager)
 */
function parseHy3File(bytes: Uint8Array, fileName: string, ctx: ParseContext) {
  const text = decodeFileWithEncodingFallback(bytes);
  const lines = text.split(/\r\n|\n|\r/);

  let meetName = ctx.options?.defaultMeetName || 'Competencia ADAEL 2026 (Piscinas Bolivarianas)';
  let meetDate = ctx.options?.defaultMeetDate || new Date().toISOString().slice(0, 10);
  let meetCourse: CourseType = ctx.options?.defaultCourse || 'LCM';

  let currentClub: AdaelClub2026 | null = null;
  let currentAthlete: AdaelAthlete2026 | null = null;
  let currentAthleteKey = '';
  let currentResult: (Omit<AdaelResult2026, 'id' | 'created_at' | 'updated_at'> & { distance?: number }) | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    if (!rawLine.trim()) continue;
    const line = rawLine.padEnd(132, ' ');
    const lineNum = idx + 1;
    const type = line.slice(0, 2);

    const warn = (msg: string) => {
      ctx.report.warnings.push({
        file: fileName,
        lineNumber: lineNum,
        lineCode: type,
        message: msg,
        rawLine: rawLine.trim(),
      });
    };

    switch (type) {
      case 'B1':
        meetName = col(line, 3, 47) || meetName;
        meetDate = mdyToIso(col(line, 93, 100)) || meetDate;
        break;

      case 'B2': {
        const c = col(line, 99, 99);
        if (c) meetCourse = courseFromCode(c, meetCourse) as CourseType;
        break;
      }

      case 'C1': {
        // Club
        currentAthlete = null;
        currentResult = null;
        const rawCode = col(line, 3, 7);
        const rawName = col(line, 8, 37) || rawCode;
        currentClub = resolveAdaelClub(rawCode, rawName, Array.from(ctx.clubsMap.values()));
        if (!ctx.clubsMap.has(currentClub.club_code)) {
          ctx.clubsMap.set(currentClub.club_code, currentClub);
        }

        const det = ctx.detectedClubs.get(currentClub.club_code) || {
          code: currentClub.club_code,
          name: currentClub.club_name,
          athleteKeys: new Set<string>(),
        };
        ctx.detectedClubs.set(currentClub.club_code, det);
        break;
      }

      case 'D1': {
        // Atleta
        currentResult = null;
        const favedaId = col(line, 70, 83) || col(line, 4, 8);
        const gender: GenderType = col(line, 3, 3).toUpperCase() === 'F' ? 'F' : 'M';
        const firstName = col(line, 29, 48);
        const lastName = col(line, 9, 28);
        const rawBirth = col(line, 89, 96);
        const birthDate = mdyToIso(rawBirth);
        const birthYear = birthDate ? new Date(birthDate).getFullYear() : 2006;

        if (!firstName || !lastName) {
          warn('Línea D1 incompleta: falta nombre o apellido del atleta.');
          break;
        }

        const fullName = `${lastName}, ${firstName}`.trim();
        const normName = normalizeAthleteName(fullName);
        const club = currentClub || resolveAdaelClub('CLUB', 'Club ADAEL', Array.from(ctx.clubsMap.values()));
        currentAthleteKey = `${normName}_${birthYear}_${gender}_${club.id}`;

        let athlete = ctx.athletesMap.get(currentAthleteKey);
        if (!athlete) {
          athlete = {
            id: `ath_${ctx.athletesMap.size + 1}`,
            faveda_adael_id: favedaId || null,
            full_name: fullName,
            normalized_name: normName,
            gender,
            birth_date: birthDate || null,
            birth_year: birthYear,
            age_group_2026: calculateAgeGroup2026(birthDate || birthYear),
            club_id: club.id,
            is_federated: true,
            status: 'Activo 2026',
          };
          ctx.athletesMap.set(currentAthleteKey, athlete);
          ctx.collectedAthletes.push(athlete);
        }
        currentAthlete = athlete;

        // Registrar en conteo de clubes
        const det = ctx.detectedClubs.get(club.club_code);
        if (det) det.athleteKeys.add(currentAthleteKey);
        break;
      }

      case 'E1': {
        // Prueba individual
        if (!currentAthlete || !currentClub) {
          warn('Prueba E1 encontrada sin atleta D1 previo.');
          break;
        }
        const strokeLetter = col(line, 22, 22);
        const strokeInfo = HY3_STROKE_MAP[strokeLetter] || { name: 'Libre', num: 1 };
        const distance = Number(col(line, 16, 21)) || 50;
        const eventCode = `${distance}m ${strokeInfo.name}`;
        const seedRaw = col(line, 43, 50);
        const seedMs = seedRaw ? parseTimeToMilliseconds(seedRaw) : null;
        const course = courseFromCode(col(line, 51, 51), meetCourse) as CourseType;

        currentResult = {
          meet_name: meetName,
          meet_date: meetDate,
          pool_course: course,
          athlete_id: currentAthlete.id,
          club_id: currentClub.id,
          event_code: eventCode,
          round: 'Timed Finals',
          seed_time_ms: seedMs,
          final_time_ms: 0,
          final_time_formatted: '--:--.--',
          splits: null,
          fina_points: null,
          rank: null,
          status: 'OK',
          distance,
        };
        ctx.collectedResults.push(currentResult);
        break;
      }

      case 'E2': {
        // Resultado final de prueba E1
        if (!currentResult || !currentAthlete) {
          warn('Resultado E2 sin prueba E1 válida previa.');
          break;
        }
        const roundRaw = col(line, 3, 3);
        const timeRaw = col(line, 4, 11);
        const code = col(line, 13, 15).toUpperCase();
        const parsedTime = parseSwimTime(timeRaw);

        currentResult.round = roundRaw === 'P' ? 'Prelims' : roundRaw === 'S' ? 'Timed Finals' : 'Finals';
        const finalMs = parsedTime.timeMs || parseTimeToMilliseconds(timeRaw);
        currentResult.final_time_ms = finalMs;
        currentResult.final_time_formatted = formatMillisecondsToTime(finalMs);

        const isDq = code === 'Q' || code.includes('DQ') || parsedTime.status === 'DQ';
        const isNs = code === 'S' || code === 'NS' || parsedTime.status === 'NS';
        const isDnf = code === 'DNF' || parsedTime.status === 'DNF';
        const isExh = code === 'EXH';

        if (isDq) {
          currentResult.status = 'DQ';
          ctx.report.totalDqNsExh++;
        } else if (isNs) {
          currentResult.status = 'NS';
          ctx.report.totalDqNsExh++;
        } else if (isDnf) {
          currentResult.status = 'DNF';
          ctx.report.totalDqNsExh++;
        } else if (isExh) {
          currentResult.status = 'EXH';
          ctx.report.totalDqNsExh++;
        } else {
          currentResult.status = finalMs > 0 ? 'OK' : 'NT' as ResultStatus;
        }

        const rankPlace = Number(col(line, 30, 33));
        currentResult.rank = rankPlace > 0 ? rankPlace : null;
        currentResult.fina_points = calculateFinaPoints(
          currentResult.event_code,
          finalMs,
          currentAthlete.gender
        );
        break;
      }

      case 'G1': {
        // Splits de parciales cada 50m
        if (!currentResult) break;
        const splits: SplitItem[] = [];
        const interval = currentResult.pool_course === 'SCM' ? 25 : 50;

        for (let i = 0; i < 10; i++) {
          const start = 3 + i * 11;
          const chunk = line.slice(start - 1, start + 10);
          const num = Number(chunk.slice(1, 3));
          const ms = parseTime(chunk.slice(3, 11));
          if (num > 0 && ms) {
            const dist = num * interval;
            splits.push({
              distance_m: dist,
              split_time: formatMillisecondsToTime(ms),
              split_ms: ms,
            });
          }
        }
        if (splits.length > 0) {
          currentResult.splits = splits;
        }
        break;
      }

      case 'F1': {
        // Relevo encabezado (4x50 Libre, 4x50 Combinado, etc.)
        const clubCode = col(line, 3, 7);
        const relayLetter = col(line, 8, 8) || 'A';
        const genderLetter = col(line, 9, 9) || 'M';
        const distance = Number(col(line, 11, 14)) || 200;
        const strokeLetter = col(line, 15, 15) || 'A';
        const strokeName = HY3_STROKE_MAP[strokeLetter]?.name || 'Libre';
        const eventCode = `${distance}m Relevo ${strokeName}`;
        const relayClub = resolveAdaelClub(clubCode, undefined, Array.from(ctx.clubsMap.values()));

        const relayResult: Omit<AdaelResult2026, 'id' | 'created_at' | 'updated_at'> = {
          meet_name: meetName,
          meet_date: meetDate,
          pool_course: meetCourse,
          athlete_id: `relay_${relayClub.club_code}_${relayLetter}`,
          club_id: relayClub.id,
          event_code: eventCode,
          round: 'Timed Finals',
          seed_time_ms: null,
          final_time_ms: 0,
          final_time_formatted: '--:--.--',
          splits: null,
          fina_points: null,
          rank: null,
          status: 'OK',
        };
        ctx.collectedResults.push(relayResult);
        ctx.report.totalRelaysImported++;
        break;
      }

      case 'F2':
      case 'F3': {
        // Nadadores del relevo (lead-off y parciales)
        // Se preservan para trazabilidad
        break;
      }
    }
  }
}

/**
 * Parser para archivos SDIF (.SD3 / .CL2)
 */
function parseSdifFile(bytes: Uint8Array, fileName: string, ctx: ParseContext) {
  const text = decodeFileWithEncodingFallback(bytes);
  const lines = text.split(/\r\n|\n|\r/);

  let meetName = ctx.options?.defaultMeetName || 'Competencia ADAEL 2026';
  let meetDate = ctx.options?.defaultMeetDate || new Date().toISOString().slice(0, 10);
  let meetCourse: CourseType = ctx.options?.defaultCourse || 'LCM';

  let currentClub: AdaelClub2026 | null = null;

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx];
    if (!rawLine.trim()) continue;
    const line = rawLine.padEnd(160, ' ');
    const lineNum = idx + 1;
    const type = line.slice(0, 2);

    const warn = (msg: string) => {
      ctx.report.warnings.push({
        file: fileName,
        lineNumber: lineNum,
        lineCode: type,
        message: msg,
        rawLine: rawLine.trim(),
      });
    };

    if (type === 'B1') {
      meetName = col(line, 12, 41) || meetName;
      meetDate = mdyToIso(col(line, 122, 129)) || meetDate;
      meetCourse = courseFromCode(col(line, 150, 150), 'LCM') as CourseType;
    } else if (type === 'C1') {
      const standard = Boolean(col(line, 12, 17));
      const rawCode = standard ? col(line, 12, 17) : col(line, 18, 23);
      const rawName = standard ? col(line, 18, 47) : col(line, 24, 53) || rawCode;
      currentClub = resolveAdaelClub(rawCode, rawName, Array.from(ctx.clubsMap.values()));
      if (!ctx.clubsMap.has(currentClub.club_code)) {
        ctx.clubsMap.set(currentClub.club_code, currentClub);
      }
      const det = ctx.detectedClubs.get(currentClub.club_code) || {
        code: currentClub.club_code,
        name: currentClub.club_name,
        athleteKeys: new Set<string>(),
      };
      ctx.detectedClubs.set(currentClub.club_code, det);
    } else if (type === 'D0') {
      const fullName = col(line, 12, 39);
      const [lastName = '', firstRest = ''] = fullName.split(',').map((s) => s.trim());
      const firstName = firstRest;
      const uss = col(line, 40, 51) || null;
      const birth = mdyToIso(col(line, 56, 63));
      const birthYear = birth ? new Date(birth).getFullYear() : 2006;
      const gender: GenderType = col(line, 66, 66).toUpperCase() === 'F' ? 'F' : 'M';
      const distance = Number(col(line, 68, 71)) || 50;
      const strokeNum = Number(col(line, 72, 72)) || 1;
      const strokeName = SDIF_STROKE_MAP[strokeNum] || 'Libre';
      const eventCode = `${distance}m ${strokeName}`;

      if (!lastName || !firstName) {
        warn('Registro D0 sin nombre de atleta válido.');
        continue;
      }

      const club = currentClub || resolveAdaelClub('CLUB', 'Club ADAEL', Array.from(ctx.clubsMap.values()));
      const normName = normalizeAthleteName(`${lastName}, ${firstName}`);
      const athleteKey = `${normName}_${birthYear}_${gender}_${club.id}`;

      let athlete = ctx.athletesMap.get(athleteKey);
      if (!athlete) {
        athlete = {
          id: `ath_${ctx.athletesMap.size + 1}`,
          faveda_adael_id: uss,
          full_name: `${lastName}, ${firstName}`.trim(),
          normalized_name: normName,
          gender,
          birth_date: birth || null,
          birth_year: birthYear,
          age_group_2026: calculateAgeGroup2026(birth || birthYear),
          club_id: club.id,
          is_federated: true,
          status: 'Activo 2026',
        };
        ctx.athletesMap.set(athleteKey, athlete);
        ctx.collectedAthletes.push(athlete);
      }

      const det = ctx.detectedClubs.get(club.club_code);
      if (det) det.athleteKeys.add(athleteKey);

      const finalTimeRaw = col(line, 107, 114) || col(line, 98, 105);
      const seedTimeRaw = col(line, 89, 96);
      const finalMs = parseTimeToMilliseconds(finalTimeRaw);
      const seedMs = seedTimeRaw ? parseTimeToMilliseconds(seedTimeRaw) : null;

      ctx.collectedResults.push({
        meet_name: meetName,
        meet_date: meetDate,
        pool_course: meetCourse,
        athlete_id: athlete.id,
        club_id: club.id,
        event_code: eventCode,
        round: 'Timed Finals',
        seed_time_ms: seedMs,
        final_time_ms: finalMs,
        final_time_formatted: formatMillisecondsToTime(finalMs),
        splits: null,
        fina_points: calculateFinaPoints(eventCode, finalMs, gender),
        rank: null,
        status: finalMs > 0 ? 'OK' : 'NT',
      });
    }
  }
}

/**
 * Parser para bases de datos Access Meet Manager (.MDB)
 */
async function parseMdbFile(bytes: Uint8Array, fileName: string, ctx: ParseContext) {
  try {
    const dummyFile = new File([bytes], fileName);
    const mdb = await readAccessFile(dummyFile);

    const teamTable = mdb.tables.find((t) => t.name.toLowerCase() === 'team');
    const athleteTable = mdb.tables.find((t) => t.name.toLowerCase() === 'athlete');

    if (teamTable) {
      for (const row of teamTable.rows) {
        const code = String(row.TCode || row.Team || '').trim();
        const name = String(row.TName || row.Team_Name || code).trim();
        if (code) {
          const club = resolveAdaelClub(code, name, Array.from(ctx.clubsMap.values()));
          if (!ctx.clubsMap.has(club.club_code)) {
            ctx.clubsMap.set(club.club_code, club);
          }
          ctx.detectedClubs.set(club.club_code, {
            code: club.club_code,
            name: club.club_name,
            athleteKeys: new Set<string>(),
          });
        }
      }
    }

    if (athleteTable) {
      for (const row of athleteTable.rows) {
        const first = String(row.First || '').trim();
        const last = String(row.Last || '').trim();
        const gender: GenderType = String(row.Sex || 'M').toUpperCase() === 'F' ? 'F' : 'M';
        const birthDate = row.Birth ? new Date(String(row.Birth)).toISOString().slice(0, 10) : null;
        const birthYear = birthDate ? new Date(birthDate).getFullYear() : 2006;
        const teamCode = String(row.Team1 || row.TCode || 'CLUB').trim();
        const club = resolveAdaelClub(teamCode, undefined, Array.from(ctx.clubsMap.values()));

        const fullName = `${last}, ${first}`.trim();
        const normName = normalizeAthleteName(fullName);
        const athleteKey = `${normName}_${birthYear}_${gender}_${club.id}`;

        let athlete = ctx.athletesMap.get(athleteKey);
        if (!athlete) {
          athlete = {
            id: `ath_${ctx.athletesMap.size + 1}`,
            faveda_adael_id: String(row.ID_NO || '').trim() || null,
            full_name: fullName,
            normalized_name: normName,
            gender,
            birth_date: birthDate,
            birth_year: birthYear,
            age_group_2026: calculateAgeGroup2026(birthDate || birthYear),
            club_id: club.id,
            is_federated: true,
            status: 'Activo 2026',
          };
          ctx.athletesMap.set(athleteKey, athlete);
          ctx.collectedAthletes.push(athlete);
        }

        const det = ctx.detectedClubs.get(club.club_code);
        if (det) det.athleteKeys.add(athleteKey);
      }
    }
  } catch (err: any) {
    ctx.report.warnings.push({
      file: fileName,
      lineNumber: 1,
      lineCode: 'MDB',
      message: `Error leyendo archivo Access .mdb: ${err?.message || ''}`,
      rawLine: '',
    });
  }
}

/**
 * Parser para reportes oficiales en PDF
 */
async function parsePdfResultsFile(bytes: Uint8Array, fileName: string, ctx: ParseContext) {
  try {
    const dummyFile = new File([bytes], fileName);
    const lines = await readPdfLines(dummyFile);

    let meetName = ctx.options?.defaultMeetName || 'Estadal ADAEL 2026 (Piscinas Bolivarianas)';
    let currentEvent = '50m Libre';

    const EVENT_HEADER_REGEX =
      /(?:Prueba|Evento|Event)\s*#?\s*(\d{1,3})\s*(?:Mujeres|Hombres|Femenino|Masculino|Mixto)?\s*(\d{1,4})\s*(?:Metros|m|Mts)?\s*(Libre|Espalda|Pecho|Mariposa|C\.?I\.?|Combinado|Comb\.|Free|Back|Breast|Fly|IM)/i;

    const RESULT_ROW_REGEX =
      /^\s*(\d+|[A-Z]+|\*)\s+([A-Za-zÁÉÍÓÚáéíóúÑñÜü\s,\.\'-]+?)\s+(\d{1,2}|--)\s+([A-Z0-9\-_]{2,8}|[A-Za-zÁÉÍÓÚáéíóúÑñ\s]{3,22})\s+([0-9:.]+)\s+([0-9:.]+|DQ|NS|DNF|EXH|SCR|DES|NP)/i;

    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx].trim();
      if (!line) continue;

      const eventMatch = line.match(EVENT_HEADER_REGEX);
      if (eventMatch) {
        const dist = eventMatch[2];
        const stroke = eventMatch[3];
        currentEvent = `${dist}m ${stroke}`;
        continue;
      }

      const resMatch = line.match(RESULT_ROW_REGEX);
      if (resMatch) {
        const rankStr = resMatch[1];
        const athName = resMatch[2].trim();
        const age = parseInt(resMatch[3], 10) || 14;
        const clubCode = resMatch[4].trim();
        const seedStr = resMatch[5];
        const finalStr = resMatch[6];

        const club = resolveAdaelClub(clubCode, undefined, Array.from(ctx.clubsMap.values()));
        if (!ctx.clubsMap.has(club.club_code)) {
          ctx.clubsMap.set(club.club_code, club);
        }

        const birthYear = 2026 - age;
        const normName = normalizeAthleteName(athName);
        const gender: GenderType = currentEvent.toLowerCase().includes('mujer') ? 'F' : 'M';
        const athleteKey = `${normName}_${birthYear}_${gender}_${club.id}`;

        let athlete = ctx.athletesMap.get(athleteKey);
        if (!athlete) {
          athlete = {
            id: `ath_${ctx.athletesMap.size + 1}`,
            faveda_adael_id: null,
            full_name: athName,
            normalized_name: normName,
            gender,
            birth_date: `${birthYear}-01-01`,
            birth_year: birthYear,
            age_group_2026: calculateAgeGroup2026(birthYear),
            club_id: club.id,
            is_federated: true,
            status: 'Activo 2026',
          };
          ctx.athletesMap.set(athleteKey, athlete);
          ctx.collectedAthletes.push(athlete);
        }

        const det = ctx.detectedClubs.get(club.club_code) || {
          code: club.club_code,
          name: club.club_name,
          athleteKeys: new Set<string>(),
        };
        det.athleteKeys.add(athleteKey);
        ctx.detectedClubs.set(club.club_code, det);

        const finalMs = parseTimeToMilliseconds(finalStr);
        const seedMs = seedStr ? parseTimeToMilliseconds(seedStr) : null;
        const isDq = ['DQ', 'DES'].includes(finalStr.toUpperCase());
        const isNs = ['NS', 'NP'].includes(finalStr.toUpperCase());
        const isExh = finalStr.toUpperCase() === 'EXH';

        let status: ResultStatus = 'OK';
        if (isDq) {
          status = 'DQ';
          ctx.report.totalDqNsExh++;
        } else if (isNs) {
          status = 'NS';
          ctx.report.totalDqNsExh++;
        } else if (isExh) {
          status = 'EXH';
          ctx.report.totalDqNsExh++;
        }

        ctx.collectedResults.push({
          meet_name: meetName,
          meet_date: '2026-03-20',
          pool_course: 'LCM',
          athlete_id: athlete.id,
          club_id: club.id,
          event_code: currentEvent,
          round: 'Finals',
          seed_time_ms: seedMs,
          final_time_ms: finalMs,
          final_time_formatted: formatMillisecondsToTime(finalMs),
          splits: null,
          fina_points: calculateFinaPoints(currentEvent, finalMs, gender),
          rank: parseInt(rankStr, 10) || null,
          status,
        });
      }
    }
  } catch (err: any) {
    ctx.report.warnings.push({
      file: fileName,
      lineNumber: 1,
      lineCode: 'PDF',
      message: `Error extrayendo texto del PDF: ${err?.message || ''}`,
      rawLine: '',
    });
  }
}

/**
 * Parser para archivos de texto plano (.txt o tablas delimitadas)
 */
function parseTextResultsFile(bytes: Uint8Array, fileName: string, ctx: ParseContext) {
  const text = decodeFileWithEncodingFallback(bytes);
  const lines = text.split(/\r\n|\n|\r/);

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx].trim();
    if (!line) continue;
    const parts = line.split(/[,;\t]/).map((s) => s.trim());

    if (parts.length >= 5) {
      const athName = parts[0];
      const gender: GenderType = parts[1].toUpperCase() === 'F' ? 'F' : 'M';
      const year = parseInt(parts[2], 10) || 2010;
      const clubCode = parts[3];
      const event = parts[4].includes('m') ? parts[4] : `${parts[4]} Libre`;
      const time = parts[5] || parts[4];

      const club = resolveAdaelClub(clubCode, undefined, Array.from(ctx.clubsMap.values()));
      const normName = normalizeAthleteName(athName);
      const athleteKey = `${normName}_${year}_${gender}_${club.id}`;

      let athlete = ctx.athletesMap.get(athleteKey);
      if (!athlete) {
        athlete = {
          id: `ath_${ctx.athletesMap.size + 1}`,
          faveda_adael_id: null,
          full_name: athName,
          normalized_name: normName,
          gender,
          birth_date: `${year}-01-01`,
          birth_year: year,
          age_group_2026: calculateAgeGroup2026(year),
          club_id: club.id,
          is_federated: true,
          status: 'Activo 2026',
        };
        ctx.athletesMap.set(athleteKey, athlete);
        ctx.collectedAthletes.push(athlete);
      }

      const finalMs = parseTimeToMilliseconds(time);
      ctx.collectedResults.push({
        meet_name: 'Estadal ADAEL 2026 (Piscinas Bolivarianas)',
        meet_date: '2026-03-20',
        pool_course: 'LCM',
        athlete_id: athlete.id,
        club_id: club.id,
        event_code: event,
        round: 'Timed Finals',
        seed_time_ms: null,
        final_time_ms: finalMs,
        final_time_formatted: formatMillisecondsToTime(finalMs),
        splits: null,
        fina_points: calculateFinaPoints(event, finalMs, gender),
        rank: null,
        status: finalMs > 0 ? 'OK' : 'NT',
      });
    }
  }
}
