import { readHytekFile } from '@/lib/hytek';
import { parseEventSetup } from '@/lib/hytek/event-setup';
import { exportToHy3, exportToSd3, calculateHy3Checksum, encodeWindows1252 } from '@/lib/swim-io/exporters';
import { decodeSwimBytes } from '@/lib/swim-io/encodingAndTime';
import { formatTime } from '@/lib/swim';
import type { Tables } from '@/integrations/supabase/types';
export { exportToHy3, exportToSd3, calculateHy3Checksum };
export async function inspectHytekFile(file:File) {
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer()))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const files=await readHytekFile(file);
 return {hash,files:files.map(f=>({...f,clubs:f.parsed.teams.length,athletes:f.parsed.athletes.length,individual:f.parsed.results.filter(r=>r.stroke<=5).length,events:f.parsed.events?.length??0}))};
}
/** EV3 writer validated by the same independent setup parser used for imported files. */
export function exportEventsEv3(meet:Tables<'meets'>,events:Tables<'events'>[]) {
 const date=(d:string|null)=>{if(!d||!/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d))throw new Error('Completa las fechas del torneo.');return `${d.slice(5,7)}/${d.slice(8,10)}/${d.slice(0,4)}`;};
 const clean=(s:string)=>{if(/[;\r\n]/.test(s))throw new Error('Un nombre contiene separadores incompatibles con EV3.');return s;};
 if(!events.length)throw new Error('El torneo no tiene pruebas.');
 const course=(s:string)=>s==='SCM'?'S':s==='SCY'?'Y':'L';
 const lines=[[clean(meet.name),clean(meet.facility_name??meet.location??''),date(meet.start_date),date(meet.end_date??meet.start_date),date(meet.age_up_date??`${meet.start_date?.slice(0,4)}-12-31`),course(meet.course),'0','0','0','Swim Lane Coach','','1.0',date(meet.start_date)].join(';')+'*>'];
 for(const [i,e] of events.entries()) {
  if(!e.event_number||!/^\d+[A-Za-z]?$/.test(e.event_number))throw new Error('Completa números de prueba válidos.');
  const cuts=e.qualifying_times_ms as Record<string,number|null>|null;const f=Array<string>(30).fill('');
  f[0]=String(i+1);f[1]=e.event_number;f[2]='F';f[3]=e.round_type==='PRELIMS_FINALS'?'2':'1';f[4]=e.is_relay?'R':'I';f[5]=e.gender==='F'?'G':e.gender==='M'?'B':'X';f[6]=String(e.min_age??0);f[7]=String(e.max_age??99);f[8]=String(e.distance);f[9]=e.is_relay?(e.stroke===6?'A':'E'):('ABCDE'[e.stroke-1]??'');f[10]='0';f[13]='N';f[14]=String(e.event_fee??0);f[16]=cuts?.['LCM']?formatTime(cuts['LCM']):'';f[18]=cuts?.['SCM']?formatTime(cuts['SCM']):'';f[20]=cuts?.['SCY']?formatTime(cuts['SCY']):'';f[21]=String(e.session_number);f[22]=String(i+1);f[23]='1';f[25]=course(e.course??meet.course);f[29]=e.is_relay?'4':'0';lines.push(f.join(';')+'*>');
 }
 const text=lines.join('\r\n')+'\r\n';parseEventSetup('events.ev3',text);
 return new File([encodeWindows1252(text)],'convocatoria.ev3',{type:'application/octet-stream'});
}
export function fileEncoding(bytes:Uint8Array){return decodeSwimBytes(bytes).encoding;}