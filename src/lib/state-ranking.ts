/**
 * Motor de Ranking Estadal Oficial — Swim Lane Coach
 * Ubicación: src/lib/state-ranking.ts
 *
 * Contrato oficial y motor de cálculo de rankings por estado,
 * deduplicación por mejor marca personal y análisis competitivo de Mi Club vs Rivales.
 */

import { formatTime } from "./swim";
import { normalizeAssociationName } from "./association-ranking";

export interface SwimResult {
  id: string;
  athleteId: string;
  athleteName: string;
  birthDate: string;       // YYYY-MM-DD
  gender: 'M' | 'F';
  clubCode: string;        // Ej: 'JSWIM', 'ITEL', 'POLI'
  clubName: string;
  state: string;           // Ej: 'Lara'
  eventCode: string;       // Ej: '100_FREE', '50_FLY'
  course: 'SCM' | 'LCM';   // 25m o 50m
  timeMs: number;          // Tiempo en milisegundos para ordenamiento exacto
  timeFormatted: string;   // Ej: "58.42" o "1:04.15"
  meetName: string;
  meetDate: string;        // YYYY-MM-DD
  aquaPoints?: number | null;
}

export interface RankingFilters {
  myClubCode: string;
  state: string;
  gender: 'M' | 'F';
  eventCode: string;
  course: 'SCM' | 'LCM';
  minAge: number;
  maxAge: number;
  referenceYear: number;   // Año competitivo (ej: 2026)
  seasonStart?: string;    // Opcional: filtrar desde fecha (ej: '2026-01-01')
}

export interface RankedSwimResult extends SwimResult {
  rank: number;
  age: number;
  isMyClub: boolean;
  diffFromLeader: string;  // '—' para el #1 o '+X.XXs' para los demás
}

export interface StateRankingSummary {
  activeState: string;
  myClubCode: string;
  totalSwimmers: number;
  leader: RankedSwimResult | null;
  myClubTop8Count: number;
  myClubBest: RankedSwimResult | null;
  myClubLeaderGapSeconds: number | null;
  myClubLeaderGapText: string;
}

// Calcula la edad competitiva al 31 de diciembre del año de referencia
export function getCompetitiveAge(birthDate: string, referenceYear: number): number {
  const birthYear = new Date(birthDate).getFullYear();
  return referenceYear - birthYear;
}

