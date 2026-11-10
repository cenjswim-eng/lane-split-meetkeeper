import { SWIM_CATEGORIES, type StandardDraft, type SwimCategory } from "./standard-rules";

const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const timePattern = /(?:\d{1,2}:)?\d{1,2}[.,]\d{2,3}/g;
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
    const times = [...line.matchAll(timePattern)].map(m => m[0].replace(",", "."));
    if (!times.length) { warnings.push(`Fila sin tiempo legible: ${line.trim()}`); continue; }
    const labels = columns.length ? columns : category ? [category] : [];
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