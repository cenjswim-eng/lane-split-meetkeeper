import { parseSwimTime } from '../swim';

export interface EntryValidation { errors:string[]; teams:number; athletes:number; entries:number; events:number; meet:string; course:string }
const field=(line:string,start:number,end:number)=>line.slice(start-1,end).trim();
function validDate(value:string) {
 if(!/^\d{8}$/.test(value))return false;
 const iso=`${value.slice(4)}-${value.slice(0,2)}-${value.slice(2,4)}`;
 const d=new Date(`${iso}T00:00:00Z`);return Number.isFinite(d.getTime())&&d.toISOString().slice(0,10)===iso;
}
/** Strict validation of the dedicated individual-entry writer, not arbitrary results SDIF. */
export function validateEntrySdif(text:string):EntryValidation {
 const errors:string[]=[];
 if(!text.endsWith('\r\n')||/[\r\n]/.test(text.replaceAll('\r\n','')))errors.push('Los registros deben terminar en CRLF.');
 const lines=text.split('\r\n');if(lines.at(-1)==='')lines.pop();
 const swimmers=new Set<string>(),identities=new Set<string>(),events=new Set<string>(),teams=new Set<string>();
 let team='',meet='',course='',entries=0;let group:string[]=[];let groupCount:string|undefined;let phase='header';
 function checkGroup(){if(!team)return;const unique=new Set(group);if(!groupCount||Number(field(groupCount,60,65))!==group.length||Number(field(groupCount,66,71))!==unique.size)errors.push(`Equipo ${team}: conteos C2 inconsistentes.`);group=[];groupCount=undefined;}
 for(const [i,line] of lines.entries()) {
 const fail=(message:string)=>errors.push(`Línea ${i+1}: ${message}`);
 if(line.length!==160||!/^[\x20-\x7e]{160}$/.test(line)){fail('se requieren 160 caracteres ASCII.');continue;}
 const type=line.slice(0,2);
 if(!['A0','B1','C1','C2','D0','Z0'].includes(type)){fail('registro no admitido en inscripciones individuales.');continue;}
 if(type==='A0'){if(i!==0||field(line,4,11)!=='V3.0'||field(line,12,13)!=='01')fail('cabecera SDIF v3 de inscripciones inválida.');}
 if(type==='B1'){if(i!==1)fail('competencia fuera de orden.');meet=field(line,12,41);course=field(line,150,150);if(!meet||!validDate(field(line,122,129))||!validDate(field(line,130,137))||!['L','S','Y'].includes(course))fail('nombre, fecha o piscina de competencia inválidos.');phase='meet';}
 if(type==='C1'){checkGroup();team=field(line,12,17);if(!team||teams.has(team))fail('equipo vacío o repetido.');teams.add(team);if(phase!=='meet'&&phase!=='entries')fail('equipo fuera de orden.');phase='team';}
 if(type==='C2'){if(phase!=='team'||field(line,12,17)!==team)fail('resumen de equipo fuera de orden.');groupCount=line;phase='entries';}
 if(type==='D0'){
 if(phase!=='entries'||!team)fail('inscripción sin equipo.');
 const name=field(line,12,39),birth=field(line,56,63),sex=field(line,66,66),eventSex=field(line,67,67),distance=field(line,68,71),stroke=field(line,72,72),number=field(line,73,76),age=field(line,77,80),time=field(line,89,96);
 if(!name.includes(',')||!name.split(',').every(x=>x.trim())||!validDate(birth)||!['M','F'].includes(sex))fail('identidad de atleta incompleta.');
 if(!['M','F','X'].includes(eventSex)||(eventSex!=='X'&&eventSex!==sex)||!/^\d+$/.test(distance)||Number(distance)<=0||!['1','2','3','4','5'].includes(stroke)||!number||!/^(UN|\d{2})(OV|\d{2})$/.test(age)||( /^\d{4}$/.test(age)&&Number(age.slice(0,2))>Number(age.slice(2))))fail('prueba, sexo o categoría inválidos.');
 if(field(line,97,97)!==course||!validDate(field(line,81,88)))fail('piscina o fecha de inscripción inválidas.');
 if(!time||!['OK','NT'].includes(parseSwimTime(time).status))fail('tiempo de inscripción inválido.');
 if(line.slice(97).trim())fail('contiene datos finales; no es una inscripción pura.');
 const swimmer=`${team}|${name}|${birth}|${sex}`,identity=`${swimmer}|${number}|${distance}|${stroke}`;
 if(identities.has(identity))fail('inscripción duplicada.');identities.add(identity);swimmers.add(swimmer);group.push(swimmer);events.add(`${number}|${distance}|${stroke}|${eventSex}|${age}`);entries++;
 }
 if(type==='Z0'){checkGroup();if(i!==lines.length-1||field(line,12,13)!=='01'||Number(field(line,58,63))!==entries||Number(field(line,64,69))!==swimmers.size||Number(field(line,54,57))!==teams.size||Number(field(line,50,53))!==teams.size*2)fail('totales Z0 inconsistentes.');phase='end';}
 }
 if(!lines[0]?.startsWith('A0')||!lines[1]?.startsWith('B1')||phase!=='end'||!entries)errors.push('Archivo incompleto: requiere A0, B1, equipos, inscripciones y Z0.');
 return {errors,teams:teams.size,athletes:swimmers.size,entries,events:events.size,meet,course};
}
export interface ExternalConfirmation { athletes:number;entries:number;identity:boolean;events:boolean;times:boolean;noErrors:boolean;version:string }
export function canConfirmEntryImport(validation:EntryValidation,c:ExternalConfirmation){return !validation.errors.length&&c.athletes===validation.athletes&&c.entries===validation.entries&&c.identity&&c.events&&c.times&&c.noErrors&&!!c.version.trim();}
export async function entryFileFingerprint(bytes:ArrayBuffer){const digest=await crypto.subtle.digest('SHA-256',bytes);return Array.from(new Uint8Array(digest),v=>v.toString(16).padStart(2,'0')).join('');}