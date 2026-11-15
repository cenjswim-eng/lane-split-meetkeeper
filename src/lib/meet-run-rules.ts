import { parseSwimTime } from './swim';
export type RunStatus='OK'|'DQ'|'NS'|'EXH';
export interface RunMark {id:string;eventId:string;gender:string;category:string;timeMs:number|null;status:RunStatus;unattached:boolean;club:string;name:string;round?:string}
export function quickTimeMs(value:string){
 if(!value.trim())return null;
 if(!/^\d+$/.test(value)) {const p=parseSwimTime(value);if(p.status!=='OK')throw new Error('Tiempo inválido');return p.timeMs;}
 const padded=value.padStart(4,'0');const cs=Number(padded.slice(-2)),seconds=Number(padded.slice(-4,-2)),minutes=Number(padded.slice(0,-4)||0);
 if(seconds>=60)throw new Error('Los segundos deben ser menores de 60');const ms=(minutes*60+seconds)*1000+cs*10;if(ms<=0||ms>2147483647)throw new Error('Tiempo fuera de rango');return ms;
}
export function rankRunMarks(rows:readonly RunMark[],points:readonly number[]){
 if(points.some(p=>!Number.isFinite(p)||p<0))throw new Error('Puntos inválidos');
 const output=rows.map(r=>({...r,place:null as number|null,points:0}));
 const groups=new Map<string,typeof output>();
 for(const r of output){if(r.status!=='OK'||r.timeMs==null)continue;const key=[r.eventId,r.gender,r.category,r.round??'F'].join('|');groups.set(key,[...(groups.get(key)??[]),r]);}
 for(const group of groups.values()){
 group.sort((a,b)=>(a.timeMs??Infinity)-(b.timeMs??Infinity));let scored=0;
 for(let i=0;i<group.length;){let j=i+1;while(j<group.length&&group[j]?.timeMs===group[i]?.timeMs)j++;
 const tied=group.slice(i,j);for(const r of tied)r.place=i+1;
 const eligible=tied.filter(r=>!r.unattached);const sum=eligible.reduce((n,_,k)=>n+(points[scored+k]??0),0);for(const r of eligible)r.points=(r.round??'F')==='F'?sum/eligible.length:0;scored+=eligible.length;i=j;}
 }return output;
}
export function personalBestDelta(finalMs:number|null,previousMs:number|null){return finalMs!=null&&previousMs!=null&&finalMs<previousMs?`-${((previousMs-finalMs)/1000).toFixed(2)}s (PB)`:null;}
// Descriptive local reasons, not a fabricated official FINA code catalogue.
export const dqReasons=[{code:'START',label:'Salida en falso',strokes:[1,2,3,4,5,6,7]},{code:'ONE_HAND',label:'Toque a una mano',strokes:[3,4,5,7]},{code:'BREAST_KICK',label:'Patada de delfín no permitida en pecho',strokes:[3,5,7]},{code:'15M',label:'Más de 15 m sumergido (estilos aplicables)',strokes:[1,2,4,5,6,7]},{code:'OTHER',label:'Otra infracción · código del juez',strokes:[1,2,3,4,5,6,7]}];