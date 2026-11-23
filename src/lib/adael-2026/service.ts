/**
 * Servicio y Motor de Dominio para el Módulo ADAEL 2026
 * Gestiona clubes, padrón oficial de fichados 2026 y resultados estadales
 */

import { supabase } from '@/integrations/supabase/client';
import type { ParsedFile } from '@/lib/hytek/types';
import {
  type AdaelClub2026,
  type AdaelAthlete2026,
  type AdaelResult2026,
  type AgeGroupAdael2026,
  type CourseType,
  type GenderType,
  type RoundType,
  type ResultStatus,
  type SplitItem,
  DEFAULT_ADAEL_CLUBS_2026,
} from './types';

const STORAGE_KEYS = {
  CLUBS: 'adael_clubs_2026_store',
  ATHLETES: 'adael_athletes_2026_store',
  RESULTS: 'adael_results_2026_store',
};

// Generador de UUID v4 simple para offline / fallback
export function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Normaliza nombres de atletas eliminando acentos, caracteres raros,
 * dobles espacios y convirtiendo a mayúsculas para deduplicación estricta.
 */
export function normalizeAthleteName(raw: string): string {
  if (!raw) return '';
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s,-]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

/**
 * Calcula la categoría oficial ADAEL 2026 al 31 de diciembre de 2026 (2026 - birthYear)
 */
export function calculateAgeGroup2026(birthYearOrDate: number | string | null | undefined): AgeGroupAdael2026 {
  if (!birthYearOrDate) return 'Máxima';

  let year: number;
  if (typeof birthYearOrDate === 'number') {
    year = birthYearOrDate;
  } else {
    const cleanStr = String(birthYearOrDate).trim();
    const dateParsed = new Date(cleanStr);
    if (!isNaN(dateParsed.getFullYear()) && cleanStr.includes('-')) {
      year = dateParsed.getFullYear();
    } else {
      const match = cleanStr.match(/\b(19\d\d|20\d\d)\b/);
      year = match ? parseInt(match[1], 10) : 2006;
    }
  }

  const ageIn2026 = 2026 - year;

  if (ageIn2026 <= 9) return 'Pre-Infantil';
  if (ageIn2026 <= 11) return 'Infantil A';
  if (ageIn2026 <= 13) return 'Infantil B';
  if (ageIn2026 <= 15) return 'Juvenil A';
  if (ageIn2026 <= 18) return 'Juvenil B';
  if (ageIn2026 <= 24) return 'Máxima';
  return 'Máster';
}

/**
 * Formatea milisegundos a formato estándar mm:ss.cc o ss.cc
 */
export function formatMillisecondsToTime(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || isNaN(ms) || ms <= 0) return '--:--.--';
  const totalSeconds = ms / 1000;
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;

  if (minutes > 0) {
    return `${minutes}:${remainingSeconds.toFixed(2).padStart(5, '0')}`;
  }
  return remainingSeconds.toFixed(2);
}

/**
 * Parsea string de tiempo ("1:02.45" o "28.32") a milisegundos
 */
export function parseTimeToMilliseconds(timeStr: string | null | undefined): number {
  if (!timeStr) return 0;
  const cleaned = timeStr.trim().toUpperCase();
  if (['NT', 'N.T.', 'DQ', 'NS', 'DNF', 'SCR', '--:--.--'].includes(cleaned)) return 0;

  const parts = cleaned.split(':');
  if (parts.length === 2) {
    const mins = parseFloat(parts[0]);
    const secs = parseFloat(parts[1]);
    if (isNaN(mins) || isNaN(secs)) return 0;
    return Math.round((mins * 60 + secs) * 1000);
  } else if (parts.length === 1) {
    const secs = parseFloat(parts[0]);
    if (isNaN(secs)) return 0;
    return Math.round(secs * 1000);
  }
  return 0;
}

/**
 * Cálculo estándar de Puntos FINA / AQUA Points
 */
