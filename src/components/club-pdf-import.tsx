import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { readClubPdf } from "@/lib/club-document";
import type { MemberDraft } from "@/lib/club";

export function ClubPdfImport({ onSave }: { onSave: (file: File, members: MemberDraft[]) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  return <div className="space-y-2"><Button asChild variant="outline"><label className="cursor-pointer">Añadir PDF<input type="file" accept=".pdf,application/pdf" aria-label="Añadir documento PDF" className="hidden" disabled={busy} onChange={async (e) => {
    const file = e.target.files?.[0]; e.target.value = ""; if (!file || busy) return;
    setBusy(true); setResult("");
    try {
      if (!/\.pdf$/i.test(file.name) || new TextDecoder().decode(await file.slice(0,5).arrayBuffer()) !== "%PDF-") throw new Error("Selecciona un PDF válido.");
      let members: MemberDraft[] = [];
      let warning = "";
      try { members = await readClubPdf(file); } catch { warning = " No se pudo extraer el registro; el original está guardado."; }
      await onSave(file, members);
      setResult(members.length ? `${members.length} integrantes registrados automáticamente.` : `PDF guardado. No se identificaron filas con Nombre, Apellido y Tipo.${warning}`);
      toast.success("Documento guardado");
    } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  }} /></label></Button>{busy && <p role="status" className="text-sm">Procesando PDF…</p>}{result && <p role="status" className="text-sm text-muted-foreground">{result}</p>}</div>;
}