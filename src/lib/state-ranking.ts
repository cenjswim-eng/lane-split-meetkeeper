/**
 * Motor de Ranking Estadal — Swim Lane Coach
 * Ubicación: src/lib/state-ranking.ts
 *
 * Filtra automáticamente los resultados pertenecientes al mismo Estado configurado
 * en el perfil del club activo, deduplica por mejor marca personal de cada nadador,
 * calcula posiciones con salto de empates, diferencia vs. #1 y genera métricas de brecha
 * para el club del usuario.
 */

import { formatTime } from "./swim";
import { normalizeAssociationName } from "./association-ranking";

export interface StateRankingFilters {
  distance: number;       // 50, 100, 200, 400, 800, 1500
  stroke: number;         // 1=Libre, 2=Espalda, 3=Pecho, 4=Mariposa, 5=Combinado
  course: "LCM" | "SCM";  // 50m LCM o 25m SCM
  gender: "M" | "F";      // Masculino o Femenino
  minAge?: number;        // Edad desde (flexible)
  maxAge?: number;        // Edad hasta (flexible)
  referenceYear?: number; // Año de referencia competitivo (por defecto año actual)
  season?: string;        // 'all' o año ej. '2026'
  startDate?: string;     // ISO 'YYYY-MM-DD'
  endDate?: string;       // ISO 'YYYY-MM-DD'
  stateOverride?: string; // Opcional para alternar estado si el usuario lo desea
}

export interface StateRankingItem {
  rank: number;
  swimmerId: string;
  athleteName: string;
  gender: "M" | "F";
  birthDate: string | null;
  age: number;
  clubId: string;
  clubCode: string;
  clubName: string;
  association: string;
  isMyClub: boolean;
  distance: number;
  stroke: number;
  course: "LCM" | "SCM";
  timeMs: number;
  formattedTime: string;
  diffVsLeader: string; // ej. "+0.00s" o "+1.42s"
  diffVsLeaderMs: number;
  aquaPoints?: number | null;
  meetName: string;
  meetDate: string | null;
}

export interface StateRankingSummary {
  activeState: string;
  activeClubName: string;
  activeClubCode: string;
  totalSwimmers: number;
  leaderSwimmer: StateRankingItem | null;
  myClubTop8Count: number;
  myClubBestSwimmer: StateRankingItem | null;
  myClubLeaderGapSeconds: number | null;
  myClubLeaderGapText: string;
}

export const STATE_EVENTS_LIST = [
  { distance: 50, stroke: 1, label: "50m Libre" },
  { distance: 100, stroke: 1, label: "100m Libre" },
  { distance: 200, stroke: 1, label: "200m Libre" },
  { distance: 400, stroke: 1, label: "400m Libre" },
  { distance: 800, stroke: 1, label: "800m Libre" },
  { distance: 1500, stroke: 1, label: "1500m Libre" },
  { distance: 50, stroke: 2, label: "50m Espalda" },
  { distance: 100, stroke: 2, label: "100m Espalda" },
  { distance: 200, stroke: 2, label: "200m Espalda" },
  { distance: 50, stroke: 3, label: "50m Pecho" },
  { distance: 100, stroke: 3, label: "100m Pecho" },
  { distance: 200, stroke: 3, label: "200m Pecho" },
  { distance: 50, stroke: 4, label: "50m Mariposa" },
  { distance: 100, stroke: 4, label: "100m Mariposa" },
  { distance: 200, stroke: 4, label: "200m Mariposa" },
  { distance: 100, stroke: 5, label: "100m Combinado (SCM)" },
  { distance: 200, stroke: 5, label: "200m Combinado" },
  { distance: 400, stroke: 5, label: "400m Combinado" },
];

export const QUICK_AGE_CATEGORIES = [
  { label: "10 - 11", name: "Infantil A", min: 10, max: 11 },
  { label: "12 - 13", name: "Infantil B", min: 12, max: 13 },
  { label: "14 - 15", name: "Juvenil A", min: 14, max: 15 },
  { label: "16 - 18", name: "Juvenil B", min: 16, max: 18 },
  { label: "19+", name: "Máxima / Abierto", min: 19, max: 99 },
];

/**
 * Motor principal de cálculo del Ranking Estadal
 */
