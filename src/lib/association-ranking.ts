import { jsPDF } from "jspdf";
import { brandedTable as autoTable, setReportTableBrand } from "./report-table-theme";
import type { ReportBrand } from "./report-brand";
import { ageAtDec31, eventLabel, formatTime } from "./swim";
import { calculateAge } from "./team-hub/ranking-engine";
import type { DashboardResult } from "./dashboard-summary";
export * from "./team-hub/ranking-engine";

export interface DetectedClub {
  id: string;
  code: string;
  name: string;
  association: string;
  isClub: boolean;
  athleteCount: number;
  resultsCount: number;
  affiliationYears?: number[];
}

export interface AssociationTopItem {
  rank: number;
  athleteId: string;
  athleteName: string;
  gender: string;
  birthDate: string | null;
  ageAtDec31: number | null;
  affiliationYear: number;
  clubCode: string;
  clubName: string;
  association: string;
  distance: number;
  stroke: number;
  course: string;
  finalTimeMs: number;
  formattedTime: string;
  meetName: string;
  meetDate: string | null;
}

export interface EventTopRanking {
  distance: number;
  stroke: number;
  course: string;
  gender: string;
  eventLabel: string;
  top5: AssociationTopItem[];
}

export interface AssociationRankingFilters {
  association: string; // 'all' or specific association name (e.g. "Miranda (ADAEM)")
  clubFilter?: string; // 'all' or specific club code
  course: string; // 'all' | 'LCM' | 'SCM'
  gender: string; // 'all' | 'M' | 'F'
  ageMode: "libre" | "13-14" | "11-12" | "15-16" | "17+" | "custom";
  ageCalculationMode?: "DEC_31" | "MEET_DATE"; // Default "DEC_31" (Federativo FEVEDA/ADAEL)
  seasonStartDate?: string; // ISO 'YYYY-MM-DD' (ej. '2026-01-01')
  seasonEndDate?: string; // ISO 'YYYY-MM-DD' (ej. '2026-12-31')
  customMinAge?: number;
  customMaxAge?: number;
  strokeFilter?: number; // 0 for all, 1-5 for specific stroke
  distanceFilter?: number; // 0 for all
  topN?: number; // default 5
  affiliationYear?: number | "all"; // Season / Year of annual federation affiliation (e.g. 2026, 2025)
  selectedMeetIds?: string[] | "all"; // Specific meet IDs to include in the ranking
  onlyAffiliatedClubs?: boolean; // When true, only official affiliated clubs (association !== "Sin Asociación")
  customClubCodes?: string[] | "all"; // When set and not "all", only include swimmers from these specific club codes
}

export interface ExtractedClubAthleteItem {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  gender: string;
  birthDate: string | null;
  ageAtDec31: number;
  category: string;
  clubCode: string;
  clubName: string;
  association: string;
  resultsCount: number;
  meets: string[];
  bestTimesSummary?: string;
}

export interface AssociationClubExportItem {
  code: string;
  name: string;
  association: string;
  meetName: string;
  meetDate?: string | null;
  athleteCount: number;
  resultsCount: number;
  affiliationYears: number[];
  isAffiliated: boolean;
}

/**
 * Standard known club codes for ADAEL (Lara State, Venezuela).
 */
export const KNOWN_ADAEL_CODES = new Set([
  "PIS",
  "PBOL",
  "PISBO",
  "HISP",
  "HIL",
  "HHIS",
  "HISPANO",
  "CBL",
  "BARQ",
  "CDL",
  "CDLARA",
  "AQU",
  "AQUALARA",
  "TRIL",
  "TRILARA",
  "ADAL",
  "ADAEL",
  "CLAR",
  "LARA",
  "CSL",
  "CSLAR",
  "CVM",
  "PALM",
  "TAR",
  "TARL",
]);

/**
 * Checks if a club belongs or is likely affiliated to ADAEL (Lara State).
 */
export function isLikelyAdaelClub(club: { code?: string; name?: string; association?: string }): boolean {
  const code = (club.code || "").toUpperCase().trim();
  const name = (club.name || "").toUpperCase().trim();
  const assoc = (club.association || "").toUpperCase().trim();

  if (KNOWN_ADAEL_CODES.has(code)) return true;
  if (assoc.includes("ADAEL") || assoc.includes("ADAL") || assoc.includes("LARA") || assoc === "LAR") return true;
  if (
    name.includes("ADAEL") ||
    name.includes("ADAL") ||
    name.includes("LARA") ||
    name.includes("BARQUISIMETO") ||
    name.includes("CABUDARE") ||
    name.includes("CARORA") ||
    name.includes("PISCINAS BOLIVARIANAS") ||
    name.includes("HOGAR HISPANO") ||
    name.includes("CENTRO SOCIAL LARENSE") ||
    name.includes("BICENTENARIO")
  ) {
    return true;
  }
  return false;
}

/**
 * Extracts and categorizes all clubs belonging or likely belonging to ADAEL from the detected clubs list.
 */
export function extractAdaelClubs(detectedClubs: DetectedClub[]): {
  affiliated: DetectedClub[];
  candidates: DetectedClub[];
} {
  const affiliated: DetectedClub[] = [];
  const candidates: DetectedClub[] = [];

  for (const club of detectedClubs) {
    const isAffiliated = normalizeAssociationName(club.association) === "Lara (ADAEL)";
    if (isAffiliated) {
      affiliated.push(club);
    } else if (isLikelyAdaelClub(club)) {
      candidates.push(club);
    }
  }

  return {
    affiliated: affiliated.sort((a, b) => a.code.localeCompare(b.code)),
    candidates: candidates.sort((a, b) => a.code.localeCompare(b.code)),
  };
}

/**
 * Normalizes state and association variations (e.g. "ADAEL", "Miranda", "MIR", "Miranda (ADAEL)")
 * to a canonical unified name so all clubs from the same state group together seamlessly.
 */
