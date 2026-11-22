/**
 * Servicio Oficial de Ranking Federado ADAEL 2026
 * Ubicación: src/services/adaelRanking.ts
 *
 * Reglas de Negocio:
 * 1. Filtra únicamente resultados con estado válido (OK), excluyendo exhibiciones (EXH) salvo activación explícita.
 * 2. Filtra solo atletas pertenecientes a clubes afiliados a adael_clubs (incluso si la marca se obtuvo en un Nacional fuera de Lara).
 * 3. Deduplica por swimmerId para mostrar únicamente la mejor marca del año 2026 de cada nadador en la prueba y curso.
 * 4. Calcula la edad al 31/12/2026 (con opción de alternar a edad al día del evento).
 * 5. Clasifica en los bloques federativos oficiales:
 *    - Infantil A (10 - 11 años)
 *    - Infantil B (12 - 13 años)
 *    - Juvenil A (14 - 15 años)
 *    - Juvenil B (16 - 18 años)
 *    - Máxima (19 y más años)
 *    - Pre-Infantil (9 y menos años)
 *    - Edad única (9 a 18+)
 *    - Clases de Para-Natación (S1-S14, SB1-SB14, SM1-SM14)
 */

import { supabase } from '@/integrations/supabase/client';
import { formatTime } from '@/lib/swim';
import { KNOWN_ADAEL_CODES } from '@/lib/team-hub/ranking-engine';

export type CourseType = 'LCM' | 'SCM';
export type StrokeCode = 'FREE' | 'BACK' | 'BREAST' | 'FLY' | 'IM';
export type GenderType = 'M' | 'F' | 'all';

export type FederatedAgeCategory =
  | 'TODAS'          // Todas las categorías (Absoluto / Libre)
  | 'PRE_INFANTIL'   // 9 años y menores
  | 'INFANTIL_A'     // 10 - 11 años
  | 'INFANTIL_B'     // 12 - 13 años
  | 'JUVENIL_A'      // 14 - 15 años
  | 'JUVENIL_B'      // 16 - 18 años
  | 'MAXIMA'         // 19 y más años
  | 'SINGLE_AGE'     // 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19+
  | 'PARA_SWIMMING'; // Clases funcionales de Para-Natación

export interface AdaelRankingFilters {
  distance: number;                   // 50, 100, 200, 400, 800, 1500
  stroke: StrokeCode;                 // 'FREE' | 'BACK' | 'BREAST' | 'FLY' | 'IM'
  course: CourseType;                 // 'LCM' | 'SCM'
  gender: 'M' | 'F' | 'all';
  category?: FederatedAgeCategory;    // Default: 'TODAS'
  singleAge?: number;                 // e.g. 9, 10, ..., 18, 19
  paraClass?: string;                 // e.g. 'all', 'S9', 'SB8', 'SM9'
  ageMode?: 'DEC_31' | 'MEET_DATE';   // Default: 'DEC_31' (al 2026-12-31)
  includeExhibition?: boolean;        // Default: false
  clubCode?: string;                  // Opcional: filtrar por un club específico
  clubWhitelist?: string[];           // Opcional: lista blanca de clubes
  topN?: number;                      // ej. Top 10, Top 20, o sin límite
  meetId?: string;                    // Opcional: filtrar por torneo específico
}

export interface RawSwimRecord {
  resultId: string;
  swimmerId: string;
  swimmerName: string;
  gender: 'M' | 'F' | 'X';
  birthDate: string;                  // ISO 'YYYY-MM-DD'
  federationId?: string | null;
  clubCode: string;
  clubName?: string;
  associationCode?: string;
  meetName: string;
  meetDate: string;                   // ISO 'YYYY-MM-DD'
  meetLocation?: string | null;
  distance: number;
  stroke: StrokeCode;
  course: CourseType;
  timeMs: number | null;
  status: 'OK' | 'DQ' | 'DNS' | 'DNF' | 'SCR' | 'NS';
  isExhibition?: boolean;
  isRelayLeadOff?: boolean;
  waPoints?: number | null;
  paraClass?: string | null;
  round?: string;
}

export interface RankedAthleteItem {
  rank: number;
  swimmerId: string;
  swimmerName: string;
  gender: 'M' | 'F';
  birthDate: string;
  age: number;                        // Edad al 31/12/2026 o al día del torneo
  categoryLabel: string;              // "Infantil A (10-11 años)", "Juvenil A (14-15 años)", etc.
  singleAgeLabel: string;             // "14 años" o "19 y más años"
  paraClass?: string | null;          // "S9", "SB8", "SM9"
  clubCode: string;
  clubName: string;
  associationCode: string;            // 'LARA'
  meetName: string;
  meetDate: string;
  meetLocation?: string | null;
  distance: number;
  stroke: StrokeCode;
  course: CourseType;
  timeMs: number;
  formattedTime: string;              // "25.40", "1:02.30"
  status: 'OK';
  isExhibition: boolean;
  isRelayLeadOff: boolean;
  waPoints?: number | null;
}

