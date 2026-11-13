import { describe, expect, it } from "vitest";
import { scopeClubData, type ClubCoachData } from "@/lib/club-management";

const data = {
 athletes: [{ id: "a", club_id: "club-a" }, { id: "b", club_id: "club-b" }, { id: "unassigned", club_id: null }],
 meets: [{ id: "meet" }, { id: "other" }], events: [{ id: "event", meet_id: "meet" }, { id: "other-event", meet_id: "other" }],
 entries: [{ id: "entry-a", athlete_id: "a", meet_id: "meet" }, { id: "entry-b", athlete_id: "b", meet_id: "meet" }],
 results: [{ id: "result-a", athlete_id: "a" }, { id: "result-b", athlete_id: "b" }],
 standards: [], versions: [], activeVersion: null,
} as unknown as ClubCoachData;
const links = [{ club_id: "club-a", meet_id: "meet" }, { club_id: "club-b", meet_id: "meet" }];
describe("private club management", () => {
 it("shows only athletes explicitly assigned to the selected club", () => { expect(scopeClubData(data, "club-a", links).athletes.map(a => a.id)).toEqual(["a"]); });
 it("shows only competitions added to the selected club", () => { expect(scopeClubData(data, "club-a", links).meets.map(m => m.id)).toEqual(["meet"]); });
 it("separates club registrations even when two clubs attend the same meet", () => { expect(scopeClubData(data, "club-a", links).entries.map(e => e.id)).toEqual(["entry-a"]); expect(scopeClubData(data, "club-b", links).entries.map(e => e.id)).toEqual(["entry-b"]); });
 it("never falls back to all data for an unknown club", () => { const scoped = scopeClubData(data, "unknown", links); expect(scoped.athletes).toEqual([]); expect(scoped.meets).toEqual([]); expect(scoped.entries).toEqual([]); });
});