export function normalizeAssociationName(name: string | null | undefined): string {
  if (!name) return "Sin Asociación";
  const clean = name.trim();
  if (
    !clean ||
    clean.toLowerCase() === "sin asociación" ||
    clean.toLowerCase() === "sin asociacion" ||
    clean.toLowerCase() === "unattached" ||
    clean.toLowerCase() === "un"
  ) {
    return "Sin Asociación";
  }

  const upper = clean.toUpperCase();

  // Lara / ADAEL / LAR
  if (upper.includes("ADAEL") || upper.includes("ADAL") || upper.includes("LARA") || upper === "LAR") {
    return "Lara (ADAEL)";
  }
  // Miranda / ADAEM / MIR
  if (upper.includes("ADAEM") || upper.includes("MIRANDA") || upper === "MIR") {
    return "Miranda (ADAEM)";
  }
  // Táchira / ADAET / ASOADET / TAC
  if (
    upper.includes("ADAET") ||
    upper.includes("ASOADET") ||
    upper.includes("TACHIRA") ||
    upper.includes("TÁCHIRA") ||
    upper === "TAC"
  ) {
    return "Táchira (ADAET)";
  }
  // Mérida / ASODAME / MER
  if (
    upper.includes("ASODAME") ||
    upper.includes("MERIDA") ||
    upper.includes("MÉRIDA") ||
    upper === "MER"
  ) {
    return "Mérida (ASODAME)";
  }
  // Distrito Capital / ASDAC / DC
  if (
    upper.includes("ASDAC") ||
    upper.includes("DISTRITO CAPITAL") ||
    upper.includes("DISTRITO") ||
    upper === "DC"
  ) {
    return "Distrito Capital (ASDAC)";
  }
  // Carabobo / ASODENA / CAR
  if (upper.includes("ASODENA") || upper.includes("CARABOBO") || upper === "CAR") {
    return "Carabobo (ASODENA)";
  }
  // Aragua / ASODEA / ARA
  if (upper.includes("ASODEA") || upper.includes("ARAGUA") || upper === "ARA") {
    return "Aragua (ASODEA)";
  }
  // Zulia / AZUDA / ZUL
  if (upper.includes("AZUDA") || upper.includes("ZULIA") || upper === "ZUL") {
    return "Zulia (AZUDA)";
  }
  // Bolívar / ADEABOL / BOL
  if (
    upper.includes("ADEABOL") ||
    upper.includes("BOLIVAR") ||
    upper.includes("BOLÍVAR") ||
    upper === "BOL"
  ) {
    return "Bolívar (ADEABOL)";
  }
  // Anzoátegui / ASOEDA / ANZ
  if (
    upper.includes("ASOEDA") ||
    upper.includes("ANZOATEGUI") ||
    upper.includes("ANZOÁTEGUI") ||
    upper === "ANZ"
  ) {
    return "Anzoátegui (ASOEDA)";
  }
  // Nueva Esparta / ASODAN / NES
  if (
    upper.includes("ASODAN") ||
    upper.includes("NUEVA ESPARTA") ||
    upper.includes("MARGARITA") ||
    upper === "NES"
  ) {
    return "Nueva Esparta (ASODAN)";
  }

  // Colombia (FECNA)
  if (upper.includes("ANTIOQUIA")) return "Antioquia (Liga de Natación de Antioquia)";
  if (upper.includes("BOGOTA") || upper.includes("BOGOTÁ")) return "Bogotá (Liga de Natación de Bogotá)";
  if (upper.includes("VALLE DEL CAUCA") || upper === "VALLE") return "Valle del Cauca (Liga de Natación del Valle)";
  if (upper.includes("SANTANDER") && !upper.includes("NORTE")) return "Santander (Liga Santandereana de Natación)";

  // España (RFEN)
  if (upper.includes("CATALUÑA") || upper.includes("CATALUNYA")) return "Cataluña (FCN)";
  if (upper.includes("ANDALUCIA") || upper.includes("ANDALUCÍA")) return "Andalucía (FAN)";
  if (upper.includes("MADRID")) return "Madrid (FMN)";
  if (upper.includes("VALENCIANA") || upper.includes("VALENCIA")) return "Comunidad Valenciana (FNCV)";

  // USA Swimming LSCs
  if (upper.includes("FLORIDA GOLD COAST") || upper === "FG") return "Florida Gold Coast (FG)";
  if (upper.includes("FLORIDA SWIMMING") || upper === "FL") return "Florida Swimming (FL)";
  if (upper.includes("SOUTHERN CALIFORNIA") || upper === "CA") return "Southern California (CA)";
  if (upper.includes("PACIFIC SWIMMING") || upper === "PC") return "Pacific Swimming (PC)";

  return clean;
}

/**
 * Extracts and consolidates all clubs and teams detected across imported athletes, results and registries.
 * Ensures 100% of clubs from imported meets (via origin_team) are captured.
 */
