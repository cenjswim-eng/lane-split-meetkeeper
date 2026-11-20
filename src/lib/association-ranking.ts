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
}

export interface AssociationTopItem {
  rank: number;
  athleteId: string;
  athleteName: string;
  gender: string;
  birthDate: string | null;
  ageAtDec31: number;
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
  association: string; // 'all' or specific association name
  course: string; // 'all' | 'LCM' | 'SCM'
  gender: string; // 'all' | 'M' | 'F'
  ageMode: "libre" | "13-14" | "11-12" | "15-16" | "17+" | "custom";
  customMinAge?: number;
  customMaxAge?: number;
  strokeFilter?: number; // 0 for all, 1-5 for specific stroke
  distanceFilter?: number; // 0 for all
  topN?: number; // default 5
}

/**
 * Extracts and consolidates all clubs and teams detected across imported athletes, results and registries.
 */
export function extractDetectedClubs(
  athletes: any[],
  results: any[],
  clubs: any[] = [],
  teams: any[] = []
): DetectedClub[] {
  const map = new Map<string, DetectedClub>();

  // 1. Registered clubs
  for (const c of clubs) {
    const code = (c.team_code || c.short_name || c.name || "CLUB").toUpperCase().trim();
    map.set(code, {
      id: c.id,
      code,
      name: c.full_name || c.name,
      association: (c.region_lsc || c.region || "").trim() || "Sin Asociación",
      isClub: true,
      athleteCount: 0,
      resultsCount: 0,
    });
  }

  // 2. Teams from meet import
  for (const t of teams) {
    const code = (t.code || "TEAM").toUpperCase().trim();
    if (!map.has(code)) {
      map.set(code, {
        id: t.id,
        code,
        name: t.name || code,
        association: (t.lsc || "").trim() || "Sin Asociación",
        isClub: false,
        athleteCount: 0,
        resultsCount: 0,
      });
    } else {
      const existing = map.get(code)!;
      if (existing.association === "Sin Asociación" && t.lsc?.trim()) {
        existing.association = t.lsc.trim();
      }
    }
  }

  // 3. Athletes
  const athleteClubMap = new Map<string, string>();
  for (const a of athletes) {
    const code = (a.clubs?.team_code || a.teams?.code || "UN").toUpperCase().trim();
    athleteClubMap.set(a.id, code);

    if (!map.has(code)) {
      map.set(code, {
        id: a.clubs?.id || a.teams?.id || code,
        code,
        name: a.clubs?.full_name || a.clubs?.name || a.teams?.name || code,
        association: (a.clubs?.region_lsc || a.teams?.lsc || "").trim() || "Sin Asociación",
        isClub: Boolean(a.clubs?.id),
        athleteCount: 0,
        resultsCount: 0,
      });
    }
    const entry = map.get(code)!;
    entry.athleteCount += 1;
  }

  // 4. Results
  for (const r of results) {
    const code = athleteClubMap.get(r.athlete_id) || "UN";
    if (map.has(code)) {
      map.get(code)!.resultsCount += 1;
    }
  }

  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Filter results and extract the Top 5 best times per event according to association and age mode.
 */
export function calculateAssociationRankings(
  results: DashboardResult[],
  athletes: any[],
  clubs: DetectedClub[],
  filters: AssociationRankingFilters
): EventTopRanking[] {
  const clubByCode = new Map(clubs.map((c) => [c.code.toUpperCase(), c]));
  const athleteMap = new Map(athletes.map((a) => [a.id, a]));

  const topLimit = filters.topN && filters.topN > 0 ? filters.topN : 5;

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

    // Association check
    const clubCode = (athlete.clubs?.team_code || athlete.teams?.code || "UN").toUpperCase().trim();
    const clubInfo = clubByCode.get(clubCode);
    const association = clubInfo?.association || (athlete.clubs?.region_lsc || athlete.teams?.lsc || "").trim() || "Sin Asociación";

    if (filters.association !== "all" && association.toLowerCase() !== filters.association.toLowerCase()) {
      continue;
    }

    // Age calculation at Dec 31
    const meetYear = Number(r.meets?.start_date?.slice(0, 4) || new Date().getFullYear());
    const athleteAge = ageAtDec31(athlete.birth_date, meetYear);

    // Age Mode check
    if (filters.ageMode === "13-14" && (athleteAge < 13 || athleteAge > 14)) continue;
    if (filters.ageMode === "11-12" && (athleteAge < 11 || athleteAge > 12)) continue;
    if (filters.ageMode === "15-16" && (athleteAge < 15 || athleteAge > 16)) continue;
    if (filters.ageMode === "17+" && athleteAge < 17) continue;
    if (filters.ageMode === "custom") {
      const min = filters.customMinAge ?? 0;
      const max = filters.customMaxAge ?? 99;
      if (athleteAge < min || athleteAge > max) continue;
    }

    const eventKey = `${r.events.distance}-${r.events.stroke}-${r.course}-${gender}`;
    const bucket = eventBuckets.get(eventKey) || [];
    bucket.push(r);
    eventBuckets.set(eventKey, bucket);
  }

  const output: EventTopRanking[] = [];

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

    // Sort ascending by final time
    const sorted = [...athleteBest.values()].sort((a, b) => (a.final_time_ms ?? Infinity) - (b.final_time_ms ?? Infinity));

    // Slice to Top N
    const topSwims = sorted.slice(0, topLimit);

    let currentRank = 0;
    const top5: AssociationTopItem[] = topSwims.map((swim, index) => {
      const athlete = athleteMap.get(swim.athlete_id);
      const meetYear = Number(swim.meets?.start_date?.slice(0, 4) || new Date().getFullYear());
      const age = ageAtDec31(athlete?.birth_date, meetYear);
      const clubCode = (athlete?.clubs?.team_code || athlete?.teams?.code || "UN").toUpperCase().trim();
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
        clubCode,
        clubName: clubInfo?.name || athlete?.clubs?.full_name || athlete?.teams?.name || clubCode,
        association: clubInfo?.association || "Sin Asociación",
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
      output.push({
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
  return output.sort((a, b) => {
    if (a.gender !== b.gender) return a.gender.localeCompare(b.gender);
    if (a.stroke !== b.stroke) return a.stroke - b.stroke;
    return a.distance - b.distance;
  });
}

/**
 * Generates an official Association Top 5 Ranking PDF.
 */
export function generateAssociationRankingPdf(
  rankings: EventTopRanking[],
  options: {
    associationName: string;
    ageModeLabel: string;
    courseLabel: string;
    genderLabel: string;
    brand?: ReportBrand;
  }
): File {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  setReportTableBrand(doc, options.brand);

  const title = `Ranking Oficial · ${options.associationName}`;
  doc.setProperties({
    title,
    author: "Swim Lane Coach",
    creator: "Swim Lane Coach",
    subject: "Ranking Oficial por Asociación Top 5",
  });

  // Header
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 15);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Modalidad: ${options.ageModeLabel}  |  Piscina: ${options.courseLabel}  |  Sexo: ${options.genderLabel}  |  Extracción: Mejores 5 tiempos`,
    14,
    22
  );

  doc.setFontSize(8);
  doc.setTextColor(120);
  doc.text(`Fecha de emisión: ${new Date().toLocaleDateString("es-VE", { day: "2-digit", month: "long", year: "numeric" })}`, 14, 27);
  doc.setTextColor(0);

  let currentY = 32;

  if (rankings.length === 0) {
    doc.setFontSize(11);
    doc.text("No se encontraron registros de tiempos con los filtros seleccionados.", 14, 45);
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
  const filename = `Ranking_Top5_${cleanAssoc}_${new Date().toISOString().slice(0, 10)}.pdf`;
  return new File([doc.output("blob")], filename, { type: "application/pdf" });
}
