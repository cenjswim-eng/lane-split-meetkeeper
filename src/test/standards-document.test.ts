import { describe, expect, it } from "vitest";
import { parseStandardsDocument } from "@/lib/standards-document";
describe("credit-free standards document parsing", () => {
  it("warns about an event row without readable times", () => {
    const r = parseStandardsDocument(["Masculino", "Juvenil B", "100 Libre ilegible"], "LCM");
    expect(r.rows).toEqual([]);
    expect(r.warnings).toHaveLength(1);
  });
  it("maps explicit category columns and gender without inventing standards", () => {
    const r = parseStandardsDocument(["Femenino", "Infantil A  Infantil B", "100 Libre  1:20,30  1:15,40"], "SCM");
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toMatchObject({ category: "Infantil A (10-11 años)", gender: "F", distance: 100, stroke: 1, time: "1:20.30", course: "SCM" });
    expect(r.rows[1]?.time).toBe("1:15.40");
  });
  it("rejects ambiguous columns rather than assigning official times incorrectly", () => {
    const r = parseStandardsDocument(["Masculino", "Infantil A  Infantil B", "100 Libre  1:20.30"], "LCM");
    expect(r.rows).toEqual([]); expect(r.warnings).toHaveLength(1);
  });
});