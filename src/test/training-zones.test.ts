import { describe, expect, it } from "vitest";
import { TRAINING_ZONES, trainingReferences, trainingTimeRange } from "@/lib/training-zones";

describe("individual training zones", () => {
  it("includes the five requested planning zones", () => {
    expect([...TRAINING_ZONES]).toEqual(["R1", "R2", "VO2 Max", "Anaeróbico 1", "Anaeróbico 2"]);
  });
  it("converts coach speed ranges inversely to time without inventing defaults", () => {
    expect(trainingTimeRange(60000, 100, 50, { minPercent: 75, maxPercent: 80 })).toEqual({ fastMs: 37500, slowMs: 40000 });
    expect(trainingTimeRange(60000, 100, 200, { minPercent: 100, maxPercent: 100 })).toEqual({ fastMs: 120000, slowMs: 120000 });
  });
  it("leaves missing, reversed and nonfinite calibrations uncomputed", () => {
    for (const range of [{ minPercent: 0, maxPercent: 80 }, { minPercent: 90, maxPercent: 80 }, { minPercent: NaN, maxPercent: 100 }]) {
      expect(trainingTimeRange(60000, 100, 50, range)).toBeNull();
    }
    expect(trainingTimeRange(60000, 0, 50, { minPercent: 80, maxPercent: 90 })).toBeNull();
  });
  it("uses only the best eligible mark per event and pool within nine months", () => {
    const swim = (id: string, time: number, date = "2026-08-01", course = "LCM", distance = 100, stroke = 1, is_dq = false) => ({ id, final_time_ms: time, is_dq, course, meets: { name: "Meet", start_date: date }, events: { distance, stroke } });
    expect(trainingReferences([
      swim("old", 40000, "2026-01-31"), swim("slower", 62000), swim("best", 60000),
      swim("short", 59000, "2026-08-01", "SCM"), swim("back", 70000, "2026-08-01", "LCM", 100, 2),
      swim("dq", 30000, "2026-08-01", "LCM", 100, 1, true), swim("relay", 50000, "2026-08-01", "LCM", 100, 6),
    ], new Date("2026-11-01T00:00:00Z")).map((r) => r.id)).toEqual(["short", "best", "back"]);
  });
});