export function generateStateRanking(
  allResults: readonly any[],
  allAthletes: readonly any[],
  allClubs: readonly any[] = [],
  allTeams: readonly any[] = [],
  activeClub: any = null,
  filters: StateRankingFilters
): { rankedList: StateRankingItem[]; summary: StateRankingSummary } {
  const currentYear = filters.referenceYear ?? new Date().getFullYear();

  // 1. Determinar el Estado / Asociación del club activo
  const fullActiveClub = allClubs.find((c) => c.id === activeClub?.id) || activeClub;
  const activeClubCode = (fullActiveClub?.team_code || fullActiveClub?.short_name || fullActiveClub?.name || "MICLUB").toUpperCase().trim();
  const activeClubName = fullActiveClub?.full_name || fullActiveClub?.name || "Mi Club";

  const rawConfiguredState = fullActiveClub?.region_lsc || fullActiveClub?.region || "";
  const detectedState = rawConfiguredState ? normalizeAssociationName(rawConfiguredState) : "Lara (ADAEL)";
  const targetState = filters.stateOverride && filters.stateOverride !== "auto"
    ? normalizeAssociationName(filters.stateOverride)
    : detectedState;

  // Mapa rápido de clubes y sus asociaciones
  const clubAssocMap = new Map<string, { code: string; name: string; assoc: string; id: string }>();
  for (const c of allClubs) {
    const code = (c.team_code || c.short_name || c.name || "CLUB").toUpperCase().trim();
    clubAssocMap.set(c.id, {
      id: c.id,
      code,
      name: c.full_name || c.name,
      assoc: normalizeAssociationName(c.region_lsc || c.region),
    });
    clubAssocMap.set(code, {
      id: c.id,
      code,
      name: c.full_name || c.name,
      assoc: normalizeAssociationName(c.region_lsc || c.region),
    });
  }

  for (const t of allTeams) {
    const code = (t.code || "TEAM").toUpperCase().trim();
    if (!clubAssocMap.has(code)) {
      clubAssocMap.set(code, {
        id: t.id,
        code,
        name: t.name || code,
        assoc: normalizeAssociationName(t.lsc),
      });
    }
  }

  // Helper para verificar si pertenece al estado objetivo
  const matchesTargetState = (assoc: string) => {
    if (!targetState || targetState === "Todas" || targetState === "all") return true;
    const cleanTarget = targetState.toLowerCase().trim();
    const cleanAssoc = assoc.toLowerCase().trim();
    return cleanAssoc.includes(cleanTarget) || cleanTarget.includes(cleanAssoc);
  };

  // 2. Filtrado inicial de resultados
  const validRecords = allResults.filter((r) => {
    // Solo tiempos válidos (sin DQ ni DNS ni tiempos nulos)
    if (r.is_dq || !r.final_time_ms || r.final_time_ms <= 0) return false;

    // Filtro de piscina (LCM vs SCM)
    if (r.course !== filters.course) return false;

    // Filtro de distancia y estilo
    const evDistance = r.events?.distance ?? r.distance;
    const evStroke = r.events?.stroke ?? r.stroke;
    if (evDistance !== filters.distance || evStroke !== filters.stroke) return false;

    // Atleta asociado
    const athlete = allAthletes.find((a) => a.id === r.athlete_id) || r.athletes;
    if (!athlete) return false;

    // Filtro de género
    if (athlete.gender !== filters.gender) return false;

    // Cálculo y filtro de edad (según año de nacimiento vs año competitivo)
    if (athlete.birth_date) {
      const birthYear = Number(athlete.birth_date.slice(0, 4));
      const competitiveAge = currentYear - birthYear;
      if (filters.minAge !== undefined && competitiveAge < filters.minAge) return false;
      if (filters.maxAge !== undefined && competitiveAge > filters.maxAge) return false;
    }

    // Filtro de temporada o fechas
    const meetDate = r.meets?.start_date || r.meet_date;
    if (filters.season && filters.season !== "all") {
      if (!meetDate || meetDate.slice(0, 4) !== filters.season) return false;
    }
    if (filters.startDate && meetDate && meetDate < filters.startDate) return false;
    if (filters.endDate && meetDate && meetDate > filters.endDate) return false;

    // Filtro estricto por Estado / Asociación
    const clubInfo =
      (athlete.club_id && clubAssocMap.get(athlete.club_id)) ||
      (athlete.clubs?.id && clubAssocMap.get(athlete.clubs.id)) ||
      (r.origin_team && clubAssocMap.get(r.origin_team.toUpperCase().trim())) ||
      (athlete.clubs?.team_code && clubAssocMap.get(athlete.clubs.team_code.toUpperCase().trim()));

    const athleteAssoc = clubInfo
      ? clubInfo.assoc
      : normalizeAssociationName(athlete.clubs?.region_lsc || athlete.clubs?.region || athlete.teams?.lsc);

    if (!matchesTargetState(athleteAssoc)) {
      return false;
    }

    return true;
  });

  // 3. Deduplicación: Conservar ÚNICAMENTE la MEJOR marca personal de cada nadador
  const bestBySwimmer = new Map<string, any>();

  for (const r of validRecords) {
    const swimmerId = r.athlete_id || (r as any).swimmer_id || r.athletes?.id;
    if (!swimmerId) continue;

    const existing = bestBySwimmer.get(swimmerId);
    if (!existing || r.final_time_ms < existing.final_time_ms) {
      bestBySwimmer.set(swimmerId, r);
    }
  }

  // 4. Ordenamiento ascendente por tiempo
  const sorted = Array.from(bestBySwimmer.values()).sort(
    (a, b) => a.final_time_ms - b.final_time_ms
  );

  const leaderTimeMs = sorted.length > 0 ? sorted[0].final_time_ms : 0;

  // 5. Asignación de rangos con manejo de empates y cálculo de Diferencia vs. #1
  let currentRank = 1;
  const rankedList: StateRankingItem[] = sorted.map((r, index) => {
    if (index > 0 && r.final_time_ms > sorted[index - 1].final_time_ms) {
      currentRank = index + 1;
    }

    const athlete = allAthletes.find((a) => a.id === r.athlete_id) || r.athletes;
    const athleteName = athlete
      ? `${athlete.last_name || ""}, ${athlete.first_name || ""}`.trim().replace(/^,\s*|,\s*$/g, "")
      : "Atleta Desconocido";

    const birthYear = athlete?.birth_date ? Number(athlete.birth_date.slice(0, 4)) : currentYear;
    const age = currentYear - birthYear;

    const clubMeta =
      (athlete?.club_id && clubAssocMap.get(athlete.club_id)) ||
      (r.origin_team && clubAssocMap.get(r.origin_team.toUpperCase().trim())) ||
      (athlete?.clubs?.id && clubAssocMap.get(athlete.clubs.id));

    const clubCode = clubMeta?.code || athlete?.clubs?.team_code || athlete?.teams?.code || r.origin_team || "CLUB";
    const clubName = clubMeta?.name || athlete?.clubs?.full_name || athlete?.clubs?.name || athlete?.teams?.name || clubCode;
    const association = clubMeta?.assoc || normalizeAssociationName(athlete?.clubs?.region_lsc || athlete?.teams?.lsc);

    // Resaltado de Mi Club: coteja id de club o código de equipo
    const isMyClub = Boolean(
      (fullActiveClub?.id && athlete?.club_id === fullActiveClub.id) ||
      (fullActiveClub?.team_code && clubCode.toUpperCase() === fullActiveClub.team_code.toUpperCase()) ||
      (fullActiveClub?.name && clubName.toLowerCase() === fullActiveClub.name.toLowerCase())
    );

    const diffVsLeaderMs = r.final_time_ms - leaderTimeMs;
    const diffVsLeader =
      currentRank === 1
        ? "+0.00s"
        : `+${(diffVsLeaderMs / 1000).toFixed(2)}s`;

    return {
      rank: currentRank,
      swimmerId: athlete?.id || r.athlete_id,
      athleteName,
      gender: athlete?.gender || filters.gender,
      birthDate: athlete?.birth_date || null,
      age,
      clubId: athlete?.club_id || "",
      clubCode,
      clubName,
      association,
      isMyClub,
      distance: filters.distance,
      stroke: filters.stroke,
      course: filters.course,
      timeMs: r.final_time_ms,
      formattedTime: formatTime(r.final_time_ms),
      diffVsLeader,
      diffVsLeaderMs,
      aquaPoints: r.aqua_points ?? null,
      meetName: r.meets?.name || "Torneo Oficial",
      meetDate: r.meets?.start_date || r.meet_date || null,
    };
  });

  // 6. Métricas y KPIs de "Mi Club" frente a los clubes adversarios
  const myClubSwimmers = rankedList.filter((item) => item.isMyClub);
  const myClubTop8Count = myClubSwimmers.filter((item) => item.rank <= 8).length;
  const myClubBestSwimmer = myClubSwimmers.length > 0 ? myClubSwimmers[0] : null;

  let myClubLeaderGapSeconds: number | null = null;
  let myClubLeaderGapText = "Sin atletas de mi club clasificados en esta prueba";

  if (myClubBestSwimmer) {
    if (myClubBestSwimmer.rank === 1) {
      myClubLeaderGapSeconds = 0;
      myClubLeaderGapText = `¡Líder Estadal! (por ${myClubBestSwimmer.athleteName})`;
    } else {
      myClubLeaderGapSeconds = Number((myClubBestSwimmer.diffVsLeaderMs / 1000).toFixed(2));
      myClubLeaderGapText = `+${myClubLeaderGapSeconds}s respecto al 1° (por ${myClubBestSwimmer.athleteName} · #${myClubBestSwimmer.rank})`;
    }
  }

  const summary: StateRankingSummary = {
    activeState: targetState,
    activeClubName,
    activeClubCode,
    totalSwimmers: rankedList.length,
    leaderSwimmer: rankedList.length > 0 ? rankedList[0] : null,
    myClubTop8Count,
    myClubBestSwimmer,
    myClubLeaderGapSeconds,
    myClubLeaderGapText,
  };

  return { rankedList, summary };
}
