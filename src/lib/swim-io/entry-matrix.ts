import { rankedAthleteRecords } from '@/lib/athlete-records';
import type { DashboardResult } from '@/lib/dashboard-summary';
import { ageAtDec31 } from '@/lib/swim';
export function matrixSeed(results: DashboardResult[], athleteId: string, distance: number, stroke: number, course: string, exact: boolean, now = new Date()) {
 return rankedAthleteRecords(results,now).find(r=>r.athlete_id===athleteId&&!r.events?.is_relay&&r.events?.distance===distance&&r.events?.stroke===stroke&&(!exact||r.course===course))??null;
}
export function eligibleEntry(athlete:{birth_date:string|null;gender:string|null}, event:{gender:string|null;min_age:number|null;max_age:number|null;is_relay:boolean;course?:string|null}, year:number, course:string) {
 const age=ageAtDec31(athlete.birth_date,year);
 return !event.is_relay&&(!event.course||event.course===course)&&(!event.gender||event.gender==='X'||event.gender===athlete.gender)&&age!=null&&(event.min_age==null||age>=event.min_age)&&(event.max_age==null||age<=event.max_age);
}
export const exceedsEntryLimit = (count:number,limit:number) => count>limit;
