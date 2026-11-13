import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowRightLeft, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { ClubCoachData } from "@/lib/club-management";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AthleteClubTransfer({ club, clubs, data }: { club: { id: string; name: string }; clubs: { id: string; name: string }[]; data: ClubCoachData }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [athleteId, setAthleteId] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  const athlete = data.athletes.find(a => a.id === athleteId);
  const selected = athlete?.club_id === club.id;
  const norm = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const matches = data.athletes.filter(a => norm(`${a.first_name} ${a.last_name} ${a.federation_id ?? ""}`).includes(norm(search)));
  async function save() {
    if (!athlete) return;
    setBusy(true);
    try {
      const { error } = await supabase.rpc("transfer_athlete_club", { p_athlete: athlete.id, p_club: club.id, ...(athlete.club_id ? { p_expected_club: athlete.club_id } : {}) });
      if (error) throw new Error(error.message);
      await Promise.all(["coach-data", "athletes", "club-management", "dashboard"].map(key => qc.invalidateQueries({ queryKey: [key] })));
      toast.success(selected ? "Ficha renovada. Historial conservado." : "Ficha trasladada. Historial conservado.");
      setOpen(false); setAthleteId("");
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo transferir la ficha."); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={v => { if (!busy) { setOpen(v); if (v) { setSearch(""); setAthleteId(""); } } }}>
    <Button variant="outline" onClick={() => setOpen(true)}><ArrowRightLeft />Transferir o renovar ficha</Button>
    <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
      <DialogHeader><DialogTitle>Ficha de atleta</DialogTitle><DialogDescription>Destino: {club.name}</DialogDescription></DialogHeader>
      <Input aria-label="Buscar atleta por nombre o cédula" placeholder="Nombre, apellido o cédula" value={search} onChange={e => setSearch(e.target.value)} />
      <Select value={athleteId} onValueChange={setAthleteId}><SelectTrigger aria-label="Ficha a transferir"><SelectValue placeholder="Seleccionar atleta de mis registros" /></SelectTrigger><SelectContent>{matches.map(a => <SelectItem key={a.id} value={a.id}>{a.first_name} {a.last_name} · {clubs.find(c => c.id === a.club_id)?.name ?? a.teams?.name ?? "Sin club"}</SelectItem>)}</SelectContent></Select>
      {athlete && <div className="space-y-2 border-y py-4 text-sm">
        <p className="font-semibold">{athlete.first_name} {athlete.last_name}</p>
        <p>Cédula / ID: {athlete.federation_id ?? "—"} · Nacimiento: {athlete.birth_date ?? "—"}</p>
        <p>Club actual: {clubs.find(c => c.id === athlete.club_id)?.name ?? "Sin club asignado"}</p>
        <p>{data.results.filter(r => r.athlete_id === athlete.id).length} resultados · {data.entries.filter(e => e.athlete_id === athlete.id).length} inscripciones</p>
        <p>Vigencia nueva: 31/12/{new Date().getUTCFullYear()}</p>
        <p className="text-muted-foreground">Se conserva la misma ficha con todos sus tiempos y parciales, incluidos los antiguos. Las competencias con inscripciones se vinculan al club de destino. El equipo de origen de los resultados no cambia.</p>
      </div>}
      <Button disabled={busy || !athlete} onClick={() => void save()}>{busy && <LoaderCircle className="animate-spin" />}{selected ? "Confirmar renovación" : "Confirmar traslado"}</Button>
    </DialogContent>
  </Dialog>;
}