export function extractDetectedClubs(
  athletes: any[],
  results: any[],
  clubs: any[] = [],
  teams: any[] = []
): DetectedClub[] {
  const map = new Map<string, DetectedClub>();
  const clubYearsMap = new Map<string, Set<number>>();

  const recordClubYear = (code: string, year: number | null | undefined) => {
    if (!year || year < 1990 || year > 2100) return;
    if (!clubYearsMap.has(code)) clubYearsMap.set(code, new Set());
    clubYearsMap.get(code)!.add(year);
  };

  // 1. Registered clubs
  for (const c of clubs) {
    const code = (c.team_code || c.short_name || c.name || "CLUB").toUpperCase().trim();
    map.set(code, {
      id: c.id,
      code,
      name: c.full_name || c.name,
      association: normalizeAssociationName(c.region_lsc || c.region),
      isClub: true,
      athleteCount: 0,
      resultsCount: 0,
      affiliationYears: [],
    });
  }

  // 2. Teams from meet import
  for (const t of teams) {
    const code = (t.code || "TEAM").toUpperCase().trim();
    const assoc = normalizeAssociationName(t.lsc);
    if (!map.has(code)) {
      map.set(code, {
        id: t.id,
        code,
        name: t.name || code,
        association: assoc,
        isClub: false,
        athleteCount: 0,
        resultsCount: 0,
        affiliationYears: [],
      });
    } else {
      const existing = map.get(code)!;
      if (existing.association === "Sin Asociación" && assoc !== "Sin Asociación") {
        existing.association = assoc;
      }
    }
  }

  // 3. Athletes
  const athleteClubMap = new Map<string, string>();
  for (const a of athletes) {
    const code = (a.clubs?.team_code || a.teams?.code || "UN").toUpperCase().trim();
    athleteClubMap.set(a.id, code);
    const assoc = normalizeAssociationName(a.clubs?.region_lsc || a.teams?.lsc);

    if (!map.has(code) && code !== "UN") {
      map.set(code, {
        id: a.clubs?.id || a.teams?.id || code,
        code,
        name: a.clubs?.full_name || a.clubs?.name || a.teams?.name || code,
        association: assoc,
        isClub: Boolean(a.clubs?.id),
        athleteCount: 0,
        resultsCount: 0,
        affiliationYears: [],
      });
    }
    if (map.has(code)) {
      map.get(code)!.athleteCount += 1;
      const existing = map.get(code)!;
      if (existing.association === "Sin Asociación" && assoc !== "Sin Asociación") {
        existing.association = assoc;
      }
    }
  }

  // 4. Results (detect all origin_team clubs from meets so NO club is missed)
  for (const r of results) {
    const rawCode = ((r as any).origin_team || athleteClubMap.get(r.athlete_id) || "UN").toUpperCase().trim();
    if (!map.has(rawCode) && rawCode !== "UN") {
      map.set(rawCode, {
        id: rawCode,
        code: rawCode,
        name: rawCode,
        association: "Sin Asociación",
        isClub: false,
        athleteCount: 0,
        resultsCount: 0,
        affiliationYears: [],
      });
    }
    if (map.has(rawCode)) {
      map.get(rawCode)!.resultsCount += 1;
    }

    // Record meet year as annual federation affiliation activity for this club
    if (r.meets?.start_date) {
      const y = Number(r.meets.start_date.slice(0, 4));
      recordClubYear(rawCode, y);
    }
  }

  // Populate affiliationYears for each detected club
  for (const [code, club] of map.entries()) {
    const years = clubYearsMap.get(code);
    club.affiliationYears = years ? [...years].sort((a, b) => b - a) : [];
  }

  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Filter results and extract the Top 5 best times per event according to association and age mode.
 * Evaluates all swimmers from all clubs affiliated to the selected association.
 */
export function calculateAssociationRankings(
  results: DashboardResult[],
  athletes: any[],
  clubs: DetectedClub[],
  filters: AssociationRankingFilters
): { rankings: EventTopRanking[]; participatingClubs: string[] } {
  const clubByCode = new Map(clubs.map((c) => [c.code.toUpperCase(), c]));
  const athleteMap = new Map(athletes.map((a) => [a.id, a]));

  const topLimit = filters.topN && filters.topN > 0 ? filters.topN : 5;
  const matchedClubs = new Set<string>();

  // Group valid results by event: distance + stroke + course + gender
  const eventBuckets = new Map<string, DashboardResult[]>();

  for (const r of results) {
    if (!r.events || r.events.is_relay || r.is_dq || !r.final_time_ms || !r.course) continue;
    if (filters.course !== "all" && r.course !== filters.course) continue;
    if (filters.strokeFilter && filters.strokeFilter > 0 && r.events.stroke !== filters.strokeFilter) continue;
    if (filters.distanceFilter && filters.distanceFilter > 0 && r.events.distance !== filters.distanceFilter) continue;

    const athlete = athleteMap.get(r.athlete_id);
    if (!athlete) continue;

    const gender = athlete.gender || "M";
    if (filters.gender !== "all" && gender !== filters.gender) continue;

    // Determine the club for this specific swim (origin_team from meet or athlete's club)
    const clubCode = (
      (r as any).origin_team ||
      athlete.clubs?.team_code ||
      athlete.teams?.code ||
      "UN"
    ).toUpperCase().trim();

    const clubInfo = clubByCode.get(clubCode);
    const association = normalizeAssociationName(
      clubInfo?.association ||
      athlete.clubs?.region_lsc ||
      athlete.teams?.lsc
    );

    // Association filter (e.g. "Miranda (ADAEL)")
    if (
      filters.association !== "all" &&
      normalizeAssociationName(filters.association).toLowerCase() !== association.toLowerCase()
    ) {
      continue;
    }

    // Optional specific club filter
    if (filters.clubFilter && filters.clubFilter !== "all" && clubCode.toLowerCase() !== filters.clubFilter.toLowerCase()) {
      continue;
    }

    // Optional manually selected custom clubs filter (restricts ranking to specific chosen clubs)
    if (
      filters.customClubCodes &&
      filters.customClubCodes !== "all" &&
      Array.isArray(filters.customClubCodes) &&
      filters.customClubCodes.length > 0 &&
      !filters.customClubCodes.map((c) => c.toUpperCase().trim()).includes(clubCode)
    ) {
      continue;
    }

    // Only officially affiliated clubs check (excludes clubs with "Sin Asociación" or unattached)
    if (filters.onlyAffiliatedClubs && association === "Sin Asociación") {
      continue;
    }

    // Specific meets selection filter (allows choosing which imported results form the ranking)
    if (
      filters.selectedMeetIds &&
      filters.selectedMeetIds !== "all" &&
      Array.isArray(filters.selectedMeetIds) &&
      filters.selectedMeetIds.length > 0
    ) {
      const meetId = r.meets?.id || (r as any).meet_id || r.meets?.name;
      if (meetId && !filters.selectedMeetIds.includes(meetId)) {
        continue;
      }
    }

    // Meet year (competition date) represents the annual federation affiliation season
    const meetDate = r.meets?.start_date || null;
    const meetYear = Number(meetDate?.slice(0, 4) || new Date().getFullYear());

    // Ámbito de Temporada: comprobación estricta de fechas de competencia (ej. 2026-01-01 al 2026-12-31)
    const seasonStart = filters.seasonStartDate ?? (filters.affiliationYear === 2026 ? "2026-01-01" : undefined);
    const seasonEnd = filters.seasonEndDate ?? (filters.affiliationYear === 2026 ? "2026-12-31" : undefined);
    if (seasonStart && meetDate && meetDate < seasonStart) continue;
    if (seasonEnd && meetDate && meetDate > seasonEnd) continue;

    // Annual federation affiliation season filter
    if (
      filters.affiliationYear &&
      filters.affiliationYear !== "all" &&
      meetYear !== Number(filters.affiliationYear)
    ) {
      continue;
    }

    // Regla de Edad Competitiva: 31 de Diciembre del año federativo (por defecto) o al día del evento
    const evalYear =
      filters.affiliationYear && filters.affiliationYear !== "all"
        ? Number(filters.affiliationYear)
        : meetYear;
    const isMeetDateMode = filters.ageCalculationMode === "MEET_DATE";
    const athleteAge = isMeetDateMode && meetDate
      ? calculateAge(athlete.birth_date, meetDate)
      : ageAtDec31(athlete.birth_date, evalYear);
    if (athleteAge == null && filters.ageMode !== "libre") continue;

    // Age Mode check (Libre vs Cruce de edades)
    if (filters.ageMode === "13-14" && ((athleteAge ?? 0) < 13 || (athleteAge ?? 0) > 14)) continue;
    if (filters.ageMode === "11-12" && ((athleteAge ?? 0) < 11 || (athleteAge ?? 0) > 12)) continue;
    if (filters.ageMode === "15-16" && ((athleteAge ?? 0) < 15 || (athleteAge ?? 0) > 16)) continue;
    if (filters.ageMode === "17+" && (athleteAge ?? 0) < 17) continue;
    if (filters.ageMode === "custom") {
      const min = filters.customMinAge ?? 0;
      const max = filters.customMaxAge ?? 99;
      if ((athleteAge ?? 0) < min || (athleteAge ?? 0) > max) continue;
    }

    matchedClubs.add(clubCode);

    const eventKey = `${r.events.distance}-${r.events.stroke}-${r.course}-${gender}`;
    const bucket = eventBuckets.get(eventKey) || [];
    bucket.push(r);
    eventBuckets.set(eventKey, bucket);
  }

  const rankings: EventTopRanking[] = [];

  for (const [key, swims] of eventBuckets.entries()) {
    const [distanceStr, strokeStr, course, gender] = key.split("-");
    if (!course || !gender) continue;
    const distance = Number(distanceStr);
    const stroke = Number(strokeStr);

    // Deduplicate: 1 best time per athlete in this event
    const athleteBest = new Map<string, DashboardResult>();
    for (const swim of swims) {
      const current = athleteBest.get(swim.athlete_id);
      if (!current || (swim.final_time_ms && (!current.final_time_ms || swim.final_time_ms < current.final_time_ms))) {
        athleteBest.set(swim.athlete_id, swim);
      }
    }

    // Sort ascending by final time (fastest first)
    const sorted = [...athleteBest.values()].sort((a, b) => (a.final_time_ms ?? Infinity) - (b.final_time_ms ?? Infinity));

    // Slice to Top N
    const topSwims = sorted.slice(0, topLimit);

    let currentRank = 0;
    const top5: AssociationTopItem[] = topSwims.map((swim, index) => {
      const athlete = athleteMap.get(swim.athlete_id);
      const meetYear = Number(swim.meets?.start_date?.slice(0, 4) || new Date().getFullYear());
      const swimMeetDate = swim.meets?.start_date || null;
      const isMeetDateMode = filters.ageCalculationMode === "MEET_DATE";
      const swimEvalYear =
        filters.affiliationYear && filters.affiliationYear !== "all"
          ? Number(filters.affiliationYear)
          : meetYear;
      const age = isMeetDateMode && swimMeetDate && athlete?.birth_date
        ? calculateAge(athlete.birth_date, swimMeetDate)
        : ageAtDec31(athlete?.birth_date ?? null, swimEvalYear);
      const clubCode = (
        (swim as any).origin_team ||
        athlete?.clubs?.team_code ||
        athlete?.teams?.code ||
        "UN"
      ).toUpperCase().trim();
      const clubInfo = clubByCode.get(clubCode);

      if (index === 0 || swim.final_time_ms !== topSwims[index - 1]?.final_time_ms) {
        currentRank = index + 1;
      }

      return {
        rank: currentRank,
        athleteId: swim.athlete_id,
        athleteName: `${athlete?.first_name || ""} ${athlete?.last_name || ""}`.trim() || "Atleta",
        gender,
        birthDate: athlete?.birth_date || null,
        ageAtDec31: age,
        affiliationYear: meetYear,
        clubCode,
        clubName: clubInfo?.name || athlete?.clubs?.full_name || athlete?.teams?.name || clubCode,
        association: normalizeAssociationName(clubInfo?.association || athlete?.clubs?.region_lsc || athlete?.teams?.lsc),
        distance,
        stroke,
        course,
        finalTimeMs: swim.final_time_ms || 0,
        formattedTime: formatTime(swim.final_time_ms),
        meetName: swim.meets?.name || "Torneo",
        meetDate: swim.meets?.start_date || null,
      };
    });

    if (top5.length > 0) {
      rankings.push({
        distance,
        stroke,
        course,
        gender,
        eventLabel: `${eventLabel(distance, stroke)} · ${gender === "M" ? "Masculino" : "Femenino"} (${course})`,
        top5,
      });
    }
  }

  // Sort events by stroke and distance
  const sortedRankings = rankings.sort((a, b) => {
    if (a.gender !== b.gender) return a.gender.localeCompare(b.gender);
    if (a.stroke !== b.stroke) return a.stroke - b.stroke;
    return a.distance - b.distance;
  });

  return {
    rankings: sortedRankings,
    participatingClubs: [...matchedClubs].sort(),
  };
}

/**
 * Generates an official Association / State Top 5 Ranking PDF including all affiliated clubs.
 */
export function generateAssociationRankingPdf(
  rankings: EventTopRanking[],
  options: {
    associationName: string;
    ageModeLabel: string;
    courseLabel: string;
    genderLabel: string;
    affiliationYearLabel?: string;
    ageCalculationMode?: "DEC_31" | "MEET_DATE";
    federationName?: string;
    participatingClubs?: string[];
    onlyAffiliatedClubs?: boolean;
    brand?: ReportBrand;
  }
): File {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  setReportTableBrand(doc, options.brand);

  const title = `Ranking Oficial por Estado / Asociación · ${options.associationName}`;
  doc.setProperties({
    title,
    author: "Swim Lane Coach",
    creator: "Swim Lane Coach",
    subject: `Ranking Oficial por Estado y Asociación Top 5 - ${options.affiliationYearLabel || ""}`,
  });

  // Header
  doc.setFontSize(15);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 13);

  // Federation & Affiliation Season subheader
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 120);
  const fedSeasonText = `${options.federationName ? options.federationName + " · " : ""}Temporada de Afiliación Anual: ${options.affiliationYearLabel || "Año en curso"}`;
  doc.text(fedSeasonText, 14, 18);
  doc.setTextColor(0);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const criteriaText = options.onlyAffiliatedClubs
    ? "Solo Clubes Afiliados Oficiales"
    : "Todos los Clubes Participantes";
  const isMeetDateMode = options.ageCalculationMode === "MEET_DATE";
  const ageRuleText = isMeetDateMode ? "Edad al día del evento" : "Edad al 31 de Diciembre";
  doc.text(
    `Modalidad: ${options.ageModeLabel}  |  Piscina: ${options.courseLabel}  |  Sexo: ${options.genderLabel}  |  Padrón: ${criteriaText}  |  Cálculo: ${ageRuleText}`,
    14,
    23
  );

  // Participating clubs line
  if (options.participatingClubs && options.participatingClubs.length > 0) {
    doc.setFontSize(8);
    doc.setTextColor(60);
    const clubsStr = `Clubes afiliados participantes (${options.participatingClubs.length}): ${options.participatingClubs.join(", ")}`;
    doc.text(clubsStr.length > 135 ? clubsStr.slice(0, 132) + "..." : clubsStr, 14, 28);
    doc.setTextColor(0);
  }

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(
    `Fecha de emisión: ${new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" })}  |  Regla: 1 mejor tiempo por atleta · ${ageRuleText}`,
    14,
    33
  );
  doc.setTextColor(0);

  let currentY = 38;

  if (rankings.length === 0) {
    doc.setFontSize(11);
    doc.text("No se encontraron registros de tiempos con los filtros seleccionados.", 14, 50);
  } else {
    for (const event of rankings) {
      if (currentY > 175) {
        doc.addPage();
        currentY = 20;
      }

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(event.eventLabel, 14, currentY);
      currentY += 4;

      const ageColHeader = isMeetDateMode ? "Edad (Evento)" : "Edad (31/12)";
      const headers = ["Pto.", "Atleta", "Club", "Asociación", ageColHeader, "Tiempo", "Competencia", "Fecha"];
      const rows = event.top5.map((item) => [
        item.rank.toString(),
        item.athleteName,
        `${item.clubCode} - ${item.clubName}`,
        item.association,
        item.ageAtDec31 != null && item.ageAtDec31 > 0 ? item.ageAtDec31.toString() : "—",
        item.formattedTime,
        item.meetName,
        item.meetDate || "—",
      ]);

      autoTable(doc, {
        startY: currentY,
        head: [headers],
        body: rows,
        margin: { left: 14, right: 14 },
        styles: { fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: [40, 80, 140], textColor: [255, 255, 255], fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 12, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 50 },
          2: { cellWidth: 55 },
          3: { cellWidth: 35 },
          4: { cellWidth: 20, halign: "center" },
          5: { cellWidth: 25, halign: "right", fontStyle: "bold" },
          6: { cellWidth: "auto" },
          7: { cellWidth: 25, halign: "center" },
        },
      });

      // Update currentY after table
      currentY = (doc as any).lastAutoTable.finalY + 8;
    }
  }

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(140);
    doc.text(
      "Swim Lane Coach · Sistema de Natación Competitiva · Compatible con Meet Manager y Team Manager",
      14,
      doc.internal.pageSize.getHeight() - 7
    );
    doc.text(`Página ${p} de ${totalPages}`, doc.internal.pageSize.getWidth() - 30, doc.internal.pageSize.getHeight() - 7);
  }

  const cleanAssoc = options.associationName.replace(/[^\w-]/g, "_").toLowerCase();
  const filename = `Ranking_Estadal_${cleanAssoc}_${new Date().toISOString().slice(0, 10)}.pdf`;
  return new File([doc.output("blob")], filename, { type: "application/pdf" });
}

