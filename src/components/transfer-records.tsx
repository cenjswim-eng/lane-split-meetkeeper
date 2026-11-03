import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

type Candidate = {
  id: string; first_name: string; last_name: string; birth_date: string | null; gender: string | null;
  federation_id: string | null; team: string | null; results: number; match: string;
};

const MATCH: Record<string, { label: string; strong: boolean; bad?: boolean }> = {
  cedula_fecha: { label: "Cédula y fecha coinciden", strong: true },
  cedula: { label: "Cédula coincide", strong: true },
  nombre_fecha: { label: "Nombre y fecha coinciden", strong: true },
  nombre: { label: "Solo nombre", strong: false },
  conflicto: { label: "Cédula, fecha o sexo distinto", strong: false, bad: true },
};

export function TransferRecords({ athleteId, defaultName }: { athleteId: string; defaultName: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(defaultName);
  const [list, setList] = useState<Candidate[] | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  async function search() {
    setBusy(true);
    const { data, error } = await supabase.rpc("find_athlete_record_sources", { _target: athleteId, _name: name });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const rows = (data ?? []) as Candidate[];
    setList(rows);
    setSel(new Set(rows.filter((r) => MATCH[r.match]?.strong && r.results > 0).map((r) => r.id)));
  }

  async function run() {
    setBusy(true);
    const { data, error } = await supabase.rpc("transfer_selected_athlete_records", { _target: athleteId, _sources: [...sel] });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    const r = data as { sources: number; moved: number; skipped: number };
    toast.success(`${r.moved} tiempos traídos de ${r.sources} registro(s)` + (r.skipped ? ` · ${r.skipped} ya existían y se omitieron` : ""));
    await qc.invalidateQueries();
    setOpen(false); setList(null);
  }

  const toggle = (id: string) => setSel((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setList(null); }}>
      <DialogTrigger asChild><Button variant="outline">Traer tiempos de otro club</Button></DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Traer tiempos de otro club</DialogTitle>
          <DialogDescription>Busca en todas tus competencias cargadas por nombre y apellido (sin importar el club) y por la cédula del atleta. Revisa las coincidencias y elige cuáles pasar a este perfil.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2 items-end">
          <div className="flex-1 space-y-1"><Label htmlFor="tr-name">Nombre y apellido</Label><Input id="tr-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <Button onClick={search} disabled={busy || !name.trim()}>{busy && !list ? "Buscando…" : "Buscar"}</Button>
        </div>
        {list && (list.length === 0 ? (
          <p className="text-sm text-muted-foreground">No se encontraron registros con ese nombre o cédula en tus competencias.</p>
        ) : (
          <div className="max-h-80 overflow-y-auto space-y-2">
            {list.map((c) => {
              const m = MATCH[c.match] ?? MATCH.nombre;
              return (
                <label key={c.id} className="flex items-start gap-3 rounded-md border border-border p-3 cursor-pointer">
                  <Checkbox checked={sel.has(c.id)} onCheckedChange={() => toggle(c.id)} disabled={!c.results} />
                  <div className="flex-1 text-sm">
                    <div className="font-medium">{c.last_name}, {c.first_name}</div>
                    <div className="text-muted-foreground">
                      Club: {c.team ?? "—"} · Cédula: {c.federation_id ?? "—"} · Nac.: {c.birth_date ?? "—"} · {c.results} tiempos
                    </div>
                  </div>
                  <Badge variant={m.bad ? "destructive" : m.strong ? "default" : "secondary"}>{m.label}</Badge>
                </label>
              );
            })}
          </div>
        ))}
        {list && list.length > 0 && (
          <DialogFooter><Button onClick={run} disabled={busy || sel.size === 0}>{busy ? "Traspasando…" : `Traer tiempos de ${sel.size} registro(s)`}</Button></DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
