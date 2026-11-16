import { EntryAssistantView } from './entry-assistant-view';
import { demoAthletes, demoSwims, demoMinimums } from '@/lib/demo-data';
import { SWIM_CATEGORIES } from '@/lib/standard-rules';
const athletes=demoAthletes.map(a=>({id:a.id,first_name:a.name.split(' ')[0]??'',last_name:a.name.split(' ').slice(1).join(' '),birth_date:a.birth,gender:a.gender}));
const events=['M','F'].flatMap((gender,i)=>[{id:`demo-entry-${gender}`,event_number:String(i+1),distance:100,stroke:1,gender,min_age:0,max_age:null,course:'LCM',qualifying_times_ms:{LCM:gender==='M'?demoMinimums.M:demoMinimums.F}},{id:`demo-nt-${gender}`,event_number:String(i+3),distance:50,stroke:2,gender,min_age:0,max_age:null,course:'LCM'}]);
const results=demoAthletes.flatMap(a=>demoSwims(a).map(s=>({athlete_id:a.id,final_time_ms:s.time,is_dq:false,course:'LCM',aqua_points:s.points,meets:{start_date:s.meet.date},events:{distance:100,stroke:1,is_relay:false}})));
export function DemoEntryAssistant(){return <EntryAssistantView athletes={athletes} events={events} results={results} date="2026-12-12" course="LCM" categories={SWIM_CATEGORIES} versions={[]} demo/>;}