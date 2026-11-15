import { ageAtDec31, parseSwimTime, formatTime } from './swim';
import { rankedAthleteRecords } from './athlete-records';
import { bestFreeRelay, bestMedleyRelay, type RelayCandidate } from './relay';
import type { DashboardResult } from './dashboard-summary';

export function millisecondsToCentiseconds(ms: number) {
  if (!Number.isSafeInteger(ms) || ms < 0 || ms > 2147483647) throw new Error('Milisegundos inválidos.');
  return Math.round(ms / 10);
}
export function centisecondsToMilliseconds(cs: number) {
  if (!Number.isSafeInteger(cs) || cs < 0 || cs > 214748364) throw new Error('Centésimas inválidas.');
  return cs * 10;
}
export function entryTimeText(ms: number | null) { return ms == null ? 'NT' : formatTime(ms); }
export function entryTimeMs(text: string) {
  const parsed = parseSwimTime(text);
  if (parsed.status !== 'OK' && parsed.status !== 'NT') throw new Error('Tiempo de inscripción inválido.');
  return parsed.timeMs;
}
function dateParts(date: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Fecha inválida.');
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== date) throw new Error('Fecha inválida.');
  return date.split('-').map(Number);
}
export function ageOnCutoff(birth: string, cutoff: string) {
  const [by=0,bm=0,bd=0] = dateParts(birth), [cy=0,cm=0,cd=0] = dateParts(cutoff);
  if (birth > cutoff) throw new Error('Nacimiento posterior a la fecha de corte.');
  return cy-by-(cm<bm || (cm===bm && cd<bd) ? 1 : 0);
}
export function tournamentEligible(a: {birth_date:string|null;gender:string|null;is_active?:boolean}, e: {gender:string|null;min_age:number|null;max_age:number|null}, year:number) {
  const age=ageAtDec31(a.birth_date,year);
  return a.is_active !== false && (a.gender==='M'||a.gender==='F') && age!=null && age>=0 && (!e.gender||e.gender==='X'||e.gender===a.gender) && (e.min_age==null||age>=e.min_age) && (e.max_age==null||age<=e.max_age);
}
export function entryLimitWarnings(count:number, sessionCount:number, relays:number, m:{max_ind_entries:number|null;max_ind_per_session:number|null;max_total_entries:number|null}) {
  return [m.max_ind_entries!=null&&count>m.max_ind_entries?'Límite individual del torneo excedido':null,m.max_ind_per_session!=null&&sessionCount>m.max_ind_per_session?'Límite individual por sesión excedido':null,m.max_total_entries!=null&&count+relays>m.max_total_entries?'Límite total excedido':null].filter((s):s is string=>s!=null);
}
export function entryFees(athletes:number, individual:number, relays:number, fees:{athlete_surcharge:number;ind_entry_fee:number;relay_entry_fee:number}) {
  const cents=(v:number)=>{if(!Number.isFinite(v)||v<0)throw new Error('Cuota inválida.');return Math.round(v*100);};
  return (athletes*cents(fees.athlete_surcharge)+individual*cents(fees.ind_entry_fee)+relays*cents(fees.relay_entry_fee))/100;
}
export function relayCandidates(results:DashboardResult[], athletes:{id:string;first_name:string;last_name:string}[], distance:number, course:string, now=new Date()):RelayCandidate[] {
  const valid=rankedAthleteRecords(results,now).filter(r=>r.events&&!r.events.is_relay&&r.events.distance===distance&&r.course===course);
  return athletes.map(a=>({id:a.id,name:`${a.first_name} ${a.last_name}`,best:Object.fromEntries([1,2,3,4].flatMap(stroke=>{const ms=valid.find(r=>r.athlete_id===a.id&&r.events?.stroke===stroke)?.final_time_ms;return ms==null?[]:[[stroke,ms]];}))}));
}
export function relayTeamsAB(candidates:RelayCandidate[], medley:boolean) {
  const optimize=medley?bestMedleyRelay:bestFreeRelay;
  const a=optimize(candidates); if(!a)return [];
  const ids=new Set(a.legs.map(l=>l.athleteId)); const b=optimize(candidates.filter(c=>!ids.has(c.id)));
  return b?[a,b]:[a];
}