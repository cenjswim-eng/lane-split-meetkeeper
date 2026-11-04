import { describe, expect, it } from "vitest";
import { athleteMinimum } from "@/lib/athlete-minimum";
import type { QualificationStandard } from "@/lib/standard-rules";

const athlete = { birth_date: "2008-12-30", gender: "M" };
const result = { final_time_ms: 62500, is_dq: false, course: "LCM", events: { distance: 100, stroke: 1 }, meets: { start_date: "2026-08-13" } };
const standard: QualificationStandard = { id: "minimum", season_year: 2026, age_group: "Juvenil B", age_min: 16, age_max: 18, gender: "M", distance: 100, stroke: 1, course: "LCM", qualifying_time_ms: 60000 };

describe("athlete PDF minimum gap", () => {
  it("calculates the milliseconds still needed for the applicable minimum", () => {
    expect(athleteMinimum(athlete, result, [standard])).toEqual({ limit_ms: 60000, remaining_ms: 2500 });
  });
  it("reports zero remaining time for equal or faster swims", () => {
    for (const final_time_ms of [60000, 59500]) expect(athleteMinimum(athlete, { ...result, final_time_ms }, [standard])?.remaining_ms).toBe(0);
  });
  it.each([
    { season_year: 2025 }, { course: "SCM" }, { gender: "F" },
    { distance: 200 }, { stroke: 2 }, { age_max: 17 },
  ])("does not compare an incompatible minimum: %j", change => {
    expect(athleteMinimum(athlete, result, [{ ...standard, ...change }])).toBeNull();
  });
  it("uses Dec-31 age even before the birthday", () => {
    expect(athleteMinimum(athlete, result, [{ ...standard, age_min: 18 }])?.limit_ms).toBe(60000);
  });
  it("prefers dated standards and the fastest within that season", () => {
    expect(athleteMinimum(athlete, result, [{ ...standard, season_year: null, qualifying_time_ms: 57000 }, standard, { ...standard, qualifying_time_ms: 59000 }])?.remaining_ms).toBe(3500);
  });
  it("does not mark disqualified swims as qualifying", () => {
    expect(athleteMinimum(athlete, { ...result, is_dq: true, final_time_ms: 59000 }, [standard])?.remaining_ms).toBeNull();
  });
  it("does not fabricate a minimum when none is loaded", () => {
    expect(athleteMinimum(athlete, result, [])).toBeNull();
  });
});