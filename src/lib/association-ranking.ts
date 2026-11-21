import { jsPDF } from "jspdf";
import { brandedTable as autoTable, setReportTableBrand } from "./report-table-theme";
import type { ReportBrand } from "./report-brand";
import { ageAtDec31, eventLabel, formatTime } from "./swim";
import type { DashboardResult } from "./dashboard-summary";

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
  ageAtDec31: number;
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
  customMinAge?: number;
  customMaxAge?: number;
  strokeFilter?: number; // 0 for all, 1-5 for specific stroke
  distanceFilter?: number; // 0 for all
  topN?: number; // default 5
  affiliationYear?: number | "all"; // Season / Year of annual federation affiliation (e.g. 2026, 2025)
  selectedMeetIds?: string[] | "all"; // Specific meet IDs to include in the ranking
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
    const meetYear = Number(r.meets?.start_date?.slice(0, 4) || new Date().getFullYear());

    // Annual federation affiliation season filter
    if (
      filters.affiliationYear &&
      filters.affiliationYear !== "all" &&
      meetYear !== Number(filters.affiliationYear)
    ) {
      continue;
    }

    // Official federation age is evaluated at December 31 of the affiliation season / competition year
    const evalYear =
      filters.affiliationYear && filters.affiliationYear !== "all"
        ? Number(filters.affiliationYear)
        : meetYear;
    const athleteAge = ageAtDec31(athlete.birth_date, evalYear);

    // Age Mode check (Libre vs Cruce de edades)
    if (filters.ageMode === "13-14" && (athleteAge < 13 || athleteAge > 14)) continue;
    if (filters.ageMode === "11-12" && (athleteAge < 11 || athleteAge > 12)) continue;
    if (filters.ageMode === "15-16" && (athleteAge < 15 || athleteAge > 16)) continue;
    if (filters.ageMode === "17+" && athleteAge < 17) continue;
    if (filters.ageMode === "custom") {
      const min = filters.customMinAge ?? 0;
      const max = filters.customMaxAge ?? 99;
      if (athleteAge < min || athleteAge > max) continue;
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
      const age = ageAtDec31(athlete?.birth_date, meetYear);
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
    federationName?: string;
    participatingClubs?: string[];
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
  doc.text(
    `Modalidad: ${options.ageModeLabel}  |  Piscina: ${options.courseLabel}  |  Sexo: ${options.genderLabel}  |  Extracción: Mejores 5 tiempos de la temporada`,
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
    `Fecha de emisión: ${new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" })}  |  Regla: 1 mejor tiempo por atleta · Edad al 31 de Diciembre`,
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

      const headers = ["Pto.", "Atleta", "Club", "Asociación", "Edad (31/12)", "Tiempo", "Competencia", "Fecha"];
      const rows = event.top5.map((item) => [
        item.rank.toString(),
        item.athleteName,
        `${item.clubCode} - ${item.clubName}`,
        item.association,
        item.ageAtDec31 > 0 ? item.ageAtDec31.toString() : "—",
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
