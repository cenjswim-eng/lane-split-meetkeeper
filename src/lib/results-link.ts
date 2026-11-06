import type { ParsedFile } from "@/lib/hytek/types";
import { matchScore, HIGH_MATCH, nameSimilarity, nameTokens } from "@/lib/history-match";

export interface RosterAthlete { id: string; first_name: string; last_name: string; birth_date: string | null; gender: string | null; federation_id: string | null; tm_athlete_id: string | null }

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Converts an HTML results page (often Meet Manager <pre> text) into plain lines. */
export function htmlToLines(html: string): string[] {
  // Modern Meet Manager wrappers publish separate cells, including a difference
  // column. Rebuild canonical result lines using labelled columns, not positions.
  const heading = html.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i)?.[1];
  if (heading && /(?:event|evento|prueba)\s+\d/i.test(heading) && /<th\b/i.test(html)) {
    const plain = (s: string) => htmlToLines(s).join(" ").trim();
    const normalized = (s: string) => plain(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const rebuilt: string[] = [plain(heading)];
    for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
      const headers = [...(table[1] ?? "").matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m => normalized(m[1] ?? ""));
      const name = headers.findIndex(h => /nombre|name/.test(h));
      const team = headers.findIndex(h => /club|team|equipo/.test(h));
      const final = headers.findIndex(h => /oficial|final|result/.test(h));
      const seed = headers.findIndex(h => /insc|seed|entry/.test(h));
      const age = headers.findIndex(h => /edad|age/.test(h));
      const place = headers.findIndex(h => /lugar|place|pos/.test(h));
      if (name < 0 || team < 0 || final < 0) continue;
      for (const row of (table[1] ?? "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const cells = [...(row[1] ?? "").matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => plain(m[1] ?? ""));
        if (!cells[name] || !cells[final]) continue;
        rebuilt.push(` ${cells[place] ?? "--"} ${cells[name]}  ${cells[age] || "FR"} ${cells[team] || "SIN-CLUB"}  ${cells[seed] || "NT"}  ${cells[final]}`);
      }
    }
    if (rebuilt.length > 1) return rebuilt;
  }
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d|pre|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|[a-z]+);/gi, (m, e: string) => e[0] === "#" ? String.fromCharCode(+e.slice(1)) : ENTITIES[e.toLowerCase()] ?? m);
  return text.split(/\r?\n/).map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim());
}

/** Spanish Meet Manager pages print times with decimal commas (1:29,14). */
export const commaTimes = (l: string) => l.replace(/(\d),(\d{2})(?!\d)/g, "$1.$2");

/** Keeps only swims of athletes registered in the roster, adopting the roster identity so imports land on the existing profile. */
export function filterToRoster(parsed: ParsedFile, roster: RosterAthlete[]) {
  const matched = new Map<string, RosterAthlete>();
  const athletes = parsed.athletes.flatMap((a) => {
    let best: { r: RosterAthlete; score: number } | null = null, ambiguous = false;
    for (const r of roster) {
      const { score, conflict } = matchScore(r, { id: a.key, first_name: a.firstName, last_name: a.lastName, birth_date: a.birthDate, gender: a.gender, federation_id: a.federationId });
      if (conflict) continue;
      const final = Math.max(score, truncatedScore(r, a));
      if (final >= HIGH_MATCH && (!best || final > best.score)) { best = { r, score: final }; ambiguous = false; }
      else if (best && final >= HIGH_MATCH && final === best.score) ambiguous = true;
    }
    if (!best || ambiguous) return [];
    matched.set(a.key, best.r);
    return [{ ...a, tmId: best.r.tm_athlete_id, federationId: best.r.federation_id, firstName: best.r.first_name, lastName: best.r.last_name, birthDate: best.r.birth_date, gender: best.r.gender ?? a.gender }];
  });
  const results = parsed.results.filter((r) => matched.has(r.athleteKey));
  const found = new Set([...matched.values()].map((r) => r.id)).size;
  const out: ParsedFile = { ...parsed, athletes, results, teams: parsed.teams.filter((t) => athletes.some((a) => a.teamCode === t.code)), warnings: parsed.warnings.filter((w) => !/fecha de nacimiento/.test(w)) };
  return { parsed: out, found, names: [...new Set([...matched.values()].map((r) => `${r.first_name} ${r.last_name}`))] };
}

/** Meet Manager web results: a frameset whose index frame links one page per event (e.g. 260813F001.htm). */
export function indexFrameUrl(html: string, base: string): string | null {
  const src = html.match(/<(?:i?frame)[^>]+src=["']?([^"' >]*evtindex[^"' >]*)/i)?.[1]
    ?? html.match(/href=["']([^"']*(?:evtindex|index)\.html?(?:\?[^"']*)?)["']/i)?.[1];
  if (!src) return null;
  const url = new URL(src.replace(/&amp;/g, "&"), base).toString();
  return url === base ? null : url;
}

export function meetEventPages(indexHtml: string, base: string): string[] {
  const links = [...indexHtml.matchAll(/href=["']?([^"' >#]+?([FPS])\d{3,4}\.html?(?:\?[^"' >#]*)?)/gi)];
  return [...new Set(links.flatMap(m => m[1] ? [new URL(m[1].replace(/&amp;/g, "&"), base).toString()] : []))];
}

export function meetIndexInfo(html: string, indexHtml: string) {
  const title = (html.match(/<title>\s*(?:Meet Results:\s*)?([^<]+?)\s*<\/title>/i)?.[1] ?? indexHtml.match(/<h2[^>]*>(?:<[^>]+>)*\s*([^<]+?)\s*</i)?.[1] ?? null)?.replace(/&amp;/g, "&") ?? null;
  const spanish = /lang=["']es|jornada|jueves|viernes|sabado|sábado|campeonato|masculino|femenino/i.test(html + indexHtml);
  const dates = [...htmlToLines(indexHtml).join("\n").matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)].flatMap(d => {
    const a = d[1], b = d[2], y = d[3];
    if (!a || !b || !y) return [];
    const [dd, mm] = spanish || +a > 12 ? [a,b] : [b,a];
    const value = `${y}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
    const dt = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(dt.valueOf()) && dt.toISOString().slice(0,10) === value ? [value] : [];
  }).sort();
  return { title, startDate: dates[0] ?? null, endDate: dates.at(-1) ?? null };
}

/** Meet Manager pages cut long names ("Colmenarez, Val"): accept a first-name prefix when the surname matches and no identity field conflicts. */
function truncatedScore(r: RosterAthlete, a: { firstName: string; lastName: string; gender: string | null; birthDate: string | null }) {
  if (a.gender && r.gender && a.gender !== r.gender) return 0;
  if (a.birthDate && r.birth_date && a.birthDate !== r.birth_date) return 0;
  if (nameSimilarity(a.lastName, r.last_name) < 0.9 && nameSimilarity(a.lastName, `${r.last_name} ${r.first_name}`) < 0.9) return 0;
  const first = nameTokens(a.firstName).filter((t) => t.length >= 3);
  const rosterTokens = nameTokens(`${r.first_name} ${r.last_name}`);
  if (!first.length || !first.every((t) => rosterTokens.some((x) => x.startsWith(t)))) return 0;
  return HIGH_MATCH;
}
