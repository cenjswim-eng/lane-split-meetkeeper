import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useRouter } from "@tanstack/react-router";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel } from "@/components/ui/alert-dialog";
import { RESET_CONFIRMATION } from "@/lib/reset-policy";
import { resetManagementData } from "@/lib/reset.functions";

export function ResetData() {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const reset = useServerFn(resetManagementData);
  const qc = useQueryClient();
  const router = useRouter();

  async function run() {
    if (confirmation !== RESET_CONFIRMATION || busy) return;
    setBusy(true);
    try {
      await reset({ data: { confirmation } });
      await qc.cancelQueries();
      qc.clear();
      setOpen(false);
      setConfirmation("");
      await router.invalidate();
      toast.success("Todos los datos de gestión fueron eliminados. Tu cuenta se conserva.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo completar el borrado.");
    } finally { setBusy(false); }
  }

  return <AlertDialog open={open} onOpenChange={(value) => { if (!busy) { setOpen(value); setConfirmation(""); } }}>
    <Button variant="destructive" onClick={() => setOpen(true)}><Trash2 className="size-4" />Borrar todos los datos</Button>
    <AlertDialogContent className="max-w-lg">
      <AlertDialogHeader>
        <AlertDialogTitle>¿Borrar todos los datos?</AlertDialogTitle>
        <AlertDialogDescription>Se eliminarán permanentemente atletas, tiempos, parciales, competencias, equipos, grupos, mínimas, historial de importaciones, integrantes del club y documentos MDB/PDF guardados. Las cuentas y los permisos de administrador se conservarán. Esta acción no se puede deshacer.</AlertDialogDescription>
      </AlertDialogHeader>
      <label htmlFor="reset-confirmation" className="text-sm font-medium">Escribe BORRAR TODO para confirmar</label>
      <Input id="reset-confirmation" value={confirmation} disabled={busy} onChange={(e) => setConfirmation(e.target.value)} autoComplete="off" />
      <AlertDialogFooter>
        <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
        <Button variant="destructive" disabled={busy || confirmation !== RESET_CONFIRMATION} onClick={run}>{busy ? "Borrando…" : "Eliminar definitivamente todo"}</Button>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
}