/**
 * Calcula la edad exacta entre fecha de nacimiento y fecha de referencia.
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
 * Determina el bloque federativo oficial según la edad del atleta.
 * Infantil A (10-11), Infantil B (12-13), Juvenil A (14-15), Juvenil B (16-18), Máxima (19+)
 */
export function classifyFederatedCategory(age: number, paraClass?: string | null): string {
  if (paraClass && paraClass.trim()) {
    return `Para-Natación (${paraClass.toUpperCase().trim()})`;
  }
  if (age <= 9) return 'Pre-Infantil (≤9 años)';
  if (age >= 10 && age <= 11) return 'Infantil A (10-11 años)';
  if (age >= 12 && age <= 13) return 'Infantil B (12-13 años)';
  if (age >= 14 && age <= 15) return 'Juvenil A (14-15 años)';
  if (age >= 16 && age <= 18) return 'Juvenil B (16-18 años)';
  return 'Máxima (19 y más años)';
}

/**
 * Verifica si un atleta cumple con el filtro de categoría solicitado.
 */
export function matchesCategoryFilter(
  age: number,
  category: FederatedAgeCategory = 'TODAS',
  options?: { singleAge?: number; paraClass?: string; swimmerParaClass?: string | null }
): boolean {
  if (category === 'TODAS') return true;

  if (category === 'PARA_SWIMMING') {
    if (!options?.swimmerParaClass) return false;
    if (options.paraClass && options.paraClass !== 'all') {
      return options.swimmerParaClass.toUpperCase().trim() === options.paraClass.toUpperCase().trim();
    }
    return true;
  }

  if (category === 'SINGLE_AGE') {
    if (options?.singleAge !== undefined) {
      if (options.singleAge >= 19) return age >= 19;
      return age === options.singleAge;
    }
    return true;
  }

  switch (category) {
    case 'PRE_INFANTIL':
      return age <= 9;
    case 'INFANTIL_A':
      return age >= 10 && age <= 11;
    case 'INFANTIL_B':
      return age >= 12 && age <= 13;
    case 'JUVENIL_A':
      return age >= 14 && age <= 15;
    case 'JUVENIL_B':
      return age >= 16 && age <= 18;
    case 'MAXIMA':
      return age >= 19;
    default:
      return true;
  }
}

/**
 * Conjunto de códigos oficiales de clubes afiliados a ADAEL (Estado Lara).
 */
export const ADAEL_CLUBS_SET = new Set(
  KNOWN_ADAEL_CODES.map((c) => c.toUpperCase().trim())
);

/**
 * Servicio Principal: getAdaelRanking2026
 * Procesa y devuelve el ranking federado oficial ADAEL de la temporada 2026.
 *
 * @param filters Filtros de búsqueda (prueba, curso, sexo, categoría, edad, modo de cálculo)
 * @param recordsToProcess Opcional: lista de registros en memoria (útil para pruebas unitarias o cache)
 */
