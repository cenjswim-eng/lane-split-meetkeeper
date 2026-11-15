import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { ageAtDec31, eventLabel } from './swim';
import type { SeedAssignment, SeedEntry } from '@/utils/seedingEngine';
async function pages<T>(load:(offset:number)=>PromiseLike<{data:T[]|null;error:unknown}>) {
 const all:T[]=[];for(let offset=0;;offset+=1000){const page=await load(offset);if(page.error)throw page.error;all.push(...(page.data??[]));if((page.data?.length??0)<1000)return all;}
}
export const seedingQuery=queryOptions({queryKey:['meet-seeding'],queryFn:async()=>{
 const [meets,events,entries,relays,athletes,clubs,teams,sessions]=await Promise.all([
 pages(o=>supabase.from('meets').select('*').order('id').range(o,o+999)),pages(o=>supabase.from('events').select('*').order('id').range(o,o+999)),
 pages(o=>supabase.from('meet_entries').select('*').order('id').range(o,o+999)),pages(o=>supabase.from('relay_entries').select('*').order('id').range(o,o+999)),
 pages(o=>supabase.from('athletes').select('*').order('id').range(o,o+999)),pages(o=>supabase.from('clubs').select('*').order('id').range(o,o+999)),
 pages(o=>supabase.from('teams').select('*').order('id').range(o,o+999)),pages(o=>supabase.from('meet_seeding_sessions').select('*').order('id').range(o,o+999))]);
 return {meets,events,entries,relays,athletes,clubs,teams,sessions};
}});
export type SeedingData=Awaited<ReturnType<NonNullable<typeof seedingQuery.queryFn>>>;
export interface OrganizerEntry extends SeedEntry { kind:'individual'|'relay'; eventId:string; savedHeat:number|null;savedLane:number|null;savedTimeMs:number|null }
export function organizerEntries(data:SeedingData,meetId:string,session:number):OrganizerEntry[]{
 const meet=data.meets.find(m=>m.id===meetId);if(!meet)return [];
 const events=data.events.filter(e=>e.meet_id===meetId&&e.session_number===session);const year=Number(meet.start_date?.slice(0,4)??new Date().getFullYear());
 return events.flatMap<OrganizerEntry>(event=>{
 const common={eventId:event.id,course:event.course??meet.course};
 if(event.is_relay)return data.relays.filter(e=>e.event_id===event.id).map(e=>{const club=data.clubs.find(c=>c.id===e.club_id);return {...common,id:`relay:${e.id}`,kind:'relay' as const,name:`${club?.full_name??club?.name??'Club'} ${e.relay_letter}`,club:club?.short_name??club?.team_code??'—',age:null,seedTimeMs:e.seed_time_ms,course:e.seed_course??common.course,status:e.status,savedHeat:e.heat,savedLane:e.lane,savedTimeMs:e.seeding_time_ms};});
 return data.entries.filter(e=>e.event_id===event.id).map(e=>{const a=data.athletes.find(a=>a.id===e.athlete_id);const club=data.clubs.find(c=>c.id===a?.club_id);const team=data.teams.find(t=>t.id===a?.team_id);return {...common,id:`individual:${e.id}`,kind:'individual' as const,name:a?`${a.last_name}, ${a.first_name}`:'Atleta no disponible',club:club?.short_name??club?.team_code??team?.code??'—',age:ageAtDec31(a?.birth_date??null,year),seedTimeMs:e.seed_time_ms,course:e.seed_course??common.course,status:e.status,savedHeat:e.heat,savedLane:e.lane,savedTimeMs:e.seeding_time_ms};});
 });
}
export function organizerEventLabel(event:SeedingData['events'][number]){return `Prueba ${event.event_number??'—'} · ${eventLabel(event.distance,event.stroke)} · ${event.gender??'X'} · ${event.min_age??'Abierta'}${event.max_age!=null?`–${event.max_age}`:''}`;}
export function seedingPayload(entries:OrganizerEntry[],assignments:SeedAssignment[],scratches:Set<string>){return entries.map(e=>{const assigned=assignments.find(a=>a.id===e.id);const scratch=scratches.has(e.id);if(!scratch&&!assigned)throw new Error(`Falta sembrar ${e.name}`);return {id:e.id.split(':')[1],kind:e.kind,eventId:e.eventId,heat:scratch?null:assigned?.heat,lane:scratch?null:assigned?.lane,status:scratch?'SCR':e.seedTimeMs==null?'NT':'OK',timeMs:assigned?.rankedTimeMs??null};});}