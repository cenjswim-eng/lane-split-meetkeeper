/** Calendar-month window, inclusive, clamped to the last day of the target month. */
export function athleteRecordWindow(now: Date) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const cutoff = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 9, 1));
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(today.getUTCDate(), lastDay));
  return { from: cutoff.toISOString().slice(0, 10), to: today.toISOString().slice(0, 10) };
}

interface TimedRecord {
  final_time_ms: number | null;
  is_dq: boolean;
  meets: { start_date: string | null } | null;
}

/** Only completed, dated swims in the last nine calendar months, fastest first. */
export function rankedAthleteRecords<T extends TimedRecord>(records: T[], now = new Date()): T[] {
  const { from, to } = athleteRecordWindow(now);
  return records.filter((record) => {
    const date = record.meets?.start_date;
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
    const parsed = new Date(`${date}T00:00:00Z`);
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) return false;
    return date >= from && date <= to && !record.is_dq && record.final_time_ms != null && Number.isFinite(record.final_time_ms) && record.final_time_ms > 0;
  }).sort((a, b) => (a.final_time_ms ?? Infinity) - (b.final_time_ms ?? Infinity) || (b.meets?.start_date ?? "").localeCompare(a.meets?.start_date ?? ""));
}