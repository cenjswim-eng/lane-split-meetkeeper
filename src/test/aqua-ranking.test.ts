import { describe, it, expect } from "vitest";
import { aquaRanking } from "@/lib/entry-rules";
import type { DashboardResult } from "@/lib/dashboard-summary";

const now = new Date("2026-11-04T00:00:00Z");
const swim = (athlete_id: string, aqua_points: number | null): DashboardResult & { aqua_points: number | null } => ({
  id: athlete_id, athlete_id, aqua_points, final_time_ms: 60000, is_dq: false, course: "LCM",
  meets: { id: "meet", name: "Campeonato", start_date: "2026-08-13" },
  events: { distance: 100, stroke: 1, is_relay: false },
  athletes: { first_name: athlete_id, last_name: "Atleta", gender: "M", birth_date: "2010-01-01" },
});
describe("ranking interno AQUA", () => {
  it("orders by highest points rather than fastest raw time", () => {
    const rows = aquaRanking([swim("a", 500), { ...swim("b", 700), final_time_ms: 120000 }], now);
    expect(rows.map(r => [r.athlete_id, r.aqua_points, r.rank])).toEqual([["b",700,1],["a",500,2]]);
  });
  it("keeps only the best score per athlete without summing repeated swims", () => {
    expect(aquaRanking([swim("a",500),swim("a",600),swim("a",600),swim("b",700)],now).map(r=>[r.athlete_id,r.aqua_points])).toEqual([["b",700],["a",600]]);
  });
  it("gives equal scores equal positions", () => {
    expect(aquaRanking([swim("a",700),swim("b",700),swim("c",500)],now).map(r=>r.rank)).toEqual([1,1,3]);
  });
  it("excludes old, disqualified, relay and unscored results", () => {
    expect(aquaRanking([
      { ...swim("old",900),meets:{id:"old",name:"Antigua",start_date:"2026-02-03"} },
      {...swim("dq",900),is_dq:true}, {...swim("relay",900),events:{distance:100,stroke:1,is_relay:true}},
      swim("missing",null),swim("zero",0),swim("valid",500),
    ],now).map(r=>r.athlete_id)).toEqual(["valid"]);
  });
});