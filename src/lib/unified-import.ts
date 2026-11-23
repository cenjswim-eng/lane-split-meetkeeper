/**
 * Módulo Central de Destinos de Importación de Resultados
 * Ubicación: src/lib/unified-import.ts
 *
 * Permite tomar cualquier resultado parseado (Hy-Tek .hy3/.cl2/.zip, PDF, MDB, Enlace Web o Texto)
 * y destinarlo de forma flexible a:
 * 1. Ranking Estadal y Análisis de Rivales (todos los clubes adversarios para comparativas por edades)
 * 2. Mis Atletas / Mi Club Registrado (marcas personales, progresión y logros de mi club)
 * 3. Circuito Oficial FEVEDA / ADAEL 2026 (meets_2026, adael_clubs, official_results_2026)
 */

import { supabase } from "@/integrations/supabase/client";
import { importParsed, type ImportSummary } from "@/lib/importer";
import { normalizeTeamCode } from "@/data/fevedaClubs";
import { filterParsedByClubCodes } from "@/lib/results-link";
import type { ParsedFile } from "@/lib/hytek/types";
import type { QueryClient } from "@tanstack/react-query";

export interface ImportDestinations {
  /** Destino 1: Ranking Estadal y Análisis de Rivales (todos los clubes adversarios para comparativas) */
  stateRanking: boolean;
  /** Destino 2: Mis Atletas / Mi Club Registrado (marcas personales, progresión y logros) */
  myClub: boolean;
  /** Destino 3: Circuito Oficial FEVEDA / ADAEL 2026 (meets_2026, adael_clubs, official_results_2026) */
  officialCircuit: boolean;
}

export type DestinationPreset = "all_in_one" | "rivals_only" | "my_club_only" | "custom";

export const DESTINATION_PRESETS: Record<
  Exclude<DestinationPreset, "custom">,
  {
    name: string;
    badge: string;
    description: string;
    destinations: ImportDestinations;
  }
> = {
  all_in_one: {
    name: "Todo en Uno (Recomendado)",
    badge: "Completo",
    description:
      "Carga el torneo completo: actualiza el ranking estadal con todos los rivales, vincula marcas a tus atletas y registra en el circuito oficial 2026.",
    destinations: {
      stateRanking: true,
      myClub: true,
      officialCircuit: true,
    },
  },
  rivals_only: {
    name: "Solo Ranking Estadal y Rivales",
    badge: "Rivales",
    description:
      "Ideal para torneos externos o invitacionales de otros estados para comparar rivales sin alterar las fichas internas de tu club.",
    destinations: {
      stateRanking: true,
      myClub: false,
      officialCircuit: true,
    },
  },
  my_club_only: {
    name: "Solo Mis Atletas / Mi Club",
    badge: "Club Interno",
    description:
      "Ideal para chequeos internos, tomas de tiempo o invitacionales cerrados donde solo deseas actualizar las marcas de tu propio equipo.",
    destinations: {
      stateRanking: false,
      myClub: true,
      officialCircuit: false,
    },
  },
};

export interface UnifiedImportParams {
  fileName: string;
  parsed: ParsedFile;
  destinations: ImportDestinations;
  myClubCode?: string;
  selectedClubs?: Set<string>;
  queryClient?: QueryClient;
  onProgress?: (pct: number, stage: string) => void;
}

export interface UnifiedImportResult {
  meetId: string;
  meetName: string;
  athletesNew: number;
  athletesMatched: number;
  totalAthletes: number;
  resultsImported: number;
  clubsCount: number;
  officialCircuitSaved: boolean;
  officialCircuitCount: number;
  stateRankingSaved: boolean;
  myClubSaved: boolean;
  achievements?: string;
}

/**
 * Registra y actualiza una competencia en el circuito oficial 2026 de ADAEL / FEVEDA.
 * Alimenta las tablas: meets_2026, adael_clubs y official_results_2026.
 */
