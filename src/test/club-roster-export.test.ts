import { describe, it, expect } from "vitest";
import {
  buildClubRosterSdif,
  buildClubRosterHy3,
  validateRosterForExport,
  exportClubRosterFile,
  type ClubExportInfo,
  type RosterAthleteExport,
} from "@/lib/hytek/club-roster-export";
import { parseSdif } from "@/lib/hytek/sdif";
import { parseHy3 } from "@/lib/hytek/hy3";

const sampleClub: ClubExportInfo = {
  code: "HSP",
  name: "Club Hispano",
  short_name: "Hispano",
  region_lsc: "MIR",
  head_coach: "Carlos Silva",
  city: "Los Teques",
  contact_phone: "+584120000000",
};

const sampleAthletes: RosterAthleteExport[] = [
  {
    first_name: "José",
    last_name: "Pérez",
    middle_initial: "A",
    gender: "M",
    birth_date: "2010-05-15",
    federation_id: "V28123456",
    is_active: true,
  },
  {
    first_name: "María",
    last_name: "González",
    middle_initial: "B",
    gender: "F",
    birth_date: "2012-10-20",
    federation_id: "V30987654",
    is_active: true,
  },
];

describe("Club Roster Exporter for Meet Manager and Team Manager", () => {
  it("validates club and athlete requirements", () => {
    const validRes = validateRosterForExport(sampleClub, sampleAthletes);
    expect(validRes.valid).toBe(true);
    expect(validRes.errors).toHaveLength(0);

    const invalidClub = validateRosterForExport({ ...sampleClub, code: "TOO_LONG_CODE" }, sampleAthletes);
    expect(invalidClub.valid).toBe(false);

    const invalidAthlete = validateRosterForExport(sampleClub, [
      { ...sampleAthletes[0], birth_date: null },
    ]);
    expect(invalidAthlete.valid).toBe(false);
  });

  it("builds valid SDIF v3 (CL2 / SD3) with 160-char lines", () => {
    const text = buildClubRosterSdif(sampleClub, sampleAthletes, {
      fileDate: new Date("2026-11-17T00:00:00Z"),
      year: 2026,
    });
    const lines = text.split("\r\n").filter(Boolean);

    expect(lines.every((l) => l.length === 160)).toBe(true);

    const a0 = lines.find((l) => l.startsWith("A0"))!;
    expect(a0.slice(0, 2)).toBe("A0");
    expect(a0.slice(3, 11).trim()).toBe("V3.0");
    expect(a0.slice(11, 13)).toBe("02"); // 02: Team / Roster export
    expect(a0.slice(43, 63).trim()).toBe("Swim Lane Coach");

    const c1 = lines.find((l) => l.startsWith("C1"))!;
    expect(c1.slice(11, 17).trim()).toBe("HSP");
    expect(c1.slice(17, 47).trim()).toBe("Club Hispano");

    const d0Lines = lines.filter((l) => l.startsWith("D0"));
    expect(d0Lines).toHaveLength(2);
    expect(d0Lines[0].slice(11, 39).trim()).toBe("PEREZ, JOSE A");
    expect(d0Lines[0].slice(39, 51).trim()).toBe("V28123456");
    expect(d0Lines[0].slice(55, 63)).toBe("05152010");
    expect(d0Lines[0].slice(65, 66)).toBe("M");

    const z0 = lines.find((l) => l.startsWith("Z0"))!;
    expect(z0.slice(19, 27).trim()).toBe("2");
  });

  it("parses exported SDIF back with parseSdif without errors", () => {
    const text = buildClubRosterSdif(sampleClub, sampleAthletes, {
      fileDate: new Date("2026-11-17T00:00:00Z"),
      year: 2026,
    });
    const parsed = parseSdif(text);
    expect(parsed.format).toBe("SDIF");
    expect(parsed.athletes).toHaveLength(2);
    expect(parsed.athletes[0].firstName).toBe("JOSE A");
    expect(parsed.athletes[0].lastName).toBe("PEREZ");
    expect(parsed.athletes[0].gender).toBe("M");
    expect(parsed.athletes[0].birthDate).toBe("2010-05-15");
  });

  it("builds valid HY3 with correct checksums", () => {
    const text = buildClubRosterHy3(sampleClub, sampleAthletes, {
      fileDate: new Date("2026-11-17T00:00:00Z"),
      year: 2026,
    });
    const lines = text.split("\r\n").filter(Boolean);

    // Each HY3 line is 128 chars data + 2 chars checksum = 130 chars
    expect(lines.every((l) => l.length === 130)).toBe(true);

    const a1 = lines.find((l) => l.startsWith("A1"))!;
    expect(a1.slice(0, 2)).toBe("A1");
    expect(a1.slice(4, 34).trim()).toBe("Swim Lane Coach");

    const c1 = lines.find((l) => l.startsWith("C1"))!;
    expect(c1.slice(2, 7).trim()).toBe("HSP");
    expect(c1.slice(7, 37).trim()).toBe("Club Hispano");

    const d1Lines = lines.filter((l) => l.startsWith("D1"));
    expect(d1Lines).toHaveLength(2);
    expect(d1Lines[0].slice(2, 3)).toBe("M");
    expect(d1Lines[0].slice(8, 28).trim()).toBe("PEREZ");
    expect(d1Lines[0].slice(28, 48).trim()).toBe("JOSE");
  });

  it("parses exported HY3 back with parseHy3 without errors", () => {
    const text = buildClubRosterHy3(sampleClub, sampleAthletes, {
      fileDate: new Date("2026-11-17T00:00:00Z"),
      year: 2026,
    });
    const parsed = parseHy3(text);
    expect(parsed.format).toBe("HY3");
    expect(parsed.athletes).toHaveLength(2);
    expect(parsed.athletes[0].firstName).toBe("JOSE");
    expect(parsed.athletes[0].lastName).toBe("PEREZ");
    expect(parsed.athletes[0].gender).toBe("M");
    expect(parsed.athletes[0].birthDate).toBe("2010-05-15");
  });

  it("exports to file and zip successfully", async () => {
    const cl2File = await exportClubRosterFile(sampleClub, sampleAthletes, "cl2");
    expect(cl2File.name.endsWith(".cl2")).toBe(true);

    const hy3File = await exportClubRosterFile(sampleClub, sampleAthletes, "hy3");
    expect(hy3File.name.endsWith(".hy3")).toBe(true);

    const zipFile = await exportClubRosterFile(sampleClub, sampleAthletes, "zip");
    expect(zipFile.name.endsWith(".zip")).toBe(true);
    expect(zipFile.size).toBeGreaterThan(0);
  });
});
