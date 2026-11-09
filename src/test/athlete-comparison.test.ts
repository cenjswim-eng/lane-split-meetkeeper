import { describe, expect, it } from "vitest";
import { athleteComparisons } from "@/lib/athlete-comparison";

const now = new Date("2026-11-09T22:52:00Z");
const swim = (date: string, time: number, course: string | null = "LCM", distance = 100, stroke = 1) => ({
  final_time_ms: time, is_dq: false, course,
  events: { distance, stroke, is_relay: false }, meets: { start_date: date },
});

describe("individual report time comparison", () => {
  it("measures improvement from the previous competition, not the personal best or input order", () => {
    const first = swim("2026-06-01", 58000), previous = swim("2026-08-01", 62500), last = swim("2026-10-01", 60000);
    const comparisons = athleteComparisons([last, first, previous], now);
    expect(comparisons.get(last)).toEqual({ previous_ms: 62500, previous_date: "2026-08-01", improvement_ms: 2500 });
    expect(comparisons.has(first)).toBe(false);
  });
  it("measures worsening as a negative millisecond difference", () => {
    const last = swim("2026-10-01", 61750);
    expect(athleteComparisons([swim("2026-08-01", 60000), last], now).get(last)?.improvement_ms).toBe(-1750);
  });
  it("reports zero change for identical times", () => {
    const last = swim("2026-10-01", 60000);
    expect(athleteComparisons([swim("2026-08-01", 60000), last], now).get(last)?.improvement_ms).toBe(0);
  });
  it("never mixes stroke, distance or pool length or guesses an unknown pool", () => {
    const last = swim("2026-10-01", 60000);
    expect(athleteComparisons([swim("2026-08-01", 62000, "SCM"), swim("2026-08-01", 62000, "LCM", 200), swim("2026-08-01", 62000, "LCM", 100, 2), swim("2026-08-01", 62000, null), last], now).has(last)).toBe(false);
  });
  it("excludes old, future, disqualified, relay and invalid swims", () => {
    const last = swim("2026-10-01", 60000);
    const relay = swim("2026-08-01", 62000);
    relay.events.is_relay = true;
    expect(athleteComparisons([swim("2026-02-08", 62000), swim("2026-11-10", 62000), { ...swim("2026-08-01", 62000), is_dq: true }, swim("2026-08-01", 0), relay, last], now).has(last)).toBe(false);
  });
  it("uses the best previous-date time and does not invent same-day round order", () => {
    const first = swim("2026-08-01", 62000), second = swim("2026-08-01", 61000), last = swim("2026-10-01", 60000);
    const comparisons = athleteComparisons([first, last, second], now);
    expect(comparisons.has(second)).toBe(false);
    expect(comparisons.get(last)?.improvement_ms).toBe(1000);
  });
});