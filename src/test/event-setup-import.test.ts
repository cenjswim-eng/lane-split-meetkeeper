import { describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc:vi.fn(),from:vi.fn() }));
vi.mock("@/integrations/supabase/client",()=>({supabase:{auth:{getUser:async()=>({data:{user:{id:"account-a"}},error:null})},...mocks}}));
import { importParsed } from "@/lib/importer";
import { parseEventSetup } from "@/lib/hytek/event-setup";
describe("confirmed setup import",()=>{
  it("sends events and cuts atomically without writing athletes, results or national standards",async()=>{
    mocks.rpc.mockResolvedValue({data:"meet-a",error:null});
    const p=parseEventSetup("copa.hyv","COPA SOMOS TENAZ 2026;11/12/2026;11/14/2026;11/14/2026;L;Piscina;;Hy-Tek;8.0\n1A;F;F;I;10;11;100;1;;72.34;;0;;70.00;;61.20;;");
    const s=await importParsed("copa.hyv",p);
    expect(mocks.rpc).toHaveBeenCalledWith("import_meet_setup",{p_setup:{format:"HYV",meet:p.meet,events:p.events},p_file_name:"copa.hyv"});
    expect(mocks.from).not.toHaveBeenCalled();expect(s).toMatchObject({events:1,results:0,athletesNew:0});
  });
  it("rejects an empty selection before requesting a write",async()=>{
    mocks.rpc.mockClear();
    await expect(importParsed("copa.ev3",{format:"EV3",meet:{name:"Copa",startDate:null,endDate:null,course:"LCM",location:null},events:[],athletes:[],results:[],teams:[],warnings:[]})).rejects.toThrow();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});