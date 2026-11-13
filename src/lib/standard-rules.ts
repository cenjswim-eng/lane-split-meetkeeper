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

export interface SwimCategory { name: string; label: string; age_min: number | null; age_max: number | null }

export function categoryLabel(name: string, age_min: number | null, age_max: number | null) {
  const n = name.trim();
  if (age_min != null && age_max != null) return age_min === age_max ? `${n} (${age_min} años)` : `${n} (${age_min}-${age_max} años)`;
  if (age_min != null) return `${n} (${age_min} años y +)`;
  return `${n} (hasta ${age_max} años)`;
}

/** Validates an account's category list: names unique, ages within 0-120, min <= max. */
export function validateCategories(list: { name: string; age_min: number | null; age_max: number | null }[]): SwimCategory[] {
  const seen = new Set<string>();
  return list.map((c) => {
    const name = c.name.trim();
    if (!name) throw new Error("Cada categoría necesita un nombre.");
    if (seen.has(name.toLowerCase())) throw new Error(`La categoría «${name}» está repetida.`);
    seen.add(name.toLowerCase());
    for (const a of [c.age_min, c.age_max]) if (a != null && (!Number.isInteger(a) || a < 0 || a > 120)) throw new Error(`Revisa las edades de «${name}».`);
    if (c.age_min == null && c.age_max == null) throw new Error(`Indica al menos una edad para «${name}».`);
    if (c.age_min != null && c.age_max != null && c.age_min > c.age_max) throw new Error(`En «${name}» la edad mínima es mayor que la máxima.`);
    return { name, label: categoryLabel(name, c.age_min, c.age_max), age_min: c.age_min, age_max: c.age_max };
  });
}

export const SWIM_CATEGORIES: readonly SwimCategory[] = [
  { name: "Pre-Infantil", label: "Pre-Infantil (hasta 9 años)", age_min: 0, age_max: 9 },
  { name: "Infantil A", label: "Infantil A (10-11 años)", age_min: 10, age_max: 11 },
  { name: "Infantil B", label: "Infantil B (12-13 años)", age_min: 12, age_max: 13 },
  { name: "Juvenil A", label: "Juvenil A (14-15 años)", age_min: 14, age_max: 15 },
  { name: "Juvenil B", label: "Juvenil B (16-18 años)", age_min: 16, age_max: 18 },
  { name: "Máxima", label: "Máxima (19 años y +)", age_min: 19, age_max: null },
];

const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();

export function categoryBounds(category: string, categories: readonly SwimCategory[] = SWIM_CATEGORIES): { age_group: string | null; age_min: number | null; age_max: number | null } {
  const text = category.trim().toLowerCase();
  const named = [...categories].sort((a, b) => b.name.length - a.name.length).find(c => fold(category).startsWith(fold(c.name)));
  if (named) return { age_group: named.label, age_min: named.age_min, age_max: named.age_max };
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

export function prepareStandardRows(drafts: StandardDraft[], year: number, categories: readonly SwimCategory[] = SWIM_CATEGORIES) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) throw new Error("Indica un año válido.");
  const seen = new Set<string>();
  return drafts.filter(d => d.selected).map(d => {
    const time = d.time.trim().replace(",", ".");
    if (!/^\d+(?::[0-5]\d)?(?:\.\d{1,3})?$/.test(time)) throw new Error("Revisa los tiempos antes de guardar.");
    const qualifying_time_ms = parseTime(time);
    if (qualifying_time_ms == null || !Number.isInteger(d.distance) || d.distance <= 0 || ![1,2,3,4,5].includes(d.stroke) || !["LCM","SCM"].includes(d.course) || !["F","M",""].includes(d.gender)) throw new Error("Revisa sexo, prueba, piscina y tiempo antes de guardar.");
    const ages = categoryBounds(d.category, categories);
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
export interface QualificationResult {
  athlete_id: string;
  final_time_ms: number | null;
  is_dq: boolean;
  course: string | null;
  meets: { name: string; start_date: string | null } | null;
  events: { distance: number; stroke: number; is_relay: boolean } | null;
  athletes: { first_name: string; last_name: string; gender: string | null; birth_date: string | null } | null;
}
export interface QualificationStandard extends StandardScope { id: string; gender: string | null; distance: number; stroke: number; course: string; qualifying_time_ms: number }

/** Best valid swim per athlete/event/course in the season year, compared with the applicable standard for that year. */
export function qualificationReport(standards: QualificationStandard[], results: QualificationResult[], year: number) {
  const best = new Map<string, QualificationResult>();
  for (const r of results) {
    if (r.is_dq || r.final_time_ms == null || !r.events || r.events.is_relay || !r.athletes || !r.course) continue;
    if (Number(r.meets?.start_date?.slice(0, 4)) !== year) continue;
    const key = `${r.athlete_id}|${r.events.distance}|${r.events.stroke}|${r.course}`;
    const prev = best.get(key);
    if (!prev || r.final_time_ms < prev.final_time_ms!) best.set(key, r);
  }
  const rows = [];
  for (const r of best.values()) {
    const a = r.athletes!, e = r.events!;
    const applicable = standards.filter(s => s.season_year === year && s.distance === e.distance && s.stroke === e.stroke && s.course === r.course && (!s.gender || s.gender === a.gender) && standardApplies(s, a.birth_date, year));
    if (!applicable.length) continue;
    const std = applicable.reduce((x, y) => (y.qualifying_time_ms < x.qualifying_time_ms ? y : x));
    rows.push({ athlete_id: r.athlete_id, name: `${a.last_name}, ${a.first_name}`, gender: a.gender, category: std.age_group, distance: e.distance, stroke: e.stroke, course: r.course!, time_ms: r.final_time_ms!, limit_ms: std.qualifying_time_ms, diff_ms: r.final_time_ms! - std.qualifying_time_ms, met: r.final_time_ms! <= std.qualifying_time_ms, meet: r.meets?.name ?? "" });
  }
  return rows.sort((x, y) => Number(y.met) - Number(x.met) || x.name.localeCompare(y.name) || x.distance - y.distance || x.stroke - y.stroke);
}
