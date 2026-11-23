/**
 * Módulo ADAEL 2026 (Clubes, Fichaje y Resultados)
 * Tipos de dominio y estructuras de datos oficiales para el estado Lara (temporada 2026)
 */

export type AgeGroupAdael2026 =
  | 'Pre-Infantil'
  | 'Infantil A'
  | 'Infantil B'
  | 'Juvenil A'
  | 'Juvenil B'
  | 'Máxima'
  | 'Máster';

export type GenderType = 'M' | 'F';

export type CourseType = 'LCM' | 'SCM';

export type RoundType = 'Prelims' | 'Finals' | 'Timed Finals';

export type ResultStatus = 'OK' | 'DQ' | 'NS' | 'DNF' | 'EXH' | 'NT';

export interface AdaelClub2026 {
  id: string;
  club_code: string;
  club_name: string;
  aliases: string[];
  season: number;
  created_at?: string;
  updated_at?: string;
}

export interface AdaelAthlete2026 {
  id: string;
  faveda_adael_id: string | null;
  full_name: string;
  normalized_name: string;
  gender: GenderType;
  birth_date: string | null;
  birth_year: number;
  age_group_2026: AgeGroupAdael2026;
  club_id: string;
  is_federated: boolean;
  status: string;
  created_at?: string;
  updated_at?: string;
  // Joined or enriched
  club?: AdaelClub2026;
}

export interface SplitItem {
  distance_m: number;
  split_time: string;
  split_ms: number;
}

export interface AdaelResult2026 {
  id: string;
  meet_name: string;
  meet_date: string;
  pool_course: CourseType;
  athlete_id: string;
  club_id: string;
  event_code: string;
  round: RoundType;
  seed_time_ms: number | null;
  final_time_ms: number;
  final_time_formatted: string;
  splits: SplitItem[] | null;
  fina_points: number | null;
  rank: number | null;
  status: ResultStatus;
  created_at?: string;
  updated_at?: string;
  // Joined or enriched
  athlete?: AdaelAthlete2026;
  club?: AdaelClub2026;
}

/**
 * Catálogo base de clubes oficiales ADAEL 2026 con sus alias habituales
 */
export const DEFAULT_ADAEL_CLUBS_2026: Omit<AdaelClub2026, 'id' | 'created_at' | 'updated_at'>[] = [
  {
    club_code: 'JSWIM',
    club_name: 'Club Escuela JSwim Lara',
    aliases: ['C.E. JSWIM', 'JSWIM-LA', 'JSWIM', 'ESCUELA JSWIM', 'CLUB JSWIM'],
    season: 2026,
  },
  {
    club_code: 'HOCAL',
    club_name: 'Club Hogar Canario Larense',
    aliases: ['HOCALAR', 'HOGAR CANARIO', 'HOGAR CANARIO LARENSE', 'HOCAL', 'HCL'],
    season: 2026,
  },
  {
    club_code: 'ITALO',
    club_name: 'Club Italo Venezolano de Barquisimeto',
    aliases: ['ITALVEN', 'ITALO', 'CENTRO ITALO', 'CIVB', 'ITALO LARENSE', 'ITALO-LA'],
    season: 2026,
  },
  {
    club_code: 'POLI',
    club_name: 'Complejo de Piscinas Bolivarianas de Lara',
    aliases: ['POLIDEPORTIVO', 'PISBO', 'PIBOL', 'PISCINAS BOLIVARIANAS', 'POLI', 'BOLIVARIANAS'],
    season: 2026,
  },
  {
    club_code: 'LUSOL',
    club_name: 'Club Los Luises / Sol Larense',
    aliases: ['LUSOL', 'LOS LUISES', 'SOL LARENSE', 'LUSOL-LA'],
    season: 2026,
  },
  {
    club_code: 'BARQ',
    club_name: 'Club Barquisimeto',
    aliases: ['BARQ', 'CLUB BARQUISIMETO', 'BARQUISIMETO', 'BARQ-LA'],
    season: 2026,
  },
  {
    club_code: 'CDLARA',
    club_name: 'Club Deportivo Lara',
    aliases: ['CDLARA', 'DEPORTIVO LARA', 'DEP LARA', 'CDL'],
    season: 2026,
  },
  {
    club_code: 'AQUALARA',
    club_name: 'Club Aqualara',
    aliases: ['AQUALARA', 'AQUA LARA', 'AQUA-LA'],
    season: 2026,
  },
  {
    club_code: 'TRILARA',
    club_name: 'Club Triatlón Lara',
    aliases: ['TRILARA', 'TRIATLON LARA', 'TRI-LARA'],
    season: 2026,
  },
  {
    club_code: 'CSLAR',
    club_name: 'Centro Social Larense',
    aliases: ['CSLAR', 'CENTRO SOCIAL LARENSE', 'CSL', 'SOCIAL LARENSE'],
    season: 2026,
  },
  {
    club_code: 'PALM',
    club_name: 'Club Las Palmas Lara',
    aliases: ['PALM', 'LAS PALMAS', 'PALMAS'],
    season: 2026,
  },
  {
    club_code: 'TARL',
    club_name: 'Club Tarpones de Lara',
    aliases: ['TARL', 'TARPONES DE LARA', 'TARPONES'],
    season: 2026,
  },
  {
    club_code: 'CVM',
    club_name: 'Colegio de Médicos de Lara',
    aliases: ['CVM', 'MEDICOS', 'COL MED Lara', 'COLEGIO DE MEDICOS'],
    season: 2026,
  },
  {
    club_code: 'GATLA',
    club_name: 'Gatos de Lara',
    aliases: ['GATLA', 'GATOS DE LARA', 'GATOS'],
    season: 2026,
  },
  {
    club_code: 'CADIP',
    club_name: 'Club CADIP Lara',
    aliases: ['CADIP', 'CLUB CADIP'],
    season: 2026,
  },
  {
    club_code: 'CNCAR',
    club_name: 'Club Natación Carora',
    aliases: ['CNCAR', 'CARORA', 'NATACION CARORA'],
    season: 2026,
  },
  {
    club_code: 'CCTRY',
    club_name: 'Country Club Barquisimeto',
    aliases: ['CCTRY', 'COUNTRY CLUB', 'COUNTRY BARQUISIMETO'],
    season: 2026,
  },
  {
    club_code: 'CAQC',
    club_name: 'Club Aqua Center',
    aliases: ['CAQC', 'AQUA CENTER'],
    season: 2026,
  },
  {
    club_code: 'CIVLA',
    club_name: 'Colegio de Ingenieros de Lara',
    aliases: ['CIVLA', 'INGENIEROS LARA', 'CIV LARA'],
    season: 2026,
  },
  {
    club_code: 'DELFJ',
    club_name: 'Delfines de Javier',
    aliases: ['DELFJ', 'DELFINES DE JAVIER', 'DELFINES'],
    season: 2026,
  },
  {
    club_code: 'HUNLA',
    club_name: 'Club Humboldt Lara',
    aliases: ['HUNLA', 'HUMBOLDT', 'HUMBOLDT LARA'],
    season: 2026,
  },
  {
    club_code: 'YARA',
    club_name: 'Clubes Invitados Yaracuy',
    aliases: ['YARA', 'ASOCIACION YARACUY', 'YARACUY'],
    season: 2026,
  },
  {
    club_code: 'LARA',
    club_name: 'Selección de Natación del Estado Lara',
    aliases: ['LARA', 'SELECCION LARA', 'ASOCIACION LARA', 'ADAEL'],
    season: 2026,
  },
];