/**
 * Extracts and consolidates all clubs belonging to an association (or all associations)
 * that participated in a specific state championship meet (or across meets),
 * aggregating athlete count and results count per club.
 */
export function extractClubsFromMeetResults(
  results: DashboardResult[],
  athletes: any[],
  detectedClubs: DetectedClub[],
  options?: {
    meetId?: string | "all";
    association?: string | "all";
    onlyAffiliatedClubs?: boolean;
    affiliationYear?: number | "all";
  }
): AssociationClubExportItem[] {
  const clubByCode = new Map(detectedClubs.map((c) => [c.code.toUpperCase(), c]));
  const athleteMap = new Map(athletes.map((a) => [a.id, a]));

  const meetFilter = options?.meetId && options.meetId !== "all" ? options.meetId : null;
  const targetAssoc =
    options?.association && options.association !== "all"
      ? normalizeAssociationName(options.association).toLowerCase()
      : null;
  const yearFilter =
    options?.affiliationYear && options.affiliationYear !== "all"
      ? Number(options.affiliationYear)
      : null;

  const clubStats = new Map<
    string,
    {
      code: string;
      name: string;
      association: string;
      athletes: Set<string>;
      resultsCount: number;
      meets: Set<string>;
      meetDates: Set<string>;
      years: Set<number>;
    }
  >();

  const ensureClub = (code: string, fallbackName?: string, fallbackAssoc?: string) => {
    const upperCode = code.toUpperCase().trim();
    if (!clubStats.has(upperCode)) {
      const known = clubByCode.get(upperCode);
      const assoc = normalizeAssociationName(known?.association || fallbackAssoc || "Sin Asociación");
      const name = known?.name || fallbackName || upperCode;
      clubStats.set(upperCode, {
        code: upperCode,
        name,
        association: assoc,
        athletes: new Set(),
        resultsCount: 0,
        meets: new Set(),
        meetDates: new Set(),
        years: new Set(known?.affiliationYears || []),
      });
    }
    return clubStats.get(upperCode)!;
  };

  // 1. Process all results
  for (const r of results) {
    if (r.is_dq) continue;

    const rMeetId = r.meets?.id || (r as any).meet_id || r.meets?.name;
    if (meetFilter && rMeetId !== meetFilter && r.meets?.name !== meetFilter) {
      continue;
    }

    const meetDate = r.meets?.start_date || null;
    const meetYear = meetDate ? Number(meetDate.slice(0, 4)) : null;
    if (yearFilter && meetYear && meetYear !== yearFilter) {
      continue;
    }

    const athlete = athleteMap.get(r.athlete_id);
    const clubCode = (
      (r as any).origin_team ||
      athlete?.clubs?.team_code ||
      athlete?.teams?.code ||
      "UN"
    ).toUpperCase().trim();

    if (clubCode === "UN") continue;

    const club = ensureClub(
      clubCode,
      (r as any).origin_team_name || athlete?.clubs?.full_name || athlete?.teams?.name,
      athlete?.clubs?.region_lsc || athlete?.teams?.lsc
    );

    if (r.athlete_id) club.athletes.add(r.athlete_id);
    club.resultsCount += 1;
    if (r.meets?.name) club.meets.add(r.meets.name);
    if (meetDate) club.meetDates.add(meetDate);
    if (meetYear && meetYear > 1990 && meetYear < 2100) club.years.add(meetYear);
  }

  // 2. If no specific meet filter was set, ensure all known detected clubs for the target association are included
  if (!meetFilter) {
    for (const dc of detectedClubs) {
      if (dc.code !== "UN" && !clubStats.has(dc.code.toUpperCase())) {
        const item = ensureClub(dc.code, dc.name, dc.association);
        item.resultsCount = dc.resultsCount;
        item.athletes = new Set(Array.from({ length: dc.athleteCount }, (_, i) => `${dc.code}-ath-${i}`));
        dc.affiliationYears?.forEach((y) => item.years.add(y));
      }
    }
  }

  // 3. Filter by association and official affiliation
  const items: AssociationClubExportItem[] = [];

  for (const stats of clubStats.values()) {
    const assocNorm = normalizeAssociationName(stats.association);
    const isAffiliated = assocNorm !== "Sin Asociación";

    if (options?.onlyAffiliatedClubs && !isAffiliated) {
      continue;
    }

    if (targetAssoc && assocNorm.toLowerCase() !== targetAssoc) {
      continue;
    }

    if (meetFilter && stats.resultsCount === 0 && stats.athletes.size === 0) {
      continue;
    }

    const meetsList = [...stats.meets];
    const meetName = meetsList.length > 0 ? meetsList.join(", ") : "Campeonato Estadal";
    const datesList = [...stats.meetDates].sort();
    const meetDate = datesList.length > 0 ? (datesList[0] ?? null) : null;

    items.push({
      code: stats.code,
      name: stats.name,
      association: assocNorm,
      meetName,
      meetDate,
      athleteCount: stats.athletes.size,
      resultsCount: stats.resultsCount,
      affiliationYears: [...stats.years].sort((a, b) => b - a),
      isAffiliated,
    });
  }

  return items.sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Generates an Excel-compatible CSV file containing the clubs of an association
 * extracted from imported meet results. Includes UTF-8 BOM.
 */
export function exportAssociationClubsCsv(
  clubs: AssociationClubExportItem[],
  metadata: {
    associationName: string;
    meetName?: string;
    seasonYear?: string;
    federationName?: string;
  }
): File {
  const sanitize = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;

  const rows: string[] = [
    `"Swim Lane Coach - Nómina de Clubes por Asociación y Campeonato"`,
    `"Asociación / Estado:",${sanitize(metadata.associationName)}`,
    `"Campeonato / Torneo:",${sanitize(metadata.meetName || "Todos los torneos estadales")}`,
    `"Federación:",${sanitize(metadata.federationName || "FEVEDA")}`,
    `"Temporada:",${sanitize(metadata.seasonYear || "Año en curso")}`,
    `"Fecha de Exportación:",${sanitize(new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" }))}`,
    `"Total de Clubes:",${clubs.length}`,
    "",
    [
      `"Nº"`,
      `"Código"`,
      `"Nombre del Club"`,
      `"Asociación Regional"`,
      `"Campeonato Estadal"`,
      `"Atletas Participantes"`,
      `"Marcas Registradas"`,
      `"Temporadas de Afiliación"`,
      `"Padrón Oficial"`,
    ].join(","),
  ];

  let totalAthletes = 0;
  let totalResults = 0;

  clubs.forEach((c, index) => {
    totalAthletes += c.athleteCount;
    totalResults += c.resultsCount;
    rows.push(
      [
        index + 1,
        sanitize(c.code),
        sanitize(c.name),
        sanitize(c.association),
        sanitize(c.meetName),
        c.athleteCount,
        c.resultsCount,
        sanitize(c.affiliationYears.join("; ")),
        sanitize(c.isAffiliated ? "Sí (Afiliado Oficial)" : "No Oficial / Invitado"),
      ].join(",")
    );
  });

  rows.push("");
  rows.push(
    [
      `"TOTALES"`,
      `"${clubs.length} Clubes"`,
      `""`,
      `""`,
      `""`,
      totalAthletes,
      totalResults,
      `""`,
      `""`,
    ].join(",")
  );

  const csvContent = "\uFEFF" + rows.join("\r\n");
  const cleanAssoc = metadata.associationName.replace(/[^\w-]/g, "_").toLowerCase();
  const cleanMeet = (metadata.meetName || "estadal").replace(/[^\w-]/g, "_").toLowerCase().slice(0, 25);
  const filename = `Clubes_${cleanAssoc}_${cleanMeet}_${new Date().toISOString().slice(0, 10)}.csv`;

  return new File([csvContent], filename, { type: "text/csv;charset=utf-8;" });
}

/**
 * Generates an official Association Clubs PDF report from championship results.
 */
export function generateAssociationClubsPdf(
  clubs: AssociationClubExportItem[],
  options: {
    associationName: string;
    meetName?: string;
    federationName?: string;
    seasonYear?: string;
    onlyAffiliated?: boolean;
    brand?: ReportBrand;
  }
): File {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  setReportTableBrand(doc, options.brand);

  const title = `Padrón de Clubes · ${options.associationName}`;
  doc.setProperties({
    title,
    author: "Swim Lane Coach",
    creator: "Swim Lane Coach",
    subject: `Nómina oficial de clubes extraída de resultados de campeonato estadal`,
  });

  // Header Title
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 13);

  // Subheader: Championship & Federation
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 120);
  const subheader = `${options.federationName ? options.federationName + " · " : ""}Campeonato: ${options.meetName || "Torneo Estadal"} · Temporada: ${options.seasonYear || "Año en curso"}`;
  doc.text(subheader, 14, 18);
  doc.setTextColor(0);

  // Criteria & totals
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  const totalAthletes = clubs.reduce((acc, c) => acc + c.athleteCount, 0);
  const totalResults = clubs.reduce((acc, c) => acc + c.resultsCount, 0);
  const criteriaText = options.onlyAffiliated ? "Solo Clubes Afiliados Oficiales" : "Todos los Clubes Participantes";
  doc.text(
    `Padrón: ${criteriaText}  |  Clubes: ${clubs.length}  |  Atletas: ${totalAthletes}  |  Marcas: ${totalResults}`,
    14,
    23
  );

  doc.setFontSize(7.5);
  doc.setTextColor(120);
  doc.text(
    `Fecha de extracción: ${new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" })}  |  Swim Lane Coach · Sistema de Natación Competitiva`,
    14,
    28
  );
  doc.setTextColor(0);

  const headers = ["Nº", "Código", "Nombre del Club", "Asociación", "Atletas", "Marcas", "Temporadas"];
  const rows = clubs.map((c, idx) => [
    (idx + 1).toString(),
    c.code,
    c.name,
    c.association,
    c.athleteCount.toString(),
    c.resultsCount.toString(),
    c.affiliationYears.length > 0 ? c.affiliationYears.join(", ") : "—",
  ]);

  autoTable(doc, {
    startY: 32,
    head: [headers],
    body: rows,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [40, 80, 140], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 20, fontStyle: "bold" },
      2: { cellWidth: 65 },
      3: { cellWidth: 40 },
      4: { cellWidth: 16, halign: "center" },
      5: { cellWidth: 16, halign: "center" },
      6: { cellWidth: "auto", halign: "center" },
    },
  });

  // Footer on all pages
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(140);
    doc.text(
      "Swim Lane Coach · Nómina oficial de clubes extraída de resultados de campeonato estadal",
      14,
      doc.internal.pageSize.getHeight() - 7
    );
    doc.text(
      `Página ${p} de ${totalPages}`,
      doc.internal.pageSize.getWidth() - 25,
      doc.internal.pageSize.getHeight() - 7
    );
  }

  const cleanAssoc = options.associationName.replace(/[^\w-]/g, "_").toLowerCase();
  const cleanMeet = (options.meetName || "estadal").replace(/[^\w-]/g, "_").toLowerCase().slice(0, 25);
  const filename = `Clubes_${cleanAssoc}_${cleanMeet}_${new Date().toISOString().slice(0, 10)}.pdf`;

  return new File([doc.output("blob")], filename, { type: "application/pdf" });
}

