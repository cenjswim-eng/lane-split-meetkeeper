import { expect, it } from "vitest";
import { prepareStandardRows, standardApplies, type StandardDraft } from "@/lib/standard-rules";
import { entryMinimum } from "@/lib/entry-rules";
import { dashboardSummary, type DashboardResult } from "@/lib/dashboard-summary";
const draft: StandardDraft = {category:"13-14",gender:"F",distance:100,stroke:1,course:"LCM",time:"1:02.34",selected:true};
it("stores Venezuelan minima for the selected year in integer milliseconds",()=>{
 const row=prepareStandardRows([draft],2026)[0];
 expect(row).toMatchObject({season_year:2026,age_min:13,age_max:14,qualifying_time_ms:62340});
});
it("annual minima never qualify a different year in entries or dashboard",()=>{
 const prepared=prepareStandardRows([draft],2026)[0];
 if (!prepared) throw new Error("Expected a standard");
 const row={id:"s",...prepared};
 const athlete={birth_date:"2013-12-25",gender:"F"};
 expect(entryMinimum([row],athlete,{distance:100,stroke:1},"LCM","2027-06-01",60000).status).toBe("unconfigured");
 const result:DashboardResult={id:"r",athlete_id:"a",final_time_ms:60000,is_dq:false,course:"LCM",events:{distance:100,stroke:1,is_relay:false},athletes:{...athlete,first_name:"Ana",last_name:"Prueba"},meets:{id:"m",name:"Prueba",start_date:"2027-06-01"}};
 expect(dashboardSummary([result],[row],new Date("2027-07-01")).qualifiedCount).toBe(0);
});
it("uses exact age intervals at December 31, including categories outside default buckets",()=>{
 const row=prepareStandardRows([{...draft,category:"14-15"}],2026)[0];
 if (!row) throw new Error("Expected a standard");
 expect(standardApplies(row,"2012-12-25",2026)).toBe(true);
 expect(standardApplies(row,"2013-12-25",2026)).toBe(false);
});
it("requires resolving missing data and does not invent category or pool",()=>{
 expect(()=>prepareStandardRows([{...draft,category:"Infantil B"}],2026)).toThrow();
 expect(()=>prepareStandardRows([{...draft,course:""}],2026)).toThrow();
 expect(()=>prepareStandardRows([{...draft,gender:"?"}],2026)).toThrow();
});
it("omits deselected rows and rejects duplicate minima",()=>{
 expect(prepareStandardRows([{...draft,selected:false}],2026)).toEqual([]);
 expect(()=>prepareStandardRows([draft,draft],2026)).toThrow();
});
it("legacy minima keep all-year applicability",()=>{
 expect(standardApplies({age_group:"13-14"},"2013-12-25",2026)).toBe(true);
});