export async function saveToOfficialCircuit2026(
  parsed: ParsedFile,
  options?: { selectedClubCodes?: Set<string> }
): Promise<{ success: boolean; meetId?: string; count: number; error?: string }> {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const meetStartDate = parsed.meet.startDate || today;
    const meetEndDate = parsed.meet.endDate || meetStartDate;
    const meetCourse = parsed.meet.course === "SCM" ? "SCM" : "LCM";
    const meetName = parsed.meet.name?.trim() || "Competencia Oficial 2026";

    // 1. Upsert meet en meets_2026
    const { data: meetRow, error: meetError } = await supabase
      .from("meets_2026" as any)
      .upsert(
        {
          name: meetName,
          start_date: meetStartDate,
          end_date: meetEndDate,
          course: meetCourse,
          location: parsed.meet.location || "Piscina Oficial",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "name,start_date,course" }
      )
      .select("id")
      .single();

    if (meetError || !meetRow?.id) {
      return {
        success: false,
        count: 0,
        error: meetError?.message || "No se pudo crear el registro en meets_2026",
      };
    }

    const meetId = meetRow.id as string;

    // 2. Upsert clubes en adael_clubs
    const clubsPayload = parsed.teams.map((t) => {
      const norm = normalizeTeamCode(t.code, t.name);
      return {
        code: norm.code,
        name: norm.name,
        association: norm.lsc || "LARA",
        is_federated_2026: true,
        updated_at: new Date().toISOString(),
      };
    });

    if (clubsPayload.length > 0) {
      await supabase.from("adael_clubs" as any).upsert(clubsPayload, { onConflict: "code" });
    }

    // 3. Mapeo y preparación de resultados para official_results_2026
    const athMap = new Map(parsed.athletes.map((a) => [a.key, a]));
    const strokeMap: Record<number, string> = {
      1: "FREE",
      2: "BACK",
      3: "BREAST",
      4: "FLY",
      5: "IM",
    };

    const refYear = Number(meetStartDate.slice(0, 4)) || 2026;
    const validResults = parsed.results.filter((r) => {
      if (!r.finalMs || r.finalMs <= 0 || r.isDq) return false;
      if (options?.selectedClubCodes && options.selectedClubCodes.size > 0) {
        const ath = athMap.get(r.athleteKey);
        const code = ath?.teamCode ? normalizeTeamCode(ath.teamCode).code : "";
        if (!options.selectedClubCodes.has(code)) return false;
      }
      return true;
    });

    const officialPayload = validResults.map((r) => {
      const ath = athMap.get(r.athleteKey);
      const norm = normalizeTeamCode(ath?.teamCode || "CLUB");
      const birthDate = ath?.birthDate || `${refYear - 14}-01-01`;

      return {
        meet_id: meetId,
        swimmer_name: ath ? `${ath.lastName}, ${ath.firstName}` : "Atleta",
        birth_date: birthDate,
        gender: ath?.gender || r.gender || "M",
        club_code: norm.code,
        distance: r.distance,
        stroke: strokeMap[r.stroke] || "FREE",
        course: r.course === "SCM" ? "SCM" : "LCM",
        time_ms: r.finalMs,
        status: "OK",
        round: r.round || "F",
        is_relay_leadoff: false,
      };
    });

    // Guardado por lotes (chunks de 500) para prevenir desbordamiento de payload
    const CHUNK_SIZE = 500;
    for (let i = 0; i < officialPayload.length; i += CHUNK_SIZE) {
      const chunk = officialPayload.slice(i, i + CHUNK_SIZE);
      await supabase.from("official_results_2026" as any).upsert(chunk, {
        onConflict: "meet_id,swimmer_name,birth_date,distance,stroke,course,round,is_relay_leadoff",
      });
    }

    return {
      success: true,
      meetId,
      count: officialPayload.length,
    };
  } catch (err: any) {
    console.warn("Aviso al guardar en official_results_2026:", err);
    return {
      success: false,
      count: 0,
      error: err?.message || "Error al sincronizar con official_results_2026",
    };
  }
}

/**
 * Ejecuta la importación unificada canalizando los datos a los destinos seleccionados.
 */
