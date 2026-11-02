import { describe, expect, it } from "vitest";
import { aiResultsToParsed, parseEventHeader, parseMeetManagerResults } from "@/lib/pdf-results";

const report = [
  "Club Natación Caracas  HY-TEK's MEET MANAGER",
  "Copa Ávila 2026 - 3/14/2026 to 3/15/2026",
  "Results",
  "Event 3  Girls 11-12 100 LC Meter Freestyle",
  "    Name                    Age Team              Seed Time  Finals Time",
  "  1 Perez, Maria             12 CN Caracas          1:08.40     1:05.32",
  "  2 Gomez, Ana Lucia         11 Delfines            NT          1:09.10",
  " -- Rojas, Sofia             12 Delfines            1:10.00          DQ",
  "Event 4  Mixed 200 LC Meter Freestyle Relay",
  "  1 Delfines  A                                                 2:01.00",
];

describe("PDF results", () => {
  it("reads event headers including gender, ages, distance and stroke", () => {
    expect(parseEventHeader("Evento 7 Mujeres 13 y Mayores 200 Metro Mariposa")).toMatchObject({ number: "7", distance: 200, stroke: 4, gender: "F", minAge: 13, maxAge: null });
  });
  it("reads Meet Manager result lines and keeps times in milliseconds", () => {
    const p = parseMeetManagerResults(report, "archivo.pdf");
    expect(p.meet).toMatchObject({ name: "Copa Ávila 2026", startDate: "2026-03-14", endDate: "2026-03-15", course: "LCM" });
    expect(p.results).toHaveLength(3);
    expect(p.results[0]).toMatchObject({ finalMs: 65320, seedMs: 68400, place: 1, distance: 100, stroke: 1, gender: "F" });
    expect(p.results[1]).toMatchObject({ seedMs: null, finalMs: 69100 });
    expect(p.results[2]).toMatchObject({ isDq: true, finalMs: null, place: null });
    expect(p.athletes.map((a) => a.firstName)).toEqual(["Maria", "Ana Lucia", "Sofia"]);
  });
  it("drops AI swims with invalid distance or stroke", () => {
    const p = aiResultsToParsed({ meet: { name: "X", location: null, start_date: "2026-02-30", end_date: null, course: "SCM" }, swims: [
      { first_name: "Ana", last_name: "Gil", birth_date: "2012-05-01", gender: "F", team: "Delfines", event_number: "1", distance: 50, stroke: 2, course: null, seed_time: null, final_time: "32.10", place: 1, is_dq: false, splits: [] },
      { first_name: "Ana", last_name: "Gil", birth_date: null, gender: "F", team: null, event_number: null, distance: 75, stroke: 9, course: null, seed_time: null, final_time: "1:00.00", place: null, is_dq: false, splits: [] },
    ] }, "f.pdf");
    expect(p.results).toHaveLength(1);
    expect(p.results[0]).toMatchObject({ finalMs: 32100, course: "SCM" });
    expect(p.meet.startDate).toBeNull();
  });
});
