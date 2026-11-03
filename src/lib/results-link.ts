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
