import { buildMeetManagerEntries } from '@/lib/hytek/meet-manager-entries';
import type { ExportRow } from '@/lib/hytek/sdif';
import { formatMsToSwimTime } from './encodingAndTime';
type Meet = { name: string; location: string | null; start_date: string | null; end_date: string | null; course: string };
type Club = { code: string; name: string };
/** HY-Tek checksum: weighted ASCII/CP1252 sum, divide by 21, add 205; reversed last two digits. */
export function calculateHy3Checksum(line128: string) {
 if (line128.length !== 128) throw new Error('El registro HY3 debe contener 128 caracteres de datos.');
 const bytes = encodeWindows1252(line128); let sum = 0;
 bytes.forEach((b,i)=>{sum += b * (i%2 === 0 ? 1 : 2);});
 return String((Math.floor(sum/21)+205)%100).padStart(2,'0').split('').reverse().join('');
}
export function encodeWindows1252(text: string): Uint8Array {
 const decoder = new TextDecoder('windows-1252'), map = new Map<string,number>();
 for(let i=0;i<256;i++) map.set(decoder.decode(new Uint8Array([i])),i);
 return Uint8Array.from([...text].map(c=>{const b=map.get(c);if(b==null) throw new Error(`Carácter no compatible con HY-TEK: ${c}`);return b;}));
}
export function exportToSd3(meet: Meet, club: Club, entries: ExportRow[]) {
 return new Blob([encodeWindows1252(buildMeetManagerEntries(meet,entries,[club]))],{type:'application/octet-stream'});
}
const date = (iso: string | null) => iso ? `${iso.slice(5,7)}${iso.slice(8,10)}${iso.slice(0,4)}` : '';
export function exportToHy3(meet: Meet, club: Club, entries: ExportRow[]) {
 // Reuse the strict SDIF identity/event/time validation before producing a second format.
 buildMeetManagerEntries(meet,entries,[club]);
 if(!/^[A-Z0-9]{1,5}$/.test(club.code)) throw new Error('El código de club HY3 requiere hasta cinco letras o números.');
 const record = (type: string, fields: [number,number,string][]) => {
  const line=Array<string>(128).fill(' ');line[0]=type[0]??' ';line[1]=type[1]??' ';
  fields.forEach(([start,width,value])=>{if(value.length>width) throw new Error(`Campo ${type} demasiado largo (${width} caracteres).`);value.padEnd(width).split('').forEach((c,i)=>{line[start-1+i]=c;});});
  const data=line.join('');return data+calculateHy3Checksum(data);
 };
 const course=meet.course==='SCM'?'S':meet.course==='SCY'?'Y':'L';
 const lines=[record('A1',[[3,2,'01'],[5,30,'Swim Lane Coach']]),record('B1',[[3,45,meet.name.slice(0,45)],[48,45,(meet.location??'').slice(0,45)],[93,8,date(meet.start_date)],[101,8,date(meet.end_date??meet.start_date)]]),record('B2',[[99,1,course]]),record('C1',[[3,5,club.code],[8,30,club.name.slice(0,30)]])];
 const grouped=new Map<string,ExportRow[]>();
 entries.forEach(e=>{const a=e.athlete,key=`${a.last_name}|${a.first_name}|${a.birth_date}|${a.gender}`;grouped.set(key,[...(grouped.get(key)??[]),e]);});
 let id=0;
 for(const group of grouped.values()) {
  const a=group[0]?.athlete;if(!a) continue;id++;
  lines.push(record('D1',[[3,1,a.gender??''],[4,5,String(id).padStart(5)],[9,20,a.last_name],[29,20,a.first_name],[70,14,a.federation_id??''],[89,8,date(a.birth_date)]]));
  for(const e of group) lines.push(record('E1',[[4,5,String(id).padStart(5)],[14,1,e.event.gender??a.gender??''],[16,6,String(e.event.distance).padStart(6)],[22,1,'ABCDE'[e.event.stroke-1]??''],[23,3,String(e.event.min_age??0).padStart(3)],[26,3,String(e.event.max_age??0).padStart(3)],[39,4,e.event.event_number??''],[43,8,formatMsToSwimTime(e.seed_time_ms).padStart(8)],[51,1,course]]));
 }
 return new Blob([encodeWindows1252(lines.join('\r\n')+'\r\n')],{type:'application/octet-stream'});
}
