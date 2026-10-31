import { describe, expect, it } from "vitest";
import { bestFreeRelay, bestMedleyRelay, candidatesFromResults } from "@/lib/relay";
import { ageAtDec31, ageGroup } from "@/lib/swim";

const C = (id: string, best: Partial<Record<number, number>>) => ({ id, name: id, best });

describe("relay optimizer", () => {
  it("free relay picks the 4 fastest freestylers", () => {
    const team = bestFreeRelay([
      C("a", { 1: 26000 }),
      C("b", { 1: 25000 }),
      C("c", { 1: 27000 }),
      C("d", { 1: 24500 }),
      C("e", { 1: 30000 }),
    ])!;
    expect(team.legs.map((l) => l.athleteId)).toEqual(["d", "b", "a", "c"]);
    expect(team.totalMs).toBe(24500 + 25000 + 26000 + 27000);
  });

  it("returns null when there are not enough swimmers", () => {
    expect(bestFreeRelay([C("a", { 1: 26000 }), C("b", { 1: 25000 })])).toBeNull();
  });

  it("medley relay assigns 4 distinct swimmers minimizing total", () => {
    // "x" is fastest at everything but can only swim one leg.
    const team = bestMedleyRelay([
      C("x", { 1: 24000, 2: 28000, 3: 30000, 4: 26000 }),
      C("bk", { 2: 29000 }),
      C("br", { 3: 32000 }),
      C("fl", { 4: 27000 }),
      C("fr", { 1: 25000 }),
    ])!;
    const ids = team.legs.map((l) => l.athleteId);
    expect(new Set(ids).size).toBe(4);
    // x must take freestyle (biggest advantage), specialists take the rest
    expect(team.legs.find((l) => l.stroke === 1)!.athleteId).toBe("x");
    expect(team.totalMs).toBe(29000 + 32000 + 27000 + 24000);
  });

  it("candidatesFromResults keeps the best non-DQ time per stroke", () => {
    const cs = candidatesFromResults([
      { athlete_id: "a", name: "A", stroke: 1, final_time_ms: 26000, is_dq: false },
      { athlete_id: "a", name: "A", stroke: 1, final_time_ms: 25500, is_dq: false },
      { athlete_id: "a", name: "A", stroke: 1, final_time_ms: 24000, is_dq: true },
      { athlete_id: "a", name: "A", stroke: 1, final_time_ms: null, is_dq: false },
    ]);
    expect(cs).toHaveLength(1);
    expect(cs[0].best[1]).toBe(25500);
  });
});

describe("age category rule (age at Dec 31)", () => {
  it("computes age at end of year", () => {
    expect(ageAtDec31("2012-03-04", 2026)).toBe(14);
    expect(ageAtDec31("2012-12-31", 2026)).toBe(14);
    expect(ageAtDec31(null, 2026)).toBeNull();
  });
  it("maps ages to groups", () => {
    expect(ageGroup(8)).toBe("8 y menor");
    expect(ageGroup(10)).toBe("9-10");
    expect(ageGroup(14)).toBe("13-14");
    expect(ageGroup(17)).toBe("15-17");
    expect(ageGroup(20)).toBe("18+");
  });
});
