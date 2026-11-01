import { describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({ results: new Map<string, unknown>(), meets: new Map<string, string>() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  auth: { getUser: async () => ({ data: { user: { id: 'owner-1' } }, error: null }) },
  rpc: vi.fn(async (_name, args) => {
    if (args.p_kind === "event") return { data: "event-1", error: null };
    const key = JSON.stringify(args.p_data);
    state.meets.set(key, "meet-1"); return { data: state.meets.get(key), error: null };
  }),
  from: (table: string) => {
    const chain = { select: () => chain, eq: () => chain, is: () => chain, ilike: () => chain, limit: () => chain,
      maybeSingle: async () => ({ data: { id:"athlete-1" }, error:null }),
      single: async () => ({ data:{id:"result-1"},error:null }),
      upsert: (row: Record<string,unknown>) => { if(table === "results") { const key = `${row['athlete_id']}|${row['event_id']}|${row['round']}`; state.results.set(key, { ...(state.results.get(key) as object ?? {}), ...row }); } return chain; },
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
    file.results[0] = { ...file.results[0], finalMs: 61000 } as ParsedFile["results"][number];
    await importParsed("updated.hy3", file);
    expect([...state.results.values()][0]).toMatchObject({ final_time_ms: 61000 });
    file.results[0] = { ...file.results[0], finalMs: null, seedMs: 63000 } as ParsedFile["results"][number];
    await importParsed("entries.hy3", file);
    expect([...state.results.values()][0]).toMatchObject({ final_time_ms: 61000, seed_time_ms: 63000 });
  });
});