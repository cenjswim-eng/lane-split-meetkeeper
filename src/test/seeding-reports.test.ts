import { it,expect } from 'vitest';
import { seedingPdf } from '@/lib/seeding-reports';
import { seedEntries } from '@/utils/seedingEngine';
it('prepares all three printable PDF formats with the full saved fields',async()=>{
 const rows=seedEntries(Array.from({length:24},(_,i)=>({id:String(i),name:`Apellido ${i}, Nombre`,age:14,club:'CLUB',seedTimeMs:60000+i*1000,course:'LCM'})),{lanes:8,mode:'timed',course:'LCM'});
 for(const kind of ['psych','program','timers'] as const){const file=seedingPdf('Copa verificación',1,[{id:'e',label:'Prueba 1 · 100 Libre · F · 14–15',rows}],kind,8,false);expect(file.type).toBe('application/pdf');expect(file.size).toBeGreaterThan(1000);}
});