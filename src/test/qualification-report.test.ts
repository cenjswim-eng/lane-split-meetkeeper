import { describe, it, expect } from "vitest";
import { qualificationReport, categoryBounds } from "@/lib/standard-rules";
const std = (t: number, course = "LCM") => ({ id: "s", season_year: 2026, ...categoryBounds("Juvenil A"), gender: "M", distance: 100, stroke: 1, course, qualifying_time_ms: t });
const res = (t: number, course = "LCM", date = "2026-05-01") => ({ athlete_id: "a", final_time_ms: t, is_dq: false, course, meets: { name: "X", start_date: date }, events: { distance: 100, stroke: 1, is_relay: false }, athletes: { first_name: "Juan", last_name: "P", gender: "M", birth_date: "2011-03-01" } });
describe("qualificationReport", () => {
  it("marks met with best season swim", () => { const r = qualificationReport([std(60000)], [res(61000), res(59000)], 2026); expect(r[0]?.met).toBe(true); expect(r[0]?.time_ms).toBe(59000); });
  it("marks not met", () => { expect(qualificationReport([std(60000)], [res(61000)], 2026)[0]?.met).toBe(false); });
  it("does not mix 25 m swims with 50 m standards", () => { expect(qualificationReport([std(60000)], [res(50000, "SCM")], 2026)).toHaveLength(0); });
  it("ignores other years", () => { expect(qualificationReport([std(60000)], [res(50000, "LCM", "2025-05-01")], 2026)).toHaveLength(0); });
});
