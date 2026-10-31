import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";

export function DeleteAthlete({ id, name, onDeleted }: { id: string; name: string; onDeleted?: () => void }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();
  return <AlertDialog open={open} onOpenChange={setOpen}>
    <Button size="icon" variant="ghost" title="Eliminar atleta" aria-label={`Eliminar ${name}`} onClick={() => setOpen(true)}><Trash2 className="size-4 text-destructive" /></Button>
    <AlertDialogContent className="w-[calc(100%-2rem)] rounded-lg"><AlertDialogHeader><AlertDialogTitle>¿Eliminar a {name}?</AlertDialogTitle><AlertDialogDescription>Se eliminarán permanentemente su perfil deportivo, resultados y parciales. Esta acción no se puede deshacer. Su ficha en Mi club, si existe, se conserva por separado.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter>
      <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel><Button variant="destructive" disabled={busy} onClick={async () => {
        setBusy(true); try { const r = await supabase.from("athletes").delete().eq("id", id).select("id").single(); if (r.error) throw r.error; setOpen(false); onDeleted?.(); await qc.invalidateQueries(); toast.success("Atleta eliminado"); } catch(e) { toast.error((e as Error).message); } finally { setBusy(false); }
      }}>{busy ? "Eliminando…" : "Eliminar definitivamente"}</Button>
    </AlertDialogFooter></AlertDialogContent>
  </AlertDialog>;
}