import { ageAtDec31, ageGroup, parseTime } from "@/lib/swim";

export interface StandardScope {
  season_year?: number | null;
  age_min?: number | null;
  age_max?: number | null;
  age_group: string | null;
}

export function standardApplies(s: StandardScope, birth: string | null, year: number) {
  if (s.season_year != null && s.season_year !== year) return false;
  const age = ageAtDec31(birth, year);
  if (s.age_min != null || s.age_max != null) return age != null && (s.age_min == null || age >= s.age_min) && (s.age_max == null || age <= s.age_max);
  return !s.age_group || (age != null && s.age_group === ageGroup(age));
}

export interface StandardDraft {
  category: string;
  gender: string;
  distance: number;
  stroke: number;
  course: string;
  time: string;
  selected: boolean;
}

export function categoryBounds(category: string): { age_group: string | null; age_min: number | null; age_max: number | null } {
  const text = category.trim().toLowerCase();
  if (/^(todas|abierta|open|libre)$/.test(text)) return { age_group: null, age_min: null, age_max: null };
  const range = text.match(/^(\d{1,2})\s*(?:-|–|a)\s*(\d{1,2})(?:\s*años)?$/);
  if (range) {
    const age_min = Number(range[1]), age_max = Number(range[2]);
    if (age_min > age_max) throw new Error("El rango de categoría está invertido.");
    return { age_group: category.trim(), age_min, age_max };
  }
  const lower = text.match(/^(\d{1,2})\s*(?:\+|y mayores|y más)$/);
  if (lower) return { age_group: category.trim(), age_min: Number(lower[1]), age_max: null };
  const upper = text.match(/^(\d{1,2})\s*(?:y menor|y menores)$/);
  if (upper) return { age_group: category.trim(), age_min: null, age_max: Number(upper[1]) };
  if (/^\d{1,2}(?:\s*años)?$/.test(text)) {
    const age = parseInt(text, 10);
    return { age_group: category.trim(), age_min: age, age_max: age };
  }
  throw new Error("Indica edades para la categoría (por ejemplo 13-14, 15-17 o 18+).");
}

export function prepareStandardRows(drafts: StandardDraft[], year: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error("Indica un año válido.");
  const seen = new Set<string>();
  return drafts.filter(d => d.selected).map(d => {
    const time = d.time.trim().replace(",", ".");
    if (!/^\d+(?::[0-5]\d)?(?:\.\d{1,3})?$/.test(time)) throw new Error("Revisa los tiempos antes de guardar.");
    const qualifying_time_ms = parseTime(time);
    if (qualifying_time_ms == null || !Number.isInteger(d.distance) || d.distance <= 0 || ![1,2,3,4,5].includes(d.stroke) || !["LCM","SCM"].includes(d.course) || !["F","M",""].includes(d.gender)) throw new Error("Revisa sexo, prueba, piscina y tiempo antes de guardar.");
    const ages = categoryBounds(d.category);
    const row = { name: `Venezuela · Mínimas nacionales ${year}`, season_year: year, ...ages, gender: d.gender || null, distance: d.distance, stroke: d.stroke, course: d.course, qualifying_time_ms };
    const key = standardIdentity(row);
    if (seen.has(key)) throw new Error("Hay pruebas duplicadas en la revisión. Desmarca una de ellas.");
    seen.add(key);
    return row;
  });
}

export function standardIdentity(s: StandardScope & { gender: string | null; distance: number; stroke: number; course: string }) {
  return JSON.stringify([s.season_year, s.age_min, s.age_max, s.age_group, s.gender, s.distance, s.stroke, s.course]);
}