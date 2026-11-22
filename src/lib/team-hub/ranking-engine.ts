/**
 * Swimmer Ranking Engine (Hy-Tek Top Times Architecture)
 * Generates official rankings by event, course, age group, and association/state.
 * Features:
 * - One best time per swimmer deduplication
 * - Strict age calculation at meet date or custom age-up cutoff
 * - Ties handling (joint ranks with rank-skip for subsequent places)
 * - Regional association / state filtering (e.g. LARA, ZULIA, MIR)
 * - Exhibition (EXH) and lead-off relay swim support
 */

export type CourseType = 'LCM' | 'SCM' | 'SCY'; // 50m, 25m, Yardas
export type StrokeCode = 'FREE' | 'BACK' | 'BREAST' | 'FLY' | 'IM';
export type ResultStatus = 'OK' | 'DQ' | 'DNS' | 'DNF';

export const STROKE_NUMBER_TO_CODE: Record<number, StrokeCode> = {
  1: 'FREE',
  2: 'BACK',
  3: 'BREAST',
  4: 'FLY',
  5: 'IM',
};

export const STROKE_CODE_TO_NUMBER: Record<StrokeCode, number> = {
  FREE: 1,
  BACK: 2,
  BREAST: 3,
  FLY: 4,
  IM: 5,
};

export const STROKE_CODE_LABELS: Record<StrokeCode, string> = {
  FREE: 'Libre',
  BACK: 'Espalda',
  BREAST: 'Pecho',
  FLY: 'Mariposa',
  IM: 'Combinado Individual',
};

export interface SwimResultRecord {
  resultId: string;
  swimmerId: string;        // ID único federativo o interno
  swimmerName: string;
  gender: 'M' | 'F';
  birthDate: string;        // ISO 'YYYY-MM-DD'
  clubCode: string;         // ej. 'JSWIM'
  clubName: string;
  associationCode: string;  // ej. 'LARA', 'ZULIA', 'MIR'
  meetName: string;
  meetDate: string;         // ISO 'YYYY-MM-DD'
  distance: number;         // 50, 100, 200, 400, 800, 1500
  stroke: StrokeCode;
  course: CourseType;
  timeMs: number;           // Tiempo en milisegundos
  status: ResultStatus;
  isExhibition: boolean;
  isRelayLeadOff?: boolean; // Válido para ranking si el relevo fue OK
  finaPoints?: number;
}

export interface RankingFilterOptions {
  distance: number;
  stroke: StrokeCode;
  gender: 'M' | 'F';
  course: CourseType;
  minAge?: number;
  maxAge?: number;
  ageCalculationMode?: 'DEC_31' | 'MEET_DATE'; // Default: 'DEC_31' (Federativo)
  ageCutoffDate?: string;   // Si se omite y ageCalculationMode es DEC_31, usa seasonYear-12-31 o 2026-12-31
  seasonYear?: number;      // ej. 2026 (Ámbito de temporada 2026: 01/01/2026 al 31/12/2026)
  startDate?: string;       // ISO 'YYYY-MM-DD' (ej. '2026-01-01')
  endDate?: string;         // ISO 'YYYY-MM-DD' (ej. '2026-12-31')
  associations?: string[];  // ej. ['LARA', 'ADAEL', 'Lara (ADAEL)']
  clubWhitelist?: string[]; // ej. Lista blanca de clubes afiliados (ej. KNOWN_ADAEL_CODES)
  includeExhibition?: boolean;
  topN?: number;            // ej. Top 10, Top 20 o sin límite
}

export interface RankedSwimmerItem extends SwimResultRecord {
  rank: number;
  ageAtRecord: number;
}

/**
 * Códigos oficiales conocidos de clubes afiliados a ADAEL (Estado Lara, Venezuela).
 */
export const KNOWN_ADAEL_CODES: string[] = [
  'PIS', 'PBOL', 'PISBO', 'HISP', 'HIL', 'HHIS', 'HISPANO', 'CBL', 'BARQ',
  'CDL', 'CDLARA', 'AQU', 'AQUALARA', 'TRIL', 'TRILARA', 'ADAL', 'ADAEL',
  'CLAR', 'LARA', 'CSL', 'CSLAR', 'CVM', 'PALM', 'TAR', 'TARL', 'HOCAL', 'ACUAR',
];

/**
 * Configuración oficial del Módulo Ranking Federado ADAEL 2026
 */
