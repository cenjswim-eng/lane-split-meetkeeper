import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { parseEventSetup } from "@/lib/hytek/event-setup";
import { readHytekFile, decodeHytek } from "@/lib/hytek";

const head = "COPA SOMOS TENAZ 2026;Piscina;11/12/2026;11/14/2026;11/14/2026;LS;0;0;0;Created by Hy-Tek's MEET MANAGER;Club;8.0;11/01/2026";
const event = (changes: Record<number, string> = {}) => {
  const f = "1;1A;F;1;I;G;10;11;100;A;0;;;N;0;;;;;;;1;1;1;09:00AM;L;0;0;0;0".split(";");
  Object.entries(changes).forEach(([i, v]) => { f[Number(i)] = v; });
  return f.join(";") + "*>";
};
const ev3 = `${head}*>\r\n${event({16:"1:12.34",18:"1:10.00",20:"1:01.20"})}`;
const hyv = "COPA SOMOS TENAZ 2026;11/12/2026;11/14/2026;11/14/2026;L;Piscina;;Hy-Tek;8.0;CN;123\r\n1A;F;F;I;10;11;100;1;;1:12.34;;0;;1:10.00;;1:01.20;;";
describe("Hy-Tek meet setup", () => {
  it("extracts name, US dates, pool, number, stroke, age and gender", () => {
    const p = parseEventSetup("copa.EV3", ev3);
    expect(p.meet).toMatchObject({ name:"COPA SOMOS TENAZ 2026",startDate:"2026-11-12",endDate:"2026-11-14",course:"LCM" });
    expect(p.events?.[0]).toMatchObject({ eventNumber:"1A",stroke:1,distance:100,minAge:10,maxAge:11,gender:"F" });
  });
  it("keeps qualifying cuts in milliseconds separately for each pool", () => {
    expect(parseEventSetup("copa.ev3",ev3).events?.[0]?.qualifyingTimesMs).toEqual({LCM:72340,SCM:70000,SCY:61200});
    expect(parseEventSetup("copa.hyv",hyv).events?.[0]?.qualifyingTimesMs).toEqual({LCM:72340,SCM:70000,SCY:61200});
  });
  it("reads SCM HYV rotation and relay identity without fabricating results", () => {
    const p = parseEventSetup("copa.hyv",hyv.replace(";L;Piscina",";S;Piscina").replace(";I;10;11;100;1", ";R;10;0;200;5"));
    expect(p.events?.[0]).toMatchObject({stroke:7,maxAge:null,course:"SCM",qualifyingTimesMs:{SCM:72340,SCY:70000,LCM:61200}});
    expect(p.results).toEqual([]);expect(p.athletes).toEqual([]);
  });
  it("uses per-event course rather than accepted entry courses", () => {
    expect(parseEventSetup("copa.ev3",`${head}*>\n${event({25:"S"})}`).meet.course).toBe("SCM");
  });
  it("keeps empty limits empty and rejects corrupt, unknown and truncated data", () => {
    expect(parseEventSetup("copa.ev3",`${head}*>\n${event()}`).events?.[0]?.qualifyingTimesMs).toEqual({LCM:null,SCM:null,SCY:null});
    for (const text of ["", "<html>error</html>", "\x00binary", `${head}\n1;incomplete`, `${head}\n${event({5:"?"})}`,`${head}\n${event({16:"12abc"})}`,ev3.replace("11/12/2026","02/30/2026")]) expect(() => parseEventSetup("bad.ev3",text)).toThrow();
  });
  it("decodes legacy Windows-1252 accents", () => {
    expect(decodeHytek(new Uint8Array([78,97,116,97,99,105,243,110]))).toBe("Natación");
  });
  it("reads ZIP pairs once, preferring EV3 and rejecting empty archives", async () => {
    const zip = new JSZip();zip.file("nested/copa.ev3",ev3);zip.file("nested/copa.hyv",hyv);
    const bytes = await zip.generateAsync({type:"arraybuffer"});
    const p = await readHytekFile({name:"copa.zip",size:bytes.byteLength,arrayBuffer:async()=>bytes} as File);
    expect(p).toHaveLength(1);expect(p[0]?.parsed.format).toBe("EV3");
    const empty = await new JSZip().generateAsync({type:"arraybuffer"});
    await expect(readHytekFile({name:"empty.zip",size:empty.byteLength,arrayBuffer:async()=>empty} as File)).rejects.toThrow();
  });
});