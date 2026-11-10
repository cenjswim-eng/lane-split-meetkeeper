import { describe, expect, it } from "vitest";
import { activeStandardVersion, compareStandardVersions, versionStandards } from "@/lib/standard-versions";
import { athleteMinimum } from "@/lib/athlete-minimum";
import type { StandardVersion } from "@/lib/standard-versions";

const row = { name: "FEVEDA", season_year: 2026, age_group: "Juvenil B", age_min: 16, age_max: 18, gender: "M", distance: 100, stroke: 1, course: "LCM", qualifying_time_ms: 60000 };
const version = (id: string, imported_at: string, active: boolean): StandardVersion => ({ id, owner_id: "owner", document_name: "FEVEDA 2026", season_year: 2026, imported_at, effective_from: null, active, standards: [row], warnings: [] });
const athlete = { birth_date: "2008-12-30", gender: "M" };
const result = { final_time_ms: 62500, is_dq: false, course: "LCM", events: { distance: 100, stroke: 1 }, meets: { start_date: "2026-08-13" } };

describe("official minimum versions", () => {
  it("uses the latest marked active version, not an inactive newer import", () => {
    expect(activeStandardVersion([version("a", "2026-01-01", true), version("b", "2026-03-01", true), version("c", "2026-05-01", false)])?.id).toBe("b");
  });
  it("keeps earlier snapshots unchanged when the active version changes", () => {
    const old = version("a", "2026-01-01", true);
    const snapshot = versionStandards(old);
    const next = { ...version("b", "2026-02-01", true), standards: [{ ...row, qualifying_time_ms: 59000 }] };
    expect(athleteMinimum(athlete, result, versionStandards(next))?.remaining_ms).toBe(3500);
    expect(athleteMinimum(athlete, result, snapshot)?.remaining_ms).toBe(2500);
    expect(old.standards).toEqual([row]);
  });
  it("returns no invented marks without an active version", () => {
    expect(versionStandards(activeStandardVersion([version("a", "2026-01-01", false)]))).toEqual([]);
  });
  it("matches sex, age, event and pool from the imported document", () => {
    const standards = versionStandards(version("a", "2026-01-01", true));
    expect(athleteMinimum(athlete, result, standards)?.limit_ms).toBe(60000);
    for (const change of [{ gender: "F" }, { age_max: 17 }, { distance: 200 }, { stroke: 2 }, { course: "SCM" }]) {
      expect(athleteMinimum(athlete, result, standards.map(s => ({ ...s, ...change })))).toBeNull();
    }
  });
  it("uses competition-year Dec-31 age even when generating a later report", () => {
    const standards = versionStandards(version("a", "2026-01-01", true));
    expect(athleteMinimum(athlete, result, standards)?.limit_ms).toBe(60000);
    expect(athleteMinimum(athlete, { ...result, meets: { start_date: "2027-01-01" } }, standards)).toBeNull();
  });
  it("summarizes changed, new, absent and unchanged marks against the previous version", () => {
    const before = versionStandards(version("a", "2026-01-01", true));
    const changes = compareStandardVersions([...before, { ...before[0], id: "absent", distance: 200 } as typeof before[number]], [{ ...before[0], id: "changed", qualifying_time_ms: 59000 } as typeof before[number], { ...before[0], id: "new", course: "SCM" } as typeof before[number]]);
    expect(changes.changed[0]?.before.qualifying_time_ms).toBe(60000);
    expect(changes.changed[0]?.after.qualifying_time_ms).toBe(59000);
    expect(changes.added).toHaveLength(1);
    expect(changes.removed).toHaveLength(1);
    expect(changes.unchanged).toBe(0);
  });
});