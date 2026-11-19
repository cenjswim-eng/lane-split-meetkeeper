import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Checkbox } from './ui/checkbox';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { PdfExport } from './pdf-export';
import { attendanceSummary,localAttendanceDate, type AttendanceReport } from '@/lib/attendance';
import { loadAttendance } from '@/lib/attendance-data';
import type { ReportBrand } from '@/lib/report-brand';
import { athleteAttendancePdf } from '@/lib/reports';
import { supabase } from '@/integrations/supabase/client';
export function AthleteAttendanceReport({athleteId,clubId,title,label,prepare}:{athleteId:string;clubId?:string|undefined;title:string;label:string;prepare:(brand:ReportBrand|undefined,attendance:AttendanceReport|undefined)=>Promise<File>}) {
 const today=localAttendanceDate();const [include,setInclude]=useState(false);const [from,setFrom]=useState(today.slice(0,7)+'-01');const [to,setTo]=useState(today);
 const valid=!!from&&!!to&&from<=to;
 const query=useQuery({queryKey:['attendance-summary',athleteId,from,to],queryFn:()=>loadAttendance(from,to,athleteId),enabled:include&&valid});
 const summary=attendanceSummary(query.data??[]);
 return <section className="w-full space-y-3 border-y py-4"><div className="flex flex-wrap items-center gap-3"><label className="flex items-center gap-2 text-sm font-medium"><Checkbox checked={include} onCheckedChange={v=>setInclude(v===true)} />Incluir cuadro de asistencia en PDF</label><Button asChild variant="ghost" size="sm"><Link to="/attendance">Control de asistencia</Link></Button></div>{include&&<><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm">Desde<Input aria-label="Asistencia desde" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="text-sm">Hasta<Input aria-label="Asistencia hasta" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>{!valid?<p role="alert" className="text-sm text-destructive">Revisa el periodo de asistencia.</p>:query.isError?<p role="alert" className="text-sm text-destructive">No se pudo consultar la asistencia. <Button variant="ghost" size="sm" onClick={()=>query.refetch()}>Reintentar</Button></p>:<p className="text-sm text-muted-foreground">{query.isFetching?'Consultando asistencia…':`${summary.attended} asistencias · ${summary.absent} ausencias · ${summary.excused} justificadas · ${summary.percentage??'—'}${summary.percentage==null?'':'%'} de asistencia`}</p>}</>}
 <div className="flex flex-wrap gap-2">
  <PdfExport key={`${athleteId}-${include}-${from}-${to}`} title={title} label={label} clubId={clubId} prepare={async brand=>{if(include&&!valid)throw Error('Revisa el periodo de asistencia.');const attendance=include?{from,to,rows:await loadAttendance(from,to,athleteId)}:undefined;return prepare(brand,attendance);}}/>
  {include && valid && (
    <PdfExport
      key={`${athleteId}-cuadro-${from}-${to}`}
      title="Cuadro Resumido de Asistencia"
      label="PDF solo cuadro de asistencia"
      clubId={clubId}
      prepare={async (brand) => {
        const rows = await loadAttendance(from, to, athleteId);
        const { data: ath } = await supabase.from('athletes').select('first_name,last_name,teams(name)').eq('id', athleteId).single();
        return athleteAttendancePdf(ath ?? { first_name: 'Atleta', last_name: '' }, { from, to, rows }, brand);
      }}
    />
  )}
 </div>
 </section>;
}
