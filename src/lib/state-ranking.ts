/**
 * Motor de Ranking Estadal Oficial — Swim Lane Coach
 * Ubicación: src/lib/state-ranking.ts
 *
 * Contrato oficial y motor de cálculo de rankings por estado,
 * deduplicación por mejor marca personal y análisis competitivo de Mi Club vs Rivales.
 */

import { formatTime } from "./swim";
import { normalizeAssociationName } from "./association-ranking";
import { normalizeTeamCode } from "@/data/fevedaClubs";

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
  diffVsMyClub: string;    // '—' si no hay atletas de mi club, '0.00s' para el mejor de mi club, o '+X.XXs' / '-X.XXs'
  diffVsMyClubMs: number | null;
}

export interface Top8ClubItem {
  clubCode: string;
  clubName: string;
  count: number;
  isMyClub: boolean;
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
  top8ClubDistribution: Top8ClubItem[];
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
  const targetMyClubClean = filters.myClubCode.toUpperCase().trim();

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

  // 4. Identificar el mejor tiempo del club del usuario logueado en esta prueba
  const myClubSwimmers = sorted.filter(
    (entry) => entry.clubCode.toUpperCase().trim() === targetMyClubClean
  );
  const myClubBestTime = myClubSwimmers.length > 0 ? myClubSwimmers[0].timeMs : null;

  // 5. Enriquecer con posición, bandera de "Mi Club", diff vs Líder y diff vs Mi Club
  const leaderTime = sorted.length > 0 ? sorted[0].timeMs : 0;

  return sorted.map((entry, index) => {
    const diffMs = entry.timeMs - leaderTime;
    const isMyClub = entry.clubCode.toUpperCase().trim() === targetMyClubClean;

    let diffVsMyClub = '—';
    let diffVsMyClubMs: number | null = null;

    if (myClubBestTime !== null) {
      diffVsMyClubMs = entry.timeMs - myClubBestTime;
      if (diffVsMyClubMs === 0) {
        diffVsMyClub = '0.00s';
      } else if (diffVsMyClubMs > 0) {
        diffVsMyClub = `+${(diffVsMyClubMs / 1000).toFixed(2)}s`;
      } else {
        diffVsMyClub = `-${(Math.abs(diffVsMyClubMs) / 1000).toFixed(2)}s`;
      }
    }

    return {
      rank: index + 1,
      ...entry,
      age: getCompetitiveAge(entry.birthDate, filters.referenceYear),
      isMyClub,
      diffFromLeader: index === 0 ? '—' : `+${(diffMs / 1000).toFixed(2)}s`,
      diffVsMyClub,
      diffVsMyClubMs,
    };
  });
}

/**
 * Cálculo de Resumen de KPIs de "Mi Club" frente al Estado y Desglose de Rivales en el Top 8
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

  // Distribución de puestos del Top 8 por club (para visualizar qué club rival domina)
  const top8Results = rankedResults.filter((r) => r.rank <= 8);
  const clubCountMap = new Map<string, { clubCode: string; clubName: string; count: number; isMyClub: boolean }>();
  for (const r of top8Results) {
    const key = r.clubCode.toUpperCase().trim();
    const existing = clubCountMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      clubCountMap.set(key, {
        clubCode: r.clubCode,
        clubName: r.clubName,
        count: 1,
        isMyClub: r.isMyClub,
      });
    }
  }

  const top8ClubDistribution = Array.from(clubCountMap.values()).sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return a.clubCode.localeCompare(b.clubCode);
  });

  return {
    activeState: filters.state,
    myClubCode: filters.myClubCode,
    totalSwimmers: rankedResults.length,
    leader,
    myClubTop8Count,
    myClubBest,
    myClubLeaderGapSeconds,
    myClubLeaderGapText,
    top8ClubDistribution,
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
    const rawCode = c.team_code || c.short_name || c.name || 'CLUB';
    const norm = normalizeTeamCode(rawCode, c.full_name || c.name, c.region_lsc || c.region || 'Lara');
    clubMap.set(c.id, { code: norm.code, name: norm.name, state: norm.state });
    clubMap.set(norm.code, { code: norm.code, name: norm.name, state: norm.state });
    if (rawCode.toUpperCase() !== norm.code) {
      clubMap.set(rawCode.toUpperCase().trim(), { code: norm.code, name: norm.name, state: norm.state });
    }
  }

  for (const t of teams) {
    const rawCode = t.code || 'TEAM';
    const norm = normalizeTeamCode(rawCode, t.name, t.lsc || 'Lara');
    if (!clubMap.has(norm.code)) {
      clubMap.set(t.id, { code: norm.code, name: norm.name, state: norm.state });
      clubMap.set(norm.code, { code: norm.code, name: norm.name, state: norm.state });
      if (rawCode.toUpperCase() !== norm.code) {
        clubMap.set(rawCode.toUpperCase().trim(), { code: norm.code, name: norm.name, state: norm.state });
      }
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

    const rawTeam = r.origin_team || ath.clubs?.team_code || ath.teams?.code || 'CLUB';
    const normTeam = normalizeTeamCode(rawTeam, ath.clubs?.name || ath.teams?.name);

    const clubMeta =
      (ath.club_id && clubMap.get(ath.club_id)) ||
      (normTeam.code && clubMap.get(normTeam.code)) ||
      (r.origin_team && clubMap.get(r.origin_team.toUpperCase().trim())) ||
      (ath.clubs?.id && clubMap.get(ath.clubs.id));

    const clubCode = clubMeta?.code || normTeam.code;
    const clubName = clubMeta?.name || normTeam.name;
    const state = clubMeta?.state || normTeam.state;

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
