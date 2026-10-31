import { describe, expect, it } from "vitest";
import { decodeHytek } from "@/lib/hytek";
import { parseHy3 } from "@/lib/hytek/hy3";
import { mdyToIso } from "@/lib/hytek/types";

function record(type: string, fields: [number, string][]) {
  const chars = Array.from(type.padEnd(132));
  for (const [start, value] of fields) for (let i = 0; i < value.length; i++) chars[start - 1 + i] = value[i] ?? " ";
  return chars.join("");
}

const athlete = (birth: string) => record("D1", [[3, "M"], [4, "    3"], [9, "Cabré"], [29, "Manuel"], [89, birth]]);
const event = record("E1", [[14, "M"], [16, "   100"], [22, "A"], [39, "   1"], [51, "L"]]);
const result = "E2F   62.34L";

describe("importación de tiempos HY3", () => {
  it("conserva columnas y nombres con acentos en archivos Windows-1252", () => {
    const raw = [record("C1", [[3, "TEST "]]), athlete("08262011"), event, result].join("\r\n");
    const bytes = Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
    const parsed = parseHy3(decodeHytek(bytes));
    expect(parsed.athletes[0]).toMatchObject({ firstName: "Manuel", lastName: "Cabré", birthDate: "2011-08-26" });
    expect(parsed.results[0]).toMatchObject({ finalMs: 62340, distance: 100 });
  });
  it("una fecha imposible no impide recuperar el tiempo", () => {
    const parsed = parseHy3([athlete("13201016"), event, result].join("\n"));
    expect(parsed.athletes[0]?.birthDate).toBeNull();
    expect(parsed.results[0]?.finalMs).toBe(62340);
    expect(parsed.warnings.length).toBe(1);
  });
  it("rechaza fechas fuera del calendario", () => {
    expect(mdyToIso("13201016")).toBeNull();
    expect(mdyToIso("02302026")).toBeNull();
    expect(mdyToIso("02292024")).toBe("2024-02-29");
  });
});