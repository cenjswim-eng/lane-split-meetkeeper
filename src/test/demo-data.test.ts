import { describe, expect, it } from "vitest";
import { demoAthletes, demoMeets, demoMinimums, demoRanking, demoSummary, demoSwims } from "@/lib/demo-data";

describe("Public read-only demo", () => {
  it("keeps fictional fixtures immutable instead of persisting edits", () => {
    const athlete = demoAthletes[0];
    const meet = demoMeets[0];
    if (!athlete || !meet) throw new Error("Missing demo fixtures");
    expect(Reflect.set(athlete, "name", "Changed")).toBe(false);
    expect(athlete.name).toBe("Ana Ríos");
    expect(Reflect.set(athlete.times, "0", 1)).toBe(false);
    expect(Reflect.set(meet, "name", "Changed")).toBe(false);
    expect(Reflect.set(demoMinimums, "F", 1)).toBe(false);
  });
  it("derives the dashboard totals from the example rows", () => {
    expect(demoSummary()).toEqual({ athletes: 24, meets: 6, bests: 24, qualified: 11, swims: 144 });
  });
  it("shows improvement and the gap from an illustrative minimum", () => {
    const ana = demoAthletes[0];
    if (!ana) throw new Error("Missing demo fixture");
    expect(demoSwims(ana)[2]).toMatchObject({ time: 65400, change: -1500, minimum: 66000, remaining: -600 });
  });
  it("shows worsening instead of hiding it", () => {
    const sofia = demoAthletes[2];
    if (!sofia) throw new Error("Missing demo fixture");
    expect(demoSwims(sofia)[2]).toMatchObject({ change: 300, remaining: 3500 });
  });
  it("ranks each athlete once by their best AQUA points", () => {
    const ranking = demoRanking();
    expect(new Set(ranking.map(row => row.athlete.id)).size).toBe(24);
    expect(ranking.map(row => row.best.points)).toEqual([...ranking.map(row => row.best.points)].sort((a, b) => b - a));
    expect(ranking.find(row => row.athlete.id === "demo-sofia")?.best.time).toBe(69200);
  });
});