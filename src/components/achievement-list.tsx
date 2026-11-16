import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Medal, Share2, Copy, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from './ui/dialog';
import { achievementLabels, achievementText, type Achievement } from '@/lib/achievements';
import { achievementsQuery } from '@/lib/achievement-data';
import { achievementImage } from '@/lib/achievement-image';
import { canShareFile, downloadFile, shareFile } from '@/lib/file-delivery';
import { formatTime, eventLabel } from '@/lib/swim';

function AchievementShare({achievement:a}:{achievement:Achievement}) {
  const [open,setOpen]=useState(false),[file,setFile]=useState<File|null>(null),[url,setUrl]=useState(''),[busy,setBusy]=useState(false);
  const text=achievementText(a);
  function close(v:boolean){setOpen(v);if(!v){if(url)URL.revokeObjectURL(url);setUrl('');setFile(null);}}
  return <Dialog open={open} onOpenChange={close}><Button variant="ghost" size="icon" title="Compartir logro" aria-label="Compartir logro" onClick={()=>setOpen(true)}><Share2/></Button><DialogContent className="max-h-[90dvh] overflow-auto"><DialogHeader><DialogTitle>Compartir logro</DialogTitle><DialogDescription>Revisa los datos del atleta antes de compartirlos. No se publican automáticamente.</DialogDescription></DialogHeader><p className="whitespace-pre-wrap break-words text-sm">{text}</p><Button variant="outline" onClick={async()=>{try{await navigator.clipboard.writeText(text);toast.success('Texto copiado');}catch{toast.error('No se pudo copiar. Selecciona el texto del resumen.');}}}><Copy/>Copiar texto</Button>{!file?<Button disabled={busy} onClick={async()=>{setBusy(true);try{const prepared=await achievementImage(a);setFile(prepared.file);setUrl(URL.createObjectURL(prepared.file));}catch(e){toast.error(e instanceof Error?e.message:'No se pudo crear la imagen.');}finally{setBusy(false);}}}>{busy?'Preparando…':'Preparar imagen vertical'}</Button>:<><img src={url} alt="Vista previa del logro para compartir" className="mx-auto max-h-80 aspect-[9/16] object-contain"/>{canShareFile(file)&&<Button onClick={async()=>{try{await shareFile(file);}catch(e){toast.error((e as Error).message);}}}><Share2/>Compartir imagen…</Button>}<Button variant="outline" onClick={()=>downloadFile(file)}><Download/>Descargar imagen</Button></>}</DialogContent></Dialog>;
}

export function AchievementList({rows,filters=false,limit,readOnly=false}:{rows:readonly Achievement[];filters?:boolean;limit?:number|undefined;readOnly?:boolean}) {
  const [athlete,setAthlete]=useState('all'),[meet,setMeet]=useState('all'),[kind,setKind]=useState('all'),[from,setFrom]=useState(''),[to,setTo]=useState('');
  const visible=rows.filter(a=>(athlete==='all'||a.athlete_id===athlete)&&(meet==='all'||a.meet_id===meet)&&(kind==='all'||a.kind===kind)&&(!from||a.achieved_on>=from)&&(!to||a.achieved_on<=to)).slice(0,limit);
  const selector=(label:string,value:string,change:(v:string)=>void,options:[string,string][])=> <Select value={value} onValueChange={change}><SelectTrigger aria-label={label} className="min-w-0"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">{label} · Todos</SelectItem>{options.map(([id,name])=><SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select>;
  return <div className="space-y-4">{filters&&<div className="grid gap-3 sm:grid-cols-3">{selector('Atleta',athlete,setAthlete,[...new Map(rows.map(a=>[a.athlete_id,`${a.athletes?.first_name??''} ${a.athletes?.last_name??''}`])).entries()])}{selector('Competencia',meet,setMeet,[...new Map(rows.map(a=>[a.meet_id,a.meets?.name??'Competencia'])).entries()])}{selector('Tipo',kind,setKind,Object.entries(achievementLabels))}<label className="text-xs text-muted-foreground">Desde<Input aria-label="Logros desde" type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label className="text-xs text-muted-foreground">Hasta<Input aria-label="Logros hasta" type="date" value={to} onChange={e=>setTo(e.target.value)}/></label><p className="self-end py-3 text-sm text-muted-foreground">{visible.length} logros</p></div>}<div className="divide-y border-y">{visible.map(a=><article key={a.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 py-4"><Medal className={`mt-1 size-5 ${a.kind==='minimum'?'text-success':a.kind==='pb'?'text-primary':'text-accent'}`}/><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="font-semibold break-words">{a.athletes?.first_name} {a.athletes?.last_name}</span><Badge variant="outline">{a.kind==='pb'?'MP':achievementLabels[a.kind]}</Badge></div><p className="mt-2 text-sm">{eventLabel(a.distance,a.stroke)} · {a.course==='LCM'?'50 m':'25 m'} · <span className="time font-semibold">{formatTime(a.time_ms)}</span></p><p className="mt-1 text-sm text-muted-foreground">{a.kind==='pb'&&a.improvement_ms!=null?`Mejoró ${(a.improvement_ms/1000).toFixed(3)} s · Anterior ${formatTime(a.previous_ms)}`:a.kind==='minimum'?`Mínima ${formatTime(a.minimum_ms)}`:'Primer tiempo registrado'}</p><p className="mt-2 break-words text-xs text-muted-foreground">{a.achieved_on} · {a.meets?.name}</p></div>{!readOnly&&<AchievementShare achievement={a}/>}</article>)}{!visible.length&&<p className="py-8 text-sm text-muted-foreground">Sin logros para estos filtros.</p>}</div></div>;
}
export function RecentAchievements({athleteId}:{athleteId?:string}) {
  const {data}=useSuspenseQuery(achievementsQuery);
  return <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-2xl font-semibold">{athleteId?'Línea de tiempo de logros':'Logros recientes'}</h2><Button variant="link" asChild><Link to="/achievements">Todos los logros</Link></Button></div><AchievementList rows={athleteId?data.filter(a=>a.athlete_id===athleteId):data} limit={athleteId?undefined:6}/></section>;
}