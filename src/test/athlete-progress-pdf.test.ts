import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { appendAthleteProgressCharts } from "@/lib/athlete-progress-pdf";
import type { AthleteReportResult } from "@/lib/reports";

const now = new Date("2026-10-31T18:39:00Z");
const swim = (time: number, course = "LCM"): AthleteReportResult => ({
  final_time_ms: time, seed_time_ms: null, is_dq: false, course, round: "F", place: null, aqua_points: null,
  events: { distance: 100, stroke: 1 }, meets: { name: "Competencia", start_date: "2026-08-01" }, splits: [],
});

describe("athlete PDF vector charts", () => {
  it("paginates all swims and gives a different pool its own chart", () => {
    const doc = new jsPDF({ orientation: "landscape" });
    appendAthleteProgressCharts(doc, "Atleta", [...Array.from({ length: 25 }, (_, i) => swim(60000 + i * 100)), swim(58000, "SCM")], now);
    expect(doc.getNumberOfPages()).toBe(6); // Existing summary + 4 LCM pages + 1 SCM page.
  });

  it("plots a single constant time without a zero-range axis", () => {
    const doc = new jsPDF({ orientation: "landscape" });
    appendAthleteProgressCharts(doc, "Atleta", [swim(60000)], now);
    expect(doc.getNumberOfPages()).toBe(2);
    expect(doc.output()).not.toMatch(/\b(?:NaN|Infinity)\b/);
  });

  it("adds no chart pages for records outside nine months or without valid finals", () => {
    const doc = new jsPDF({ orientation: "landscape" });
    appendAthleteProgressCharts(doc, "Atleta", [
      { ...swim(60000), meets: { name: "Antigua", start_date: "2026-01-30" } },
      { ...swim(60000), is_dq: true }, { ...swim(60000), final_time_ms: null },
    ], now);
    expect(doc.getNumberOfPages()).toBe(1);
  });
});