import { describe, expect, it } from "vitest";
import { athleteProgressPdf, meetPointsSummary, type AthleteReportResult } from "@/lib/reports";

// Dates stay inside the rolling nine-month window regardless of the real clock.
const swim = (
  time: number,
  date: string,
  distance = 100,
  stroke = 1,
  course = "LCM",
): AthleteReportResult => ({
  final_time_ms: time,
  seed_time_ms: null,
  is_dq: false,
  course,
  round: "F",
  place: 1,
  aqua_points: 500,
  events: { distance, stroke },
  meets: { name: "Copa Ciudad", start_date: date },
  splits: [],
});

function pdfText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(Buffer.from(reader.result as ArrayBuffer).toString("latin1"));
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

const athlete = {
  first_name: "Ana",
  last_name: "Pérez",
  birth_date: "2010-04-01",
  gender: "F",
  federation_id: "123",
  teams: { name: "Club Acua" },
};

const TEN_SWIMS = [
  "2026-03-01", "2026-03-20", "2026-04-15", "2026-05-10", "2026-06-05",
  "2026-07-01", "2026-07-25", "2026-08-20", "2026-09-15", "2026-10-10",
].map((date, i) => swim(60000 + i * 100, date));

describe("athlete PDF keeps per-event evolution charts", () => {
  it("keeps one chart page for every event and pool", async () => {
    const results = [
      swim(61000, "2026-03-15"),
      swim(60200, "2026-05-10"),
      swim(59400, "2026-08-20"),
      swim(31000, "2026-04-02", 50, 2, "SCM"),
      swim(30400, "2026-09-12", 50, 2, "SCM"),
    ];
    const text = await pdfText(athleteProgressPdf(athlete, results, [], null));
    expect(text).toContain("Evolución · 100 Libre · LCM");
    expect(text).toContain("Evolución · 50 Espalda · SCM");
    expect(text.match(/Evolución ·/g)).toHaveLength(2);
  });

  it("keeps every swim when a proof needs more than one chart page", async () => {
    const text = await pdfText(athleteProgressPdf(athlete, TEN_SWIMS, [], null));
    // The en dash is stored as a WinAnsi byte, so match it positionally.
    expect(text).toMatch(/Nados 1.7 de 10/);
    expect(text).toMatch(/Nados 8.10 de 10/);
    expect(text.match(/Evolución ·/g)).toHaveLength(2);
  });

  it("keeps charts even when the athlete has minimums and comparisons", async () => {
    const results = [swim(61000, "2026-03-15"), swim(59400, "2026-08-20")];
    const text = await pdfText(athleteProgressPdf(athlete, results, [], null));
    expect(text).toContain("Diferencia con mínima");
    expect(text).toContain("Variación");
    expect(text).toContain("Evolución ·");
  });
});

describe("athlete PDF reports meet scoring points", () => {
  const scored = (points: number, name: string, date: string): AthleteReportResult => ({ ...swim(60000, date), points, meets: { name, start_date: date } });

  it("sums points per meet and omits meets without points", () => {
    const results = [scored(9, "Copa A", "2026-03-01"), scored(7, "Copa A", "2026-03-01"), scored(0, "Copa B", "2026-05-10")];
    expect(meetPointsSummary(results)).toEqual([{ name: "Copa A", date: "2026-03-01", swims: 2, points: 16 }]);
  });

  it("shows the per-meet points table and total in the PDF", async () => {
    const results = [scored(9, "Copa A", "2026-03-01"), scored(7, "Copa A", "2026-03-01")];
    const text = await pdfText(athleteProgressPdf(athlete, results, [], null));
    expect(text).toContain("Puntos por competencia");
    expect(text).toContain("Total del periodo");
  });

  it("omits the points table when no meet awarded points", async () => {
    const text = await pdfText(athleteProgressPdf(athlete, [swim(60000, "2026-03-01")], [], null));
    expect(text).not.toContain("Puntos por competencia");
  });
});
