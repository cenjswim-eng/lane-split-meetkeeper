import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, FileText } from "lucide-react";
import { coachQuery } from "@/lib/coach-data";
import { profileQuery } from "@/lib/profile";
import { compactReportQuery } from "@/lib/compact-report-data";
import { compactCells, compactDate, compactHeaders, compactKpis, compactReportRows, courseLabel, type RowEdit, type TargetMode } from "@/lib/compact-meet-report";
import { compactLogo, compactMeetPdf } from "@/lib/compact-meet-pdf";
import { loadStandardVersions } from "@/lib/standard-version-data";
import { standardSourceNote } from "@/lib/standard-versions";
import { compactTime, formatTimeDiff } from "@/utils/timeDiffUtils";
import { parseTime } from "@/lib/swim";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandEmpty, CommandList, CommandItem } from "@/components/ui/command";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PdfExport } from "@/components/pdf-export";

export function CompactMeetReportModal() {
  const [open,setOpen]=useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button variant="outline"><FileText className="size-4" />Reporte ejecutivo / resumido</Button></DialogTrigger>
    <DialogContent className="flex max-h-[94dvh] w-[calc(100%-1rem)] max-w-7xl flex-col overflow-hidden p-4 sm:p-6">
      <DialogHeader className="pr-6"><DialogTitle>Reporte Ejecutivo / Resumido por Competencia</DialogTitle><DialogDescription>Resultados seleccionados · Comparaciones y objetivos</DialogDescription></DialogHeader>
      {open && <CompactReportBody />}
    </DialogContent>
  </Dialog>;
}

