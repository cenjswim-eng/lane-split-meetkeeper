import { athleteProgressSeries } from "./athlete-records";

interface ComparisonRecord {
  final_time_ms: number | null;
  is_dq: boolean;
  course: string | null;
  events: { distance: number; stroke: number; is_relay?: boolean } | null;
  meets: { start_date: string | null } | null;
}

export interface AthleteComparison {
  previous_ms: number;
  previous_date: string;
  /** Positive = faster; negative = slower. */
  improvement_ms: number;
}

/** Compare with the best swim on the latest earlier competition date, never guess same-day order. */
export function athleteComparisons<T extends ComparisonRecord>(records: T[], now = new Date()) {
  const comparisons = new Map<T, AthleteComparison>();
  const eligible = records.filter(r => r.course && !r.events?.is_relay);
  for (const group of athleteProgressSeries(eligible, now)) {
    let previous: { date: string; time: number } | undefined;
    let current: { date: string; time: number } | undefined;
    for (const record of group.records) {
      const date = record.meets?.start_date;
      const time = record.final_time_ms;
      if (!date || time == null) continue;
      if (current?.date !== date) {
        previous = current;
        current = { date, time };
      }
      if (previous) comparisons.set(record, {
        previous_ms: previous.time,
        previous_date: previous.date,
        improvement_ms: previous.time - time,
      });
      if (current) current.time = Math.min(current.time, time);
    }
  }
  return comparisons;
}

export function comparisonLabel(comparison: AthleteComparison | undefined) {
  if (!comparison) return "Sin registro anterior comparable";
  if (comparison.improvement_ms === 0) return "Sin cambio (0.00 s)";
  return `${comparison.improvement_ms > 0 ? "Mejoró" : "Empeoró"} ${(Math.abs(comparison.improvement_ms) / 1000).toFixed(2)} s`;
}