export const ADAEL_2026_SEASON = {
  year: 2026,
  startDate: '2026-01-01',
  endDate: '2026-12-31',
  ageCutoffDate: '2026-12-31',
  associationCode: 'LARA',
  associationName: 'Lara (ADAEL)',
  courses: ['LCM', 'SCM'] as const,
};

/**
 * Helper: Calcular edad exacta entre fecha de nacimiento y fecha referencia.
 */
export function calculateAge(birthDateStr: string, referenceDateStr: string): number {
  const birth = new Date(birthDateStr);
  const ref = new Date(referenceDateStr);
  let age = ref.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = ref.getUTCMonth() - birth.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return age;
}

/**
 * Motor Principal de Generación de Ranking (Estilo Hy-Tek Top Times)
 */
export function generateSwimmerRanking(
  allResults: SwimResultRecord[],
  filters: RankingFilterOptions
): RankedSwimmerItem[] {
  const ageMode = filters.ageCalculationMode ?? 'DEC_31';
  const cutoffDate = filters.ageCutoffDate ?? (filters.seasonYear ? `${filters.seasonYear}-12-31` : '2026-12-31');
  const seasonStart = filters.startDate ?? (filters.seasonYear ? `${filters.seasonYear}-01-01` : undefined);
  const seasonEnd = filters.endDate ?? (filters.seasonYear ? `${filters.seasonYear}-12-31` : undefined);

  const allowedAssocs = (filters.associations ?? []).map((a) => a.toUpperCase().trim());
  const allowedClubs = (filters.clubWhitelist ?? []).map((c) => c.toUpperCase().trim());

  // 1. Filtrado inicial de validez, prueba, curso, temporada y afiliación
  const validRecords = allResults.filter((r) => {
    if (r.status !== 'OK') return false;
    if (!filters.includeExhibition && r.isExhibition) return false;
    if (r.distance !== filters.distance) return false;
    if (r.stroke !== filters.stroke) return false;
    if (r.gender !== filters.gender) return false;

    // Regla de Cursos: Separación estricta entre LCM y SCM (sin mezclar)
    if (r.course !== filters.course) return false;

    // Regla de Ámbito de Temporada (ej. 2026-01-01 al 2026-12-31)
    if (seasonStart && r.meetDate < seasonStart) return false;
    if (seasonEnd && r.meetDate > seasonEnd) return false;

    // Regla de Afiliación (Asociación LARA / ADAEL o lista blanca de clubes afiliados)
    if (allowedAssocs.length > 0 || allowedClubs.length > 0) {
      const targetAssoc = r.associationCode ? r.associationCode.toUpperCase().trim() : '';
      const targetClub = r.clubCode ? r.clubCode.toUpperCase().trim() : '';

      const assocMatches = allowedAssocs.length > 0 && (
        allowedAssocs.includes(targetAssoc) ||
        (allowedAssocs.some((a) => a.includes('LARA') || a.includes('ADAEL') || a === 'LAR') &&
          (targetAssoc.includes('LARA') || targetAssoc.includes('ADAEL') || targetAssoc === 'LAR'))
      );

      const clubMatches = allowedClubs.length > 0 && allowedClubs.includes(targetClub);

      if (allowedAssocs.length > 0 && allowedClubs.length > 0) {
        if (!assocMatches && !clubMatches) return false;
      } else if (allowedAssocs.length > 0 && !assocMatches) {
        return false;
      } else if (allowedClubs.length > 0 && !clubMatches) {
        return false;
      }
    }

    // Regla de Edad Competitiva (Corte al 31 de Diciembre o al día del evento)
    const refDate = ageMode === 'MEET_DATE' ? r.meetDate : cutoffDate;
    const competitiveAge = calculateAge(r.birthDate, refDate);

    if (filters.minAge !== undefined && competitiveAge < filters.minAge) return false;
    if (filters.maxAge !== undefined && competitiveAge > filters.maxAge) return false;

    return true;
  });

  // 2. Deduplicación: conservar solo el MEJOR tiempo de cada nadador
  const bestBySwimmer = new Map<string, SwimResultRecord & { ageAtRecord: number }>();

  for (const record of validRecords) {
    const refDate = ageMode === 'MEET_DATE' ? record.meetDate : cutoffDate;
    const ageAtRecord = calculateAge(record.birthDate, refDate);
    const existing = bestBySwimmer.get(record.swimmerId);

    if (!existing || record.timeMs < existing.timeMs) {
      bestBySwimmer.set(record.swimmerId, { ...record, ageAtRecord });
    }
  }

  // 3. Ordenamiento ascendente por tiempo y asignación de posición oficial (manejo de empates)
  const sorted = Array.from(bestBySwimmer.values()).sort((a, b) => a.timeMs - b.timeMs);

  let currentRank = 1;
  const rankedList: RankedSwimmerItem[] = sorted.map((item, index) => {
    if (index > 0 && item.timeMs > sorted[index - 1]!.timeMs) {
      currentRank = index + 1;
    }
    return {
      rank: currentRank,
      ...item,
    };
  });

  // 4. Recorte opcional Top N
  return filters.topN ? rankedList.slice(0, filters.topN) : rankedList;
}