export async function getAdaelRanking2026(
  filters: AdaelRankingFilters,
  recordsToProcess?: RawSwimRecord[]
): Promise<RankedAthleteItem[]> {
  const ageMode = filters.ageMode ?? 'DEC_31';
  const cutoffDate = ageMode === 'DEC_31' ? '2026-12-31' : null;

  // 1. Obtener registros (de base de datos si no se pasan en memoria)
  let rawRecords: RawSwimRecord[] = [];
  if (recordsToProcess && recordsToProcess.length > 0) {
    rawRecords = recordsToProcess;
  } else {
    rawRecords = await fetchAdaelRecordsFromDb(filters);
  }

  // 2. Determinar padrón de clubes afiliados válidos
  const targetClubCodes = new Set<string>();
  if (filters.clubWhitelist && filters.clubWhitelist.length > 0) {
    filters.clubWhitelist.forEach((c) => targetClubCodes.add(c.toUpperCase().trim()));
  } else {
    ADAEL_CLUBS_SET.forEach((c) => targetClubCodes.add(c));
  }

  // 3. Filtrado inicial estricto
  const validRecords = rawRecords.filter((r) => {
    // REGLA 1: Solo tiempos válidos (OK), excluyendo exhibiciones (EXH) salvo que se soliciten
    if (r.status !== 'OK') return false;
    if (!r.timeMs || r.timeMs <= 0) return false;
    if (!filters.includeExhibition && r.isExhibition) return false;

    // Filtro de prueba y curso
    if (r.distance !== filters.distance) return false;
    if (r.stroke !== filters.stroke) return false;
    if (r.course !== filters.course) return false;

    // Filtro de género
    if (filters.gender !== 'all' && r.gender !== filters.gender) return false;

    // Ámbito de temporada 2026 (01/01/2026 al 31/12/2026)
    if (r.meetDate < '2026-01-01' || r.meetDate > '2026-12-31') return false;

    // REGLA 2: Solo atletas pertenecientes a clubes afiliados a adael_clubs
    // (Incluso si la marca se obtuvo en un Torneo Nacional celebrado fuera de Lara)
    const clubCodeClean = (r.clubCode || '').toUpperCase().trim();
    if (!targetClubCodes.has(clubCodeClean)) {
      return false;
    }

    // Filtro opcional por club específico
    if (filters.clubCode && filters.clubCode !== 'all') {
      if (clubCodeClean !== filters.clubCode.toUpperCase().trim()) {
        return false;
      }
    }

    // Filtro opcional por torneo específico
    if (filters.meetId && (r as any).meetId !== filters.meetId) {
      return false;
    }

    // REGLA 4: Cálculo de edad (al 31/12/2026 o al día del torneo)
    const refDate = cutoffDate ?? r.meetDate;
    const athleteAge = calculateAge(r.birthDate, refDate);

    // REGLA 5: Clasificación y filtro de categorías federativas
    const matchesCategory = matchesCategoryFilter(athleteAge, filters.category ?? 'TODAS', {
      singleAge: filters.singleAge,
      paraClass: filters.paraClass,
      swimmerParaClass: r.paraClass,
    });
    if (!matchesCategory) return false;

    return true;
  });

  // REGLA 3: Deduplicación por swimmerId para mostrar solo la MEJOR marca del año 2026
  const bestBySwimmer = new Map<string, RawSwimRecord & { calculatedAge: number }>();

  for (const record of validRecords) {
    const refDate = cutoffDate ?? record.meetDate;
    const athleteAge = calculateAge(record.birthDate, refDate);
    const existing = bestBySwimmer.get(record.swimmerId);

    // Conservar solo el menor tiempo en milisegundos (más rápido)
    if (!existing || (record.timeMs !== null && existing.timeMs !== null && record.timeMs < existing.timeMs)) {
      bestBySwimmer.set(record.swimmerId, {
        ...record,
        calculatedAge: athleteAge,
      });
    }
  }

  // 4. Ordenamiento ascendente por tiempo y asignación de puestos oficiales (manejo de empates)
  const sorted = Array.from(bestBySwimmer.values()).sort(
    (a, b) => (a.timeMs ?? Infinity) - (b.timeMs ?? Infinity)
  );

  let currentRank = 1;
  const rankedItems: RankedAthleteItem[] = sorted.map((item, index) => {
    if (index > 0 && item.timeMs !== null && sorted[index - 1]?.timeMs !== null) {
      if (item.timeMs > (sorted[index - 1]?.timeMs ?? 0)) {
        currentRank = index + 1; // Salto de ranking oficial
      }
    }

    const age = item.calculatedAge;
    const categoryLabel = classifyFederatedCategory(age, item.paraClass);
    const singleAgeLabel = age >= 19 ? '19 y más años' : `${age} años`;

    return {
      rank: currentRank,
      swimmerId: item.swimmerId,
      swimmerName: item.swimmerName,
      gender: item.gender === 'F' ? 'F' : 'M',
      birthDate: item.birthDate,
      age,
      categoryLabel,
      singleAgeLabel,
      paraClass: item.paraClass || null,
      clubCode: item.clubCode,
      clubName: item.clubName || item.clubCode,
      associationCode: item.associationCode || 'LARA',
      meetName: item.meetName,
      meetDate: item.meetDate,
      meetLocation: item.meetLocation,
      distance: item.distance,
      stroke: item.stroke,
      course: item.course,
      timeMs: item.timeMs!,
      formattedTime: formatTime(item.timeMs),
      status: 'OK',
      isExhibition: Boolean(item.isExhibition),
      isRelayLeadOff: Boolean(item.isRelayLeadOff),
      waPoints: item.waPoints,
    };
  });

  // 5. Aplicar recorte opcional Top N
  return filters.topN && filters.topN > 0 ? rankedItems.slice(0, filters.topN) : rankedItems;
}

/**
 * Consulta la base de datos Supabase para recuperar resultados oficiales de 2026.
 */
