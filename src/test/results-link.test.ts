import { describe, expect, it } from "vitest";
import { commaTimes, filterToRoster, htmlToLines } from "@/lib/results-link";
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
  it("reads decimal-comma times", () => expect(commaTimes("Leal, Camila  15 JSWIM  1:36,97  1:29,14")).toBe("Leal, Camila  15 JSWIM  1:36.97  1:29.14"));
});

import { parseMeetManagerResults } from "@/lib/pdf-results";
describe("Meet Manager web pages", () => {
  it("reads college-class rows and splits", () => {
    const p = parseMeetManagerResults(["Event 7  Women 100 Yard Freestyle", "  1 Waggoner, Allie  SR Seton Hall        50.72    49.45 B       32", "             24.10        49.45 (25.35)"], "x");
    expect(p.results[0]).toMatchObject({ finalMs: 49450, splits: [{ distance: 50, cumulative_ms: 24100 }, { distance: 100, cumulative_ms: 49450 }] });
  });
});

describe("truncated Meet Manager names", () => {
  it("matches a cut first name to the registered swimmer and reads 'Masc.' as male", () => {
    const p = parseMeetManagerResults(["Evento 29  Masc. 16-18 200 LC Metros Libre", " 29 Aranguren, Dani  18 JSWIM             2:10,44    2:11,94".replace(/(\d),(\d{2})/g, "$1.$2")], "x");
    expect(p.results[0]?.gender).toBe("M");
    const roster = [
      { id: "d", first_name: "DANIEL", last_name: "ARANGUREN", birth_date: "2008-03-01", gender: "M", federation_id: null, tm_athlete_id: null },
      { id: "j", first_name: "Jorjhant", last_name: "Aranguren", birth_date: "2011-03-01", gender: "M", federation_id: null, tm_athlete_id: null },
    ];
    const r = filterToRoster(p, roster);
    expect(r.names).toEqual(["DANIEL ARANGUREN"]);
  });
});
