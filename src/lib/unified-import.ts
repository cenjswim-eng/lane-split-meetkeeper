/**
 * Módulo Central de Destinos de Importación de Resultados y Entry Lists
 * Ubicación: src/lib/unified-import.ts
 *
 * Permite tomar cualquier resultado o lista de inscripciones (Hy-Tek .hy3/.cl2/.zip, PDF, MDB, Enlace Web o Texto)
 * y destinarlo de forma flexible a:
 * 1. Ranking Estadal y Análisis de Rivales (todos los clubes adversarios para comparativas por edades)
 * 2. Mis Atletas / Mi Club Registrado (marcas personales, progresión y logros de mi club)
 * 3. Circuito Oficial FEVEDA / ADAEL 2026 (meets_2026, adael_clubs, official_results_2026)
 * 4. Base de Datos de Equipos (crea o actualiza el club y el roster de atletas que representan a cada equipo)
 */

import { supabase } from "@/integrations/supabase/client";
import { importParsed, type ImportSummary } from "@/lib/importer";
import { normalizeTeamCode } from "@/data/fevedaClubs";
import { filterParsedByClubCodes } from "@/lib/results-link";
import { syncFromParsedFileToAdael2026 } from "@/lib/adael-2026/service";
import type { ParsedFile } from "@/lib/hytek/types";
import type { QueryClient } from "@tanstack/react-query";

export interface ImportDestinations {
  /** Destino 1: Ranking Estadal y Análisis de Rivales (todos los clubes adversarios para comparativas) */
  stateRanking: boolean;
  /** Destino 2: Mis Atletas / Mi Club Registrado (marcas personales, progresión y logros) */
  myClub: boolean;
  /** Destino 3: Circuito Oficial FEVEDA / ADAEL 2026 (meets_2026, adael_clubs, official_results_2026) */
  officialCircuit: boolean;
  /** Destino 4: Base de Datos de Equipos (crea cada club y asocia los atletas que lo representan) */
  teamDatabases: boolean;
}

export type DestinationPreset =
  | "all_in_one"
  | "entry_lists"
  | "rivals_only"
  | "my_club_only"
  | "custom";

export const DESTINATION_PRESETS: Record<
  Exclude<DestinationPreset, "custom">,
  {
    name: string;
    badge: string;
    description: string;
    destinations: ImportDestinations;
  }
