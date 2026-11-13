import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Building2, Plus, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { clubManagementQuery } from "@/lib/club-management-data";
import { scopeClubData } from "@/lib/club-management";
import { coachQuery } from "@/lib/coach-data";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ClubEditor } from "@/components/club-editor";
import { QuickAthleteEntry } from "@/components/quick-athlete-entry";
import { ClubRosterTable } from "@/components/club-roster-table";
import { AthleteClubTransfer } from "@/components/athlete-club-transfer";
import { categoriesQuery } from "@/lib/categories";

export const Route = createFileRoute("/_authenticated/clubs")({
 head: () => ({ meta: [{ title: "Clubes — Swim Lane Coach" }, { name: "description", content: "Gestión privada de atletas, competencias e inscripciones por club." }, { property: "og:title", content: "Clubes — Swim Lane Coach" }, { property: "og:description", content: "Organiza tus clubes sin compartir registros entre cuentas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
 loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(clubManagementQuery), context.queryClient.ensureQueryData(coachQuery), context.queryClient.ensureQueryData(categoriesQuery)]); },
 component: Clubs,
});
function Clubs() {
 const { data: management } = useSuspenseQuery(clubManagementQuery);
 const { data } = useSuspenseQuery(coachQuery);
 const qc = useQueryClient();
 const [clubId, setClubId] = useState(""); const [clubSearch, setClubSearch] = useState("");
 const [athleteId, setAthleteId] = useState(""); const [meetId, setMeetId] = useState(""); const [busy, setBusy] = useState(false);
 const club = management.clubs.find(c => c.id === clubId) ?? management.clubs[0];
 const scoped = scopeClubData(data, club?.id ?? "", management.links);
 async function action(work: () => Promise<void>) {
  setBusy(true);
  try { await work(); await Promise.all([qc.invalidateQueries({ queryKey: ["club-management"] }), qc.invalidateQueries({ queryKey: ["club-register"] }), qc.invalidateQueries({ queryKey: ["coach-data"] }), qc.invalidateQueries({ queryKey: ["athletes"] })]); }
  catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo guardar el cambio."); } finally { setBusy(false); }
 }
 return <div className="min-w-0 space-y-6">
  <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-4xl font-bold">Clubes</h1><p className="mt-1 text-muted-foreground">{management.clubs.length} clubes · Cuenta privada</p></div>{club && <Select value={club.id} onValueChange={v => { setClubId(v); setAthleteId(""); setMeetId(""); }}><SelectTrigger aria-label="Club activo" className="w-full sm:w-64"><SelectValue /></SelectTrigger><SelectContent>{management.clubs.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>}</header>
  <div className="flex flex-wrap gap-3 border-y py-4"><Input aria-label="Buscar club" placeholder="Buscar club o código" value={clubSearch} onChange={e=>setClubSearch(e.target.value)} className="w-full sm:w-72"/><ClubEditor onSaved={setClubId}/></div>
  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{management.clubs.filter(c=>`${c.name} ${c.team_code??""}`.toLowerCase().includes(clubSearch.toLowerCase())).map(c=>{const athletes=data.athletes.filter(a=>a.club_id===c.id);return <Button key={c.id} variant="outline" onClick={()=>setClubId(c.id)} className={`h-auto min-w-0 justify-start whitespace-normal p-4 text-left ${c.id===club?.id?"border-primary bg-muted":""}`}><div className="w-full min-w-0 space-y-2"><div className="flex items-center gap-2"><span className="rounded border px-2 py-1 font-mono text-primary">{c.team_code??"—"}</span><span className="min-w-0 break-words font-semibold">{c.full_name??c.name}</span></div><p className="text-xs text-muted-foreground">{c.region_lsc||"Región sin registrar"} · {c.head_coach||"Entrenador sin registrar"}</p><p className="text-xs">Total {athletes.length} · M {athletes.filter(a=>a.gender==="M").length} · F {athletes.filter(a=>a.gender==="F").length}</p></div></Button>})}</div>
  {club ? <>
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex min-w-0 items-center gap-2 break-words text-2xl font-semibold"><Building2 className="shrink-0 text-primary" />{club.name}</h2><div className="flex flex-wrap gap-2"><ClubEditor key={club.id} club={club}/><Button asChild variant="outline"><Link to="/club" search={{ club: club.id }}>Integrantes y documentos<ArrowRight /></Link></Button></div></div>
   <div className="grid grid-cols-3 gap-3 border-b pb-5">{[{ label: "Atletas", value: scoped.athletes.length }, { label: "Competencias", value: scoped.meets.length }, { label: "Inscripciones", value: scoped.entries.length }].map(({ label, value }) => <div key={label}><p className="time text-3xl font-semibold text-primary">{value}</p><p className="break-words text-xs text-muted-foreground sm:text-sm">{label}</p></div>)}</div>
   <Tabs defaultValue="athletes" key={club.id}>
    <TabsList className="grid h-auto w-full grid-cols-3 sm:max-w-lg"><TabsTrigger value="athletes">Atletas</TabsTrigger><TabsTrigger value="meets">Competencias</TabsTrigger><TabsTrigger value="entries">Inscripciones</TabsTrigger></TabsList>
    <TabsContent value="athletes" className="space-y-4 pt-3"><div className="flex flex-wrap gap-2"><QuickAthleteEntry clubId={club.id} clubs={management.clubs}/><AthleteClubTransfer club={club} clubs={management.clubs} data={data} /></div>
     <div className="flex flex-wrap gap-2"><Select value={athleteId} onValueChange={setAthleteId}><SelectTrigger aria-label="Atleta sin club" className="w-full sm:w-80"><SelectValue placeholder="Asignar atleta existente" /></SelectTrigger><SelectContent>{data.athletes.filter(a => !a.club_id).map(a => <SelectItem key={a.id} value={a.id}>{a.first_name} {a.last_name}</SelectItem>)}</SelectContent></Select><Button disabled={busy || !athleteId} onClick={() => void action(async () => { const r = await supabase.from("athletes").update({ club_id: club.id }).eq("id", athleteId); if (r.error) throw r.error; setAthleteId(""); toast.success("Atleta asignado al club."); })}><Plus />Asignar</Button></div>
     <ClubRosterTable athletes={scoped.athletes} clubs={management.clubs}/>
    </TabsContent>
    <TabsContent value="meets" className="space-y-4 pt-3"><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/import">Importar competencia</Link></Button><Select value={meetId} onValueChange={setMeetId}><SelectTrigger aria-label="Competencia para el club" className="w-full sm:w-80"><SelectValue placeholder="Añadir competencia importada" /></SelectTrigger><SelectContent>{data.meets.filter(m => !scoped.meets.some(s => s.id === m.id)).map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select><Button disabled={busy || !meetId} onClick={() => void action(async () => { const r = await supabase.from("club_meets").upsert({ club_id: club.id, meet_id: meetId }, { onConflict: "club_id,meet_id" }); if (r.error) throw r.error; setMeetId(""); toast.success("Competencia añadida al club."); })}><Plus />Añadir</Button></div><div className="divide-y border-y">{scoped.meets.map(m => <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="break-words font-medium">{m.name}</p><p className="text-sm text-muted-foreground">{m.start_date ?? "—"} · {m.course}</p></div><div className="flex gap-2"><Button asChild><Link to="/entries" search={{ club: club.id, meet: m.id }}>Inscribir</Link></Button><Button variant="ghost" disabled={busy} onClick={() => void action(async () => { const r = await supabase.from("club_meets").delete().eq("club_id", club.id).eq("meet_id", m.id); if (r.error) throw r.error; })}>Retirar</Button></div></div>)}{!scoped.meets.length && <p className="py-5 text-sm text-muted-foreground">Sin competencias añadidas.</p>}</div></TabsContent>
    <TabsContent value="entries" className="space-y-4 pt-3"><Button asChild><Link to="/entries" search={{ club: club.id }}>Gestionar y exportar inscripciones<ArrowRight /></Link></Button><div className="divide-y border-y">{scoped.meets.map(m => <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><p className="break-words font-medium">{m.name}</p><Button asChild variant="outline"><Link to="/entries" search={{ club: club.id, meet: m.id }}>{scoped.entries.filter(e => e.meet_id === m.id).length} inscripciones<ArrowRight /></Link></Button></div>)}{!scoped.meets.length && <p className="py-5 text-sm text-muted-foreground">Añade una competencia para gestionar sus inscripciones.</p>}</div></TabsContent>
   </Tabs>
  </> : <p className="py-6 text-muted-foreground">Sin clubes registrados.</p>}
  <details className="border-t pt-4"><summary className="cursor-pointer font-semibold">Atletas libres / sin club ({data.athletes.filter(a=>!a.club_id).length})</summary><div className="space-y-4 pt-4"><QuickAthleteEntry clubs={management.clubs}/><ClubRosterTable athletes={data.athletes.filter(a=>!a.club_id)} clubs={management.clubs}/></div></details>
 </div>;
}
