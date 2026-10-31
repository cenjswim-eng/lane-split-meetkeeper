import { describe, expect, it } from "vitest";
import { athleteRecordWindow, rankedAthleteRecords, athleteProgressSeries } from "@/lib/athlete-records";

const now = new Date("2026-10-31T07:06:00Z");
const row = (id: string, date: string | null, time: number | null, is_dq = false) => ({ id, meets: { start_date: date }, final_time_ms: time, is_dq });

describe("athlete profile records", () => {
  it("includes exactly nine months and excludes older and future events", () => {
    expect(rankedAthleteRecords([
      row("boundary", "2026-01-31", 61000), row("old", "2026-01-30", 50000),
      row("today", "2026-10-31", 60000), row("future", "2026-11-01", 40000),
    ], now).map((r) => r.id)).toEqual(["today", "boundary"]);
  });
  it("orders from best to worst without truncating or changing the source history", () => {
    const input = Array.from({ length: 35 }, (_, i) => row(String(i), "2026-08-01", 65000 - i * 100));
    expect(rankedAthleteRecords(input, now).map((r) => r.final_time_ms)).toEqual(Array.from({ length: 35 }, (_, i) => 61600 + i * 100));
    expect(input[0]?.final_time_ms).toBe(65000);
  });
  it("clamps nine calendar months at a shorter month end", () => {
    expect(athleteRecordWindow(new Date("2026-11-30T23:59:59Z"))).toEqual({ from: "2026-02-28", to: "2026-11-30" });
  });
  it("excludes undated, invalid, disqualified and missing or invalid times", () => {
    expect(rankedAthleteRecords([row("none", null, 50000), row("badDate", "2026-02-30", 50000), row("dq", "2026-08-01", 50000, true), row("nt", "2026-08-01", null), row("zero", "2026-08-01", 0), row("nan", "2026-08-01", NaN)], now)).toEqual([]);
  });
  it("charts every event separately across competitions in chronological order", () => {
    const swim = (id: string, date: string, time: number, distance = 100, stroke = 1, course = "LCM") => ({ ...row(id, date, time), events: { distance, stroke }, course });
    const series = athleteProgressSeries([
      swim("latest", "2026-10-01", 58000), swim("first", "2026-02-01", 62000),
      swim("middle", "2026-06-01", 60000), swim("short", "2026-06-01", 57000, 100, 1, "SCM"),
      swim("back", "2026-06-01", 68000, 100, 2), swim("200", "2026-06-01", 130000, 200),
      swim("old", "2026-01-30", 50000),
    ], now);
    expect(series.map((s) => [s.distance, s.stroke, s.course])).toEqual([[100, 1, "LCM"], [100, 1, "SCM"], [200, 1, "LCM"], [100, 2, "LCM"]]);
    expect(series[0]?.records.map((r) => r.id)).toEqual(["first", "middle", "latest"]);
  });
});