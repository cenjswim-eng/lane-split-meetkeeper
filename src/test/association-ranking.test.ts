import { describe, it, expect } from "vitest";
import {
  extractDetectedClubs,
  calculateAssociationRankings,
  generateAssociationRankingPdf,
  normalizeAssociationName,
  extractAdaelClubs,
  isLikelyAdaelClub,
  KNOWN_ADAEL_CODES,
} from "@/lib/association-ranking";
import {
  getFederation,
  getAssociationsForFederation,
  findKnownClubAssociation,
  KNOWN_FEDERATION_CLUBS,
  getKnownClubsForFederation,
  loadFederationAffiliatedClubs,
} from "@/lib/federations";

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

  it("filters ranking by annual federation affiliation season (affiliationYear) and detects club seasons", () => {
    // Add multi-season results: 2025 vs 2026
    const multiSeasonResults = [
      ...mockResults,
      // Athlete 1 in 2025 (Faster than 2026: 57.00s in 2025, but 58.00s in 2026)
      {
        id: "res-2025-1",
        athlete_id: "ath-1",
        final_time_ms: 57000, // 57.00s in 2025
        course: "LCM",
        is_dq: false,
        meets: { name: "Nacional 2025", start_date: "2025-11-15" },
        events: { distance: 100, stroke: 1, is_relay: false },
      },
      // Athlete 2 in 2025 (58.50s in 2025 vs 59.00s in 2026)
      {
        id: "res-2025-2",
        athlete_id: "ath-2",
        final_time_ms: 58500,
        course: "LCM",
        is_dq: false,
        meets: { name: "Estadal 2025", start_date: "2025-05-20" },
        events: { distance: 100, stroke: 1, is_relay: false },
      },
    ];

    const detected = extractDetectedClubs(mockAthletes, multiSeasonResults, mockClubs);
    const cpmiClub = detected.find((c) => c.code === "CPMI");
    expect(cpmiClub?.affiliationYears).toContain(2026);
    expect(cpmiClub?.affiliationYears).toContain(2025);

    // 1. Filter by 2026 Annual Affiliation Season
    const res2026 = calculateAssociationRankings(
      multiSeasonResults as any,
      mockAthletes,
      detected,
      {
        association: "Miranda (ADAEM)",
        course: "LCM",
        gender: "M",
        ageMode: "libre",
        affiliationYear: 2026,
      }
    );

    const event2026 = res2026.rankings[0];
    const ath1In2026 = event2026.top5.find((item) => item.athleteName === "Pedro Pérez");
    // Pedro's time in 2026 season was 58.00s (not 57.00s which was 2025)
    expect(ath1In2026?.finalTimeMs).toBe(58000);
    expect(ath1In2026?.affiliationYear).toBe(2026);

    // 2. Filter by 2025 Annual Affiliation Season
    const res2025 = calculateAssociationRankings(
      multiSeasonResults as any,
      mockAthletes,
      detected,
      {
        association: "Miranda (ADAEM)",
        course: "LCM",
        gender: "M",
        ageMode: "libre",
        affiliationYear: 2025,
      }
    );
    const event2025 = res2025.rankings[0];
    const ath1In2025 = event2025.top5.find((item) => item.athleteName === "Pedro Pérez");
    expect(ath1In2025?.finalTimeMs).toBe(57000);
    expect(ath1In2025?.affiliationYear).toBe(2025);

    // 3. Filter by all seasons (historic best)
    const resAll = calculateAssociationRankings(
      multiSeasonResults as any,
      mockAthletes,
      detected,
      {
        association: "Miranda (ADAEM)",
        course: "LCM",
        gender: "M",
        ageMode: "libre",
        affiliationYear: "all",
      }
    );
    const eventAll = resAll.rankings[0];
    const ath1All = eventAll.top5.find((item) => item.athleteName === "Pedro Pérez");
    expect(ath1All?.finalTimeMs).toBe(57000); // 57.00 is historic best across both seasons

    // 4. PDF generation includes affiliation year label
    const pdf2026 = generateAssociationRankingPdf(res2026.rankings, {
      associationName: "Miranda (ADAEM)",
      ageModeLabel: "Categoría Libre",
      courseLabel: "50 m (LCM)",
      genderLabel: "Masculino",
      affiliationYearLabel: "Temporada de Afiliación Anual 2026",
      federationName: "FEVEDA",
      participatingClubs: res2026.participatingClubs,
    });
    expect(pdf2026).toBeDefined();
    expect(pdf2026.size).toBeGreaterThan(100);
  });

  it("extracts and detects teams belonging to ADAEL (Lara) accurately", () => {
    const clubsPool = [
      { id: "c-1", code: "PIS", name: "Piscinas Bolivarianas", association: "Lara (ADAEL)", isClub: true, athleteCount: 15, resultsCount: 40 },
      { id: "c-2", code: "HISP", name: "Hogar Hispano de Lara", association: "Sin Asociación", isClub: true, athleteCount: 12, resultsCount: 30 },
      { id: "c-3", code: "CBL", name: "Club Barquisimeto", association: "Sin Asociación", isClub: false, athleteCount: 8, resultsCount: 20 },
      { id: "c-4", code: "CIV", name: "Centro Italo Venezolano", association: "Distrito Capital (ASDAC)", isClub: true, athleteCount: 10, resultsCount: 25 },
      { id: "c-5", code: "CPMI", name: "Centro Portugués", association: "Miranda (ADAEM)", isClub: true, athleteCount: 14, resultsCount: 35 },
    ];

    expect(isLikelyAdaelClub(clubsPool[0])).toBe(true);
    expect(isLikelyAdaelClub(clubsPool[1])).toBe(true);
    expect(isLikelyAdaelClub(clubsPool[2])).toBe(true);
    expect(isLikelyAdaelClub(clubsPool[3])).toBe(false);
    expect(isLikelyAdaelClub(clubsPool[4])).toBe(false);

    const { affiliated, candidates } = extractAdaelClubs(clubsPool as any);
    expect(affiliated.map((c) => c.code)).toEqual(["PIS"]);
    expect(candidates.map((c) => c.code)).toEqual(["CBL", "HISP"]);
  });

  it("filters ranking by specifically chosen meet IDs (selectedMeetIds)", () => {
    const meetResults = [
      {
        id: "res-m1",
        athlete_id: "ath-1",
        final_time_ms: 58000,
        course: "LCM",
        is_dq: false,
        meets: { id: "meet-estadal-1", name: "I Estadal ADAEL 2026", start_date: "2026-03-01" },
        events: { distance: 100, stroke: 1, is_relay: false },
      },
      {
        id: "res-m2",
        athlete_id: "ath-1",
        final_time_ms: 55000, // Faster, but in invitational meet
        course: "LCM",
        is_dq: false,
        meets: { id: "meet-invitational", name: "Invitacional Privado", start_date: "2026-04-01" },
        events: { distance: 100, stroke: 1, is_relay: false },
      },
    ];

    const detected = extractDetectedClubs(mockAthletes, meetResults, mockClubs);

    // Only consider meet-estadal-1
    const resFiltered = calculateAssociationRankings(
      meetResults as any,
      mockAthletes,
      detected,
      {
        association: "Miranda (ADAEM)",
        course: "LCM",
        gender: "M",
        ageMode: "libre",
        selectedMeetIds: ["meet-estadal-1"],
      }
    );

    const event = resFiltered.rankings[0];
    expect(event.top5[0].finalTimeMs).toBe(58000);
    expect(event.top5[0].meetName).toBe("I Estadal ADAEL 2026");
  });

  it("identifies known official clubs from FEVEDA and other national federations", () => {
    // Lara clubs in FEVEDA
    expect(findKnownClubAssociation("PIS", "Piscinas Bolivarianas", "VEN")).toBe("Lara (ADAEL)");
    expect(findKnownClubAssociation("HISP", "Hogar Hispano", "VEN")).toBe("Lara (ADAEL)");
    expect(findKnownClubAssociation("CBL", "Club Barquisimeto", "VEN")).toBe("Lara (ADAEL)");

    // Miranda and DC clubs in FEVEDA
    expect(findKnownClubAssociation("CPMI", "Centro Portugués", "VEN")).toBe("Miranda (ADAEM)");
    expect(findKnownClubAssociation("CIV", "Centro Italo", "VEN")).toBe("Distrito Capital (ASDAC)");

    // Colombia and Spain clubs
    expect(findKnownClubAssociation("ANT", "Huracanes Antioquia", "COL")).toBe(
      "Antioquia (Liga de Natación de Antioquia)"
    );
    expect(findKnownClubAssociation("SAB", "Natació Sabadell", "ESP")).toBe("Cataluña (FCN)");

    expect(KNOWN_FEDERATION_CLUBS.length).toBeGreaterThan(20);
  });

  it("retrieves official affiliated clubs by federation via getKnownClubsForFederation", () => {
    const venClubs = getKnownClubsForFederation("VEN");
    expect(venClubs.length).toBeGreaterThan(15);
    expect(venClubs.some((c) => c.association === "Lara (ADAEL)")).toBe(true);
    expect(venClubs.some((c) => c.association === "Miranda (ADAEM)")).toBe(true);
    expect(venClubs.some((c) => c.association === "Táchira (ADAET)")).toBe(true);
    expect(venClubs.some((c) => c.association === "Mérida (ASODAME)")).toBe(true);

    const colClubs = getKnownClubsForFederation("COL");
    expect(colClubs.some((c) => c.association.includes("Antioquia"))).toBe(true);

    const espClubs = getKnownClubsForFederation("ESP");
    expect(espClubs.some((c) => c.association.includes("Cataluña"))).toBe(true);
  });

  it("supports bulk loading federation affiliated clubs into teams table", async () => {
    const upsertedRecords: any[] = [];
    const mockSupabase = {
      from: (table: string) => ({
        upsert: async (records: any[], options: any) => {
          if (table === "teams") {
            upsertedRecords.push(...records);
          }
          return { error: null };
        },
      }),
    };

    const res = await loadFederationAffiliatedClubs(mockSupabase, "user-test-123", "VEN");
    expect(res.count).toBeGreaterThan(15);
    expect(res.federation.shortName).toBe("FEVEDA");
    expect(upsertedRecords.length).toBe(res.count);
    expect(upsertedRecords[0].owner_id).toBe("user-test-123");
    expect(upsertedRecords.some((r) => r.lsc === "Lara (ADAEL)")).toBe(true);
  });

  it("filters ranking by onlyAffiliatedClubs, excluding swimmers from unattached or unaffiliated clubs", () => {
    const unattachedClub = { id: "club-un", team_code: "UNA", full_name: "Unattached Swimmer", region_lsc: null };
    const clubsWithUnattached = [...mockClubs, unattachedClub];

    const unattachedAthlete = {
      id: "ath-un",
      first_name: "Nadador",
      last_name: "Libre",
      gender: "M",
      birth_date: "2012-01-01",
      clubs: unattachedClub,
    };
    const allAthletes = [...mockAthletes, unattachedAthlete];

    const resultsWithUnattached = [
      ...mockResults,
      {
        id: "res-un",
        athlete_id: "ath-un",
        final_time_ms: 50000, // Very fast time, but unaffiliated
        course: "LCM",
        is_dq: false,
        meets: { name: "Estadal 2026", start_date: "2026-06-01" },
        events: { distance: 100, stroke: 1, is_relay: false },
      },
    ];

    const detected = extractDetectedClubs(allAthletes, resultsWithUnattached, clubsWithUnattached);

    // 1. Without onlyAffiliatedClubs (all clubs included when association is 'all')
    const resAll = calculateAssociationRankings(
      resultsWithUnattached as any,
      allAthletes,
      detected,
      {
        association: "all",
        course: "LCM",
        gender: "M",
        ageMode: "libre",
        onlyAffiliatedClubs: false,
      }
    );
    const topSwimmerAll = resAll.rankings[0].top5[0];
    expect(topSwimmerAll.athleteId).toBe("ath-un");

    // 2. With onlyAffiliatedClubs = true (unaffiliated swimmer excluded)
    const resAffiliated = calculateAssociationRankings(
      resultsWithUnattached as any,
      allAthletes,
      detected,
      {
        association: "all",
        course: "LCM",
        gender: "M",
        ageMode: "libre",
        onlyAffiliatedClubs: true,
      }
    );
    const topSwimmerAffiliated = resAffiliated.rankings[0].top5[0];
    expect(topSwimmerAffiliated.athleteId).not.toBe("ath-un");
    expect(topSwimmerAffiliated.athleteId).toBe("ath-1");
  });
});
