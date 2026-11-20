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
    { id: "club-3", team_code: "EMIL", full_name: "Emil Friedman", region_lsc: "Miranda (ADAEL)" },
  ];

  const mockAthletes = [
    {
      id: "ath-1",
      first_name: "Pedro",
      last_name: "Pérez",
      gender: "M",
      birth_date: "2012-05-10", // Age at 2026: 14 (Miranda - CPMI)
      clubs: mockClubs[0],
    },
    {
      id: "ath-2",
      first_name: "Juan",
      last_name: "Gómez",
      gender: "M",
      birth_date: "2013-08-15", // Age at 2026: 13 (Miranda - CPMI)
      clubs: mockClubs[0],
    },
    {
      id: "ath-3",
      first_name: "Luis",
      last_name: "Martínez",
      gender: "M",
      birth_date: "2010-02-20", // Age at 2026: 16 (Miranda - CPMI)
      clubs: mockClubs[0],
    },
    {
      id: "ath-4",
      first_name: "Carlos",
      last_name: "Silva",
      gender: "M",
      birth_date: "2013-01-01", // Age at 2026: 13 (Distrito Capital - CIV)
      clubs: mockClubs[1],
    },
    {
      id: "ath-5",
      first_name: "Andrés",
      last_name: "Díaz",
      gender: "M",
      birth_date: "2012-03-15", // Age at 2026: 14 (Miranda - EMIL)
      clubs: mockClubs[2],
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
    // Athlete 4 in 100m Free (Different association: Distrito Capital)
    {
      id: "res-5",
      athlete_id: "ath-4",
      final_time_ms: 57000,
      course: "LCM",
      is_dq: false,
      meets: { name: "Estadal 2026", start_date: "2026-06-01" },
      events: { distance: 100, stroke: 1, is_relay: false },
    },
    // Athlete 5 in 100m Free (Affiliated Miranda club EMIL: 56.00)
    {
      id: "res-6",
      athlete_id: "ath-5",
      final_time_ms: 56000, // 56.00 (Fastest 13-14 in Miranda!)
      course: "LCM",
      is_dq: false,
      meets: { name: "Estadal Miranda 2026", start_date: "2026-06-01" },
      events: { distance: 100, stroke: 1, is_relay: false },
    },
  ];

  it("extracts detected clubs and tallies athletes and results", () => {
    const detected = extractDetectedClubs(mockAthletes, mockResults, mockClubs);
    expect(detected.length).toBeGreaterThanOrEqual(3);
    const cpmi = detected.find((c) => c.code === "CPMI");
    expect(cpmi).toBeDefined();
    expect(cpmi?.association).toBe("Miranda (ADAEL)");
    expect(cpmi?.athleteCount).toBe(3);
    expect(cpmi?.resultsCount).toBe(4);

    const emil = detected.find((c) => c.code === "EMIL");
    expect(emil).toBeDefined();
    expect(emil?.association).toBe("Miranda (ADAEL)");
    expect(emil?.athleteCount).toBe(1);
    expect(emil?.resultsCount).toBe(1);
  });

  it("calculates multi-club state ranking including all swimmers from all affiliated clubs in Miranda", () => {
    const detected = extractDetectedClubs(mockAthletes, mockResults, mockClubs);
    const { rankings, participatingClubs } = calculateAssociationRankings(
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
    // Athlete 5 (EMIL) has 56.00 -> Rank 1.
    // Athlete 1 (CPMI) has 58.00 (best) -> Rank 2.
    // Athlete 2 (CPMI) has 59.00 -> Rank 3.
    // All swimmers from both clubs in Miranda are in the ranking!
    expect(event.top5.length).toBe(3);
    expect(event.top5[0].athleteName).toBe("Andrés Díaz");
    expect(event.top5[0].clubCode).toBe("EMIL");
    expect(event.top5[0].finalTimeMs).toBe(56000);
    expect(event.top5[0].rank).toBe(1);

    expect(event.top5[1].athleteName).toBe("Pedro Pérez");
    expect(event.top5[1].clubCode).toBe("CPMI");
    expect(event.top5[1].finalTimeMs).toBe(58000);
    expect(event.top5[1].rank).toBe(2);

    expect(event.top5[2].athleteName).toBe("Juan Gómez");
    expect(event.top5[2].clubCode).toBe("CPMI");
    expect(event.top5[2].finalTimeMs).toBe(59000);
    expect(event.top5[2].rank).toBe(3);

    // Participating clubs includes both CPMI and EMIL
    expect(participatingClubs).toContain("CPMI");
    expect(participatingClubs).toContain("EMIL");
    expect(participatingClubs).not.toContain("CIV");
  });

  it("calculates Libre ranking (all ages) across all affiliated clubs", () => {
    const detected = extractDetectedClubs(mockAthletes, mockResults, mockClubs);
    const { rankings, participatingClubs } = calculateAssociationRankings(
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
    // In Libre mode:
    // Athlete 3 (CPMI, age 16, 55.00) -> Rank 1
    // Athlete 5 (EMIL, age 14, 56.00) -> Rank 2
    // Athlete 1 (CPMI, age 14, 58.00) -> Rank 3
    // Athlete 2 (CPMI, age 13, 59.00) -> Rank 4
    expect(event.top5.length).toBe(4);
    expect(event.top5[0].athleteName).toBe("Luis Martínez");
    expect(event.top5[0].clubCode).toBe("CPMI");
    expect(event.top5[0].finalTimeMs).toBe(55000);
    expect(event.top5[0].rank).toBe(1);

    expect(event.top5[1].athleteName).toBe("Andrés Díaz");
    expect(event.top5[1].clubCode).toBe("EMIL");
    expect(event.top5[1].finalTimeMs).toBe(56000);
    expect(event.top5[1].rank).toBe(2);

    expect(participatingClubs).toEqual(["CPMI", "EMIL"]);
  });

  it("generates a valid PDF File object with participating clubs", () => {
    const detected = extractDetectedClubs(mockAthletes, mockResults, mockClubs);
    const { rankings, participatingClubs } = calculateAssociationRankings(
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
      participatingClubs,
    });

    expect(pdfFile).toBeDefined();
    expect(pdfFile.name).toContain("Ranking_Estadal");
    expect(pdfFile.type).toBe("application/pdf");
    expect(pdfFile.size).toBeGreaterThan(100);
  });
});
