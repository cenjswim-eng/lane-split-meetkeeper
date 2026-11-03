import type { ParsedFile } from "@/lib/hytek/types";
import { matchScore, HIGH_MATCH } from "@/lib/history-match";

export interface RosterAthlete { id: string; first_name: string; last_name: string; birth_date: string | null; gender: string | null; federation_id: string | null; tm_athlete_id: string | null }

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Converts an HTML results page (often Meet Manager <pre> text) into plain lines. */
export function htmlToLines(html: string): string[] {
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
    let best: { r: RosterAthlete; score: number } | null = null;
    for (const r of roster) {
      const { score } = matchScore(r, { id: a.key, first_name: a.firstName, last_name: a.lastName, birth_date: a.birthDate, gender: a.gender, federation_id: a.federationId });
      if (score >= HIGH_MATCH && (!best || score > best.score)) best = { r, score };
    }
    if (!best) return [];
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
  const src = html.match(/<frame[^>]+src=["']?([^"' >]*evtindex[^"' >]*)/i)?.[1];
  return src ? new URL(src, base).toString() : null;
}

export function meetEventPages(indexHtml: string, base: string): string[] {
  const links = [...indexHtml.matchAll(/href=["']?([^"' >#]+?([FPS])\d{3}\.html?)/gi)].map((m) => ({ href: m[1]!, kind: m[2]!.toUpperCase() }));
  const finals = links.filter((l) => l.kind === "F");
  return [...new Set((finals.length ? finals : links).map((l) => new URL(l.href, base).toString()))];
}

export function meetIndexInfo(html: string, indexHtml: string) {
  const title = (html.match(/<title>\s*(?:Meet Results:\s*)?([^<]+?)\s*<\/title>/i)?.[1] ?? indexHtml.match(/<h2[^>]*>(?:<[^>]+>)*\s*([^<]+?)\s*</i)?.[1] ?? null)?.replace(/&amp;/g, "&") ?? null;
  const d = indexHtml.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  // Spanish Meet Manager prints day/month; swap when the first number cannot be a month.
  const iso = (a: string, b: string, y: string) => { const [dd, mm] = +a > 12 || +b <= 12 ? [a, b] : [b, a]; return `${y}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`; };
  return { title, startDate: d ? iso(d[1]!, d[2]!, d[3]!) : null, endDate: d ? iso(d[4]!, d[5]!, d[6]!) : null };
}
