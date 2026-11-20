import { describe, it, expect } from "vitest";
import {
  extractDetectedClubs,
  calculateAssociationRankings,
  generateAssociationRankingPdf,
} from "@/lib/association-ranking";

describe("Association Ranking Top 5", () => {
  const mockClubs = [
    { id: "club-1", team_code: "CPMI", full_name: "Centro Portugués", region_lsc: "Miranda (ADAEL)" },
    { id: "club-2", team_code: "CIV", full_name: "Centro Italo", region_lsc: "Distrito Capital" },
  ];

  const mockAthletes = [
    {
      id: "ath-1",
      first_name: "Pedro",
      last_name: "Pérez",
      gender: "M",
      birth_date: "2012-05-10", // Age at 2026: 14
      clubs: mockClubs[0],
    },
    {
      id: "ath-2",
      first_name: "Juan",
      last_name: "Gómez",
      gender: "M",
      birth_date: "2013-08-15", // Age at 2026: 13
      clubs: mockClubs[0],
    },
    {
      id: "ath-3",
      first_name: "Luis",
      last_name: "Martínez",
      gender: "M",
      birth_date: "2010-02-20", // Age at 2026: 16 (Outside 13-14)
      clubs: mockClubs[0],
    },
    {
      id: "ath-4",
      first_name: "Carlos",
      last_name: "Silva",
      gender: "M",
      birth_date: "2013-01-01", // Age at 2026: 13
      clubs: mockClubs[1], // Different association
    },
  ];

  const mockResults = [
    // Athlete 1 in 100m Free (Course LCM)
    {
      id: "res-1",
      athlete_id: "ath-1",
      final_time_ms: 60000, // 1:00.00
      course: "LCM",
      is_dq: false,
      meets: { name: "Estadal 2026", start_date: "2026-06-01" },
      events: { distance: 100, stroke: 1, is_relay: false },
    },
    // Athlete 1 with faster time in same event (should deduplicate to this best time)
    {
      id: "res-2",
      athlete_id: "ath-1",
      final_time_ms: 58000, // 58.00 (faster)
      course: "LCM",
      is_dq: false,
      meets: { name: "Nacional 2026", start_date: "2026-08-01" },
      events: { distance: 100, stroke: 1, is_relay: false },
    },
    // Athlete 2 in 100m Free (Course LCM)
    {
      id: "res-3",
      athlete_id: "ath-2",
      final_time_ms: 59000, // 59.00
      course: "LCM",
      is_dq: false,
      meets: { name: "Estadal 2026", start_date: "2026-06-01" },
      events: { distance: 100, stroke: 1, is_relay: false },
    },
    // Athlete 3 in 100m Free (Age 16)
    {
      id: "res-4",
      athlete_id: "ath-3",
      final_time_ms: 55000, // 55.00
      course: "LCM",
      is_dq: false,
      meets: { name: "Estadal 2026", start_date: "2026-06-01" },
      events: { distance: 100, stroke: 1, is_relay: false },
    },
    // Athlete 4 in 100m Free (Different association)
    {
      id: "res-5",
      athlete_id: "ath-4",
      final_time_ms: 57000,
      course: "LCM",
      is_dq: false,
      meets: { name: "Estadal 2026", start_date: "2026-06-01" },
      events: { distance: 100, stroke: 1, is_relay: false },
    },
  ];

  it("extracts detected clubs and tallies athletes and results", () => {
    const detected = extractDetectedClubs(mockAthletes, mockResults, mockClubs);
    expect(detected.length).toBeGreaterThanOrEqual(2);
    const cpmi = detected.find((c) => c.code === "CPMI");
    expect(cpmi).toBeDefined();
    expect(cpmi?.association).toBe("Miranda (ADAEL)");
    expect(cpmi?.athleteCount).toBe(3);
    expect(cpmi?.resultsCount).toBe(4);
  });

  it("calculates Top 5 ranking for Miranda in 13-14 age bracket", () => {
    const detected = extractDetectedClubs(mockAthletes, mockResults, mockClubs);
    const rankings = calculateAssociationRankings(
      mockResults as any,
      mockAthletes,
      detected,
      {
        association: "Miranda (ADAEL)",
        course: "LCM",
        gender: "M",
        ageMode: "13-14",
      }
    );

    expect(rankings.length).toBe(1);
    const event = rankings[0];
    expect(event.distance).toBe(100);
    expect(event.stroke).toBe(1);
    // Athlete 3 is age 16 so excluded.
    // Athlete 4 is Distrito Capital so excluded.
    // Athlete 1 has two times; only fastest 58.00 should be kept.
    // Athlete 2 has 59.00.
    expect(event.top5.length).toBe(2);
    expect(event.top5[0].athleteName).toBe("Pedro Pérez");
    expect(event.top5[0].finalTimeMs).toBe(58000);
    expect(event.top5[0].rank).toBe(1);
    expect(event.top5[1].athleteName).toBe("Juan Gómez");
    expect(event.top5[1].finalTimeMs).toBe(59000);
    expect(event.top5[1].rank).toBe(2);
  });

  it("calculates Libre ranking (all ages) including age 16 athlete", () => {
    const detected = extractDetectedClubs(mockAthletes, mockResults, mockClubs);
    const rankings = calculateAssociationRankings(
      mockResults as any,
      mockAthletes,
      detected,
      {
        association: "Miranda (ADAEL)",
        course: "LCM",
        gender: "M",
        ageMode: "libre",
      }
    );

    expect(rankings.length).toBe(1);
    const event = rankings[0];
    // In Libre mode, Athlete 3 (55.00) is included and should be Rank 1!
    expect(event.top5.length).toBe(3);
    expect(event.top5[0].athleteName).toBe("Luis Martínez");
    expect(event.top5[0].finalTimeMs).toBe(55000);
    expect(event.top5[0].rank).toBe(1);
    expect(event.top5[1].athleteName).toBe("Pedro Pérez");
    expect(event.top5[1].rank).toBe(2);
  });

  it("generates a valid PDF File object", () => {
    const detected = extractDetectedClubs(mockAthletes, mockResults, mockClubs);
    const rankings = calculateAssociationRankings(
      mockResults as any,
      mockAthletes,
      detected,
      {
        association: "Miranda (ADAEL)",
        course: "LCM",
        gender: "M",
        ageMode: "13-14",
      }
    );

    const pdfFile = generateAssociationRankingPdf(rankings, {
      associationName: "Miranda (ADAEL)",
      ageModeLabel: "13 - 14 años",
      courseLabel: "50 m (LCM)",
      genderLabel: "Masculino",
    });

    expect(pdfFile).toBeDefined();
    expect(pdfFile.name).toContain("Ranking_Top5");
    expect(pdfFile.type).toBe("application/pdf");
    expect(pdfFile.size).toBeGreaterThan(100);
  });
});
