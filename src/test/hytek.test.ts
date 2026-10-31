import { describe, expect, it } from "vitest";
import { parseTime, formatTime } from "@/lib/swim";
import { parseSdif, buildSd3 } from "@/lib/hytek/sdif";

describe("times are stored in milliseconds", () => {
  it("parses minute times", () => expect(parseTime("1:02.34")).toBe(62340));
  it("parses second times", () => expect(parseTime("28.05")).toBe(28050));
  it("treats DQ as no time", () => expect(parseTime("DQ")).toBeNull());
  it("formats back", () => expect(formatTime(62340)).toBe("1:02.34"));
});

describe("SD3 round trip", () => {
  it("exports and re-imports a result with splits", () => {
    const text = buildSd3(
      { name: "Copa Test", location: "Caracas", start_date: "2026-05-01", end_date: "2026-05-02", course: "LCM" },
      [{
        athlete: { first_name: "Ana", last_name: "Perez", federation_id: "VEN123", birth_date: "2012-03-04", gender: "F", team_code: "CLUB" },
        event: { event_number: "12", distance: 100, stroke: 4, gender: "F", min_age: 13, max_age: 14 },
        seed_time_ms: 70000, final_time_ms: 68450, is_dq: false, place: 2, aqua_points: 480, course: "LCM", round: "F",
        splits: [{ split_distance: 50, cumulative_time_ms: 32100 }, { split_distance: 100, cumulative_time_ms: 68450 }],
      }],
      [{ code: "CLUB", name: "Club Test" }],
    );
    const p = parseSdif(text);
    expect(p.meet.name).toBe("Copa Test");
    expect(p.athletes[0]).toMatchObject({ lastName: "Perez", firstName: "Ana", birthDate: "2012-03-04", federationId: "VEN123" });
    const r = p.results.find((x) => x.round === "F")!;
    expect(r).toMatchObject({ distance: 100, stroke: 4, finalMs: 68450, seedMs: 70000, place: 2 });
    expect(r.splits).toEqual([{ distance: 50, cumulative_ms: 32100 }, { distance: 100, cumulative_ms: 68450 }]);
  });
});
