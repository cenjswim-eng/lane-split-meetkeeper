import { athleteRecordWindow, rankedAthleteRecords } from './athlete-records';
import { ageAtDec31 } from './swim';
import { standardApplies, type QualificationStandard, type SwimCategory } from './standard-rules';
import { tournamentEligible } from './tournament-rules';

export interface AssistantAthlete { id: string; first_name: string; last_name: string; birth_date: string|null; gender: string|null; is_active?: boolean }
export interface AssistantEvent { id:string; distance:number; stroke:number; gender:string|null; min_age:number|null; max_age:number|null; course:string|null; event_number?:string|null; qualifying_times_ms?:unknown }
export interface AssistantResult { athlete_id:string; final_time_ms:number|null; is_dq:boolean; course:string|null; aqua_points:number|null; meets:{start_date:string|null}|null; events:{distance:number;stroke:number;is_relay:boolean}|null }
export interface AssistantRules { date:string; course:string; maxAthlete:number|null; maxEvent:number|null; genders:string[]; categories:string[]; requiresMinimum:boolean; versionId:string; factor:number|null }
export interface AssistantRow { athleteId:string; eventId:string; timeMs:number|null; referenceDate:string|null; converted:boolean; origin:'manual'|'suggested' }
export const defaultAssistantRules = (date:string, course:string):AssistantRules => ({date,course,maxAthlete:null,maxEvent:null,genders:['M','F'],categories:[],requiresMinimum:false,versionId:'tournament',factor:null});
export function assistantAllowed(a:AssistantAthlete,e:AssistantEvent,r:AssistantRules,c:readonly SwimCategory[]) {
 const age=ageAtDec31(a.birth_date,Number(r.date.slice(0,4)));
 return tournamentEligible(a,e,Number(r.date.slice(0,4))) && r.genders.includes(a.gender??'') && (!r.categories.length||c.some(x=>r.categories.includes(x.name)&&age!=null&&(x.age_min==null||age>=x.age_min)&&(x.age_max==null||age<=x.age_max)));
}
export function assistantReference(a:AssistantAthlete,e:AssistantEvent,results:AssistantResult[],r:AssistantRules,now=new Date()) {
 const recent=rankedAthleteRecords(results,now).filter(x=>x.athlete_id===a.id&&x.events&&!x.events.is_relay&&x.events.distance===e.distance&&x.events.stroke===e.stroke&&(x.meets?.start_date??'')<r.date);
 const course=e.course??r.course;
 const exact=recent.find(x=>x.course===course);
 const other=r.factor!=null&&r.factor>0?recent.find(x=>x.course!==course&&[x.course,course].every(y=>y==='LCM'||y==='SCM')):undefined;
 const ref=exact??other;
 const converted=!!ref&&!exact;
 const time=ref?.final_time_ms??null;
 const timeMs=time==null?null:converted&&r.factor!=null?Math.round(time*(ref?.course==='LCM'?r.factor:1/r.factor)):time;
 return {timeMs,referenceDate:ref?.meets?.start_date??null,converted,aqua:recent.filter(x=>x.course===(ref?.course??course)).reduce<number|null>((n,x)=>x.aqua_points==null?n:Math.max(n??0,x.aqua_points),null)};
}
export function assistantMinimum(a:AssistantAthlete,e:AssistantEvent,r:AssistantRules,standards:readonly QualificationStandard[]) {
 const course=e.course??r.course;
 if(r.versionId==='tournament') { const q=e.qualifying_times_ms; const v=q&&typeof q==='object'&&!Array.isArray(q)?(q as Record<string,unknown>)[course]:null; return typeof v==='number'&&Number.isSafeInteger(v)&&v>0?v:null; }
 const matches=standards.filter(s=>s.course===course&&s.distance===e.distance&&s.stroke===e.stroke&&(!s.gender||s.gender===a.gender)&&standardApplies(s,a.birth_date,Number(r.date.slice(0,4))));
 return matches.length?Math.min(...matches.map(s=>s.qualifying_time_ms)):null;
}
export function assistantReason(time:number|null,minimum:number|null,aqua:number|null) { return time==null?'NT · Sin tiempo':minimum!=null?time<=minimum?'Hizo marca':`Faltan ${((time-minimum)/1000).toFixed(2)} s`:aqua!=null?'Mejor puntaje AQUA':'Mejor tiempo reciente'; }
export function suggestEntries(athletes:AssistantAthlete[],events:AssistantEvent[],results:AssistantResult[],rules:AssistantRules,standards:readonly QualificationStandard[],categories:readonly SwimCategory[],now=new Date()):AssistantRow[] {
 const counts=new Map<string,number>(); const rows:AssistantRow[]=[];
 for(const a of athletes) {
 const candidates=events.filter(e=>assistantAllowed(a,e,rules,categories)).map(e=>{const ref=assistantReference(a,e,results,rules,now),min=assistantMinimum(a,e,rules,standards);return {e,ref,gap:min!=null&&ref.timeMs!=null?ref.timeMs-min:null};}).sort((a,b)=>{
 const group=(x:typeof a)=>x.gap!=null?x.gap<=0?0:1:x.ref.timeMs!=null?2:3;
 return group(a)-group(b)||(group(a)===1?(a.gap??Infinity)-(b.gap??Infinity):0)||(b.ref.aqua??-1)-(a.ref.aqua??-1)||a.e.id.localeCompare(b.e.id);
 });
 let count=0;for(const x of candidates){if(rules.maxAthlete!=null&&count>=rules.maxAthlete)break;if(rules.maxEvent!=null&&(counts.get(x.e.id)??0)>=rules.maxEvent)continue;rows.push({athleteId:a.id,eventId:x.e.id,...x.ref,origin:'suggested'});counts.set(x.e.id,(counts.get(x.e.id)??0)+1);count++;}
 } return rows;
}
export function assistantWarnings(row:AssistantRow,rows:AssistantRow[],a:AssistantAthlete|undefined,e:AssistantEvent|undefined,r:AssistantRules,standards:readonly QualificationStandard[],categories:readonly SwimCategory[],now=new Date()) {
 const warnings:string[]=[];
 if(!a||!e)return ['Atleta o prueba no disponible'];
 if(!assistantAllowed(a,e,r,categories))warnings.push('Fuera de categoría o sexo permitido');
 const min=assistantMinimum(a,e,r,standards);if(r.requiresMinimum&&(min==null||row.timeMs==null||row.timeMs>min))warnings.push(min==null?'Sin mínima configurada':'No cumple mínima');
 if(r.maxAthlete!=null&&rows.filter(x=>x.athleteId===row.athleteId).length>r.maxAthlete)warnings.push('Máximo de pruebas por atleta superado');
 if(r.maxEvent!=null&&rows.filter(x=>x.eventId===row.eventId).length>r.maxEvent)warnings.push('Máximo de atletas por prueba superado');
 if(rows.filter(x=>x.athleteId===row.athleteId&&x.eventId===row.eventId).length>1)warnings.push('Inscripción duplicada');
 if(row.referenceDate&&row.referenceDate<athleteRecordWindow(now).from)warnings.push('Tiempo de más de 9 meses');
 return warnings;
}