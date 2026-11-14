import { useState } from 'react';
import { useMutation, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Upload, Check, ArrowLeft, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { coachQuery } from '@/lib/coach-data';
import { clubManagementQuery } from '@/lib/club-management-data';
import { parseSwimFile, reconcileSwimmer } from '@/lib/swim-io/staging';
import type { ParseFileResult } from '@/lib/swim-io/types';
import { importParsed } from '@/lib/importer';
import { eventLabel, formatTime } from '@/lib/swim';

export function SwimFileImporterModal() {
 const { data } = useSuspenseQuery(coachQuery), { data: management } = useSuspenseQuery(clubManagementQuery), qc = useQueryClient();
 const [open,setOpen]=useState(false),[step,setStep]=useState(1),[file,setFile]=useState<ParseFileResult|null>(null),[reading,setReading]=useState(false),[error,setError]=useState(''),[drag,setDrag]=useState(false);
 const [clubId,setClub]=useState('none'),[teamCode,setTeam]=useState('all'),[links,setLinks]=useState<Record<string,string>>({}),[progress,setProgress]=useState(0);
 const athletes=file?.parsed.athletes.filter(a=>teamCode==='all'||a.teamCode===teamCode)??[];
 const existing=data.athletes.filter(a=>clubId==='none'||a.club_id===clubId);
 const matches=athletes.map(a=>({athlete:a,...reconcileSwimmer(a,existing)}));
 const resolved=Object.fromEntries(matches.flatMap(m=>{const id=links[m.athlete.key]??m.match?.id;return id&&id!=='new'?[[m.athlete.key,id]]:[];}));
 const unresolved=matches.some(m=>m.status==='possible'&&!links[m.athlete.key]);
 const results=file?.parsed.results.filter(r=>athletes.some(a=>a.key===r.athleteKey))??[];
 const mutation=useMutation({mutationFn:async()=>{
  if(!file) throw new Error('Selecciona un archivo.');
  return importParsed(file.name,file.parsed,setProgress,{hash:file.hash,clubId:clubId==='none'?undefined:clubId,teamCode,links:resolved});
 },onSuccess:async summary=>{setStep(3);setProgress(100);toast.success(`${summary.results} marcas y ${summary.splits} parciales guardados.`);await Promise.all(['meets','athletes','results','coach-data','club-management','dashboard','import-logs'].map(k=>qc.invalidateQueries({queryKey:[k]})));},onError:e=>{setError(e.message);setStep(2);}});
 async function pick(f?:File){if(!f||reading||mutation.isPending)return;setReading(true);setError('');try{setFile(await parseSwimFile(f));setLinks({});setTeam('all');setStep(2);}catch(e){setError(e instanceof Error?e.message:'No se pudo leer el archivo.');}finally{setReading(false);}}
 function update(field:'name'|'startDate'|'course',value:string){setFile(f=>f?{...f,parsed:{...f.parsed,meet:{...f.parsed.meet,[field]:value}}}:f);}
 return <Dialog open={open} onOpenChange={v=>{if(mutation.isPending)return;setOpen(v);if(!v){setStep(1);setFile(null);setError('');mutation.reset();}}}>
 <Button onClick={()=>setOpen(true)}><Upload/>Importar resultados</Button>
 <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl"><DialogHeader><DialogTitle>Importar archivo de natación</DialogTitle><DialogDescription>Competencias · HY3 / SD3 / CL2 / ZIP</DialogDescription></DialogHeader>
 <ol className="grid grid-cols-3 gap-2 border-b pb-4 text-sm">{['Carga','Revisión','Confirmación'].map((t,i)=><li key={t} className={step===i+1?'font-semibold text-primary':'text-muted-foreground'}>{i+1}. {t}</li>)}</ol>
 {error&&<p role="alert" className="break-words text-sm text-destructive">{error}</p>}
 {step===1&&<label className={`flex min-h-52 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-6 ${drag?'border-primary bg-muted':'border-border'}`} onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)} onDrop={e=>{e.preventDefault();setDrag(false);void pick(e.dataTransfer.files[0]);}}><Upload className="size-9 text-primary"/><span className="font-semibold">{reading?'Leyendo archivo…':'Arrastra o selecciona un archivo'}</span><span className="text-sm text-muted-foreground">HY3 · SD3 · CL2 · ZIP — hasta 25 MB</span><input type="file" accept=".hy3,.sd3,.cl2,.zip" aria-label="Archivo de natación" className="sr-only" disabled={reading} onChange={e=>{void pick(e.target.files?.[0]);e.target.value='';}}/></label>}
 {file&&step===2&&<div className="space-y-5">
 <div className="space-y-1 border-b pb-3 text-xs text-muted-foreground"><p className="break-all">{file.name} · {file.format} · {file.encoding}</p><p className="break-all">SHA-256: {file.hash}</p></div>
 <div className="grid gap-3 sm:grid-cols-3"><label className="space-y-1 text-sm">Nombre de competencia<Input aria-label="Nombre de competencia" value={file.parsed.meet.name} onChange={e=>update('name',e.target.value)}/></label><label className="space-y-1 text-sm">Fecha<Input aria-label="Fecha de competencia" type="date" value={file.parsed.meet.startDate??''} onChange={e=>update('startDate',e.target.value)}/></label><div className="space-y-1 text-sm">Piscina<Select value={file.parsed.meet.course} onValueChange={v=>update('course',v)}><SelectTrigger aria-label="Piscina de competencia"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="LCM">50m (L)</SelectItem><SelectItem value="SCM">25m (S)</SelectItem><SelectItem value="SCY">25yd (Y)</SelectItem></SelectContent></Select></div></div>
 <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[[athletes.length,'Atletas'],[results.length,'Pruebas / resultados'],[results.reduce((n,r)=>n+r.splits.length,0),'Parciales'],[file.parsed.warnings.length,'Advertencias']].map(([n,t])=><div key={t} className="rounded-md border p-3"><p className="text-2xl font-semibold">{n}</p><p className="text-xs text-muted-foreground">{t}</p></div>)}</div>
 <div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-sm">Mi club de destino</p><Select value={clubId} onValueChange={v=>{setClub(v);setLinks({});}}><SelectTrigger aria-label="Club de destino"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="none">Sin asignar club</SelectItem>{management.clubs.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select></div><div><p className="mb-1 text-sm">Clubes del archivo</p><Select value={teamCode} onValueChange={setTeam}><SelectTrigger aria-label="Filtrar club del archivo"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">Importar todos</SelectItem>{file.parsed.teams.map(t=><SelectItem key={t.code} value={t.code}>{t.code} · {t.name}</SelectItem>)}</SelectContent></Select></div></div>
 <div className="divide-y border-y">{matches.map(m=><div key={m.athlete.key} className="grid gap-2 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"><div className="min-w-0"><p className="break-words font-medium">{m.athlete.firstName} {m.athlete.lastName}</p><p className="text-xs text-muted-foreground">{m.athlete.birthDate??'Nacimiento sin registrar'} · {m.athlete.teamCode??'Sin equipo'}</p></div><div>{m.status==='existing'?<Badge variant="outline" className="text-success">Atleta existente</Badge>:m.status==='new'?<Badge variant="outline" className="text-primary">Nuevo atleta</Badge>:<div className="space-y-2"><Badge variant="outline" className="text-accent">Posible coincidencia</Badge><Select value={links[m.athlete.key]??''} onValueChange={v=>setLinks(l=>({...l,[m.athlete.key]:v}))}><SelectTrigger aria-label={`Vincular ${m.athlete.firstName} ${m.athlete.lastName}`}><SelectValue placeholder="Revisar identidad"/></SelectTrigger><SelectContent><SelectItem value="new">Crear nuevo atleta</SelectItem>{m.candidates.map(a=><SelectItem value={a.id} key={a.id}>{a.first_name} {a.last_name} · {a.birth_date??'—'}</SelectItem>)}</SelectContent></Select></div>}</div></div>)}</div>
 <details><summary className="cursor-pointer py-2 font-medium">Resultados seleccionados · {results.length}</summary><div className="max-h-72 overflow-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Atleta</th><th className="p-2">Prueba</th><th className="p-2">Tiempo / estado</th></tr></thead><tbody>{results.map((r,i)=><tr key={i} className="border-t"><td className="p-2">{athletes.find(a=>a.key===r.athleteKey)?.firstName}</td><td className="p-2">{r.eventNumber} · {eventLabel(r.distance,r.stroke)} · {r.course}</td><td className="p-2">{r.status&&r.status!=='OK'?r.status:formatTime(r.finalMs)}</td></tr>)}</tbody></table></div></details>
 <details><summary className="cursor-pointer py-2 font-medium">Advertencias del archivo · {file.parsed.warnings.length}</summary><div className="max-h-52 space-y-2 overflow-auto text-sm text-muted-foreground">{file.parsed.warnings.map((w,i)=><p className="break-words" key={i}>{w}</p>)}{!file.parsed.warnings.length&&<p>Sin advertencias.</p>}</div></details>
 {unresolved&&<p className="text-sm text-accent">Revisa las posibles coincidencias antes de confirmar.</p>}
 <div className="flex flex-wrap justify-between gap-2"><Button variant="outline" onClick={()=>setStep(1)} disabled={mutation.isPending}><ArrowLeft/>Cambiar archivo</Button><Button disabled={mutation.isPending||!athletes.length||unresolved||!file.parsed.meet.name.trim()||!file.parsed.meet.startDate} onClick={()=>{setStep(3);setProgress(5);mutation.mutate();}}><ArrowRight/>Confirmar e Importar</Button></div>
 </div>}
 {step===3&&<div className="space-y-5 py-6"><Progress value={progress}/>{mutation.isPending?<p role="status">Guardando la competencia y sus registros…</p>:<><Check className="size-12 text-success"/><h2 className="text-xl font-semibold">Importación completada</h2><p>{mutation.data?.athletesNew} atletas nuevos · {mutation.data?.athletesMatched} existentes · {mutation.data?.results} marcas · {mutation.data?.splits} parciales</p><Button onClick={()=>setOpen(false)}>Cerrar</Button></>}</div>}
 </DialogContent></Dialog>;
}
