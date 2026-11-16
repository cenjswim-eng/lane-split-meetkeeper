import { describe,it,expect } from 'vitest';
import { buildMeetManagerEntries } from '@/lib/hytek/meet-manager-entries';
import { validateEntrySdif,canConfirmEntryImport } from '@/lib/hytek/entry-validation';
import type { ExportRow } from '@/lib/hytek/sdif';
const meet={name:'Copa',location:null,start_date:'2026-12-12',end_date:'2026-12-12',course:'LCM'};
const row:ExportRow={athlete:{first_name:'Ana',last_name:'Rios',birth_date:'2011-12-31',gender:'F',team_code:'CLUB'},event:{event_number:'1',distance:100,stroke:1,gender:'F',min_age:14,max_age:15},seed_time_ms:null,final_time_ms:null,is_dq:false,place:null,aqua_points:null,course:'LCM',round:'F',splits:[]};
const text=()=>buildMeetManagerEntries(meet,[row],[]);
function change(type:string,start:number,value:string){return text().split('\r\n').map(l=>l.startsWith(type)?l.slice(0,start-1)+value+l.slice(start-1+value.length):l).join('\r\n');}
describe('SD3 validation and explicit external confirmation',()=>{
 it('counts valid individual entries including NT',()=>{expect(validateEntrySdif(text())).toMatchObject({errors:[],teams:1,athletes:1,entries:1,events:1,meet:'Copa',course:'L'});});
 it('rejects records not 160 ASCII characters',()=>{expect(validateEntrySdif(text().replace('A01','A0é')).errors.length).toBeGreaterThan(0);});
 it('requires CRLF',()=>{expect(validateEntrySdif(text().replaceAll('\r\n','\n')).errors).toContain('Los registros deben terminar en CRLF.');});
 it('requires entry header type 01',()=>{expect(validateEntrySdif(change('A0',12,'02')).errors.join()).toContain('cabecera');});
 it('checks C2 totals',()=>{expect(validateEntrySdif(change('C2',60,'     2')).errors.join()).toContain('C2');});
 it('checks Z0 totals',()=>{expect(validateEntrySdif(change('Z0',58,'     3')).errors.join()).toContain('Z0');});
 it('rejects duplicate athlete event registrations',()=>{const s=text(),d=s.split('\r\n').find(l=>l.startsWith('D0'));if(!d)throw Error();expect(validateEntrySdif(s.replace('Z01',d+'\r\nZ01')).errors.join()).toContain('duplicada');});
 it('checks event and course fields',()=>{expect(validateEntrySdif(change('D0',97,'S')).errors.join()).toContain('piscina');expect(validateEntrySdif(change('D0',73,'    ')).errors.join()).toContain('prueba');});
 it('rejects invalid time and final-result fields',()=>{expect(validateEntrySdif(change('D0',89,'invalid ')).errors.join()).toContain('tiempo');expect(validateEntrySdif(change('D0',100,'1')).errors.join()).toContain('datos finales');});
 it('cannot confirm automatically from local validation',()=>{const v=validateEntrySdif(text());expect(canConfirmEntryImport(v,{athletes:1,entries:1,identity:false,events:false,times:false,noErrors:false,version:'8'})).toBe(false);});
 it('requires matching imported totals and all external attestations',()=>{const v=validateEntrySdif(text()),c={athletes:1,entries:1,identity:true,events:true,times:true,noErrors:true,version:'8'};expect(canConfirmEntryImport(v,c)).toBe(true);expect(canConfirmEntryImport(v,{...c,entries:0})).toBe(false);expect(canConfirmEntryImport(v,{...c,noErrors:false})).toBe(false);});
});