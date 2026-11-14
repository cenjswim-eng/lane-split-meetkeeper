import { describe, expect, it } from "vitest";
import { File as NodeFile } from "node:buffer";
import { readSwimFileText, readHytekFile } from "@/lib/hytek";
import { parseHy3 } from "@/lib/hytek/hy3";
import { parseSwimTime } from "@/lib/swim";

function record(type: string, fields: [number, string][] = []) {
  const chars = Array.from(type.padEnd(132));
  for (const [start, value] of fields) for (let i = 0; i < value.length; i++) chars[start - 1 + i] = value[i] ?? " ";
  return chars.join("");
}
const swimmer = (id = "1", first = "Ana") => record("D1", [[3, "F"], [4, id.padStart(5)], [9, "Muñoz"], [29, first], [89, "03042012"]]);
const event = (course = "L", stroke = "A") => record("E1", [[14, "F"], [16, "   100"], [22, stroke], [23, " 14"], [26, " 15"], [39, "  12"], [43, " 1:02.34"], [51, course]]);
const result = (time = "   61.23", round = "F", code = "") => record("E2", [[3, round], [4, time], [12, "L"], [13, code], [30, "   2"]]);
// JSDOM's File does not implement arrayBuffer; native Node File matches the browser API.
const file = (data: string | Uint8Array, name: string) => new NodeFile([data], name) as unknown as File;

describe("uploaded swimming time specification", () => {
  it("reads UTF-8 names without corrupting fixed columns", async () => {
    const text = swimmer();
    expect(await readSwimFileText(file(text, "utf8.hy3"))).toBe(text);
  });
  it("falls back to Windows-1252 for legacy names", async () => {
    const text = swimmer();
    const bytes = Uint8Array.from([...text].map(c => c.charCodeAt(0)));
    expect(await readSwimFileText(file(bytes, "ansi.hy3"))).toBe(text);
  });
  it("parses precise milliseconds and the short-pool suffix", () => {
    expect(parseSwimTime("1:02.345S")).toMatchObject({ timeMs: 62345, course: "S", status: "OK" });
  });
  it("parses decimal commas without float arithmetic", () => {
    expect(parseSwimTime("28,05L").timeMs).toBe(28050);
  });
  it.each(["DQ", "NS", "SCR", "DNF", "NT"])("does not turn %s into a final time", status => {
    expect(parseSwimTime(`1:02.34 ${status}`)).toMatchObject({ timeMs: null, status });
  });
  it.each(["1:72.34", "-2:01", "1e3", "28.05garbage", "Infinity"])("rejects malformed time %s", raw => {
    expect(parseSwimTime(raw)).toMatchObject({ timeMs: null, status: "INVALID" });
  });
});

describe("safe HY3 record contexts", () => {
  it("does not assign an orphan result to the preceding swimmer", () => {
    const p = parseHy3([swimmer(), event(), result(), swimmer("2", "Sara"), result("   50.00")].join("\n"));
    expect(p.results).toHaveLength(1);
    expect(p.results[0]?.finalMs).toBe(61230);
    expect(p.warningDetails?.[0]).toMatchObject({ lineNumber: 5, lineCode: "E2", rawLine: result("   50.00") });
  });
  it("resets athlete context on a new team header", () => {
    const p = parseHy3([swimmer(), event(), result(), record("C1", [[3, "OTHER"]]), event(), result()].join("\n"));
    expect(p.results).toHaveLength(1);
    expect(p.warningDetails?.[0]?.lineCode).toBe("E1");
  });
  it("rejects unknown styles instead of guessing freestyle", () => {
    const p = parseHy3([swimmer(), event("L", "Z"), result()].join("\n"));
    expect(p.results).toHaveLength(0);
    expect(p.warningDetails?.[0]?.lineNumber).toBe(2);
  });
  it("retains separate rounds even when the first swim is DQ", () => {
    const p = parseHy3([swimmer(), event(), result("   61.23", "P", "DQ"), result("   60.00", "F")].join("\n"));
    expect(p.results).toHaveLength(2);
    expect(p.results[0]).toMatchObject({ round: "P", finalMs: null, isDq: true });
    expect(p.results[1]).toMatchObject({ round: "F", finalMs: 60000, isDq: false });
  });
  it("deduplicates repeated swimmer headers without merging conflicting identities", () => {
    const p = parseHy3([swimmer(), swimmer(), event(), result(), swimmer("1", "Sara"), event(), result()].join("\n"));
    expect(p.athletes).toHaveLength(1);
    expect(p.results).toHaveLength(1);
    expect(p.warningDetails?.[0]?.lineNumber).toBe(5);
  });
  it("does not guess that relay F1 records contain individual splits", () => {
    const p = parseHy3([swimmer(), event(), record("F1"), result()].join("\n"));
    expect(p.results[0]?.finalMs).toBeNull();
    expect(p.warningDetails?.[0]?.lineCode).toBe("F1");
  });
  it("retains all 25 m splits and deduplicates repeated split records", () => {
    const splits = record("G1", [[3, " 01   15.00"], [14, " 02   30.00"], [25, " 03   45.00"], [36, " 04 1:00.00"]]);
    const p = parseHy3([swimmer(), event("S"), splits, splits].join("\n"));
    expect(p.results[0]?.splits).toEqual([25, 50, 75, 100].map((distance, i) => ({ distance, cumulative_ms: (i + 1) * 15000 })));
  });
  it("processes the actual upload entry point with event identity and category intact", async () => {
    const files = await readHytekFile(file([swimmer(), event(), result()].join("\r\n"), "test.hy3"));
    expect(files[0]?.parsed.results[0]).toMatchObject({ eventNumber: "12", distance: 100, stroke: 1, minAge: 14, maxAge: 15, seedMs: 62340, finalMs: 61230 });
  });
});