const BASE_TIMES_LCM: Record<string, { M: number; F: number }> = {
  '50m Libre': { M: 20.91, F: 23.61 },
  '100m Libre': { M: 46.80, F: 51.71 },
  '200m Libre': { M: 102.0, F: 112.98 },
  '400m Libre': { M: 220.07, F: 235.38 },
  '800m Libre': { M: 452.12, F: 484.79 },
  '1500m Libre': { M: 871.02, F: 920.48 },
  '50m Espalda': { M: 23.55, F: 26.86 },
  '100m Espalda': { M: 51.60, F: 57.13 },
  '200m Espalda': { M: 111.92, F: 123.14 },
  '50m Pecho': { M: 25.95, F: 29.16 },
  '100m Pecho': { M: 56.88, F: 64.13 },
  '200m Pecho': { M: 125.48, F: 137.55 },
  '50m Mariposa': { M: 22.27, F: 24.43 },
  '100m Mariposa': { M: 49.45, F: 55.18 },
  '200m Mariposa': { M: 110.34, F: 121.81 },
  '200m C.I.': { M: 114.00, F: 126.12 },
  '400m C.I.': { M: 242.50, F: 265.87 },
};

export function calculateFinaPoints(eventCode: string, timeMs: number, gender: GenderType): number {
  if (!timeMs || timeMs <= 0) return 0;
  const timeSec = timeMs / 1000;
  const base = BASE_TIMES_LCM[eventCode] || BASE_TIMES_LCM[`${eventCode} Libre`];
  if (!base) return 0;
  const baseSec = gender === 'M' ? base.M : base.F;
  if (!baseSec) return 0;
  const points = Math.floor(1000 * Math.pow(baseSec / timeSec, 3));
  return Math.max(0, points);
}

/**
 * Resuelve un club oficial a partir de código, alias o nombre
 */
export function resolveAdaelClub(
  codeOrAlias: string,
  clubName?: string,
  clubsCatalog: AdaelClub2026[] = []
): AdaelClub2026 {
  const query = (codeOrAlias || '').trim().toUpperCase();
  const nameQuery = (clubName || '').trim().toUpperCase();

  // 1. Buscar en catálogo cargado
  const foundInCatalog = clubsCatalog.find((c) => {
    if (c.club_code.toUpperCase() === query) return true;
    if (c.aliases?.some((a) => a.toUpperCase() === query || query.includes(a.toUpperCase()))) return true;
    if (c.club_name.toUpperCase() === nameQuery) return true;
    return false;
  });
  if (foundInCatalog) return foundInCatalog;

  // 2. Buscar en catálogo por defecto
  const foundInDefault = DEFAULT_ADAEL_CLUBS_2026.find((c) => {
    if (c.club_code.toUpperCase() === query) return true;
    if (c.aliases.some((a) => a.toUpperCase() === query || query.includes(a.toUpperCase()))) return true;
    if (nameQuery && c.club_name.toUpperCase() === nameQuery) return true;
    return false;
  });
  if (foundInDefault) {
    return {
      id: generateUUID(),
      ...foundInDefault,
    };
  }

  // 3. Fallback: Crear club provisional con el código/alias dado
  const fallbackCode = query.replace(/[^A-Z0-9]/g, '').slice(0, 8) || 'CLUB';
  return {
    id: generateUUID(),
    club_code: fallbackCode,
    club_name: clubName?.trim() || `Club ${fallbackCode}`,
    aliases: [query],
    season: 2026,
  };
}

/**
 * Obtener clubes de ADAEL 2026 (Supabase con fallback a localStorage y catálogo predefinido)
 */
export async function getAdaelClubs2026(): Promise<AdaelClub2026[]> {
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('adael_clubs_2026')
        .select('*')
        .eq('season', 2026)
        .order('club_name');

      if (!error && data && data.length > 0) {
        return data as AdaelClub2026[];
      }
    }
  } catch (err) {
    console.warn('[ADAEL 2026] Supabase getAdaelClubs2026 fallback to local storage', err);
  }

  // Fallback local
  if (typeof window !== 'undefined' && window.localStorage) {
    const raw = localStorage.getItem(STORAGE_KEYS.CLUBS);
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch {}
    }
  }

  // Si no hay datos, inicializamos con DEFAULT_ADAEL_CLUBS_2026
  const initialClubs: AdaelClub2026[] = DEFAULT_ADAEL_CLUBS_2026.map((c) => ({
    ...c,
    id: generateUUID(),
  }));

  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(STORAGE_KEYS.CLUBS, JSON.stringify(initialClubs));
  }

  return initialClubs;
}

