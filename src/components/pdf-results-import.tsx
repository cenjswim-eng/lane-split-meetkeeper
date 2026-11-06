import { useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { readPdfLines } from "@/lib/club-document";
import { parseMeetManagerResults } from "@/lib/pdf-results";
import type { ParsedFile } from "@/lib/hytek/types";

async function validPdf(file: File) {
  if (!/\.pdf$/i.test(file.name) || new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== "%PDF-") throw new Error("Selecciona un PDF válido.");
  if (file.size > 8_000_000) throw new Error("El PDF debe pesar menos de 8 MB.");
}

export function PdfResultsImport({ disabled, onParsed }: { disabled?: boolean; onParsed: (name: string, parsed: ParsedFile) => void }) {
  const [busy, setBusy] = useState(false);
  async function read(file: File) {
    setBusy(true);
    try {
      await validPdf(file);
      const base = file.name.replace(/\.pdf$/i, "");
      const parsed = parseMeetManagerResults(await readPdfLines(file), base);
      if (!parsed.results.length) toast.error("No se reconocieron resultados individuales. Usa el reporte de resultados de Meet Manager o un archivo HY3/SD3; no se consumieron créditos.");
      else onParsed(file.name, parsed);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  const pick = () => <Button asChild variant="outline" disabled={busy || disabled}><label className="cursor-pointer"><FileText className="mr-2 size-4" />Leer PDF sin créditos<input type="file" accept=".pdf,application/pdf" aria-label="PDF Meet Manager" className="hidden" disabled={busy || disabled} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) read(f); }} /></label></Button>;
  return <section className="space-y-2 rounded-lg border bg-card p-4">
    <h2 className="text-xl font-semibold uppercase">Resultados en PDF</h2>
    <p className="text-sm text-muted-foreground">Lectura local de texto y documentos escaneados, sin créditos. Los resultados reconocidos se muestran antes de importar; revisa siempre el PDF original.</p>
    <div className="flex flex-wrap gap-2">{pick()}</div>
    {busy && <p role="status" className="text-sm">Leyendo PDF; los documentos escaneados pueden tardar más…</p>}
  </section>;
}
