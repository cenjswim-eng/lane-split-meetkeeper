// Pure fuzzy matching of athlete identities for the history transfer tool.
export interface MatchPerson {
  id: string;
  first_name: string;
  last_name: string;
  birth_date: string | null;
  gender: string | null;
  federation_id: string | null;
}

export const nameTokens = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function lev(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!; d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = d[j]!;
      d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return d[b.length]!;
}
const sim = (a: string, b: string) => (a === b ? 1 : 1 - lev(a, b) / Math.max(a.length, b.length, 1));

/** Order-independent name similarity 0..1; initials match tokens starting with that letter. */
export function nameSimilarity(a: string, b: string): number {
  const ta = nameTokens(a), tb = nameTokens(b);
  const [short, long] = ta.length <= tb.length ? [ta, tb] : [tb, ta];
  const full = short.filter((t) => t.length > 1);
  if (!full.length) return 0;
  let total = 0;
  for (const t of full) total += Math.max(0, ...long.filter((x) => x.length > 1).map((x) => sim(t, x)));
  return total / full.length;
}

const idKey = (s: string | null) => (s ?? "").replace(/[^0-9a-z]/gi, "").toLowerCase();

/** Returns a percentage 0..100, or 0 when a hard identity field conflicts. */
export function matchScore(target: MatchPerson, cand: MatchPerson): { score: number; conflict: string | null } {
  const tf = idKey(target.federation_id), cf = idKey(cand.federation_id);
  if (tf && cf && tf !== cf) return { score: 0, conflict: "ID distinto" };
  if (target.birth_date && cand.birth_date && target.birth_date !== cand.birth_date) return { score: 0, conflict: "Fecha de nacimiento distinta" };
  if (target.gender && cand.gender && target.gender !== cand.gender) return { score: 0, conflict: "Sexo distinto" };
  const name = nameSimilarity(`${target.first_name} ${target.last_name}`, `${cand.first_name} ${cand.last_name}`);
  let score = name * 80;
  if (tf && tf === cf) score += 20;
  if (target.birth_date && target.birth_date === cand.birth_date) score += 15;
  if (target.gender && target.gender === cand.gender) score += 5;
  return { score: Math.min(100, Math.round(score)), conflict: null };
}

export const HIGH_MATCH = 85;
export const MIN_MATCH = 60;