/**
 * Guarda o actualiza clubes en ADAEL 2026
 */
export async function upsertAdaelClubs2026(clubs: AdaelClub2026[]): Promise<AdaelClub2026[]> {
  try {
    if (supabase) {
      const inserts = clubs.map((c) => ({
        id: c.id,
        club_code: c.club_code,
        club_name: c.club_name,
        aliases: c.aliases,
        season: 2026,
      }));
      await supabase.from('adael_clubs_2026').upsert(inserts, { onConflict: 'club_code' });
    }
  } catch (err) {
    console.warn('[ADAEL 2026] Supabase upsertAdaelClubs2026 error:', err);
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(STORAGE_KEYS.CLUBS, JSON.stringify(clubs));
  }
  return clubs;
}

/**
 * Obtener atletas del padrón ADAEL 2026
 */
export async function getAdaelAthletes2026(filters?: {
  clubId?: string;
  ageGroup?: string;
  gender?: string;
  search?: string;
}): Promise<AdaelAthlete2026[]> {
  let athletes: AdaelAthlete2026[] = [];

  try {
    if (supabase) {
      let query = supabase.from('adael_athletes_2026').select('*, club:adael_clubs_2026(*)');

      if (filters?.clubId && filters.clubId !== 'all') {
        query = query.eq('club_id', filters.clubId);
      }
      if (filters?.ageGroup && filters.ageGroup !== 'all') {
        query = query.eq('age_group_2026', filters.ageGroup);
      }
      if (filters?.gender && filters.gender !== 'all') {
        query = query.eq('gender', filters.gender);
      }

      const { data, error } = await query.order('normalized_name');
      if (!error && data) {
        athletes = data as unknown as AdaelAthlete2026[];
      }
    }
  } catch (err) {
    console.warn('[ADAEL 2026] Supabase getAdaelAthletes2026 fallback to local:', err);
  }

  if (athletes.length === 0 && typeof window !== 'undefined' && window.localStorage) {
    const raw = localStorage.getItem(STORAGE_KEYS.ATHLETES);
    if (raw) {
      try {
        athletes = JSON.parse(raw);
      } catch {}
    }
  }

  // Filtrado local en memoria
  if (filters) {
    if (filters.clubId && filters.clubId !== 'all') {
      athletes = athletes.filter((a) => a.club_id === filters.clubId);
    }
    if (filters.ageGroup && filters.ageGroup !== 'all') {
      athletes = athletes.filter((a) => a.age_group_2026 === filters.ageGroup);
    }
    if (filters.gender && filters.gender !== 'all') {
      athletes = athletes.filter((a) => a.gender === filters.gender);
    }
    if (filters.search) {
      const q = filters.search.toUpperCase().trim();
      athletes = athletes.filter(
        (a) =>
          a.normalized_name.includes(q) ||
          a.full_name.toUpperCase().includes(q) ||
          (a.faveda_adael_id && a.faveda_adael_id.toUpperCase().includes(q))
      );
    }
  }

  return athletes;
}

/**
 * Guarda o actualiza atletas garantizando estricta deduplicación por (normalized_name, birth_year, gender, club_id)
 */
