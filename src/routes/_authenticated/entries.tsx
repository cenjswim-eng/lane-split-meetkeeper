import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, ClipboardList } from "lucide-react";
import { coachQuery } from "@/lib/coach-data";
import { supabase } from "@/integrations/supabase/client";
import { entrySeed, entryMinimum } from "@/lib/entry-rules";
import { eventLabel, formatTime } from "@/lib/swim";
import { prepareEntries } from "@/lib/entry-files";
import { MeetExport } from "@/components/meet-export";
import { Button } from "@/components/ui/button";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { ShareSummary } from "@/components/share-summary";
import { clubManagementQuery } from "@/lib/club-management-data";
import { TournamentSetup } from '@/components/team-manager-tools';
import { TeamRelayBuilder } from '@/components/team-relay-builder';
import { teamRelayQuery } from '@/lib/team-relay-data';
import { tournamentEligible, entryLimitWarnings, entryFees } from '@/lib/tournament-rules';
import { scopeClubData } from "@/lib/club-management";
import { MeetEntriesExporter } from '@/components/exports/MeetEntriesExporter';
import { EntryAssistant } from '@/components/entry-assistant';
import { assistantDraftQuery } from '@/lib/entry-assistant-data';
import { AssistantMeetCreate } from '@/components/assistant-meet-create';

