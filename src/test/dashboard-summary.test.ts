import { describe, it, expect } from "vitest";
import { dashboardSummary, type DashboardResult, type DashboardStandard } from "@/lib/dashboard-summary";

const now = new Date("2026-11-02T18:58:00Z");
const row: DashboardResult = { id: "r1", athlete_id: "a1", final_time_ms: 60000, is_dq: false, course: "LCM", meets: { id: "m1", name: "Meet", start_date: "2026-02-02" }, events: { distance: 100, stroke: 1, is_relay: false }, athletes: { first_name: "Ana", last_name: "Perez", gender: "F", birth_date: "2014-12-25" } };
const standard: DashboardStandard = { id: "s1", course: "LCM", distance: 100, stroke: 1, gender: "F", age_group: "11-12", qualifying_time_ms: 60000 };
describe("resumen del entrenador", () => {
  it("incluye solo los últimos nueve meses, sin futuras marcas", () => {
    const data = dashboardSummary([row, { ...row, id: "old", meets: { ...row.meets, id: "m2", name: "Old", start_date: "2026-02-01" } }, { ...row, id: "future", meets: { id: "m3", name: "Next", start_date: "2026-11-03" } }], [], now);
    expect(data.recent.map(r => r.id)).toEqual(["r1"]);
    expect(data.months.reduce((total, month) => total + month.swims, 0)).toBe(1);
  });
  it("separa mejores marcas por atleta y piscina sin contar nados repetidos", () => {
    expect(dashboardSummary([row, { ...row, id: "r2", final_time_ms: 61000 }, { ...row, id: "r3", course: "SCM" }, { ...row, id: "r4", athlete_id: "a2" }], [], now).bestCount).toBe(3);
  });
  it("compara mínimas inclusive usando edad del 31 de diciembre, sexo y piscina", () => {
    expect(dashboardSummary([row], [standard], now).qualifiedCount).toBe(1);
    for (const changed of [{ age_group: "9-10" }, { gender: "M" }, { course: "SCM" }, { qualifying_time_ms: 59990 }]) expect(dashboardSummary([row], [{ ...standard, ...changed }], now).qualifiedCount).toBe(0);
  });
  it("excluye descalificaciones y relevos del resumen individual", () => {
    expect(dashboardSummary([{ ...row, is_dq: true }, { ...row, id: "relay", events: { distance: 400, stroke: 1, is_relay: true } }], [standard], now).bestCount).toBe(0);
  });
});