export async function upsertAdaelAthletes2026(
  newAthletes: Array<Omit<AdaelAthlete2026, 'id' | 'created_at' | 'updated_at'>>
): Promise<AdaelAthlete2026[]> {
  const existing = await getAdaelAthletes2026();
  const mergedMap = new Map<string, AdaelAthlete2026>();

  // Cargar existentes
  for (const a of existing) {
    const key = `${a.normalized_name}_${a.birth_year}_${a.gender}_${a.club_id}`;
    mergedMap.set(key, a);
  }

  // Insertar o actualizar nuevos
  for (const n of newAthletes) {
    const key = `${n.normalized_name}_${n.birth_year}_${n.gender}_${n.club_id}`;
    const curr = mergedMap.get(key);
    if (curr) {
      mergedMap.set(key, {
        ...curr,
        ...n,
        id: curr.id,
        faveda_adael_id: n.faveda_adael_id || curr.faveda_adael_id,
        status: n.status || curr.status,
      });
    } else {
      const newRecord: AdaelAthlete2026 = {
        id: generateUUID(),
        ...n,
      };
      mergedMap.set(key, newRecord);
    }
  }

  const resultList = Array.from(mergedMap.values());

  // Sincronizar en Supabase
  try {
    if (supabase) {
      const dbInserts = resultList.map((a) => ({
        id: a.id,
        faveda_adael_id: a.faveda_adael_id,
        full_name: a.full_name,
        normalized_name: a.normalized_name,
        gender: a.gender,
        birth_date: a.birth_date,
        birth_year: a.birth_year,
        age_group_2026: a.age_group_2026,
        club_id: a.club_id,
        is_federated: a.is_federated,
        status: a.status,
      }));
      await supabase.from('adael_athletes_2026').upsert(dbInserts, {
        onConflict: 'normalized_name,birth_year,gender,club_id',
      });
    }
  } catch (err) {
    console.warn('[ADAEL 2026] Supabase upsertAdaelAthletes2026 error:', err);
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(STORAGE_KEYS.ATHLETES, JSON.stringify(resultList));
  }

  return resultList;
}

/**
 * Obtener resultados oficiales 2026
 */
export async function getAdaelResults2026(filters?: {
  meetName?: string;
  course?: CourseType | 'all';
  eventCode?: string;
  clubId?: string;
  athleteId?: string;
  status?: string;
}): Promise<AdaelResult2026[]> {
  let results: AdaelResult2026[] = [];

  try {
    if (supabase) {
      let query = supabase.from('adael_results_2026').select('*, athlete:adael_athletes_2026(*), club:adael_clubs_2026(*)');

      if (filters?.meetName && filters.meetName !== 'all') {
        query = query.eq('meet_name', filters.meetName);
      }
      if (filters?.course && filters.course !== 'all') {
        query = query.eq('pool_course', filters.course);
      }
      if (filters?.eventCode && filters.eventCode !== 'all') {
        query = query.eq('event_code', filters.eventCode);
      }
      if (filters?.clubId && filters.clubId !== 'all') {
        query = query.eq('club_id', filters.clubId);
      }
      if (filters?.athleteId) {
        query = query.eq('athlete_id', filters.athleteId);
      }

      const { data, error } = await query.order('final_time_ms', { ascending: true });
      if (!error && data) {
        results = data as unknown as AdaelResult2026[];
      }
    }
  } catch (err) {
    console.warn('[ADAEL 2026] Supabase getAdaelResults2026 fallback to local:', err);
  }

  if (results.length === 0 && typeof window !== 'undefined' && window.localStorage) {
    const raw = localStorage.getItem(STORAGE_KEYS.RESULTS);
    if (raw) {
      try {
        results = JSON.parse(raw);
      } catch {}
    }
  }

  // Filtrado en memoria
  if (filters) {
    if (filters.meetName && filters.meetName !== 'all') {
      results = results.filter((r) => r.meet_name === filters.meetName);
    }
    if (filters.course && filters.course !== 'all') {
      results = results.filter((r) => r.pool_course === filters.course);
    }
    if (filters.eventCode && filters.eventCode !== 'all') {
      results = results.filter((r) => r.event_code === filters.eventCode);
    }
    if (filters.clubId && filters.clubId !== 'all') {
      results = results.filter((r) => r.club_id === filters.clubId);
    }
    if (filters.athleteId) {
      results = results.filter((r) => r.athlete_id === filters.athleteId);
    }
    if (filters.status && filters.status !== 'all') {
      results = results.filter((r) => r.status === filters.status);
    }
  }

  return results;
}

/**
 * Guarda o actualiza resultados garantizando estricta deduplicación por (meet_name, meet_date, pool_course, athlete_id, event_code, round)
 */
