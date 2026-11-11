import { describe, expect, it } from "vitest";
import { athleteProgressPdf, type AthleteReportResult } from "@/lib/reports";

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
    const results = Array.from({ length: 10 }, (_, i) => swim(60000 + i * 100, `2026-0${(i % 9) + 1}-10`));
    const text = await pdfText(athleteProgressPdf(athlete, results, [], null));
    expect(text).toContain("Nados 1–8 de 10");
    expect(text).toContain("Nados 9–10 de 10");
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