export const Route = createFileRoute("/_authenticated/entries")({
 validateSearch: (s: Record<string, unknown>): { club?: string | undefined; meet?: string | undefined } => ({ club: typeof s["club"] === "string" ? s["club"] : undefined, meet: typeof s["meet"] === "string" ? s["meet"] : undefined }),
 head: () => ({ meta: [{ title: "Inscripciones — Swim Lane Coach" }, { name: "description", content: "Selecciona nadadores y pruebas, consulta mínimas y exporta inscripciones SD3 para Meet Manager." }, { property: "og:title", content: "Inscripciones — Swim Lane Coach" }, { property: "og:description", content: "Inscripciones privadas del club y exportaciones para Meet Manager y Team Manager." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
 loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(coachQuery), context.queryClient.ensureQueryData(clubManagementQuery),context.queryClient.ensureQueryData(teamRelayQuery),context.queryClient.ensureQueryData(assistantDraftQuery)]); }, component: Entries,
});
function Entries() {
 const { data: all } = useSuspenseQuery(coachQuery); const qc = useQueryClient();
 const { data: management } = useSuspenseQuery(clubManagementQuery);
 const {data:relays}=useSuspenseQuery(teamRelayQuery);
 const search = Route.useSearch(); const navigate = Route.useNavigate();
 const data = search.club ? scopeClubData(all, search.club, management.links) : all;
 const [chosenMeet, setMeetId] = useState(search.meet ?? "");
 const [chosenAthlete, setAthleteId] = useState("");
 const meetId = data.meets.some(m => m.id === chosenMeet) ? chosenMeet : data.meets[0]?.id ?? "";
 const athleteId = data.athletes.some(a => a.id === chosenAthlete) ? chosenAthlete : data.athletes[0]?.id ?? "";
 const [selected, setSelected] = useState<string[]>([]); const [busy, setBusy] = useState(false);
 const meet = data.meets.find(m => m.id === meetId); const athlete = data.athletes.find(a => a.id === athleteId);
 const events = data.events.filter(e => e.meet_id === meetId && (!athlete || tournamentEligible(athlete,e,Number(meet?.start_date?.slice(0,4)??new Date().getFullYear())))); const entries = data.entries.filter(e => e.meet_id === meetId);
 const activeEntries=entries.filter(e=>e.status!=='SCR');
 const athleteEntries=activeEntries.filter(e=>e.athlete_id===athleteId);
 const pending=selected.filter(id=>!athleteEntries.some(e=>e.event_id===id));
 const relayCount=relays.entries.filter(r=>r.meet_id===meetId&&r.status!=='SCR'&&[r.swimmer_1_id,r.swimmer_2_id,r.swimmer_3_id,r.swimmer_4_id].includes(athleteId)).length;
 const warnings=meet?[...new Set(events.flatMap(ev=>entryLimitWarnings(athleteEntries.length+pending.length,athleteEntries.filter(e=>data.events.find(v=>v.id===e.event_id)?.session_number===ev.session_number).length+pending.filter(id=>events.find(v=>v.id===id)?.session_number===ev.session_number).length,relayCount,meet)))]:[];
 const feeRelays=relays.entries.filter(r=>r.meet_id===meetId&&r.status!=='SCR'&&(!search.club||r.club_id===search.club));
 const feeAthletes=new Set([...activeEntries.map(e=>e.athlete_id),...(pending.length?[athleteId]:[]),...feeRelays.flatMap(r=>[r.swimmer_1_id,r.swimmer_2_id,r.swimmer_3_id,r.swimmer_4_id])]);
 async function save() {
  if (!meet || !athlete || !selected.length || warnings.length) return;
  setBusy(true);
  try {
   const rows = selected.flatMap(id => { const event = events.find(e => e.id === id); if (!event) return []; return [{ meet_id: meet.id, athlete_id: athlete.id, event_id: id, seed_course:event.course??meet.course, seed_time_ms: entrySeed(data.results, athlete.id, event.distance, event.stroke, event.course??meet.course, meet.start_date) }]; });
   const { error } = await supabase.from("meet_entries").upsert(rows, { onConflict: "athlete_id,event_id" });
   if (error) throw error; await qc.invalidateQueries({ queryKey: ["coach-data"] }); setSelected([]); toast.success("Inscripciones guardadas.");
  } catch(e) { toast.error(e instanceof Error ? e.message : "No se pudieron guardar las inscripciones."); } finally { setBusy(false); }
 }
 async function remove(id: string) { const { error } = await supabase.from("meet_entries").delete().eq("id", id); if(error) toast.error(error.message); else await qc.invalidateQueries({ queryKey: ["coach-data"] }); }
 const text = `Swim Lane Coach\nInscripciones · ${meet?.name ?? ""}\n${meet?.start_date ?? ""} · ${meet?.course ?? ""}\n` + entries.map(e => { const a=data.athletes.find(a=>a.id===e.athlete_id), ev=data.events.find(ev=>ev.id===e.event_id); return `${a?.first_name ?? ""} ${a?.last_name ?? ""} · ${ev ? eventLabel(ev.distance,ev.stroke) : ""} · ${formatTime(e.seed_time_ms)}`; }).join("\n");
 return <div className="space-y-6"><h1 className="text-4xl font-bold">Inscripciones</h1><Select value={search.club ?? "all"} onValueChange={v => { setSelected([]); setMeetId(""); setAthleteId(""); void navigate({ search: { club: v === "all" ? undefined : v } }); }}><SelectTrigger aria-label="Club de inscripciones" className="w-full sm:w-80"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos mis clubes</SelectItem>{management.clubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select><div className="grid gap-3 sm:grid-cols-2"><Select value={meetId} onValueChange={v=>{setMeetId(v);setSelected([]);}}><SelectTrigger aria-label="Competencia"><SelectValue placeholder="Competencia" /></SelectTrigger><SelectContent>{data.meets.map(m=><SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select><Select value={athleteId} onValueChange={v=>{setAthleteId(v);setSelected([]);}}><SelectTrigger aria-label="Atleta"><SelectValue placeholder="Atleta" /></SelectTrigger><SelectContent>{data.athletes.map(a=><SelectItem key={a.id} value={a.id}>{a.first_name} {a.last_name}</SelectItem>)}</SelectContent></Select></div>
 {meet&&<div className="flex flex-wrap items-center gap-3"><TournamentSetup key={meet.id} meet={meet}/><span className="text-sm text-muted-foreground">Edad al 31/12 · {athleteEntries.length+pending.length} pruebas del atleta</span></div>}
 <div className="flex flex-wrap gap-3"><MeetEntriesExporter meetId={meetId}/><AssistantMeetCreate onCreated={id=>{setMeetId(id);setSelected([]);}}/></div>
 {meet&&<EntryAssistant key={`${meetId}-${search.club}`} meetId={meetId} clubId={search.club}/>}
 {warnings.map(w=><p key={w} role="alert" className="text-sm text-destructive">{w}</p>)}
 <section className="border-y"><h2 className="py-4 text-2xl font-semibold">Pruebas de la competencia</h2>{events.length ? events.map(ev=>{
 const seed = athlete && meet ? entrySeed(data.results,athlete.id,ev.distance,ev.stroke,ev.course??meet.course,meet.start_date) : null;
 const minimum = athlete && meet ? entryMinimum(data.standards,athlete,ev,meet.course,meet.start_date,seed) : null;
 const warning = minimum?.status === "not-met" || minimum?.status === "no-time";
 return <label key={ev.id} className="grid cursor-pointer grid-cols-[auto_minmax(0,1fr)] gap-3 border-t py-4"><input type="checkbox" aria-label={eventLabel(ev.distance,ev.stroke)} checked={selected.includes(ev.id)} onChange={e=>setSelected(e.target.checked ? [...selected,ev.id] : selected.filter(id=>id!==ev.id))} className="mt-1 size-4 accent-primary" /><div className="min-w-0"><p className="font-medium">{ev.event_number && `${ev.event_number} · `}{eventLabel(ev.distance,ev.stroke)} <span className="text-xs text-muted-foreground">{ev.gender ?? "Mixto"} · {ev.min_age ?? "—"}–{ev.max_age ?? "—"}</span></p><p className="mt-1 text-sm text-muted-foreground">Marca: {formatTime(seed)}{minimum?.limit != null && ` · Mínima: ${formatTime(minimum.limit)}`}</p><p className={`mt-1 text-xs ${warning ? "text-accent" : minimum?.status === "met" ? "text-success" : "text-muted-foreground"}`}>{minimum?.status === "not-met" ? "No cumple la mínima" : minimum?.status === "no-time" ? "Sin marca para verificar la mínima" : minimum?.status === "met" ? "Mínima alcanzada" : "Sin mínima configurada"}</p></div></label>;
 }) : <p className="pb-5 text-sm text-muted-foreground">Esta competencia no tiene pruebas individuales. Importa su archivo de pruebas o inscripciones.</p>}</section><Button disabled={busy || !selected.length || !athlete || warnings.length>0} onClick={save}><ClipboardList />{busy ? "Guardando…" : "Guardar inscripciones"}</Button>
 <section><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold">Inscripciones guardadas · {entries.length}</h2>{meet && entries.length>0 && <div className="flex flex-wrap gap-2"><MeetExport key={`${meet.id}-${entries.map(e=>`${e.id}:${e.seed_time_ms}`).join(",")}`} entriesOnly name={meet.name} prepare={kind=>Promise.resolve(prepareEntries(data,meet.id,kind==="sd3"?"sd3":kind==='hy3'?'hy3':"pdf",search.club))} /><ShareSummary text={text} /></div>}</div><div className="mt-4 divide-y border-y">{entries.map(e=>{const a=data.athletes.find(a=>a.id===e.athlete_id),ev=data.events.find(ev=>ev.id===e.event_id);return <div key={e.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-4"><div className="min-w-0"><p className="break-words font-medium">{a?.first_name} {a?.last_name}</p><p className="text-sm text-muted-foreground">{ev ? eventLabel(ev.distance,ev.stroke):"—"} · {formatTime(e.seed_time_ms)}</p></div><Button variant="ghost" size="icon" title="Eliminar inscripción" aria-label="Eliminar inscripción" onClick={()=>remove(e.id)}><Trash2 /></Button></div>})}{!entries.length && <p className="py-6 text-sm text-muted-foreground">Sin inscripciones guardadas.</p>}</div></section>
 {meet&&search.club&&<TeamRelayBuilder key={`${meet.id}-${search.club}`} meet={meet} clubId={search.club} data={data}/>}
 {meet&&<section className="border-t pt-5"><h2 className="text-xl font-semibold">Resumen de cuotas</h2><p className="mt-2 text-sm text-muted-foreground">{feeAthletes.size} atletas × {meet.athlete_surcharge} + {activeEntries.length+pending.length} individuales × {meet.ind_entry_fee} + {feeRelays.length} relevos × {meet.relay_entry_fee}</p><p className="mt-3 text-2xl font-semibold text-primary">Total: {entryFees(feeAthletes.size,activeEntries.length+pending.length,feeRelays.length,meet).toFixed(2)}</p><p className="mt-1 text-xs text-muted-foreground">Unidad monetaria del torneo · Sin cobro automático</p></section>}
 </div>;
}
