import { describe, it, expect } from "vitest";
import { buildMeetManagerEntries } from "@/lib/hytek/meet-manager-entries";
import type { ExportRow } from "@/lib/hytek/sdif";
const meet = { name: "Copa del club", location: "Caracas", start_date: "2026-11-10", end_date: "2026-11-11", course: "LCM" };
const row: ExportRow = { athlete: { first_name: "José", last_name: "Pérez", birth_date: "2010-02-03", gender: "M", federation_id: "1234", team_code: "CLUB" }, event: { event_number: "12", distance: 100, stroke: 1, gender: "M", min_age: 15, max_age: 17 }, seed_time_ms: 62340, final_time_ms: 59000, is_dq: false, place: 1, aqua_points: 500, course: "LCM", round: "F", splits: [{ split_distance: 50, cumulative_time_ms: 29000 }] };
const build = (rows = [row]) => buildMeetManagerEntries(meet, rows, [{ code: "CLUB", name: "Club Natación" }], new Date("2026-11-02T00:00:00Z"));
describe("Meet Manager SDIF v3 registrations", () => {
  it("uses A0 file type 01 and software at official offsets", () => {
    const a = build().split("\r\n")[0] ?? "";
    expect(a.slice(0, 2)).toBe("A0"); expect(a.slice(3, 11).trim()).toBe("V3.0"); expect(a.slice(11, 13)).toBe("01"); expect(a.slice(43, 63).trim()).toBe("Swim Lane Coach"); expect(a.slice(105, 113)).toBe("11022026");
  });
  it("writes C1 team identity, mandatory C2 counts and Z0 totals", () => {
    const lines = build([row, { ...row, event: { ...row.event, event_number: "13", distance: 200 } }]).split("\r\n").filter(Boolean);
    const c1 = lines.find(l => l.startsWith("C1")) ?? "", c2 = lines.find(l => l.startsWith("C2")) ?? "", z = lines.at(-1) ?? "";
    expect(c1.slice(11, 17)).toBe("  CLUB"); expect(c1.slice(17, 47).trim()).toBe("Club Natacion"); expect(c2.slice(59, 65).trim()).toBe("2"); expect(c2.slice(65, 71).trim()).toBe("1"); expect(z.slice(11, 13)).toBe("01"); expect(z.slice(57, 63).trim()).toBe("2"); expect(z.slice(63, 69).trim()).toBe("1");
    expect(lines.every(l => l.length === 160 && new TextEncoder().encode(l).length === 160)).toBe(true);
  });
  it("writes seed and pool without final times, places or splits", () => {
    const text = build(), d = text.split("\r\n").find(l => l.startsWith("D0")) ?? "";
    expect(d.slice(11, 39).trim()).toBe("Perez, Jose"); expect(d.slice(55, 63)).toBe("02032010"); expect(d.slice(72, 76).trim()).toBe("12"); expect(d.slice(88, 96).trim()).toBe("1:02.34"); expect(d[96]).toBe("L"); expect(d.slice(97).trim()).toBe(""); expect(text.includes("G0")).toBe(false);
  });
  it("supports NT entries and SCM course explicitly", () => {
    const text = buildMeetManagerEntries({ ...meet, course: "SCM" }, [{ ...row, course: "SCM", seed_time_ms: null }], []);
    const d = text.split("\r\n").find(l => l.startsWith("D0")) ?? "";
    expect(d.slice(88, 96).trim()).toBe("NT"); expect(d[96]).toBe("S");
  });
  it("rejects missing identity, duplicate entries and wrong event sex", () => {
    expect(() => build([{ ...row, athlete: { ...row.athlete, birth_date: null } }])).toThrow(/nacimiento/);
    expect(() => build([row, row])).toThrow(/duplicada/);
    expect(() => build([{ ...row, event: { ...row.event, gender: "F" } }])).toThrow(/sexo/);
    expect(() => build([{ ...row, event: { ...row.event, event_number: null } }])).toThrow(/número/);
  });
});