/**
 * Returns swimming category label based on age at Dec 31 according to national/FEVEDA/World Aquatics rules.
 */
export function getSwimmingCategoryLabel(age: number): string {
  if (age <= 10) return "Pre-Infantil (≤10 años)";
  if (age >= 11 && age <= 12) return "Infantil A (11-12 años)";
  if (age >= 13 && age <= 14) return "Infantil B (13-14 años)";
  if (age >= 15 && age <= 16) return "Juvenil A (15-16 años)";
  if (age >= 17 && age <= 18) return "Juvenil B (17-18 años)";
  return "Máxima (19 y más años)";
}

/**
 * Extracts all athletes that belong to the specified target clubs from imported meet results.
 */
export function extractAthletesFromClubs(
  results: DashboardResult[],
  athletes: any[],
  targetClubCodes: string[] | "all",
  options?: {
    detectedClubs?: DetectedClub[];
    meetId?: string | "all";
    seasonYear?: number | "all";
    gender?: string | "all";
  }
): ExtractedClubAthleteItem[] {
  const athleteMap = new Map(athletes.map((a) => [a.id, a]));
  const clubByCode = new Map(
    (options?.detectedClubs || []).map((c) => [c.code.toUpperCase(), c])
  );

  const targetCodesSet =
    targetClubCodes === "all"
      ? null
      : new Set(targetClubCodes.map((c) => c.toUpperCase().trim()));

  const meetFilter = options?.meetId && options.meetId !== "all" ? options.meetId : null;
  const yearFilter =
    options?.seasonYear && options.seasonYear !== "all" ? Number(options.seasonYear) : null;
  const currentYear = yearFilter || new Date().getFullYear();

  const athleteStats = new Map<
    string,
    {
      id: string;
      athlete: any;
      clubCode: string;
      clubName: string;
      association: string;
      resultsCount: number;
      meets: Set<string>;
      bestEvents: Map<string, { label: string; timeMs: number; formatted: string }>;
    }
  >();

  for (const r of results) {
    if (r.is_dq) continue;

    const rMeetId = r.meets?.id || (r as any).meet_id || r.meets?.name;
    if (meetFilter && rMeetId !== meetFilter && r.meets?.name !== meetFilter) {
      continue;
    }

    const meetDate = r.meets?.start_date || null;
    const meetYear = meetDate ? Number(meetDate.slice(0, 4)) : null;
    if (yearFilter && meetYear && meetYear !== yearFilter) {
      continue;
    }

    const athlete = athleteMap.get(r.athlete_id);
    if (!athlete) continue;

    if (options?.gender && options.gender !== "all" && athlete.gender !== options.gender) {
      continue;
    }

    const clubCode = (
      (r as any).origin_team ||
      athlete.clubs?.team_code ||
      athlete.teams?.code ||
      "UN"
    ).toUpperCase().trim();

    if (clubCode === "UN") continue;

    if (targetCodesSet && !targetCodesSet.has(clubCode)) {
      continue;
    }

    const knownClub = clubByCode.get(clubCode);
    const assoc = normalizeAssociationName(
      knownClub?.association || athlete.clubs?.region_lsc || athlete.teams?.lsc
    );
    const clubName =
      knownClub?.name ||
      (r as any).origin_team_name ||
      athlete.clubs?.full_name ||
      athlete.teams?.name ||
      clubCode;

    if (!athleteStats.has(athlete.id)) {
      athleteStats.set(athlete.id, {
        id: athlete.id,
        athlete,
        clubCode,
        clubName,
        association: assoc,
        resultsCount: 0,
        meets: new Set(),
        bestEvents: new Map(),
      });
    }

    const stats = athleteStats.get(athlete.id)!;
    stats.resultsCount += 1;
    if (r.meets?.name) stats.meets.add(r.meets.name);

    if (r.events && r.final_time_ms) {
      const eventKey = `${r.events.distance}-${r.events.stroke}-${r.course}`;
      const existing = stats.bestEvents.get(eventKey);
      if (!existing || r.final_time_ms < existing.timeMs) {
        stats.bestEvents.set(eventKey, {
          label: `${eventLabel(r.events.distance, r.events.stroke)} (${r.course})`,
          timeMs: r.final_time_ms,
          formatted: formatTime(r.final_time_ms),
        });
      }
    }
  }

  const items: ExtractedClubAthleteItem[] = [];

  for (const stats of athleteStats.values()) {
    const a = stats.athlete;
    const birthDate = a.birth_date || null;
    const age = ageAtDec31(birthDate, currentYear) ?? 0;
    const category = getSwimmingCategoryLabel(age);
    const fullName =
      `${a.last_name || ""}, ${a.first_name || ""}`.trim().replace(/^,\s*|,\s*$/g, "") || "Nadador";

    const topTimes = [...stats.bestEvents.values()]
      .slice(0, 3)
      .map((ev) => `${ev.label}: ${ev.formatted}`)
      .join("; ");

    items.push({
      id: stats.id,
      firstName: a.first_name || "",
      lastName: a.last_name || "",
      fullName,
      gender: a.gender || "M",
      birthDate,
      ageAtDec31: age,
      category,
      clubCode: stats.clubCode,
      clubName: stats.clubName,
      association: stats.association,
      resultsCount: stats.resultsCount,
      meets: [...stats.meets],
      bestTimesSummary: topTimes || "—",
    });
  }

  return items.sort((a, b) => {
    if (a.clubCode !== b.clubCode) return a.clubCode.localeCompare(b.clubCode);
    if (a.category !== b.category) return a.category.localeCompare(b.category);
    return a.fullName.localeCompare(b.fullName);
  });
}