/**
 * Función preconfigurada para el Ranking Federado Oficial ADAEL Temporada 2026
 */
export function generateAdaelFederatedRanking2026(
  allResults: SwimResultRecord[],
  options: {
    distance: number;
    stroke: StrokeCode;
    gender: 'M' | 'F';
    course: 'LCM' | 'SCM';
    minAge?: number;
    maxAge?: number;
    ageCalculationMode?: 'DEC_31' | 'MEET_DATE';
    clubWhitelist?: string[];
    topN?: number;
  }
): RankedSwimmerItem[] {
  return generateSwimmerRanking(allResults, {
    distance: options.distance,
    stroke: options.stroke,
    gender: options.gender,
    course: options.course,
    ...(options.minAge !== undefined ? { minAge: options.minAge } : {}),
    ...(options.maxAge !== undefined ? { maxAge: options.maxAge } : {}),
    seasonYear: ADAEL_2026_SEASON.year,
    startDate: ADAEL_2026_SEASON.startDate,
    endDate: ADAEL_2026_SEASON.endDate,
    ageCalculationMode: options.ageCalculationMode ?? 'DEC_31',
    ageCutoffDate: ADAEL_2026_SEASON.ageCutoffDate,
    associations: ['LARA', 'ADAEL', 'Lara (ADAEL)'],
    clubWhitelist: options.clubWhitelist ?? KNOWN_ADAEL_CODES,
    ...(options.topN !== undefined ? { topN: options.topN } : {}),
  });
}

/**
 * Adapter: Convierte un resultado del Dashboard / Base de datos a SwimResultRecord
 */
export function toSwimResultRecord(
  result: {
    id: string;
    athlete_id: string;
    final_time_ms: number | null;
    is_dq?: boolean | null;
    status?: string | null;
    course?: string | null;
    is_exhibition?: boolean | null;
    aqua_points?: number | null;
    fina_points?: number | null;
    meets?: { id?: string; name?: string; start_date?: string | null } | null;
    events?: { distance?: number | null; stroke?: number | null; is_relay?: boolean | null } | null;
    athletes?: { first_name?: string | null; last_name?: string | null; gender?: string | null; birth_date?: string | null; club_id?: string | null; association?: string | null } | null;
  },
  clubMeta?: { clubCode?: string; clubName?: string; associationCode?: string }
): SwimResultRecord | null {
  if (!result.final_time_ms || result.is_dq || !result.events || !result.athletes || !result.athletes.birth_date) {
    return null;
  }

  const strokeCode = STROKE_NUMBER_TO_CODE[result.events.stroke ?? 1] ?? 'FREE';
  const course = (result.course?.toUpperCase() as CourseType) ?? 'LCM';
  const gender = (result.athletes.gender?.toUpperCase() === 'F' ? 'F' : 'M') as 'M' | 'F';

  return {
    resultId: result.id,
    swimmerId: result.athlete_id,
    swimmerName: `${result.athletes.last_name ?? ''}, ${result.athletes.first_name ?? ''}`.trim(),
    gender,
    birthDate: result.athletes.birth_date,
    clubCode: clubMeta?.clubCode ?? result.athletes.club_id ?? 'UN',
    clubName: clubMeta?.clubName ?? 'Club Independiente',
    associationCode: clubMeta?.associationCode ?? result.athletes.association ?? 'FEDERACION',
    meetName: result.meets?.name ?? 'Torneo Oficial',
    meetDate: result.meets?.start_date ?? new Date().toISOString().slice(0, 10),
    distance: result.events.distance ?? 50,
    stroke: strokeCode,
    course,
    timeMs: result.final_time_ms,
    status: (result.status as ResultStatus) ?? 'OK',
    isExhibition: Boolean(result.is_exhibition),
    ...((result.aqua_points ?? result.fina_points) != null
      ? { finaPoints: (result.aqua_points ?? result.fina_points)! }
      : {}),
  };
}