export async function upsertAdaelResults2026(
  newResults: Array<Omit<AdaelResult2026, 'id' | 'created_at' | 'updated_at'>>
): Promise<AdaelResult2026[]> {
  const existing = await getAdaelResults2026();
  const mergedMap = new Map<string, AdaelResult2026>();

  for (const r of existing) {
    const key = `${r.meet_name}_${r.meet_date}_${r.pool_course}_${r.athlete_id}_${r.event_code}_${r.round}`;
    mergedMap.set(key, r);
  }

  for (const n of newResults) {
    const key = `${n.meet_name}_${n.meet_date}_${n.pool_course}_${n.athlete_id}_${n.event_code}_${n.round}`;
    const curr = mergedMap.get(key);
    if (curr) {
      mergedMap.set(key, {
        ...curr,
        ...n,
        id: curr.id,
      });
    } else {
      const record: AdaelResult2026 = {
        id: generateUUID(),
        ...n,
      };
      mergedMap.set(key, record);
    }
  }

  const resultList = Array.from(mergedMap.values());

  try {
    if (supabase) {
      const dbInserts = resultList.map((r) => ({
        id: r.id,
        meet_name: r.meet_name,
        meet_date: r.meet_date,
        pool_course: r.pool_course,
        athlete_id: r.athlete_id,
        club_id: r.club_id,
        event_code: r.event_code,
        round: r.round,
        seed_time_ms: r.seed_time_ms,
        final_time_ms: r.final_time_ms,
        final_time_formatted: r.final_time_formatted,
        splits: r.splits,
        fina_points: r.fina_points,
        rank: r.rank,
        status: r.status,
      }));
      await supabase.from('adael_results_2026').upsert(dbInserts, {
        onConflict: 'meet_name,meet_date,pool_course,athlete_id,event_code,round',
      });
    }
  } catch (err) {
    console.warn('[ADAEL 2026] Supabase upsertAdaelResults2026 error:', err);
  }

  if (typeof window !== 'undefined' && window.localStorage) {
    localStorage.setItem(STORAGE_KEYS.RESULTS, JSON.stringify(resultList));
  }

  return resultList;
}

/**
 * Pipeline Centralizado de Ingestión:
 * Procesa entradas o resultados oficiales (Hy-Tek, Entry List, HTML scraping de adael.com.ve o natacionvenezuela.com)
 * resolviendo clubes, fichando atletas en el padrón 2026 y registrando marcas oficiales.
 */
