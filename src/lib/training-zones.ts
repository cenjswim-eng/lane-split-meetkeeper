import { rankedAthleteRecords } from "./athlete-records";

// Local planning labels, not a universal mapping to Olbrecht's four qualities.
export const TRAINING_ZONES = ["R1", "R2", "VO2 Max", "Anaeróbico 1", "Anaeróbico 2"] as const;
export type TrainingZone = typeof TRAINING_ZONES[number];
export interface ZoneSpeedRange { minPercent: number; maxPercent: number }
export interface TrainingReference {
  id: string;
  final_time_ms: number | null;
  is_dq: boolean;
  course: string | null;
  meets: { name: string; start_date: string | null } | null;
  events: { distance: number; stroke: number } | null;
}

export function trainingReferences<T extends TrainingReference>(records: T[], now = new Date()): T[] {
  const seen = new Set<string>();
  return rankedAthleteRecords(records, now).filter((record) => {
    if (!record.events || record.events.stroke < 1 || record.events.stroke > 5 || record.events.distance <= 0 || !["LCM", "SCM"].includes(record.course ?? "")) return false;
    const key = `${record.events.distance}-${record.events.stroke}-${record.course}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Arithmetic only: coach-calibrated percent of reference SPEED, never percent of time.
 * No physiological zone thresholds can be inferred here from race results alone.
 * Distances use constant pace, not predicted race performances or prescribed sets.
 */
export function trainingTimeRange(referenceMs: number, referenceDistance: number, targetDistance: number, range: ZoneSpeedRange) {
  const { minPercent, maxPercent } = range;
  if (![referenceMs, referenceDistance, targetDistance, minPercent, maxPercent].every((n) => Number.isFinite(n) && n > 0) || minPercent > maxPercent) return null;
  const base = referenceMs * targetDistance / referenceDistance;
  const fastMs = Math.round(base * 100 / maxPercent);
  const slowMs = Math.round(base * 100 / minPercent);
  if (!Number.isSafeInteger(fastMs) || !Number.isSafeInteger(slowMs) || fastMs <= 0) return null;
  return { fastMs, slowMs };
}