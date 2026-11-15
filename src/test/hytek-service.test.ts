import { it,expect } from 'vitest';
import { exportEventsEv3 } from '@/services/hytekParser';
import { parseEventSetup } from '@/lib/hytek/event-setup';
import type { Tables } from '@/integrations/supabase/types';
it('exports EV3 event identities, pools, ages and integer qualifying cuts',async()=>{
 const meet={name:'Copa Demo',start_date:'2026-11-15',end_date:'2026-11-16',course:'LCM',location:'Piscina'} as Tables<'meets'>;
 const event={event_number:'1',gender:'F',distance:100,stroke:1,is_relay:false,min_age:14,max_age:15,course:'LCM',session_number:1,qualifying_times_ms:{LCM:62340,SCM:60000}} as Tables<'events'>;
 const file=exportEventsEv3(meet,[event]);const text=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=reject;reader.readAsText(file);});
 expect(parseEventSetup(file.name,text).events?.[0]).toMatchObject({eventNumber:'1',gender:'F',distance:100,stroke:1,minAge:14,maxAge:15,course:'LCM',qualifyingTimesMs:{LCM:62340,SCM:60000,SCY:null}});
});