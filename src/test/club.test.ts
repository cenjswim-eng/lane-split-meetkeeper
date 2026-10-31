import { describe, expect, it } from "vitest";
import { mapClubMembers, MEMBER_ROLES, suggestMemberMapping } from "@/lib/club";
const table = { name: "Athlete", columns: ["athlete_id", "first_name", "last_name", "birth_date"], rows: [{ athlete_id: 1, first_name: "Ana", last_name: "Perez", birth_date: new Date("2012-03-04T00:00:00Z") }] };
describe("club membership", () => {
  it("supports swimmers, coaches, directors and staff", () => { expect(Object.keys(MEMBER_ROLES)).toEqual(["nadador", "entrenador", "directivo", "personal"]); });
  it("maps Access fields without importing meet results", () => { const r = mapClubMembers(table, suggestMemberMapping(table), "entrenador"); expect(r.members[0]).toMatchObject({ first_name: "Ana", last_name: "Perez", member_role: "entrenador", birth_date: "2012-03-04", source_key: "athlete:1" }); });
  it("gives the same identity to a reimported row and skips duplicates", () => { const r = mapClubMembers({ ...table, rows: [...table.rows, ...table.rows] }, suggestMemberMapping(table), "nadador"); expect(r.members).toHaveLength(1); expect(r.skipped).toBe(1); expect(r.members[0]?.source_key).toBe("athlete:1"); });
});