// Normalizador de estado para comparaciones flexibles (e.g. 'Lara' y 'Lara (ADAEL)')
export function cleanStateName(raw: string): string {
  if (!raw) return '';
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s*\(.*?\)\s*/g, '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Motor Principal de Generación de Ranking Estadal
 */
export function generateStateRanking(
  allResults: SwimResult[],
  filters: RankingFilters
): RankedSwimResult[] {
  const targetStateClean = cleanStateName(filters.state);

  // 1. Filtrar por estado, prueba, género, tipo de piscina, fecha y rango de edad
  const filtered = allResults.filter((r) => {
    const resultStateClean = cleanStateName(r.state);
    const matchesState =
      resultStateClean === targetStateClean ||
      r.state.toLowerCase() === filters.state.toLowerCase() ||
      resultStateClean.includes(targetStateClean) ||
      targetStateClean.includes(resultStateClean);

    if (!matchesState) return false;
    if (r.eventCode !== filters.eventCode) return false;
    if (r.gender !== filters.gender) return false;
    if (r.course !== filters.course) return false;
    if (filters.seasonStart && r.meetDate < filters.seasonStart) return false;

    const age = getCompetitiveAge(r.birthDate, filters.referenceYear);
    return age >= filters.minAge && age <= filters.maxAge;
  });

  // 2. Quedarse solo con la MEJOR marca (menor timeMs) de cada atleta
  const bestByAthlete = new Map<string, SwimResult>();
  for (const result of filtered) {
    const existing = bestByAthlete.get(result.athleteId);
    if (!existing || result.timeMs < existing.timeMs) {
      bestByAthlete.set(result.athleteId, result);
    }
  }

  // 3. Ordenar de menor a mayor tiempo
  const sorted = Array.from(bestByAthlete.values()).sort(
    (a, b) => a.timeMs - b.timeMs
  );

  // 4. Enriquecer con posición, bandera de "Mi Club" y diferencial respecto al líder
  const leaderTime = sorted.length > 0 ? sorted[0].timeMs : 0;

  return sorted.map((entry, index) => {
    const diffMs = entry.timeMs - leaderTime;
    return {
      rank: index + 1,
      ...entry,
      age: getCompetitiveAge(entry.birthDate, filters.referenceYear),
      isMyClub: entry.clubCode.toUpperCase().trim() === filters.myClubCode.toUpperCase().trim(),
      diffFromLeader: index === 0 ? '—' : `+${(diffMs / 1000).toFixed(2)}s`,
    };
  });
}

/**
 * Cálculo de Resumen de KPIs de "Mi Club" frente al Estado
 */
export function calculateStateRankingSummary(
  rankedResults: RankedSwimResult[],
  filters: RankingFilters
): StateRankingSummary {
  const myClubSwimmers = rankedResults.filter((r) => r.isMyClub);
  const myClubTop8Count = myClubSwimmers.filter((r) => r.rank <= 8).length;
  const myClubBest = myClubSwimmers.length > 0 ? myClubSwimmers[0] : null;

  const leader = rankedResults.length > 0 ? rankedResults[0] : null;
  const leaderTime = leader ? leader.timeMs : 0;

  let myClubLeaderGapSeconds: number | null = null;
  let myClubLeaderGapText = 'Sin atletas de mi club clasificados en esta prueba';

  if (myClubBest) {
    if (myClubBest.rank === 1) {
      myClubLeaderGapSeconds = 0;
      myClubLeaderGapText = `¡Líder Estadal! (por ${myClubBest.athleteName})`;
    } else {
      myClubLeaderGapSeconds = Number(((myClubBest.timeMs - leaderTime) / 1000).toFixed(2));
      myClubLeaderGapText = `+${myClubLeaderGapSeconds}s respecto al 1° (por ${myClubBest.athleteName} · #${myClubBest.rank})`;
    }
  }

  return {
    activeState: filters.state,
    myClubCode: filters.myClubCode,
    totalSwimmers: rankedResults.length,
    leader,
    myClubTop8Count,
    myClubBest,
    myClubLeaderGapSeconds,
    myClubLeaderGapText,
  };
}

/**
 * Lista oficial de eventos de natación con código estandarizado
 */
export const STATE_EVENT_CODES = [
  { eventCode: '50_FREE', label: '50m Libre', distance: 50, stroke: 'FREE', strokeNum: 1 },
  { eventCode: '100_FREE', label: '100m Libre', distance: 100, stroke: 'FREE', strokeNum: 1 },
  { eventCode: '200_FREE', label: '200m Libre', distance: 200, stroke: 'FREE', strokeNum: 1 },
  { eventCode: '400_FREE', label: '400m Libre', distance: 400, stroke: 'FREE', strokeNum: 1 },
  { eventCode: '800_FREE', label: '800m Libre', distance: 800, stroke: 'FREE', strokeNum: 1 },
  { eventCode: '1500_FREE', label: '1500m Libre', distance: 1500, stroke: 'FREE', strokeNum: 1 },
  { eventCode: '50_BACK', label: '50m Espalda', distance: 50, stroke: 'BACK', strokeNum: 2 },
  { eventCode: '100_BACK', label: '100m Espalda', distance: 100, stroke: 'BACK', strokeNum: 2 },
  { eventCode: '200_BACK', label: '200m Espalda', distance: 200, stroke: 'BACK', strokeNum: 2 },
  { eventCode: '50_BREAST', label: '50m Pecho', distance: 50, stroke: 'BREAST', strokeNum: 3 },
  { eventCode: '100_BREAST', label: '100m Pecho', distance: 100, stroke: 'BREAST', strokeNum: 3 },
  { eventCode: '200_BREAST', label: '200m Pecho', distance: 200, stroke: 'BREAST', strokeNum: 3 },
  { eventCode: '50_FLY', label: '50m Mariposa', distance: 50, stroke: 'FLY', strokeNum: 4 },
  { eventCode: '100_FLY', label: '100m Mariposa', distance: 100, stroke: 'FLY', strokeNum: 4 },
  { eventCode: '200_FLY', label: '200m Mariposa', distance: 200, stroke: 'FLY', strokeNum: 4 },
  { eventCode: '100_IM', label: '100m Combinado (SCM)', distance: 100, stroke: 'IM', strokeNum: 5 },
  { eventCode: '200_IM', label: '200m Combinado', distance: 200, stroke: 'IM', strokeNum: 5 },
  { eventCode: '400_IM', label: '400m Combinado', distance: 400, stroke: 'IM', strokeNum: 5 },
];

export const QUICK_AGE_CATEGORIES = [
  { label: '10 - 11', name: 'Infantil A', min: 10, max: 11 },
  { label: '12 - 13', name: 'Infantil B', min: 12, max: 13 },
  { label: '14 - 15', name: 'Juvenil A', min: 14, max: 15 },
  { label: '16 - 18', name: 'Juvenil B', min: 16, max: 18 },
  { label: '19+', name: 'Máxima / Abierto', min: 19, max: 99 },
];

/**
 * Adaptador: Convierte resultados heterogéneos de base de datos a SwimResult[]
 */
export function adaptToSwimResults(
  results: readonly any[],
  athletes: readonly any[],
  clubs: readonly any[] = [],
  teams: readonly any[] = []
): SwimResult[] {
  const clubMap = new Map<string, { code: string; name: string; state: string }>();

  for (const c of clubs) {
    const code = (c.team_code || c.short_name || c.name || 'CLUB').toUpperCase().trim();
    const state = normalizeAssociationName(c.region_lsc || c.region || 'Lara');
    clubMap.set(c.id, { code, name: c.full_name || c.name, state });
    clubMap.set(code, { code, name: c.full_name || c.name, state });
  }

  for (const t of teams) {
    const code = (t.code || 'TEAM').toUpperCase().trim();
    if (!clubMap.has(code)) {
      const state = normalizeAssociationName(t.lsc || 'Lara');
      clubMap.set(t.id, { code, name: t.name || code, state });
      clubMap.set(code, { code, name: t.name || code, state });
    }
  }

  const strokeNumToStr: Record<number, string> = {
    1: 'FREE',
    2: 'BACK',
    3: 'BREAST',
    4: 'FLY',
    5: 'IM',
  };

  const adapted: SwimResult[] = [];

  for (const r of results) {
    if (r.is_dq || !r.final_time_ms || r.final_time_ms <= 0) continue;

    const ath = athletes.find((a) => a.id === r.athlete_id) || r.athletes;
    if (!ath || !ath.birth_date) continue;

    const distance = r.events?.distance ?? r.distance ?? 100;
    const strokeNum = r.events?.stroke ?? r.stroke ?? 1;
    const strokeStr = strokeNumToStr[strokeNum] || 'FREE';
    const eventCode = `${distance}_${strokeStr}`;

    const clubMeta =
      (ath.club_id && clubMap.get(ath.club_id)) ||
      (r.origin_team && clubMap.get(r.origin_team.toUpperCase().trim())) ||
      (ath.clubs?.id && clubMap.get(ath.clubs.id)) ||
      (ath.clubs?.team_code && clubMap.get(ath.clubs.team_code.toUpperCase().trim()));

    const clubCode = clubMeta?.code || ath.clubs?.team_code || ath.teams?.code || r.origin_team || 'CLUB';
    const clubName = clubMeta?.name || ath.clubs?.full_name || ath.clubs?.name || ath.teams?.name || clubCode;
    const state = clubMeta?.state || normalizeAssociationName(ath.clubs?.region_lsc || ath.teams?.lsc || 'Lara');

    adapted.push({
      id: r.id || `${ath.id}-${r.final_time_ms}`,
      athleteId: ath.id || r.athlete_id,
      athleteName: `${ath.last_name || ''}, ${ath.first_name || ''}`.trim().replace(/^,\s*|,\s*$/g, ''),
      birthDate: ath.birth_date,
      gender: ath.gender || 'M',
      clubCode,
      clubName,
      state,
      eventCode,
      course: r.course === 'SCM' ? 'SCM' : 'LCM',
      timeMs: r.final_time_ms,
      timeFormatted: formatTime(r.final_time_ms),
      meetName: r.meets?.name || 'Torneo Oficial',
      meetDate: r.meets?.start_date || r.meet_date || '2026-01-01',
      aquaPoints: r.aqua_points ?? null,
    });
  }

  return adapted;
}
