import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ results: new Map<string, unknown>(), meets: new Map<string, string>() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  rpc: vi.fn(async (_name, args) => {
    if (args.p_kind === "event") return { data: "event-1", error: null };
    const key = JSON.stringify(args.p_data);
    state.meets.set(key, "meet-1"); return { data: state.meets.get(key), error: null };
  }),
  from: (table: string) => {
    const chain = { select: () => chain, eq: () => chain, is: () => chain, ilike: () => chain, limit: () => chain,
      maybeSingle: async () => ({ data: { id:"athlete-1" }, error:null }),
      single: async () => ({ data:{id:"result-1"},error:null }),
      upsert: (row: Record<string,unknown>) => { if(table === "results") state.results.set(`${row.athlete_id}|${row.event_id}|${row.round}`,row);return chain; },
      insert: () => chain, update: () => chain,
      then: (resolve: (v: unknown) => unknown) => Promise.resolve({data:[],error:null}).then(resolve),
    }; return chain;
  },
} }));
import { importParsed } from "@/lib/importer";
import type { ParsedFile } from "@/lib/hytek";
describe("Meet reimport", () => {
  it("reuses competition and athlete/result identities when the filename changes", async () => {
    state.results.clear();state.meets.clear();
    const file: ParsedFile = {format:"HY3",meet:{name:"Copa",startDate:"2026-08-01",endDate:null,location:null,course:"LCM"},teams:[],warnings:[],athletes:[{key:"a",tmId:"123",federationId:null,firstName:"Ana",lastName:"Perez",birthDate:null,gender:"F",teamCode:null}],results:[{athleteKey:"a",eventNumber:null,distance:100,stroke:1,gender:"F",minAge:null,maxAge:null,seedMs:null,finalMs:62000,course:"LCM",place:null,isDq:false,round:"F",splits:[]}]};
    const a=await importParsed("first.hy3",file); const b=await importParsed("renamed.hy3",file);
    expect(a.meetId).toBe(b.meetId);expect(state.meets.size).toBe(1);expect(state.results.size).toBe(1);
  });
});