/** Relay lineup optimizer. Pure functions so they stay testable without the database. */

export interface RelayCandidate {
  id: string;
  name: string;
  /** Best time in ms per stroke code (1 libre, 2 espalda, 3 pecho, 4 mariposa). */
  best: Partial<Record<number, number>>;
}

export interface RelayLeg {
  stroke: number;
  athleteId: string;
  name: string;
  ms: number;
}

export interface RelayTeam {
  legs: RelayLeg[];
  totalMs: number;
}

/** Free relay: the N fastest swimmers in freestyle (stroke 1). */
export function bestFreeRelay(candidates: RelayCandidate[], size = 4): RelayTeam | null {
  const ok = candidates.filter((c) => c.best[1] != null).sort((a, b) => a.best[1]! - b.best[1]!);
  if (ok.length < size) return null;
  const legs = ok.slice(0, size).map((c) => ({ stroke: 1, athleteId: c.id, name: c.name, ms: c.best[1]! }));
  return { legs, totalMs: legs.reduce((s, l) => s + l.ms, 0) };
}

/** Medley order: espalda, pecho, mariposa, libre. */
export const MEDLEY_ORDER = [2, 3, 4, 1] as const;

/** Medley relay: assign 4 distinct swimmers to back/breast/fly/free minimizing total time. */
export function bestMedleyRelay(candidates: RelayCandidate[]): RelayTeam | null {
  // Keep the 8 fastest per stroke to bound the search space.
  const pool = new Map<string, RelayCandidate>();
  for (const s of MEDLEY_ORDER) {
    candidates
      .filter((c) => c.best[s] != null)
      .sort((a, b) => a.best[s]! - b.best[s]!)
      .slice(0, 8)
      .forEach((c) => pool.set(c.id, c));
  }
  const list = [...pool.values()];
  let best: RelayTeam | null = null;
  for (const a of list) {
    if (a.best[2] == null) continue;
    for (const b of list) {
      if (b.id === a.id || b.best[3] == null) continue;
      for (const c of list) {
        if (c.id === a.id || c.id === b.id || c.best[4] == null) continue;
        for (const d of list) {
          if (d.id === a.id || d.id === b.id || d.id === c.id || d.best[1] == null) continue;
          const legs: RelayLeg[] = [
            { stroke: 2, athleteId: a.id, name: a.name, ms: a.best[2]! },
            { stroke: 3, athleteId: b.id, name: b.name, ms: b.best[3]! },
            { stroke: 4, athleteId: c.id, name: c.name, ms: c.best[4]! },
            { stroke: 1, athleteId: d.id, name: d.name, ms: d.best[1]! },
          ];
          const totalMs = legs.reduce((s, l) => s + l.ms, 0);
          if (!best || totalMs < best.totalMs) best = { legs, totalMs };
        }
      }
    }
  }
  return best;
}

/** Builds candidates from flat result rows: best (minimum) time per athlete per stroke. */
export function candidatesFromResults(
  rows: { athlete_id: string; name: string; stroke: number; final_time_ms: number | null; is_dq: boolean | null }[],
): RelayCandidate[] {
  const map = new Map<string, RelayCandidate>();
  for (const r of rows) {
    if (!r.final_time_ms || r.is_dq) continue;
    let c = map.get(r.athlete_id);
    if (!c) {
      c = { id: r.athlete_id, name: r.name, best: {} };
      map.set(r.athlete_id, c);
    }
    const cur = c.best[r.stroke];
    if (cur == null || r.final_time_ms < cur) c.best[r.stroke] = r.final_time_ms;
  }
  return [...map.values()];
}
