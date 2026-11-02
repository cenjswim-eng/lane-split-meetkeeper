import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { aiRosterMembers, pdfToBase64, readClubPdf } from "@/lib/club-document";
import { extractPdfWithAi } from "@/lib/pdf-ai.functions";
import type { MemberDraft } from "@/lib/club";

export function ClubPdfImport({ onSave }: { onSave: (file: File, members: MemberDraft[]) => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const extract = useServerFn(extractPdfWithAi);
  async function handle(file: File, ai: boolean) {
    setBusy(true); setResult("");
    try {
      if (!/\.pdf$/i.test(file.name) || new TextDecoder().decode(await file.slice(0,5).arrayBuffer()) !== "%PDF-") throw new Error("Selecciona un PDF válido.");
      if (ai && file.size > 8_000_000) throw new Error("El PDF debe pesar menos de 8 MB.");
      let members: MemberDraft[] = [];
      let warning = "";
      if (ai) {
        const r = await extract({ data: { kind: "roster", base64: await pdfToBase64(file) } });
        members = aiRosterMembers((r.output as { members: Parameters<typeof aiRosterMembers>[0] }).members ?? []);
      } else {
        try { members = await readClubPdf(file); } catch { warning = " No se pudo extraer el registro; el original está guardado."; }
      }
      await onSave(file, members);
      setResult(members.length ? `${members.length} integrantes registrados${ai ? " con IA. Revisa la lista." : " automáticamente."}` : ai ? "PDF guardado. La IA no encontró integrantes." : `PDF guardado. No se identificaron filas con Nombre, Apellido y Tipo; prueba “PDF con IA”.${warning}`);
      toast.success("Documento guardado");
    } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  }
  const input = (ai: boolean) => <input type="file" accept=".pdf,application/pdf" aria-label={ai ? "Añadir PDF con IA" : "Añadir documento PDF"} className="hidden" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && !busy) handle(f, ai); }} />;
  return <div className="space-y-2"><div className="flex flex-wrap gap-2"><Button asChild variant="outline"><label className="cursor-pointer">Añadir PDF{input(false)}</label></Button><Button asChild variant="outline"><label className="cursor-pointer"><Sparkles className="mr-2 size-4" />PDF con IA{input(true)}</label></Button></div>{busy && <p role="status" className="text-sm">Procesando PDF…</p>}{result && <p role="status" className="text-sm text-muted-foreground">{result}</p>}</div>;
}