export async function executeUnifiedImport({
  fileName,
  parsed,
  destinations,
  myClubCode,
  selectedClubs,
  queryClient,
  onProgress,
}: UnifiedImportParams): Promise<UnifiedImportResult> {
  if (!destinations.stateRanking && !destinations.myClub && !destinations.officialCircuit) {
    throw new Error("Debes seleccionar al menos un destino para los resultados.");
  }

  // Sanitizar fechas y datos del torneo
  const today = new Date().toISOString().slice(0, 10);
  const targetParsed: ParsedFile = {
    ...parsed,
    meet: {
      ...parsed.meet,
      name: parsed.meet.name?.trim() || fileName.replace(/\.[^.]+$/, "").trim() || "Torneo de Natación",
      startDate: parsed.meet.startDate || today,
      endDate: parsed.meet.endDate || parsed.meet.startDate || today,
      course:
        parsed.meet.course === "LCM" || parsed.meet.course === "SCM" || parsed.meet.course === "SCY"
          ? parsed.meet.course
          : "LCM",
    },
  };

  // Si se seleccionaron clubes específicos y no son todos, aplicar filtro
  let readyParsed = targetParsed;
  if (selectedClubs && selectedClubs.size > 0 && selectedClubs.size < targetParsed.teams.length) {
    readyParsed = filterParsedByClubCodes(targetParsed, Array.from(selectedClubs));
  }

  onProgress?.(10, "Iniciando procesamiento de resultados...");

  let coreSummary: ImportSummary = {
    meetId: "",
    meetName: readyParsed.meet.name,
    teams: readyParsed.teams.length,
    athletesNew: 0,
    athletesMatched: 0,
    results: 0,
    splits: 0,
  };

  // 1. Guardado en la base de datos central (si se seleccionó Ranking Estadal o Mi Club)
  if (destinations.stateRanking || destinations.myClub) {
    onProgress?.(25, "Guardando atletas y marcas en base de datos central...");

    // Si se activa ranking estadal, teamCode es 'all' (todos los clubes rivales y propios).
    // Si solo se activó Mi Club y no ranking, se puede limitar al club activo.
    const teamCodeOption = destinations.stateRanking ? "all" : myClubCode || "all";

    coreSummary = await importParsed(
      readyParsed.meet.name,
      readyParsed,
      (pct) => onProgress?.(Math.round(25 + pct * 0.45), "Sincronizando tiempos e historial..."),
      { teamCode: teamCodeOption }
    );
  }

  // 2. Registro en circuito oficial 2026 (si se seleccionó)
  let officialCircuitSaved = false;
  let officialCircuitCount = 0;

  if (destinations.officialCircuit) {
    onProgress?.(75, "Registrando en circuito oficial ADAEL / FEVEDA 2026...");
    const officialRes = await saveToOfficialCircuit2026(readyParsed, {
      selectedClubCodes: selectedClubs,
    });
    officialCircuitSaved = officialRes.success;
    officialCircuitCount = officialRes.count;
    if (!coreSummary.meetId && officialRes.meetId) {
      coreSummary.meetId = officialRes.meetId;
    }
  }

  // 3. Refrescar cachés de React Query
  onProgress?.(92, "Actualizando vistas y clasificaciones...");
  if (queryClient) {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ["coach-data"] }),
      queryClient.invalidateQueries({ queryKey: ["official_results_2026_state_ranking"] }),
      queryClient.invalidateQueries({ queryKey: ["official_results_2026"] }),
      queryClient.invalidateQueries({ queryKey: ["meets_2026"] }),
      queryClient.invalidateQueries({ queryKey: ["adael_clubs"] }),
      queryClient.invalidateQueries({ queryKey: ["athletes"] }),
      queryClient.invalidateQueries({ queryKey: ["meets"] }),
      queryClient.invalidateQueries({ queryKey: ["profile"] }),
      queryClient.invalidateQueries({ queryKey: ["rankings"] }),
    ]);
  }

  onProgress?.(100, "¡Importación completada con éxito!");

  return {
    meetId: coreSummary.meetId,
    meetName: coreSummary.meetName,
    athletesNew: coreSummary.athletesNew,
    athletesMatched: coreSummary.athletesMatched,
    totalAthletes: readyParsed.athletes.length,
    resultsImported: coreSummary.results || readyParsed.results.length,
    clubsCount: readyParsed.teams.length,
    officialCircuitSaved,
    officialCircuitCount,
    stateRankingSaved: destinations.stateRanking,
    myClubSaved: destinations.myClub,
    achievements: coreSummary.achievements,
  };
}