async function fetchAdaelRecordsFromDb(filters: AdaelRankingFilters): Promise<RawSwimRecord[]> {
  try {
    // 1. Intentar consultar la tabla especializada official_results_2026
    const query = supabase
      .from('official_results_2026' as any)
      .select(`
        id,
        swimmer_name,
        federation_id,
        birth_date,
        gender,
        club_code,
        distance,
        stroke,
        course,
        time_ms,
        status,
        is_relay_leadoff,
        wa_points,
        round,
        meet_id,
        meets_2026:meet_id (
          id,
          name,
          start_date,
          course,
          location
        ),
        adael_clubs:club_code (
          code,
          name,
          is_federated_2026,
          association
        )
      `)
      .eq('course', filters.course)
      .eq('stroke', filters.stroke)
      .eq('distance', filters.distance)
      .eq('status', 'OK');

    if (filters.gender !== 'all') {
      query.eq('gender', filters.gender);
    }

    const { data, error } = await query;

    if (!error && data && data.length > 0) {
      return (data as any[]).map((r) => {
        const meet = r.meets_2026;
        const club = r.adael_clubs;
        const swimmerKey = `${r.swimmer_name}_${r.birth_date}`;

        return {
          resultId: r.id,
          swimmerId: swimmerKey,
          swimmerName: r.swimmer_name,
          gender: r.gender,
          birthDate: r.birth_date,
          federationId: r.federation_id,
          clubCode: r.club_code,
          clubName: club?.name || r.club_code,
          associationCode: club?.association || 'LARA',
          meetName: meet?.name || 'Torneo Oficial 2026',
          meetDate: meet?.start_date || '2026-01-01',
          meetLocation: meet?.location,
          distance: r.distance,
          stroke: r.stroke,
          course: r.course,
          timeMs: r.time_ms,
          status: r.status,
          isExhibition: false,
          isRelayLeadOff: Boolean(r.is_relay_leadoff),
          waPoints: r.wa_points,
          round: r.round,
        };
      });
    }

    // 2. Fallback: Consultar tabla general de results con filtro de temporada 2026
    const fallbackQuery = supabase
      .from('results')
      .select(`
        id,
        athlete_id,
        final_time_ms,
        status,
        is_dq,
        is_exhibition,
        aqua_points,
        round,
        events!inner (distance, stroke, is_relay),
        meets!inner (id, name, start_date, course, location),
        athletes!inner (
          id,
          first_name,
          last_name,
          gender,
          birth_date,
          federation_id,
          clubs (id, team_code, full_name, region_lsc),
          teams (id, code, name, lsc)
        )
      `)
      .eq('meets.course', filters.course)
      .gte('meets.start_date', '2026-01-01')
      .lte('meets.start_date', '2026-12-31')
      .eq('is_dq', false)
      .not('final_time_ms', 'is', null);

    const { data: fallbackData, error: fallbackError } = await fallbackQuery;
    if (fallbackError || !fallbackData) return [];

    return (fallbackData as any[]).map((r) => {
      const athlete = r.athletes;
      const meet = r.meets;
      const clubCode = (
        (r as any).origin_team ||
        athlete?.clubs?.team_code ||
        athlete?.teams?.code ||
        'UN'
      ).toUpperCase().trim();

      const strokeCode = mapStrokeNumberToCode(r.events?.stroke);

      return {
        resultId: r.id,
        swimmerId: r.athlete_id,
        swimmerName: `${athlete?.last_name || ''}, ${athlete?.first_name || ''}`.trim(),
        gender: athlete?.gender || 'M',
        birthDate: athlete?.birth_date || '2000-01-01',
        federationId: athlete?.federationId,
        clubCode,
        clubName: athlete?.clubs?.full_name || athlete?.teams?.name || clubCode,
        associationCode: athlete?.clubs?.region_lsc || 'LARA',
        meetName: meet?.name || 'Competencia 2026',
        meetDate: meet?.start_date || '2026-01-01',
        meetLocation: meet?.location,
        distance: r.events?.distance || 50,
        stroke: strokeCode,
        course: (meet?.course || filters.course) as CourseType,
        timeMs: r.final_time_ms,
        status: 'OK',
        isExhibition: Boolean(r.is_exhibition),
        isRelayLeadOff: false,
        waPoints: r.aqua_points,
        round: r.round || 'F',
      };
    });
  } catch (err) {
    console.error('Error al consultar base de datos para ranking ADAEL 2026:', err);
    return [];
  }
}

function mapStrokeNumberToCode(num?: number | null): StrokeCode {
  switch (num) {
    case 2: return 'BACK';
    case 3: return 'BREAST';
    case 4: return 'FLY';
    case 5: return 'IM';
    default: return 'FREE';
  }
}
