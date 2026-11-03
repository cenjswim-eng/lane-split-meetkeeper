import { describe, expect, it } from "vitest";
import { matchScore, nameSimilarity, HIGH_MATCH, MIN_MATCH } from "@/lib/history-match";

const p = (first_name: string, last_name: string, extra: Partial<{ birth_date: string; gender: string; federation_id: string }> = {}) =>
  ({ id: first_name, first_name, last_name, birth_date: null, gender: null, federation_id: null, ...extra });

describe("history match", () => {
  it("ignores accents, case and order", () => {
    expect(nameSimilarity("José Pérez", "PEREZ jose")).toBe(1);
  });
  it("tolerates a typo", () => {
    expect(nameSimilarity("Ezequiel Barreto", "Ezequel Barreto")).toBeGreaterThan(0.9);
  });
  it("same name + birth date is a high match", () => {
    const s = matchScore(p("Ana", "Ruiz", { birth_date: "2012-01-01" }), p("ANA", "RUIZ", { birth_date: "2012-01-01" }));
    expect(s.score).toBeGreaterThanOrEqual(HIGH_MATCH);
  });
  it("name only stays below high match", () => {
    expect(matchScore(p("Ana", "Ruiz"), p("Ana", "Ruiz")).score).toBeLessThan(HIGH_MATCH);
  });
  it("different birth date or ID rejects", () => {
    expect(matchScore(p("Ana", "Ruiz", { birth_date: "2012-01-01" }), p("Ana", "Ruiz", { birth_date: "2011-01-01" })).score).toBe(0);
    expect(matchScore(p("Ana", "Ruiz", { federation_id: "V-123" }), p("Ana", "Ruiz", { federation_id: "456" })).score).toBe(0);
  });
  it("different person scores below minimum", () => {
    expect(matchScore(p("Daniel", "Aranguren"), p("Jorjhant", "Aranguren")).score).toBeLessThan(MIN_MATCH);
  });
});
