import { describe, it, expect } from "vitest";
import {
  extractDetectedClubs,
  calculateAssociationRankings,
  generateAssociationRankingPdf,
  normalizeAssociationName,
} from "@/lib/association-ranking";
import { getFederation, getAssociationsForFederation } from "@/lib/federations";

describe("Association Ranking Top 5", () => {
  const mockClubs = [
    { id: "club-1", team_code: "CPMI", full_name: "Centro Portugués", region_lsc: "Miranda (ADAEM)" },
    { id: "club-2", team_code: "CIV", full_name: "Centro Italo", region_lsc: "Distrito Capital (ASDAC)" },
    { id: "club-3", team_code: "EMIL", full_name: "Emil Friedman", region_lsc: "Miranda (ADAEM)" },
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
    expect(cpmi?.association).toBe("Miranda (ADAEM)");
    expect(cpmi?.athleteCount).toBe(3);
    expect(cpmi?.resultsCount).toBe(4);

    const emil = detected.find((c) => c.code === "EMIL");
    expect(emil).toBeDefined();
    expect(emil?.association).toBe("Miranda (ADAEM)");
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
        association: "Miranda (ADAEM)",
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
        association: "Miranda (ADAEM)",
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
        association: "Miranda (ADAEM)",
        course: "LCM",
        gender: "M",
        ageMode: "13-14",
      }
    );

    const pdfFile = generateAssociationRankingPdf(rankings, {
      associationName: "Miranda (ADAEM)",
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

  it("normalizes official Venezuelan association acronyms (ADAEL = Lara, ADAEM = Miranda, ADAET = Táchira, ASODAME = Mérida)", () => {
    // ADAEL -> Lara
    expect(normalizeAssociationName("ADAEL")).toBe("Lara (ADAEL)");
    expect(normalizeAssociationName("adael")).toBe("Lara (ADAEL)");
    expect(normalizeAssociationName("Lara")).toBe("Lara (ADAEL)");

    // ADAEM -> Miranda
    expect(normalizeAssociationName("ADAEM")).toBe("Miranda (ADAEM)");
    expect(normalizeAssociationName("adaem")).toBe("Miranda (ADAEM)");
    expect(normalizeAssociationName("Miranda")).toBe("Miranda (ADAEM)");
    expect(normalizeAssociationName("MIR")).toBe("Miranda (ADAEM)");

    // ADAET -> Táchira
    expect(normalizeAssociationName("ADAET")).toBe("Táchira (ADAET)");
    expect(normalizeAssociationName("Táchira")).toBe("Táchira (ADAET)");

    // ASODAME -> Mérida
    expect(normalizeAssociationName("ASODAME")).toBe("Mérida (ASODAME)");
    expect(normalizeAssociationName("Mérida")).toBe("Mérida (ASODAME)");

    // Other states
    expect(normalizeAssociationName("ASDAC")).toBe("Distrito Capital (ASDAC)");
    expect(normalizeAssociationName("ASODENA")).toBe("Carabobo (ASODENA)");

    // Cross-club check for Lara and Miranda
    const clubsWithVariations = [
      { id: "c1", team_code: "PIS", full_name: "Piscinas Bolivarianas", region_lsc: "ADAEL" },
      { id: "c2", team_code: "CPMI", full_name: "Centro Portugués", region_lsc: "ADAEM" },
    ];
    const detected = extractDetectedClubs([], [], clubsWithVariations as any);
    expect(detected.find((c) => c.code === "PIS")?.association).toBe("Lara (ADAEL)");
    expect(detected.find((c) => c.code === "CPMI")?.association).toBe("Miranda (ADAEM)");
  });

  it("supports loading associations by federation for multiple countries", () => {
    const ven = getFederation("VEN");
    expect(ven.shortName).toBe("FEVEDA");
    expect(ven.associations).toContain("Miranda (ADAEM)");
    expect(ven.associations).toContain("Lara (ADAEL)");

    const col = getFederation("COL");
    expect(col.shortName).toBe("FECNA");
    expect(col.associations).toContain("Antioquia (Liga de Natación de Antioquia)");
    expect(col.associations).toContain("Bogotá (Liga de Natación de Bogotá)");

    const esp = getFederation("ESP");
    expect(esp.shortName).toBe("RFEN");
    expect(esp.associations).toContain("Cataluña (FCN)");
    expect(esp.associations).toContain("Madrid (FMN)");

    const mex = getFederation("MEX");
    expect(mex.shortName).toBe("FMN");
    expect(mex.associations).toContain("Estado de México (ANEM)");

    const usa = getFederation("USA");
    expect(usa.shortName).toBe("USA Swimming");
    expect(usa.associations).toContain("Florida Gold Coast (FG)");

    // Normalization works across international associations
    expect(normalizeAssociationName("Antioquia")).toBe("Antioquia (Liga de Natación de Antioquia)");
    expect(normalizeAssociationName("Cataluña")).toBe("Cataluña (FCN)");
    expect(normalizeAssociationName("FG")).toBe("Florida Gold Coast (FG)");
  });
});