/**
 * Generates an Excel-compatible CSV file containing all athletes extracted from the selected clubs.
 */
export function exportClubAthletesCsv(
  athletes: ExtractedClubAthleteItem[],
  metadata: {
    clubsCount: number;
    meetName?: string;
    seasonYear?: string;
    federationName?: string;
  }
): File {
  const sanitize = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;

  const rows: string[] = [
    `"Swim Lane Coach - Nómina de Atletas Extraídos por Clubes"`,
    `"Clubes Considerados:",${metadata.clubsCount}`,
    `"Campeonato / Torneo:",${sanitize(metadata.meetName || "Todos los torneos")}`,
    `"Federación:",${sanitize(metadata.federationName || "FEVEDA")}`,
    `"Temporada:",${sanitize(metadata.seasonYear || "Año en curso")}`,
    `"Fecha de Exportación:",${sanitize(new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" }))}`,
    `"Total de Atletas Extraídos:",${athletes.length}`,
    "",
    [
      `"Nº"`,
      `"Atleta (Apellidos, Nombres)"`,
      `"Sexo"`,
      `"Fecha de Nacimiento"`,
      `"Edad (31/Dic)"`,
      `"Categoría"`,
      `"Código Club"`,
      `"Nombre del Club"`,
      `"Asociación Regional"`,
      `"Marcas Registradas"`,
      `"Mejores Marcas"`,
      `"Competencias Participadas"`,
    ].join(","),
  ];

  let totalMarks = 0;

  athletes.forEach((a, idx) => {
    totalMarks += a.resultsCount;
    rows.push(
      [
        idx + 1,
        sanitize(a.fullName),
        sanitize(a.gender === "M" ? "Masculino" : "Femenino"),
        sanitize(a.birthDate || "—"),
        a.ageAtDec31 > 0 ? a.ageAtDec31 : "—",
        sanitize(a.category),
        sanitize(a.clubCode),
        sanitize(a.clubName),
        sanitize(a.association),
        a.resultsCount,
        sanitize(a.bestTimesSummary),
        sanitize(a.meets.join("; ")),
      ].join(",")
    );
  });

  rows.push("");
  rows.push([
    `"TOTAL"`,
    `"${athletes.length} Atletas"`,
    `""`,
    `""`,
    `""`,
    `""`,
    `"${metadata.clubsCount} Clubes"`,
    `""`,
    `""`,
    totalMarks,
    `""`,
    `""`,
  ].join(","));

  const csvContent = "\uFEFF" + rows.join("\r\n");
  const filename = `Atletas_Clubes_Ranking_${new Date().toISOString().slice(0, 10)}.csv`;
  return new File([csvContent], filename, { type: "text/csv;charset=utf-8;" });
}