export async function ingestOfficialAdaelBatch(params: {
  meetName: string;
  meetDate: string;
  poolCourse: CourseType;
  records: Array<{
    favedaId?: string;
    athleteName: string;
    gender: GenderType;
    birthYear?: number;
    birthDate?: string;
    clubCodeOrAlias: string;
    clubName?: string;
    isFederated?: boolean;
    eventCode: string;
    round?: RoundType;
    seedTime?: string;
    finalTime: string;
    splits?: SplitItem[];
    rank?: number;
    status?: ResultStatus;
  }>;
}): Promise<{
  clubsProcessed: number;
  athletesProcessed: number;
  resultsProcessed: number;
}> {
  const catalogClubs = await getAdaelClubs2026();
  const clubsMap = new Map<string, AdaelClub2026>();
  catalogClubs.forEach((c) => clubsMap.set(c.club_code, c));

  const athletesToUpsert: Array<Omit<AdaelAthlete2026, 'id' | 'created_at' | 'updated_at'>> = [];
  const resultsToUpsert: Array<Omit<AdaelResult2026, 'id' | 'created_at' | 'updated_at'>> = [];

  // Paso 1: Resolver y asegurar clubes
  for (const r of params.records) {
    const resolved = resolveAdaelClub(r.clubCodeOrAlias, r.clubName, Array.from(clubsMap.values()));
    if (!clubsMap.has(resolved.club_code)) {
      clubsMap.set(resolved.club_code, resolved);
    }
  }
  await upsertAdaelClubs2026(Array.from(clubsMap.values()));

  // Paso 2: Construir atletas y deduplicar
  const athleteKeyToId = new Map<string, string>();
  const existingAthletes = await getAdaelAthletes2026();
  existingAthletes.forEach((a) => {
    athleteKeyToId.set(`${a.normalized_name}_${a.birth_year}_${a.gender}_${a.club_id}`, a.id);
  });

  for (const r of params.records) {
    const club = resolveAdaelClub(r.clubCodeOrAlias, r.clubName, Array.from(clubsMap.values()));
    const normName = normalizeAthleteName(r.athleteName);
    const bYear = r.birthYear || (r.birthDate ? new Date(r.birthDate).getFullYear() : 2006);
    const ageGroup = calculateAgeGroup2026(r.birthDate || bYear);
    const athleteKey = `${normName}_${bYear}_${r.gender}_${club.id}`;

    let athleteId = athleteKeyToId.get(athleteKey);
    if (!athleteId) {
      athleteId = generateUUID();
      athleteKeyToId.set(athleteKey, athleteId);

      athletesToUpsert.push({
        faveda_adael_id: r.favedaId || null,
        full_name: r.athleteName.trim(),
        normalized_name: normName,
        gender: r.gender,
        birth_date: r.birthDate || null,
        birth_year: bYear,
        age_group_2026: ageGroup,
        club_id: club.id,
        is_federated: r.isFederated ?? true,
        status: 'Activo 2026',
      });
    }
  }

  if (athletesToUpsert.length > 0) {
    await upsertAdaelAthletes2026(athletesToUpsert);
  }

  // Refrescar mapa de atletas actualizado
  const allAthletes = await getAdaelAthletes2026();
  const athleteLookup = new Map<string, AdaelAthlete2026>();
  allAthletes.forEach((a) => {
    athleteLookup.set(`${a.normalized_name}_${a.birth_year}_${a.gender}_${a.club_id}`, a);
  });

  // Paso 3: Construir resultados
  for (const r of params.records) {
    const club = resolveAdaelClub(r.clubCodeOrAlias, r.clubName, Array.from(clubsMap.values()));
    const normName = normalizeAthleteName(r.athleteName);
    const bYear = r.birthYear || (r.birthDate ? new Date(r.birthDate).getFullYear() : 2006);
    const athleteKey = `${normName}_${bYear}_${r.gender}_${club.id}`;
    const athlete = athleteLookup.get(athleteKey);

    if (!athlete) continue;

    const finalMs = parseTimeToMilliseconds(r.finalTime);
    const seedMs = r.seedTime ? parseTimeToMilliseconds(r.seedTime) : null;
    const finaPoints = calculateFinaPoints(r.eventCode, finalMs, r.gender);

    resultsToUpsert.push({
      meet_name: params.meetName,
      meet_date: params.meetDate,
      pool_course: params.poolCourse,
      athlete_id: athlete.id,
      club_id: club.id,
      event_code: r.eventCode,
      round: r.round || 'Timed Finals',
      seed_time_ms: seedMs,
      final_time_ms: finalMs,
      final_time_formatted: formatMillisecondsToTime(finalMs),
      splits: r.splits || null,
      fina_points: finaPoints,
      rank: r.rank || null,
      status: r.status || (finalMs > 0 ? 'OK' : 'DQ'),
    });
  }

  if (resultsToUpsert.length > 0) {
    await upsertAdaelResults2026(resultsToUpsert);
  }

  return {
    clubsProcessed: clubsMap.size,
    athletesProcessed: athletesToUpsert.length,
    resultsProcessed: resultsToUpsert.length,
  };
}

const STROKE_NAMES: Record<number, string> = {
  1: 'Libre',
  2: 'Espalda',
  3: 'Pecho',
  4: 'Mariposa',
  5: 'C.I.',
};

/**
 * Sincroniza un ParsedFile (de Hy-Tek, SDIF, PDF o HTML) directamente con el Módulo ADAEL 2026
 */