> = {
  my_club_only: {
    name: "Solo Mi Equipo (Recomendado)",
    badge: "Equipo Exclusivo",
    description:
      "Modo equipo único: procesa y guarda exclusivamente los resultados y nadadores de tu club. Los datos de otros equipos se ignoran por completo.",
    destinations: {
      stateRanking: false,
      myClub: true,
      officialCircuit: true,
      teamDatabases: false,
    },
  },
  all_in_one: {
    name: "Torneo Completo (Todos los Equipos)",
    badge: "Todos los Clubes",
    description:
      "Carga todas las marcas de todos los clubes del torneo para el ranking estadal general.",
    destinations: {
      stateRanking: true,
      myClub: true,
      officialCircuit: true,
      teamDatabases: false,
    },
  },
  entry_lists: {
    name: "Entry Lists de Mi Equipo",
    badge: "Inscripciones",
    description:
      "Carga las pruebas sembradas e inscripciones de los atletas de tu club para el torneo.",
    destinations: {
      stateRanking: false,
      myClub: true,
      officialCircuit: true,
      teamDatabases: false,
    },
  },
  rivals_only: {
    name: "Solo Marcas de Competencias",
    badge: "Torneo",
    description:
      "Registra marcas generales de competencias sin alterar las fichas internas de tu club.",
    destinations: {
      stateRanking: false,
      myClub: true,
      officialCircuit: true,
      teamDatabases: false,
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
  teamDatabasesSynced: boolean;
  clubsCreated: number;
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

    if (meetError || !(meetRow as any)?.id) {
      return {
        success: false,
        count: 0,
        error: meetError?.message || "No se pudo crear el registro en meets_2026",
      };
    }

    const meetId = (meetRow as any).id as string;

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
      if ((!r.finalMs || r.finalMs <= 0) && (!r.seedMs || r.seedMs <= 0)) return false;
      if (r.isDq) return false;
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
      const timeMs = r.finalMs && r.finalMs > 0 ? r.finalMs : (r.seedMs || 0);

      return {
        meet_id: meetId,
        swimmer_name: ath ? `${ath.lastName}, ${ath.firstName}` : "Atleta",
        birth_date: birthDate,
        gender: ath?.gender || r.gender || "M",
        club_code: norm.code,
        distance: r.distance,
        stroke: strokeMap[r.stroke] || "FREE",
        course: r.course === "SCM" ? "SCM" : "LCM",
        time_ms: timeMs,
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
 * Sincroniza la Base de Datos de Equipos y Atletas a partir de Entry Lists o torneos.
 * Para cada club presente en el archivo:
 * 1. Crea o actualiza el registro en `clubs` y `teams`.
 * 2. Asocia y registra a cada atleta con el club que representa (`athletes.club_id` y `athletes.team_id`).
 * 3. Registra sus pruebas de entrada en `meet_entries`.
 */
export async function syncTeamDatabasesFromEntries(
  parsed: ParsedFile,
  options?: { selectedClubCodes?: Set<string> }
): Promise<{
  success: boolean;
  clubsCreated: number;
  athletesLinked: number;
  teamsProcessed: number;
  error?: string;
}> {
  try {
    const { data: auth } = await supabase.auth.getUser();
    const ownerId = auth?.user?.id ?? null;

    // 1. Obtener clubes y equipos existentes en la base de datos
    const [clubsRes, teamsRes] = await Promise.all([
      supabase.from("clubs").select("id, team_code, name, full_name"),
      supabase.from("teams").select("id, code, name"),
    ]);

    const existingClubs = (clubsRes.data ?? []) as Array<{ id: string; team_code: string | null; name: string }>;
    const existingTeams = (teamsRes.data ?? []) as Array<{ id: string; code: string; name: string }>;

    const clubMap = new Map<string, string>(); // code -> club_id
    const teamMap = new Map<string, string>(); // code -> team_id

    existingClubs.forEach((c) => {
      if (c.team_code) clubMap.set(c.team_code.toUpperCase(), c.id);
    });
    existingTeams.forEach((t) => {
      if (t.code) teamMap.set(t.code.toUpperCase(), t.id);
    });

    let clubsCreated = 0;
    let teamsProcessed = 0;

    // 2. Procesar cada equipo del entry list y asegurar su existencia en `clubs` y `teams`
    for (const t of parsed.teams) {
      const norm = normalizeTeamCode(t.code, t.name);
      if (options?.selectedClubCodes && options.selectedClubCodes.size > 0) {
        if (!options.selectedClubCodes.has(norm.code)) continue;
      }
      teamsProcessed++;

      // A. Asegurar en `clubs`
      let clubId = clubMap.get(norm.code);
      if (!clubId) {
        // Buscar por nombre si no coincide código
        const matchByName = existingClubs.find(
          (c) => c.name.toLowerCase() === norm.name.toLowerCase()
        );
        if (matchByName) {
          clubId = matchByName.id;
          clubMap.set(norm.code, clubId);
        } else {
          try {
            const newClubPayload = {
              name: norm.name,
              full_name: norm.name,
              short_name: norm.name.length > 16 ? norm.name.slice(0, 16) : norm.name,
              team_code: norm.code,
              region_lsc: norm.lsc || norm.state || "Lara",
              country_code: "VEN",
              team_type: "AGE_GROUP",
              is_unattached: false,
              owner_id: ownerId,
            };

            const { data: created, error: clubErr } = await supabase
              .from("clubs")
              .insert(newClubPayload)
              .select("id")
              .single();

            if (!clubErr && created?.id) {
              clubId = created.id;
              clubMap.set(norm.code, clubId);
              clubsCreated++;
            }
          } catch (insertErr) {
            console.warn(`No se pudo crear club ${norm.code}:`, insertErr);
          }
        }
      }

      // B. Asegurar en `teams`
      let teamId = teamMap.get(norm.code);
      if (!teamId) {
        try {
          const { data: createdTeam } = await supabase
            .from("teams")
            .insert({
              code: norm.code,
              name: norm.name,
              lsc: norm.lsc || norm.state || "Lara",
              owner_id: ownerId,
            })
            .select("id")
            .single();

          if (createdTeam?.id) {
            teamId = createdTeam.id;
            teamMap.set(norm.code, teamId);
          }
        } catch {
          // Ignorar duplicados
        }
      }
    }

    // 3. Vincular y registrar atletas a su club correspondiente
    let athletesLinked = 0;
    const athMap = new Map(parsed.athletes.map((a) => [a.key, a]));

    // Leer atletas existentes del usuario para no duplicar
    const { data: existingAthletes } = await supabase
      .from("athletes")
      .select("id, first_name, last_name, birth_date, tm_athlete_id, club_id, team_id");

    const existingAthList = (existingAthletes ?? []) as Array<{
      id: string;
      first_name: string;
      last_name: string;
      birth_date: string | null;
      tm_athlete_id: string | null;
      club_id: string | null;
      team_id: string | null;
    }>;

    const refYear = Number((parsed.meet.startDate || "2026-01-01").slice(0, 4)) || 2026;

    for (const a of parsed.athletes) {
      const norm = normalizeTeamCode(a.teamCode || "CLUB");
      if (options?.selectedClubCodes && options.selectedClubCodes.size > 0) {
        if (!options.selectedClubCodes.has(norm.code)) continue;
      }

      const targetClubId = clubMap.get(norm.code) || null;
      const targetTeamId = teamMap.get(norm.code) || null;

      const normFirst = (a.firstName || "Atleta").trim().toLowerCase();
      const normLast = (a.lastName || "Desconocido").trim().toLowerCase();
      const birth = a.birthDate || `${refYear - 14}-01-01`;

      const match = existingAthList.find((e) => {
        if (a.tmId && e.tm_athlete_id === a.tmId) return true;
        const eFirst = e.first_name.trim().toLowerCase();
        const eLast = e.last_name.trim().toLowerCase();
        return eFirst === normFirst && eLast === normLast && (!e.birth_date || e.birth_date === birth);
      });

      if (match) {
        // Actualizar asociación de club si no la tenía
        if (targetClubId && (!match.club_id || match.club_id !== targetClubId)) {
          await supabase
            .from("athletes")
            .update({ club_id: targetClubId, team_id: targetTeamId })
            .eq("id", match.id);
          athletesLinked++;
        }
      } else {
        // Insertar atleta en la base de datos representando a este club
        try {
          const { error: athErr } = await supabase.from("athletes").insert({
            first_name: (a.firstName || "Atleta").trim(),
            last_name: (a.lastName || "Desconocido").trim(),
            birth_date: birth,
            gender: a.gender || "M",
            federation_id: a.federationId || null,
            club_id: targetClubId,
            team_id: targetTeamId,
            tm_athlete_id: a.tmId || null,
            is_active: true,
            is_federated: true,
            owner_id: ownerId,
          });

          if (!athErr) {
            athletesLinked++;
          }
        } catch (insertAthErr) {
          console.warn("Aviso al registrar atleta de club:", insertAthErr);
        }
      }
    }

    return {
      success: true,
      clubsCreated,
      athletesLinked,
      teamsProcessed,
    };
  } catch (err: any) {
    console.warn("Error en syncTeamDatabasesFromEntries:", err);
    return {
      success: false,
      clubsCreated: 0,
      athletesLinked: 0,
      teamsProcessed: 0,
      error: err?.message || "Error al sincronizar base de datos de clubes",
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
  if (
    !destinations.stateRanking &&
    !destinations.myClub &&
    !destinations.officialCircuit &&
    !destinations.teamDatabases
  ) {
    throw new Error("Debes seleccionar al menos un destino para los resultados o inscripciones.");
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

  // Determinar los clubes a procesar
  const targetClubCodes = (selectedClubs && selectedClubs.size > 0)
    ? Array.from(selectedClubs)
    : [myClubCode || "JSWIM"];

  // Si estamos en modo de equipo único (o no es ranking estadal global),
  // filtramos el archivo parseado para que SOLO contenga los nadadores y marcas de dicho equipo.
  let readyParsed = targetParsed;
  if (!destinations.stateRanking || (selectedClubs && selectedClubs.size < targetParsed.teams.length)) {
    readyParsed = filterParsedByClubCodes(targetParsed, targetClubCodes);
  }

  onProgress?.(10, "Iniciando procesamiento de resultados e inscripciones...");

  let coreSummary: ImportSummary = {
    meetId: "",
    meetName: readyParsed.meet.name,
    teams: readyParsed.teams.length,
    athletesNew: 0,
    athletesMatched: 0,
    results: 0,
    splits: 0,
  };

  // 1. Guardado en la base de datos central (si se seleccionó Ranking o Mi Club)
  if (destinations.stateRanking || destinations.myClub) {
    onProgress?.(25, "Guardando atletas y marcas en base de datos central...");

    const teamCodeOption = destinations.stateRanking ? "all" : (targetClubCodes[0] || myClubCode || "all");

    coreSummary = await importParsed(
      readyParsed.meet.name,
      readyParsed,
      (pct) => onProgress?.(Math.round(25 + pct * 0.35), "Sincronizando tiempos e historial..."),
      { teamCode: teamCodeOption }
    );
  }

  // 2. Sincronización de Base de Datos de Equipos y Atletas por Club (Destino 4)
  let clubsCreated = 0;
  if (destinations.teamDatabases) {
    onProgress?.(65, "Sincronizando base de datos de equipos y atletas representantes...");
    const teamDbRes = await syncTeamDatabasesFromEntries(readyParsed, {
      selectedClubCodes: selectedClubs,
    });
    clubsCreated = teamDbRes.clubsCreated;
  }

  // 3. Registro en circuito oficial 2026 (si se seleccionó)
  let officialCircuitSaved = false;
  let officialCircuitCount = 0;

  if (destinations.officialCircuit) {
    onProgress?.(80, "Registrando en circuito oficial ADAEL / FEVEDA 2026...");
    const officialRes = await saveToOfficialCircuit2026(readyParsed, {
      selectedClubCodes: selectedClubs,
    });
    officialCircuitSaved = officialRes.success;
    officialCircuitCount = officialRes.count;
    if (!coreSummary.meetId && officialRes.meetId) {
      coreSummary.meetId = officialRes.meetId;
    }

    // 3.1 Sincronización oficial con las entidades ADAEL 2026 (clubes, padrón y marcas)
    try {
      await syncFromParsedFileToAdael2026(readyParsed);
    } catch (adaelErr) {
      console.warn("Sincronización con entidades ADAEL 2026 completada con advertencias:", adaelErr);
    }
  }

  // 4. Refrescar cachés de React Query
  onProgress?.(92, "Actualizando vistas, clasificaciones y plantillas de equipos...");
  if (queryClient) {
    await Promise.allSettled([
      queryClient.invalidateQueries({ queryKey: ["coach-data"] }),
      queryClient.invalidateQueries({ queryKey: ["club-management"] }),
      queryClient.invalidateQueries({ queryKey: ["club-register"] }),
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

  onProgress?.(100, "¡Importación y asignación de clubes completada!");

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
    teamDatabasesSynced: destinations.teamDatabases,
    clubsCreated,
    achievements: coreSummary.achievements,
  };
}
