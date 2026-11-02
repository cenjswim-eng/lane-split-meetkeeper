/** Normalized representation of any Hy-Tek file (HY3, CL2, SD3). */
export interface ParsedSplit {
  distance: number;
  cumulative_ms: number;
}
export interface ParsedResult {
  athleteKey: string;
  eventNumber: string | null;
  distance: number;
  stroke: number;
  gender: string | null;
  minAge: number | null;
  maxAge: number | null;
  seedMs: number | null;
  finalMs: number | null;
  course: string | null;
  place: number | null;
  isDq: boolean;
  round: "P" | "F" | "S";
  splits: ParsedSplit[];
}
export interface ParsedAthlete {
  key: string;
  tmId: string | null;
  federationId: string | null;
  firstName: string;
  lastName: string;
  birthDate: string | null; // ISO yyyy-mm-dd
  gender: string | null;
  teamCode: string | null;
}
export interface ParsedTeam {
  code: string;
  name: string;
  lsc?: string | null;
}
export interface ParsedFile {
  format: "HY3" | "SDIF" | "MDB" | "PDF";
  meet: { name: string; location: string | null; startDate: string | null; endDate: string | null; course: string };
  teams: ParsedTeam[];
  athletes: ParsedAthlete[];
  results: ParsedResult[];
  warnings: string[];
}

export function mdyToIso(s: string): string | null {
  const t = s.trim();
  if (!/^\d{8}$/.test(t)) return null;
  const mm = t.slice(0, 2), dd = t.slice(2, 4), yy = t.slice(4, 8);
  const d = new Date(Date.UTC(Number(yy), Number(mm) - 1, Number(dd)));
  if (d.getUTCFullYear() !== Number(yy) || d.getUTCMonth() !== Number(mm) - 1 || d.getUTCDate() !== Number(dd)) return null;
  return `${yy}-${mm}-${dd}`;
}
export function courseFromCode(c: string | undefined, fallback = "LCM"): string {
  const x = (c ?? "").trim().toUpperCase();
  if (x === "L" || x === "3") return "LCM";
  if (x === "S" || x === "2") return "SCM";
  if (x === "Y" || x === "1") return "SCY";
  return fallback;
}
export const col = (line: string, start: number, end: number) => line.slice(start - 1, end).trim();
