/**
 * TypeScript Schema Definitions for ADAEL 2026 Ranking Module
 * Database tables: adael_clubs, meets_2026, official_results_2026
 */

export type CourseType2026 = 'LCM' | 'SCM';
export type StrokeCode2026 = 'FREE' | 'BACK' | 'BREAST' | 'FLY' | 'IM';
export type ResultStatus2026 = 'OK' | 'DQ' | 'DNS' | 'DNF' | 'SCR' | 'NS';
export type RoundCode2026 = 'F' | 'P' | 'S';

export interface AdaelClubRecord {
  id?: string;
  code: string;               // Código Hy-Tek (ej. 'PISBO', 'HISP', 'BARQ')
  name: string;               // Nombre completo oficial
  isFederated2026: boolean;   // Estatus federado 2026
  association: string;        // 'LARA'
  createdAt?: string;
  updatedAt?: string;
}

export interface Meet2026Record {
  id?: string;
  name: string;               // Nombre del torneo
  startDate: string;          // Fecha de inicio (ISO 'YYYY-MM-DD', strictly 2026)
  endDate?: string | null;    // Fecha de culminación
  course: CourseType2026;     // 'LCM' (50m) o 'SCM' (25m)
  location?: string | null;   // Sede oficial (ej. 'Piscinas Bolivarianas, Barquisimeto')
  fileHash?: string | null;
  sourceFilename?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface OfficialResult2026Record {
  id?: string;
  meetId?: string;
  swimmerName: string;        // Atleta ("Apellidos, Nombres")
  federationId?: string | null; // ID federativo o Cédula
  birthDate: string;          // Fecha de nacimiento (ISO 'YYYY-MM-DD')
  gender: 'M' | 'F' | 'X';    // Género
  clubCode: string;           // Código Hy-Tek del club afiliado
  distance: number;           // 25, 50, 100, 200, 400, 800, 1500
  stroke: StrokeCode2026;     // 'FREE', 'BACK', 'BREAST', 'FLY', 'IM'
  course: CourseType2026;     // 'LCM' o 'SCM'
  timeMs: number | null;      // Tiempo final en milisegundos (null si DQ/DNS)
  status: ResultStatus2026;   // 'OK', 'DQ', 'DNS', 'DNF', 'SCR'
  isRelayLeadOff: boolean;    // true si es 1er relevista válido (F3+G1)
  waPoints?: number | null;   // Puntos World Aquatics (AQUA Points)
  round?: RoundCode2026;      // 'F', 'P', 'S'
  eventNumber?: string | null;
  createdAt?: string;
}

export interface AdaelIngestPayload {
  meet: {
    name: string;
    startDate: string;
    endDate?: string | null;
    course: CourseType2026;
    location?: string | null;
    fileHash?: string | null;
    fileName?: string | null;
  };
  clubs: {
    code: string;
    name: string;
    isFederated?: boolean;
    association?: string;
  }[];
  results: {
    swimmerName: string;
    federationId?: string | null;
    birthDate: string;
    gender: 'M' | 'F' | 'X';
    clubCode: string;
    distance: number;
    stroke: StrokeCode2026;
    timeMs: number | null;
    status: ResultStatus2026;
    isRelayLeadOff: boolean;
    waPoints?: number | null;
    round?: RoundCode2026;
    eventNumber?: string | null;
  }[];
}

export interface AdaelIngestResult {
  meetId: string;
  meetName: string;
  course: CourseType2026;
  startDate: string;
  totalSwimmers: number;
  individualResults: number;
  relayLeadOffs: number;
  totalResultsIngested: number;
  fileName?: string;
}

export interface BatchUploadFileSummary {
  fileName: string;
  format: 'HY3' | 'SD3' | 'ZIP';
  meetName: string;
  startDate: string;
  course: CourseType2026;
  location?: string | null;
  clubsDetected: number;
  athletesDetected: number;
  individualResults: number;
  relayLeadOffs: number;
  status: 'PENDING' | 'INGESTED' | 'DUPLICATE_UPDATED' | 'ERROR';
  errorMessage?: string;
}

export interface BatchUploadReport {
  totalFiles: number;
  successfulFiles: number;
  failedFiles: number;
  totalMeetsProcessed: number;
  totalResultsIngested: number;
  totalRelayLeadOffs: number;
  fileSummaries: BatchUploadFileSummary[];
}
