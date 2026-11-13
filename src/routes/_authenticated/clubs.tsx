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
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewAthlete } from "@/components/new-athlete";
import { AthleteClubTransfer } from "@/components/athlete-club-transfer";
import { registrationStatus } from "@/lib/athlete-registration";

export const Route = createFileRoute("/_authenticated/clubs")({
 head: () => ({ meta: [{ title: "Clubes — Swim Lane Coach" }, { name: "description", content: "Gestión privada de atletas, competencias e inscripciones por club." }, { property: "og:title", content: "Clubes — Swim Lane Coach" }, { property: "og:description", content: "Organiza tus clubes sin compartir registros entre cuentas." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
 loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(clubManagementQuery), context.queryClient.ensureQueryData(coachQuery)]); },
 component: Clubs,
});
function Clubs() {
 const { data: management } = useSuspenseQuery(clubManagementQuery);
 const { data } = useSuspenseQuery(coachQuery);
 const qc = useQueryClient();
 const [clubId, setClubId] = useState(""); const [name, setName] = useState("");
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
  <form className="flex flex-wrap items-end gap-3 border-y py-4" onSubmit={e => { e.preventDefault(); if (!name.trim()) return; void action(async () => { const r = await supabase.from("clubs").insert({ name: name.trim() }).select("id").single(); if (r.error) throw r.error; setClubId(r.data.id); setName(""); toast.success("Club creado."); }); }}><div className="min-w-0 flex-1 space-y-2 sm:max-w-sm"><Label htmlFor="new-club">Nuevo club</Label><Input id="new-club" placeholder="Nombre del club" required maxLength={150} value={name} onChange={e => setName(e.target.value)} /></div><Button disabled={busy || !name.trim()}><Plus />Crear club</Button></form>
  {club ? <>
   <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="flex min-w-0 items-center gap-2 break-words text-2xl font-semibold"><Building2 className="shrink-0 text-primary" />{club.name}</h2><Button asChild variant="outline"><Link to="/club" search={{ club: club.id }}>Integrantes y documentos<ArrowRight /></Link></Button></div>
   <div className="grid grid-cols-3 gap-3 border-b pb-5">{[{ label: "Atletas", value: scoped.athletes.length }, { label: "Competencias", value: scoped.meets.length }, { label: "Inscripciones", value: scoped.entries.length }].map(({ label, value }) => <div key={label}><p className="time text-3xl font-semibold text-primary">{value}</p><p className="break-words text-xs text-muted-foreground sm:text-sm">{label}</p></div>)}</div>
   <Tabs defaultValue="athletes" key={club.id}>
    <TabsList className="grid h-auto w-full grid-cols-3 sm:max-w-lg"><TabsTrigger value="athletes">Atletas</TabsTrigger><TabsTrigger value="meets">Competencias</TabsTrigger><TabsTrigger value="entries">Inscripciones</TabsTrigger></TabsList>
    <TabsContent value="athletes" className="space-y-4 pt-3"><div className="flex flex-wrap gap-2"><NewAthlete clubId={club.id} /><AthleteClubTransfer club={club} clubs={management.clubs} data={data} /></div>
     <div className="flex flex-wrap gap-2"><Select value={athleteId} onValueChange={setAthleteId}><SelectTrigger aria-label="Atleta sin club" className="w-full sm:w-80"><SelectValue placeholder="Asignar atleta existente" /></SelectTrigger><SelectContent>{data.athletes.filter(a => !a.club_id).map(a => <SelectItem key={a.id} value={a.id}>{a.first_name} {a.last_name}</SelectItem>)}</SelectContent></Select><Button disabled={busy || !athleteId} onClick={() => void action(async () => { const r = await supabase.from("athletes").update({ club_id: club.id }).eq("id", athleteId); if (r.error) throw r.error; setAthleteId(""); toast.success("Atleta asignado al club."); })}><Plus />Asignar</Button></div>
     <div className="divide-y border-y">{scoped.athletes.map(a => <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-3"><div><Link className="font-medium text-primary" to="/athletes/$id" params={{ id: a.id }}>{a.first_name} {a.last_name}</Link><p className="text-xs text-muted-foreground">{registrationStatus(a.registration_expires_on) === "unregistered" ? "Vigencia sin registrar" : `${registrationStatus(a.registration_expires_on) === "expired" ? "Ficha vencida" : "Ficha vigente"} · ${a.registration_expires_on}`}</p></div><Button variant="ghost" disabled={busy} onClick={() => void action(async () => { const r = await supabase.from("athletes").update({ club_id: null }).eq("id", a.id); if (r.error) throw r.error; })}>Desvincular</Button></div>)}{!scoped.athletes.length && <p className="py-5 text-sm text-muted-foreground">Sin atletas asignados.</p>}</div>
    </TabsContent>
    <TabsContent value="meets" className="space-y-4 pt-3"><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><Link to="/import">Importar competencia</Link></Button><Select value={meetId} onValueChange={setMeetId}><SelectTrigger aria-label="Competencia para el club" className="w-full sm:w-80"><SelectValue placeholder="Añadir competencia importada" /></SelectTrigger><SelectContent>{data.meets.filter(m => !scoped.meets.some(s => s.id === m.id)).map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select><Button disabled={busy || !meetId} onClick={() => void action(async () => { const r = await supabase.from("club_meets").upsert({ club_id: club.id, meet_id: meetId }, { onConflict: "club_id,meet_id" }); if (r.error) throw r.error; setMeetId(""); toast.success("Competencia añadida al club."); })}><Plus />Añadir</Button></div><div className="divide-y border-y">{scoped.meets.map(m => <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="break-words font-medium">{m.name}</p><p className="text-sm text-muted-foreground">{m.start_date ?? "—"} · {m.course}</p></div><div className="flex gap-2"><Button asChild><Link to="/entries" search={{ club: club.id, meet: m.id }}>Inscribir</Link></Button><Button variant="ghost" disabled={busy} onClick={() => void action(async () => { const r = await supabase.from("club_meets").delete().eq("club_id", club.id).eq("meet_id", m.id); if (r.error) throw r.error; })}>Retirar</Button></div></div>)}{!scoped.meets.length && <p className="py-5 text-sm text-muted-foreground">Sin competencias añadidas.</p>}</div></TabsContent>
    <TabsContent value="entries" className="space-y-4 pt-3"><Button asChild><Link to="/entries" search={{ club: club.id }}>Gestionar y exportar inscripciones<ArrowRight /></Link></Button><div className="divide-y border-y">{scoped.meets.map(m => <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><p className="break-words font-medium">{m.name}</p><Button asChild variant="outline"><Link to="/entries" search={{ club: club.id, meet: m.id }}>{scoped.entries.filter(e => e.meet_id === m.id).length} inscripciones<ArrowRight /></Link></Button></div>)}{!scoped.meets.length && <p className="py-5 text-sm text-muted-foreground">Añade una competencia para gestionar sus inscripciones.</p>}</div></TabsContent>
   </Tabs>
  </> : <p className="py-6 text-muted-foreground">Sin clubes registrados.</p>}
 </div>;
}