export async function syncFromParsedFileToAdael2026(
  parsed: ParsedFile,
  options?: {
    meetName?: string;
    meetDate?: string;
    poolCourse?: CourseType;
  }
): Promise<{
  clubsProcessed: number;
  athletesProcessed: number;
  resultsProcessed: number;
}> {
  const meetName = options?.meetName || parsed.meet?.name || 'I Estadal ADAEL 2026 (Piscinas Bolivarianas)';
  const meetDate = options?.meetDate || parsed.meet?.startDate || new Date().toISOString().slice(0, 10);
  const poolCourse: CourseType = options?.poolCourse || (parsed.meet?.course === 'SCM' ? 'SCM' : 'LCM');

  const teamLookup = new Map<string, { code: string; name: string }>();
  for (const t of parsed.teams || []) {
    teamLookup.set(t.code, { code: t.code, name: t.name || t.code });
  }

  const athMap = new Map(parsed.athletes.map((a) => [a.key, a]));
  const records: Parameters<typeof ingestOfficialAdaelBatch>[0]['records'] = [];

  for (const r of parsed.results || []) {
    const ath = athMap.get(r.athleteKey);
    if (!ath) continue;

    const teamInfo = teamLookup.get(ath.teamCode) || { code: ath.teamCode, name: ath.teamCode };
    const strokeName = STROKE_NAMES[r.stroke] || 'Libre';
    const eventCode = `${r.distance}m ${strokeName}`;
    const round: RoundType = r.round === 'P' ? 'Prelims' : r.round === 'S' ? 'Timed Finals' : 'Finals';

    const finalTimeStr = r.finalMs
      ? formatMillisecondsToTime(r.finalMs)
      : r.seedMs
      ? formatMillisecondsToTime(r.seedMs)
      : '';
    const seedTimeStr = r.seedMs ? formatMillisecondsToTime(r.seedMs) : undefined;

    const athleteFullName =
      ath.lastName && ath.firstName
        ? `${ath.lastName}, ${ath.firstName}`
        : ath.firstName || ath.lastName || 'Atleta ADAEL';
    const gender: GenderType = ath.gender === 'F' ? 'F' : 'M';
    const birthYear = ath.birthDate ? new Date(ath.birthDate).getFullYear() : 2006;

    const splits: SplitItem[] = (r.splits || []).map((s, idx) => ({
      distance_m: (idx + 1) * 50,
      split_time: formatMillisecondsToTime(s),
      split_ms: s,
    }));

    records.push({
      favedaId: ath.usmsId || undefined,
      athleteName: athleteFullName,
      gender,
      birthYear,
      birthDate: ath.birthDate || undefined,
      clubCodeOrAlias: teamInfo.code,
      clubName: teamInfo.name,
      isFederated: true,
      eventCode,
      round,
      seedTime: seedTimeStr,
      finalTime: finalTimeStr,
      splits: splits.length > 0 ? splits : undefined,
      rank: r.place || undefined,
      status: r.isDq ? 'DQ' : 'OK',
    });
  }

  // Atletas de entry list que no tengan resultados aún
  for (const ath of parsed.athletes || []) {
    const hasResult = records.some((rec) =>
      rec.athleteName.toUpperCase().includes(ath.lastName?.toUpperCase() || '')
    );
    if (!hasResult) {
      const teamInfo = teamLookup.get(ath.teamCode) || { code: ath.teamCode, name: ath.teamCode };
      const athleteFullName =
        ath.lastName && ath.firstName
          ? `${ath.lastName}, ${ath.firstName}`
          : ath.firstName || ath.lastName || 'Atleta ADAEL';
      records.push({
        favedaId: ath.usmsId || undefined,
        athleteName: athleteFullName,
        gender: ath.gender === 'F' ? 'F' : 'M',
        birthDate: ath.birthDate || undefined,
        birthYear: ath.birthDate ? new Date(ath.birthDate).getFullYear() : 2006,
        clubCodeOrAlias: teamInfo.code,
        clubName: teamInfo.name,
        isFederated: true,
        eventCode: '50m Libre',
        finalTime: '',
        status: 'NS',
      });
    }
  }

  return ingestOfficialAdaelBatch({
    meetName,
    meetDate,
    poolCourse,
    records,
  });
}

