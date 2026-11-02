import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { UserPlus, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

export function NewAthlete() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [team, setTeam] = useState("none");
  const [gender, setGender] = useState("none");
  const queryClient = useQueryClient();
  const teams = useQuery({ queryKey: ["athlete-team-options"], enabled: open, queryFn: async () => {
    const { data, error } = await supabase.from("teams").select("id, name").order("name");
    if (error) throw error;
    return data;
  } });
  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const first = String(form.get("first") ?? "").trim();
    const last = String(form.get("last") ?? "").trim();
    if (!first || !last) { toast.error("Indica nombre y apellido."); return; }
    setBusy(true);
    try {
      const { error } = await supabase.from("athletes").insert({ first_name: first, last_name: last, birth_date: String(form.get("birth") ?? "") || null, gender: gender === "none" ? null : gender, team_id: team === "none" ? null : team });
      if (error) throw error;
      await Promise.all([queryClient.invalidateQueries({ queryKey: ["dashboard"] }), queryClient.invalidateQueries({ queryKey: ["athletes"] })]);
      toast.success("Atleta añadido."); setOpen(false); setTeam("none"); setGender("none");
    } catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo añadir el atleta."); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={setOpen}>
    <Button variant="outline" className="h-11 w-full sm:w-auto" onClick={() => setOpen(true)}><UserPlus />Nuevo atleta</Button>
    <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
      <DialogHeader><DialogTitle>Nuevo atleta</DialogTitle><DialogDescription>Registro del nadador</DialogDescription></DialogHeader>
      <form onSubmit={save} className="grid gap-4">
        <div className="grid gap-1.5"><Label htmlFor="athlete-first">Nombre</Label><Input id="athlete-first" name="first" required maxLength={100} /></div>
        <div className="grid gap-1.5"><Label htmlFor="athlete-last">Apellido</Label><Input id="athlete-last" name="last" required maxLength={100} /></div>
        <div className="grid gap-1.5"><Label htmlFor="athlete-birth">Fecha de nacimiento</Label><Input id="athlete-birth" name="birth" type="date" max={new Date().toISOString().slice(0, 10)} /></div>
        <Select value={gender} onValueChange={setGender}><SelectTrigger aria-label="Sexo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sexo sin especificar</SelectItem><SelectItem value="M">Masculino</SelectItem><SelectItem value="F">Femenino</SelectItem></SelectContent></Select>
        <Select value={team} onValueChange={setTeam}><SelectTrigger aria-label="Equipo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sin equipo</SelectItem>{teams.data?.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}</SelectContent></Select>
        {teams.isError && <p className="text-sm text-destructive">No se pudieron cargar los equipos.</p>}
        <Button type="submit" disabled={busy}>{busy && <LoaderCircle className="animate-spin" />}Guardar atleta</Button>
      </form>
    </DialogContent>
  </Dialog>;
}