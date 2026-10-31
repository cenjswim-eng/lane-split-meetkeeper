export const STROKES: Record<number, string> = {
  1: "Libre",
  2: "Espalda",
  3: "Pecho",
  4: "Mariposa",
  5: "Combinado",
  6: "Relevo Libre",
  7: "Relevo CI",
};

export type Course = "LCM" | "SCM" | "SCY";

/** Parse "1:02.34", "62.34", "2:01:02.34" into ms. Returns null for NT/DQ/NS/SCR or invalid. */
export function parseTime(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const s = raw.trim().replace(/[A-Za-z]+$/, "");
  if (!s || !/\d/.test(s)) return null;
  const parts = s.split(":").map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return null;
  let secs = 0;
  for (const p of parts) secs = secs * 60 + p;
  if (secs <= 0) return null;
  return Math.round(secs * 1000);
}

export function formatTime(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const cs = Math.round(ms / 10);
  const m = Math.floor(cs / 6000);
  const s = Math.floor((cs % 6000) / 100);
  const c = cs % 100;
  const sc = `${String(s).padStart(m ? 2 : 1, "0")}.${String(c).padStart(2, "0")}`;
  return m ? `${m}:${sc}` : sc;
}

/** SDIF-style time "  1:02.34" or "    62.34" right-aligned in width */
export function sdifTime(ms: number | null | undefined, width = 8): string {
  return (ms == null ? "" : formatTime(ms)).padStart(width, " ");
}

/**
 * World Aquatics base times (ms), approximate 2024 values.
 * Key: `${course}-${gender}-${distance}-${stroke}`
 */
const BASE: Record<string, number> = {
  // LCM men
  "LCM-M-50-1": 20910, "LCM-M-100-1": 46400, "LCM-M-200-1": 102000, "LCM-M-400-1": 220070, "LCM-M-800-1": 452120, "LCM-M-1500-1": 870670,
  "LCM-M-50-2": 23550, "LCM-M-100-2": 51600, "LCM-M-200-2": 111920,
  "LCM-M-50-3": 25950, "LCM-M-100-3": 56880, "LCM-M-200-3": 125480,
  "LCM-M-50-4": 22270, "LCM-M-100-4": 49450, "LCM-M-200-4": 110730,
  "LCM-M-200-5": 114000, "LCM-M-400-5": 243840,
  // LCM women
  "LCM-F-50-1": 23610, "LCM-F-100-1": 51710, "LCM-F-200-1": 112980, "LCM-F-400-1": 235380, "LCM-F-800-1": 484790, "LCM-F-1500-1": 920480,
  "LCM-F-50-2": 26860, "LCM-F-100-2": 57330, "LCM-F-200-2": 123140,
  "LCM-F-50-3": 29160, "LCM-F-100-3": 64130, "LCM-F-200-3": 137550,
  "LCM-F-50-4": 24430, "LCM-F-100-4": 55480, "LCM-F-200-4": 121810,
  "LCM-F-200-5": 126120, "LCM-F-400-5": 264140,
  // SCM men
  "SCM-M-50-1": 19900, "SCM-M-100-1": 44840, "SCM-M-200-1": 99370, "SCM-M-400-1": 212250, "SCM-M-800-1": 440460, "SCM-M-1500-1": 846880,
  "SCM-M-50-2": 22110, "SCM-M-100-2": 48330, "SCM-M-200-2": 105630,
  "SCM-M-50-3": 24950, "SCM-M-100-3": 55280, "SCM-M-200-3": 120160,
  "SCM-M-50-4": 21320, "SCM-M-100-4": 47710, "SCM-M-200-4": 108240,
  "SCM-M-100-5": 49280, "SCM-M-200-5": 108880, "SCM-M-400-5": 234810,
  // SCM women
  "SCM-F-50-1": 22830, "SCM-F-100-1": 50250, "SCM-F-200-1": 109360, "SCM-F-400-1": 230250, "SCM-F-800-1": 473910, "SCM-F-1500-1": 908240,
  "SCM-F-50-2": 25230, "SCM-F-100-2": 54020, "SCM-F-200-2": 118940,
  "SCM-F-50-3": 28370, "SCM-F-100-3": 62360, "SCM-F-200-3": 134570,
  "SCM-F-50-4": 23940, "SCM-F-100-4": 52710, "SCM-F-200-4": 119610,
  "SCM-F-100-5": 55110, "SCM-F-200-5": 121860, "SCM-F-400-5": 255480,
};

export function aquaPoints(ms: number | null, course: string, gender: string | null, distance: number, stroke: number): number | null {
  if (!ms || !gender || (gender !== "M" && gender !== "F")) return null;
  const base = BASE[`${course === "SCY" ? "SCM" : course}-${gender}-${distance}-${stroke}`];
  if (!base) return null;
  return Math.round(1000 * Math.pow(base / ms, 3));
}

export function ageAt(birth: string | null, at: Date = new Date()): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  let a = at.getFullYear() - b.getFullYear();
  const m = at.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < b.getDate())) a--;
  return a;
}

/** Age on December 31 of the given year — the category rule used by federations. */
export function ageAtDec31(birth: string | null, year: number): number | null {
  if (!birth) return null;
  const y = new Date(`${birth}T00:00:00`).getFullYear();
  if (Number.isNaN(y)) return null;
  return year - y;
}

export function ageGroup(age: number | null): string {
  if (age == null) return "—";
  if (age <= 8) return "8 y menor";
  if (age <= 10) return "9-10";
  if (age <= 12) return "11-12";
  if (age <= 14) return "13-14";
  if (age <= 17) return "15-17";
  return "18+";
}

export function eventLabel(distance: number, stroke: number) {
  return `${distance} ${STROKES[stroke] ?? stroke}`;
}
