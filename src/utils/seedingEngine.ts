export type SeedingMode = 'timed' | 'circle';
export interface SeedEntry { id: string; name: string; seedTimeMs: number | null; course: string; status?: string; age?: number | null; club?: string }
export interface SeedAssignment extends SeedEntry { heat: number; lane: number; rankedTimeMs: number | null; converted: boolean }
export interface SeedOptions { lanes: 6 | 8 | 10; mode: SeedingMode; course: string; conversion?: { enabled: boolean; lcmToScm: number } }
export const lanePriority = (lanes: number): number[] => {
  if (![6,8,10].includes(lanes)) throw new Error('Elige 6, 8 o 10 carriles.');
  const center=lanes/2;
  return Array.from({length:lanes},(_,i)=>i%2===0?center-i/2:center+Math.ceil(i/2));
};
export function rankEntries(entries: readonly SeedEntry[], options: SeedOptions) {
  lanePriority(options.lanes);
  if (new Set(entries.map(e=>e.id)).size!==entries.length) throw new Error('Inscripciones duplicadas.');
  const factor=options.conversion?.lcmToScm??1;
  if(options.conversion?.enabled&&(!Number.isFinite(factor)||factor<=0))throw new Error('Factor de conversión inválido.');
  return entries.filter(e=>e.status!=='SCR').map(e=>{
    if(e.seedTimeMs!=null&&(!Number.isSafeInteger(e.seedTimeMs)||e.seedTimeMs<=0))throw new Error('Los tiempos deben ser milisegundos enteros positivos.');
    const mismatch=e.seedTimeMs!=null&&e.course!==options.course;
    if(mismatch&&(!options.conversion?.enabled||![e.course,options.course].every(c=>['LCM','SCM'].includes(c))))throw new Error(`${e.name}: tiempo de otra piscina; revisa la conversión.`);
    const rankedTimeMs=e.seedTimeMs==null?null:Math.round(e.seedTimeMs*(mismatch?(e.course==='LCM'?factor:1/factor):1));
    if(rankedTimeMs!=null&&(!Number.isSafeInteger(rankedTimeMs)||rankedTimeMs<=0||rankedTimeMs>2147483647))throw new Error('Tiempo convertido fuera de rango.');
    return {...e,rankedTimeMs,converted:mismatch};
  }).sort((a,b)=>(a.rankedTimeMs??Infinity)-(b.rankedTimeMs??Infinity)||a.name.localeCompare(b.name)||a.id.localeCompare(b.id));
}
export function seedEntries(entries: readonly SeedEntry[], options: SeedOptions): SeedAssignment[] {
  const ranked=rankEntries(entries,options),priority=lanePriority(options.lanes),n=ranked.length;
  if(!n)return [];
  const count=Math.ceil(n/options.lanes);
  const sizes=Array<number>(count).fill(options.lanes);sizes[0]=n-(count-1)*options.lanes;
  if(count>1&&(sizes[0]??0)<3){const move=3-(sizes[0]??0);sizes[0]=3;sizes[1]=(sizes[1]??0)-move;}
  const heats:Array<typeof ranked>=Array.from({length:count},()=>[]);
  let cursor=0;
  if(options.mode==='circle'&&count>1){
    const circle=Math.min(3,count),start=count-circle;
    while(heats.slice(start).some((h,i)=>h.length<(sizes[start+i]??0))){
      for(let h=count-1;h>=start;h--){if((heats[h]?.length??0)>=(sizes[h]??0))continue;const e=ranked[cursor++];if(e)heats[h]?.push(e);}
    }
    for(let h=start-1;h>=0;h--){heats[h]=ranked.slice(cursor,cursor+(sizes[h]??0));cursor+=sizes[h]??0;}
  }else{
    for(let h=count-1;h>=0;h--){heats[h]=ranked.slice(cursor,cursor+(sizes[h]??0));cursor+=sizes[h]??0;}
  }
  return heats.flatMap((heat,i)=>heat.map((e,j)=>({...e,heat:i+1,lane:priority[j]??1})));
}
export function moveSeed(assignments: readonly SeedAssignment[], id:string, heat:number, lane:number, lanes:number) {
  if(!Number.isInteger(heat)||heat<1||!Number.isInteger(lane)||lane<1||lane>lanes)throw new Error('Serie o carril inválido.');
  const source=assignments.find(a=>a.id===id);if(!source)throw new Error('Inscripción no disponible.');
  const target=assignments.find(a=>a.heat===heat&&a.lane===lane);
  return assignments.map(a=>a.id===id?{...a,heat,lane}:target&&a.id===target.id?{...a,heat:source.heat,lane:source.lane}:{...a});
}