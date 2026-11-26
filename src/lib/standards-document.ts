import { SWIM_CATEGORIES, type StandardDraft, type SwimCategory } from "./standard-rules";

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const timePattern = /(?:\d{1,2}[:.](?=\d{2}[.,]\d{2}))?\d{1,2}[.,]\d{2,3}/g;
const styles: [RegExp, number][] = [[/combinado|medley|\bci\b|\bim\b/,5],[/libre|free/,1],[/espalda|back/,2],[/pecho|breast/,3],[/mariposa|butterfly|\bfly\b/,4]];

/** Conservative local table reader: only map times when column context is explicit. */
export function parseStandardsDocument(lines: string[], course: string, categories: readonly SwimCategory[] = SWIM_CATEGORIES) {
  let gender = "?", category = "";
  let columns: string[] = [];
  const rows: StandardDraft[] = [], warnings: string[] = [];
  for (const line of lines) {
    const text = fold(line);
    const female = /femenin|female|women|damas/.test(text), male = /masculin|\bmale\b|\bmen\b|varones/.test(text);
    if (female !== male) gender = female ? "F" : "M";
    const named = categories.filter(c => text.includes(fold(c.name))).sort((a,b) => text.indexOf(fold(a.name))-text.indexOf(fold(b.name)));
    if (named.length > 1) columns = named.map(c => c.label);
    else if (named.length === 1) { category = named[0]?.label ?? ""; columns = []; }
    const distance = line.match(/\b(25|50|100|200|400|800|1500)\b/)?.[1];
    const stroke = styles.find(([re]) => re.test(text))?.[1];
    if (!distance || !stroke) continue;
    const times = [...line.matchAll(timePattern)].map(m => normalizeTime(m[0]));
    if (!times.length) { warnings.push(`Fila sin tiempo legible: ${line.trim()}`); continue; }
    const labels = columns.length ? columns : category ? [category] : [];
    if (labels.length === times.length / 2 || (!labels.length && times.length % 2 === 0)) {
      // Tabla venezolana: pares Femenino/Masculino por categoría; filas cortas omiten las categorías menores.
      const pairs = times.length / 2;
      const cols = labels.length === pairs ? labels : [...categories].sort((a, b) => (a.age_min ?? 0) - (b.age_min ?? 0)).map(c => c.label).slice(-pairs);
      if (cols.length === pairs) {
        cols.forEach((label, i) => {
          rows.push({ category: label, gender: "F", distance: Number(distance), stroke, course, time: times[i * 2]!, selected: true });
          rows.push({ category: label, gender: "M", distance: Number(distance), stroke, course, time: times[i * 2 + 1]!, selected: true });
        });
        continue;
      }
    }
    if (gender === "?" || labels.length !== times.length) {
      warnings.push(`No se asignó automáticamente esta fila: ${line.trim()}. Revisa sexo y columnas.`);
      continue;
    }
    times.forEach((time, i) => {
      const label = labels[i];
      if (label) rows.push({ category: label, gender, distance: Number(distance), stroke, course, time, selected: true });
    });
  }
  return { rows, warnings };
}
/** "1.18.77" → "1:18.77"; "35,79" → "35.79". */
function normalizeTime(raw: string) {
  const t = raw.replace(/,/g, ".");
  const m = t.match(/^(\d{1,2})[:.](\d{2}\.\d{2,3})$/);
  return m ? `${m[1]}:${m[2]}` : t;
}