/**
 * Generates an official PDF report of athletes belonging to the selected clubs.
 */
export function generateClubAthletesPdf(
  athletes: ExtractedClubAthleteItem[],
  options: {
    clubsCount: number;
    meetName?: string;
    federationName?: string;
    seasonYear?: string;
    brand?: ReportBrand;
  }
): File {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  setReportTableBrand(doc, options.brand);

  const title = `Nómina Oficial de Atletas por Clubes · Ranking`;
  doc.setProperties({
    title,
    author: "Swim Lane Coach",
    creator: "Swim Lane Coach",
    subject: `Nómina de atletas extraídos de los clubes seleccionados para el ranking`,
  });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 13);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 64, 120);
  const subheader = `${options.federationName ? options.federationName + " · " : ""}Torneo: ${options.meetName || "Todos"} · Temporada: ${options.seasonYear || "Año en curso"}`;
  doc.text(subheader, 14, 18);
  doc.setTextColor(0);

  const maleCount = athletes.filter((a) => a.gender === "M").length;
  const femaleCount = athletes.filter((a) => a.gender === "F").length;
  const totalResults = athletes.reduce((acc, a) => acc + a.resultsCount, 0);

  doc.setFontSize(8.5);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Total Atletas: ${athletes.length}  |  Masculino: ${maleCount}  |  Femenino: ${femaleCount}  |  Clubes: ${options.clubsCount}  |  Marcas Registradas: ${totalResults}`,
    14,
    23
  );

  doc.setFontSize(7.5);
  doc.setTextColor(120);
  doc.text(
    `Fecha de emisión: ${new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" })}  |  Regla: Edad calculada al 31 de Diciembre`,
    14,
    28
  );
  doc.setTextColor(0);

  const headers = ["Nº", "Atleta", "Sexo", "Edad", "Categoría", "Club", "Asociación", "Marcas", "Mejores Pruebas"];
  const rows = athletes.map((a, idx) => [
    (idx + 1).toString(),
    a.fullName,
    a.gender === "M" ? "M" : "F",
    a.ageAtDec31 > 0 ? a.ageAtDec31.toString() : "—",
    a.category,
    `${a.clubCode} - ${a.clubName}`,
    a.association,
    a.resultsCount.toString(),
    a.bestTimesSummary || "—",
  ]);

  autoTable(doc, {
    startY: 32,
    head: [headers],
    body: rows,
    margin: { left: 14, right: 14 },
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [40, 80, 140], textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: {
      0: { cellWidth: 10, halign: "center", fontStyle: "bold" },
      1: { cellWidth: 45 },
      2: { cellWidth: 12, halign: "center" },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 32 },
      5: { cellWidth: 45 },
      6: { cellWidth: 32 },
      7: { cellWidth: 16, halign: "center" },
      8: { cellWidth: "auto" },
    },
  });

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(7.5);
    doc.setTextColor(140);
    doc.text(
      "Swim Lane Coach · Nómina oficial de atletas extraídos de los clubes seleccionados",
      14,
      doc.internal.pageSize.getHeight() - 7
    );
    doc.text(`Página ${p} de ${totalPages}`, doc.internal.pageSize.getWidth() - 25, doc.internal.pageSize.getHeight() - 7);
  }

  const filename = `Atletas_Clubes_Ranking_${new Date().toISOString().slice(0, 10)}.pdf`;
  return new File([doc.output("blob")], filename, { type: "application/pdf" });
}
