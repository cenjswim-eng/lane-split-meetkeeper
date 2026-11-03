import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export function TransferRecords({ athleteId, defaultName }: { athleteId: string; defaultName: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [club, setClub] = useState("");
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    const { data, error } = await supabase.rpc("transfer_athlete_records", { _target: athleteId, _name: name, _club: club });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const r = data as { sources: number; moved: number; skipped: number; entries: number };
    if (!r.sources) toast.info("No se encontraron registros con ese nombre" + (club ? " y club" : "") + " en tus competencias.");
    else toast.success(`${r.moved} tiempos traídos de ${r.sources} registro(s)` + (r.skipped ? ` · ${r.skipped} ya existían y se omitieron` : ""));
    await qc.invalidateQueries();
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button variant="outline">Traer tiempos de otro club</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Traer tiempos de otro club</DialogTitle>
          <DialogDescription>Busca en tus competencias cargadas los resultados con este nombre y los pasa automáticamente a este perfil. Se omiten registros con otra fecha de nacimiento u otro sexo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="tr-name">Nombre del atleta</Label><Input id="tr-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="tr-club">Club anterior (opcional)</Label><Input id="tr-club" placeholder="Nombre o código del club" value={club} onChange={(e) => setClub(e.target.value)} /></div>
        </div>
        <DialogFooter><Button onClick={run} disabled={busy || !name.trim()}>{busy ? "Buscando…" : "Buscar y traer tiempos"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