function CompactReportBody() {
  const {data:coach}=useQuery(coachQuery);
  const {data:detail,error,isPending}=useQuery(compactReportQuery);
  const {data:profile}=useQuery(profileQuery);
  const queryClient=useQueryClient();
  const [meets,setMeets]=useState<string[]>([]);
  const [scope,setScope]=useState("club");
  const [clubId,setClubId]=useState("all");
  const [athleteId,setAthleteId]=useState("");
  const [mode,setMode]=useState<TargetMode>("national");
  const [edits,setEdits]=useState<Record<string,RowEdit>>({});
  const [targetText,setTargetText]=useState<Record<string,string>>({});
  const [invalid,setInvalid]=useState<Record<string,boolean>>({});
  const [coachName,setCoachName]=useState<string | null>(null);
  const [clubName,setClubName]=useState<string | null>(null);
  const rows=useMemo(()=>coach&&detail && (scope!=="athlete"||athleteId) ? compactReportRows(detail.results,coach.athletes,meets,mode,coach.standards,coach.events,edits,scope==="athlete"?athleteId:"",clubId==="all"?"":clubId):[],[coach,detail,meets,mode,edits,scope,athleteId,clubId]);
  if(error)return <p role="alert" className="text-destructive">No se pudieron cargar los resultados: {error.message}</p>;
  if(isPending || !coach || !detail)return <p role="status">Cargando competencias y resultados…</p>;
  const club=detail.clubs.find(c=>c.id===clubId);
  const headerClub=clubName ?? club?.full_name ?? club?.name ?? profile?.club?.name ?? "Mis clubes";
  const headerCoach=coachName ?? club?.head_coach ?? profile?.settings?.display_name ?? "";
  const athletes=coach.athletes.filter(a=>clubId==="all" || a.club_id===clubId);
  const kpis=compactKpis(rows);
  const source=mode==="national"?standardSourceNote(coach.activeVersion):mode==="pb"?"Referencia: mejor tiempo personal previo, misma prueba y piscina.":mode==="tournament"?"Referencia: mínimas importadas de la prueba del torneo, según piscina, sexo y edad.":"Referencia: objetivos manuales del entrenador; no son mínimas oficiales.";
  const invalidTargets=rows.some(row=>invalid[row.id]);
  async function prepare() {
    if(!coach || !detail)throw new Error("Los resultados todavía no están disponibles.");
    if(invalidTargets)throw new Error("Corrige las marcas objetivo inválidas.");
    const current=await loadStandardVersions();
    queryClient.setQueryData(coachQuery.queryKey,{...coach,standards:current.data,versions:current.versions,activeVersion:current.activeVersion});
    const freshRows=compactReportRows(detail.results,coach.athletes,meets,mode,current.data,coach.events,edits,scope==="athlete"?athleteId:"",clubId==="all"?"":clubId);
    let logoUrl=clubId==="all"?profile?.logoUrl ?? null:null;
    if(club?.logo_path){const signed=await supabase.storage.from("club-documents").createSignedUrl(club.logo_path,300);if(signed.error)throw signed.error;logoUrl=signed.data?.signedUrl ?? null;}
    return compactMeetPdf({rows:freshRows,club:headerClub,coach:headerCoach,meets:coach.meets.filter(m=>meets.includes(m.id)).map(m=>`${m.name} (${courseLabel(m.course)})`),source:(mode==="national"?standardSourceNote(current.activeVersion):source)+(Object.keys(targetText).length?" · Incluye objetivos editados manualmente.":""),logo:await compactLogo(logoUrl)});
  }
  return <div className="min-h-0 space-y-4 overflow-y-auto">
    <div className="grid gap-3 border-y py-4 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1.5"><Label>Competencias</Label><Popover><PopoverTrigger asChild><Button variant="outline" role="combobox" aria-label="Seleccionar competencias" className="w-full justify-between"><span className="truncate">{meets.length?`${meets.length} seleccionada${meets.length===1?"":"s"}`:"Seleccionar competencias"}</span><ChevronsUpDown className="size-4 shrink-0" /></Button></PopoverTrigger><PopoverContent align="start" className="w-[min(380px,calc(100vw-2rem))] p-0"><Command><CommandInput placeholder="Buscar torneo…" /><CommandList><CommandEmpty>Sin coincidencias.</CommandEmpty>{coach.meets.map(m=><CommandItem key={m.id} value={`${m.name} ${m.start_date} ${m.course} ${m.id}`} onSelect={()=>setMeets(old=>old.includes(m.id)?old.filter(id=>id!==m.id):[...old,m.id])}><Check className={`size-4 shrink-0 ${meets.includes(m.id)?"opacity-100":"opacity-0"}`} /><span className="min-w-0"><span className="block break-words">{m.name}</span><span className="text-xs">{compactDate(m.start_date)} · {courseLabel(m.course)}</span></span></CommandItem>)}</CommandList></Command></PopoverContent></Popover></div>
      <div className="space-y-1.5"><Label>Alcance</Label><Select value={scope} onValueChange={setScope}><SelectTrigger aria-label="Alcance del reporte"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="club">Todo el club / equipo</SelectItem><SelectItem value="athlete">Un atleta específico</SelectItem></SelectContent></Select></div>
      <div className="space-y-1.5"><Label>Club / Equipo</Label><Select value={clubId} onValueChange={value=>{setClubId(value);setAthleteId("");}}><SelectTrigger aria-label="Club del reporte"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos mis clubes</SelectItem>{detail.clubs.map(c=><SelectItem key={c.id} value={c.id}>{c.full_name || c.name}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label>Marca de referencia</Label><Select value={mode} onValueChange={value=>{setMode(value as TargetMode);setEdits(old=>Object.fromEntries(Object.entries(old).map(([id,edit])=>[id,edit.date?{date:edit.date}:{}])));setTargetText({});setInvalid({});}}><SelectTrigger aria-label="Marca de referencia"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="national">Mínima nacional · versión activa</SelectItem><SelectItem value="tournament">Mínima del torneo</SelectItem><SelectItem value="pb">Mejor tiempo previo (PB)</SelectItem><SelectItem value="manual">Marca objetivo manual</SelectItem></SelectContent></Select></div>
      {scope==="athlete"&&<div className="space-y-1.5"><Label>Atleta</Label><Select value={athleteId} onValueChange={setAthleteId}><SelectTrigger aria-label="Atleta del reporte ejecutivo"><SelectValue placeholder="Seleccionar atleta" /></SelectTrigger><SelectContent>{athletes.map(a=><SelectItem key={a.id} value={a.id}>{a.last_name}, {a.first_name}</SelectItem>)}</SelectContent></Select></div>}
      <div className="space-y-1.5"><Label htmlFor="compact-club">Nombre del club</Label><Input id="compact-club" value={headerClub} onChange={e=>setClubName(e.target.value)} /></div>
      <div className="space-y-1.5"><Label htmlFor="compact-coach">Entrenador</Label><Input id="compact-coach" value={headerCoach} onChange={e=>setCoachName(e.target.value)} /></div>
    </div>
    <p className="text-xs text-muted-foreground">{source}</p>
    {!!rows.length && <p className="text-xs text-muted-foreground">* Fecha de inicio del torneo: los resultados no guardan fecha individual. Confirma la fecha de cada prueba. PB histórico completo; comparación contra fechas anteriores, misma prueba y piscina.</p>}
    <div className="overflow-x-auto border-y">
      <table aria-label="Vista previa del reporte ejecutivo" className="w-full min-w-[1080px] text-left text-xs"><thead><tr>{compactHeaders.map(h=><th key={h} className="border-b p-2 font-medium">{h}</th>)}</tr></thead>
        <tbody>{rows.map((row,i)=>{const cells=compactCells(row);return <Fragment key={row.id}>
          {(i===0||rows[i-1]?.athleteId!==row.athleteId)&&<tr><th colSpan={7} className="border-b bg-muted p-2 text-foreground">{row.athlete}</th></tr>}
          <tr>{cells.map((cell,col)=><td key={col} className={`border-b p-2 align-top ${col===5&&row.pbDiffMs!=null?(row.pbDiffMs<0?"text-success":row.pbDiffMs>0?"text-destructive":""):col===6&&row.targetDiffMs!=null?(row.targetDiffMs<=0?"font-semibold text-success":"text-destructive"):""}`}>
            {col===2?<Input type="date" aria-label={`Fecha ${row.id}`} value={row.date ?? ""} className="w-36 text-xs" onChange={e=>{const date=e.target.value;if(date)setEdits(old=>({...old,[row.id]:{...old[row.id],date}}));}} />:col===6?<div className="space-y-1"><Input aria-label={`Objetivo ${row.id}`} aria-invalid={invalid[row.id] || undefined} className="h-8 w-28 font-mono text-xs" placeholder="N/A" value={targetText[row.id] ?? (row.targetMs==null?"":compactTime(row.targetMs))} onChange={e=>{const text=e.target.value;setTargetText(old=>({...old,[row.id]:text}));const ms=parseTime(text);setInvalid(old=>({...old,[row.id]:!!text.trim()&&ms==null}));if(!text.trim()||ms!=null)setEdits(old=>({...old,[row.id]:{...old[row.id],targetMs:ms}}));}} /><span>{invalid[row.id]?"Tiempo inválido · MM:SS.cc":cell}</span></div>:cell}
          </td>)}</tr>
        </Fragment>;})}</tbody>
      </table>
      {!rows.length&&<p className="py-8 text-center text-sm text-muted-foreground">{!meets.length?"Selecciona una o más competencias.":scope==="athlete"&&!athleteId?"Selecciona un atleta.":"Sin resultados individuales para esta selección."}</p>}
    </div>
    <div className="grid grid-cols-2 gap-3 border-b pb-4 sm:grid-cols-4" aria-label="Resumen del torneo">{[["Pruebas nadadas",kpis.swims],["Nuevos PB",`${kpis.pbs} · ${kpis.pbPercent}%`],["Objetivos logrados",kpis.targets],["Tiempo descontado",`${formatTimeDiff(-kpis.savedMs)}s`]].map(([label,value])=><div key={label}><p className="text-xs text-muted-foreground">{label}</p><p className="font-mono text-lg font-semibold">{value}</p></div>)}</div>
    <div className="flex justify-end pb-1">{!!rows.length&&!invalidTargets&&<PdfExport key={JSON.stringify([meets,scope,clubId,athleteId,mode,edits,headerClub,headerCoach,coach.activeVersion?.id])} title="Reporte ejecutivo de competencia" clubId={clubId==="all"?undefined:clubId} label="Generar PDF compacto" prepare={prepare} />}</div>
  </div>;
}