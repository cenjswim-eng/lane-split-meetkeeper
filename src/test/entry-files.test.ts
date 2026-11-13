import { describe, expect, it } from "vitest";
import { prepareEntries } from "@/lib/entry-files";
import type { coachQuery } from "@/lib/coach-data";

type CoachData = Awaited<ReturnType<typeof coachQuery.queryFn & {}>>;
const data = {
  meets: [{ id: "meet", name: "COPA SOMOS TENAZ 2026", location: "Caracas", start_date: "2026-11-13", end_date: null, course: "LCM" }],
  athletes: [{ id: "athlete", first_name: "Ana", last_name: "Perez", birth_date: "2012-04-20", gender: "F", federation_id: "123456", teams: { code: "CLUB", name: "Club" } }],
  events: [{ id: "event", meet_id: "meet", event_number: "12", distance: 100, stroke: 1, gender: "F", min_age: 14, max_age: 15 }],
  entries: [{ id: "entry", meet_id: "meet", athlete_id: "athlete", event_id: "event", seed_time_ms: 62340 }, { id: "other-entry", meet_id: "other", athlete_id: "athlete", event_id: "event", seed_time_ms: 60000 }],
  results: [], standards: [], versions: [], activeVersion: null,
} as unknown as CoachData;

function read(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

describe("saved registrations export", () => {
  it("includes every saved registration for the selected meet", async () => {
    const saved = { ...data, events: [...data.events, { ...data.events[0], id: "event-2", event_number: "15", distance: 200, stroke: 4 }], entries: [...data.entries, { ...data.entries[0], id: "entry-2", event_id: "event-2" }] } as CoachData;
    const records = (await read(prepareEntries(saved, "meet", "sd3"))).split("\r\n").filter(r => r.startsWith("D0"));
    expect(records).toHaveLength(2);
    expect(records.map(r => r.slice(72, 76).trim())).toEqual(["12", "15"]);
  });
  it("includes the saved event number in D0 columns 73–76", async () => {
    const record = (await read(prepareEntries(data, "meet", "sd3"))).split("\r\n").find(r => r.startsWith("D0"));
    expect(record?.slice(72, 76)).toBe("  12");
  });
  it("includes the saved stroke in D0 column 72", async () => {
    const saved = { ...data, events: [{ ...data.events[0], stroke: 4 }] } as CoachData;
    const record = (await read(prepareEntries(saved, "meet", "sd3"))).split("\r\n").find(r => r.startsWith("D0"));
    expect(record?.slice(71, 72)).toBe("4");
  });
  it("includes the saved distance in D0 columns 68–71", async () => {
    const record = (await read(prepareEntries(data, "meet", "sd3"))).split("\r\n").find(r => r.startsWith("D0"));
    expect(record?.slice(67, 71)).toBe(" 100");
  });
  it("includes the event age category, not the swimmer's age, in D0 columns 77–80", async () => {
    const record = (await read(prepareEntries(data, "meet", "sd3"))).split("\r\n").find(r => r.startsWith("D0"));
    expect(record?.slice(76, 80)).toBe("1415");
  });
  it("preserves open-ended event age categories in SDIF", async () => {
    const saved = { ...data, events: [{ ...data.events[0], min_age: 19, max_age: null }] } as CoachData;
    const record = (await read(prepareEntries(saved, "meet", "sd3"))).split("\r\n").find(r => r.startsWith("D0"));
    expect(record?.slice(76, 80)).toBe("19OV");
  });
  it("exports only saved entries for the selected meet as SDIF v3 registrations", async () => {
    const file = prepareEntries(data, "meet", "sd3");
    expect(file.name).toBe("COPA_SOMOS_TENAZ_2026_inscripciones.sd3");
    const records = (await read(file)).split("\r\n").filter(Boolean);
    expect(records[0]?.slice(11, 13)).toBe("01");
    const entries = records.filter(r => r.startsWith("D0"));
    expect(entries).toHaveLength(1);
    expect(entries[0]?.slice(72, 76).trim()).toBe("12");
    expect(entries[0]?.slice(88, 96).trim()).toBe("1:02.34");
    expect(entries[0]?.slice(96, 97)).toBe("L");
    expect(entries[0]?.slice(97).trim()).toBe("");
    expect(records.some(r => r.startsWith("G0"))).toBe(false);
  });
  it("never silently omits a saved entry with an unavailable athlete or event", () => {
    expect(() => prepareEntries({ ...data, entries: [...data.entries, { ...data.entries[0], id: "missing", meet_id: "meet", athlete_id: "missing" }] } as CoachData, "meet", "sd3")).toThrow(/atleta o prueba/);
    expect(() => prepareEntries({ ...data, events: [] }, "meet", "sd3")).toThrow(/atleta o prueba/);
  });
});