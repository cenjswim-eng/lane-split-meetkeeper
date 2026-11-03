import { describe, expect, it } from "vitest";
import { filterToRoster, htmlToLines } from "@/lib/results-link";
import type { ParsedFile } from "@/lib/hytek/types";

const base = (names: [string, string][]): ParsedFile => ({
  format: "PDF", meet: { name: "M", location: null, startDate: null, endDate: null, course: "LCM" }, teams: [{ code: "X", name: "X" }],
  athletes: names.map(([l, f]) => ({ key: l, tmId: null, federationId: null, firstName: f, lastName: l, birthDate: null, gender: "M", teamCode: "X" })),
  results: names.map(([l]) => ({ athleteKey: l, eventNumber: "1", distance: 100, stroke: 1, gender: "M", minAge: null, maxAge: null, seedMs: null, finalMs: 60000, course: "LCM", place: 1, isDq: false, round: "F" as const, splits: [] })),
  warnings: [],
});

describe("results link", () => {
  it("keeps only registered athletes and adopts their identity", () => {
    const roster = [{ id: "a1", first_name: "Ezequiel", last_name: "Barreto", birth_date: "2010-01-02", gender: "M", federation_id: "V1", tm_athlete_id: null }];
    const r = filterToRoster(base([["Barreto", "Ezequiel A"], ["Pérez", "Luis"]]), roster);
    expect(r.parsed.results).toHaveLength(1);
    expect(r.parsed.athletes[0]).toMatchObject({ firstName: "Ezequiel", birthDate: "2010-01-02", federationId: "V1" });
  });
  it("extracts pre text lines from html", () => {
    expect(htmlToLines("<pre>Event 1  Boys\n 1 Barreto, Ezequiel &amp; X</pre>")).toEqual(["Event 1  Boys", " 1 Barreto, Ezequiel & X"]);
  });
});
