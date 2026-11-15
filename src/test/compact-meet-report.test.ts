import { describe, expect, it } from "vitest";
import { compactReportRows, compactKpis, tournamentTarget, type CompactResult } from "@/lib/compact-meet-report";
import { formatTimeDiff, timeDiffMs, compactTime } from "@/utils/timeDiffUtils";
const athlete={id:"a",first_name:"Ana",last_name:"Ñúñez",birth_date:"2010-12-30",gender:"F",club_id:"club"};
const result=(id:string,date:string,time:number|null,course="LCM",status="OK"):CompactResult=>({id,athlete_id:"a",meet_id:id,event_id:"e",final_time_ms:time,is_dq:status==="DQ",status,course,events:{distance:100,stroke:1,is_relay:false},meets:{id,name:id,start_date:date}});
const history=[result("prior","2023-10-10",65000),result("race","2026-11-01",64150),result("future","2026-11-02",63000),result("short","2026-10-01",60000,"SCM")];
describe("Precise time differences",()=>{
 it("subtracts 850 milliseconds without floating point errors",()=>expect(timeDiffMs(64150,65000)).toBe(-850));
 it("formats the requested negative and positive examples",()=>{expect(formatTimeDiff(-850)).toBe("-0.85");expect(formatTimeDiff(420)).toBe("+0.42");expect(formatTimeDiff(-60640)).toBe("-01:00.64");expect(compactTime(64150)).toBe("01:04.15");});
 it("rejects fractional milliseconds",()=>expect(()=>timeDiffMs(1.5,1)).toThrow());
});
describe("Executive report rules",()=>{
 it("reports only selected meets and compares all historical earlier same-course swims",()=>{const rows=compactReportRows(history,[athlete],["race"],"pb",[],[]);expect(rows).toHaveLength(1);expect(rows[0]?.previousPbMs).toBe(65000);expect(rows[0]?.pbMs).toBe(63000);expect(rows[0]?.pbDiffMs).toBe(-850);expect(rows[0]?.newPb).toBe(true);});
 it("does not invent same-day PB order",()=>{const rows=compactReportRows([result("a","2026-11-01",64000),result("b","2026-11-01",63000)],[athlete],["a","b"],"pb",[],[]);expect(rows.map(r=>r.pbDiffMs)).toEqual([null,null]);});
 it("matches year, Dec-31 age, sex, distance, stroke and course for national minimum",()=>{const standards=[{id:"s",season_year:2026,age_min:16,age_max:18,age_group:null,gender:"F",distance:100,stroke:1,course:"LCM",qualifying_time_ms:64790}];const rows=compactReportRows(history,[athlete],["race"],"national",standards,[]);expect(rows[0]?.targetDiffMs).toBe(-640);expect(compactReportRows(history,[{...athlete,gender:"M"}],["race"],"national",standards,[])[0]?.targetMs).toBeNull();});
 it("calculates exact shortfall and manual target equality",()=>{const rows=compactReportRows(history,[athlete],["race"],"manual",[],[],{race:{targetMs:63800}});expect(rows[0]?.targetDiffMs).toBe(350);expect(compactKpis(rows).targets).toBe(0);expect(compactKpis(compactReportRows(history,[athlete],["race"],"manual",[],[],{race:{targetMs:64150}})).targets).toBe(1);});
 it("calculates tournament KPIs, excludes NS and retains DQ without false targets",()=>{const rows=compactReportRows([...history,result("dq","2026-11-01",62000,"LCM","DQ"),result("ns","2026-11-01",null,"LCM","NS")],[athlete],["race","dq","ns"],"pb",[],[]);expect(compactKpis(rows)).toEqual({swims:2,pbs:1,pbPercent:50,targets:1,savedMs:850});expect(rows.find(r=>r.id==="dq")?.targetDiffMs).toBeNull();});
 it("isolates the selected club and athlete",()=>{expect(compactReportRows(history,[athlete],["race"],"pb",[],[],{},"a","other")).toHaveLength(0);expect(compactReportRows(history,[athlete],["race"],"pb",[],[],{},"other")).toHaveLength(0);});
 it("reads explicit imported course cuts without cross-course guessing",()=>{const event={id:"e",course:"LCM",qualifying_times_ms:{LCM:65000,SCM:60000},gender:"F",min_age:16,max_age:18};expect(tournamentTarget(event,result("race","2026-11-01",64150),athlete)).toBe(65000);expect(tournamentTarget({...event,course:"SCM"},result("race","2026-11-01",64150),athlete)).toBeNull();});
});