// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { accessTime, normalizeAccess, readAccessFile } from "@/lib/access";

describe("Microsoft Access Jet DB 4.0", () => {
  it("reads a real Jet 4 MDB and normalizes swimming data", async () => {
    const bytes = readFileSync(new URL("./fixtures/swimming-jet4.mdb", import.meta.url));
    expect(bytes[20]).toBe(1);
    const db = await readAccessFile(new File([bytes], "swimming.mdb"));
    expect(db.tables.map((t) => t.name)).toEqual(["Athlete", "Meet", "Events", "Results", "Splits"]);
    const [p] = normalizeAccess(db, "seconds", "LCM");
    expect(p?.format).toBe("MDB");
    expect(p?.athletes[0]).toMatchObject({ firstName: "Ana", lastName: "Prueba Access", birthDate: "2012-03-04", tmId: null });
    expect(p?.results[0]).toMatchObject({ distance: 100, stroke: 1, finalMs: 62340, splits: [{ distance: 50, cumulative_ms: 30120 }] });
  });
  it("rejects a renamed text file instead of treating it as MDB", async () => {
    await expect(readAccessFile(new File(["Standard Jet DB"], "wrong.mdb"))).rejects.toThrow("Jet DB 4.0");
  });
  it("converts the selected numeric unit but preserves explicitly declared milliseconds", () => {
    expect(accessTime({ time: 6234 }, "centiseconds", [], ["time"])).toBe(62340);
    expect(accessTime({ time: 62340 }, "milliseconds", [], ["time"])).toBe(62340);
    expect(accessTime({ final_time_ms: 62340 }, "seconds", ["final_time_ms"], [])).toBe(62340);
    expect(accessTime({ time: "1:02.34" }, "milliseconds", [], ["time"])).toBe(62340);
  });
  it("does not import an unrelated Access schema", () => {
    expect(normalizeAccess({ name: "unrelated.mdb", tables: [{ name: "Customers", columns: ["name"], rows: [{ name: "A" }] }] }, "seconds", "LCM")).toEqual([]);
  });
});