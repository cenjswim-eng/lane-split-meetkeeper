import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { FileText, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { pdfToBase64, readPdfLines } from "@/lib/club-document";
import { aiResultsToParsed, parseMeetManagerResults, type AiResults } from "@/lib/pdf-results";
import { extractPdfWithAi } from "@/lib/pdf-ai.functions";
import type { ParsedFile } from "@/lib/hytek/types";

async function validPdf(file: File) {
  if (!/\.pdf$/i.test(file.name) || new TextDecoder().decode(await file.slice(0, 5).arrayBuffer()) !== "%PDF-") throw new Error("Selecciona un PDF válido.");
  if (file.size > 8_000_000) throw new Error("El PDF debe pesar menos de 8 MB.");
}

export function PdfResultsImport({ disabled, onParsed }: { disabled?: boolean; onParsed: (name: string, parsed: ParsedFile) => void }) {
  const [busy, setBusy] = useState<"" | "local" | "ai">("");
  const extract = useServerFn(extractPdfWithAi);
  async function read(file: File, mode: "local" | "ai") {
    setBusy(mode);
    try {
      await validPdf(file);
      const base = file.name.replace(/\.pdf$/i, "");
      const parsed = mode === "local"
        ? parseMeetManagerResults(await readPdfLines(file), base)
        : aiResultsToParsed((await extract({ data: { kind: "results", base64: await pdfToBase64(file) } })).output as AiResults, base);
      if (!parsed.results.length) toast.error(mode === "local" ? "No se reconoció el formato Meet Manager. Prueba la lectura con IA." : "No se encontraron resultados individuales.");
      else onParsed(file.name, parsed);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(""); }
  }
  const pick = (mode: "local" | "ai", label: string, Icon: typeof FileText) => <Button asChild variant="outline" disabled={!!busy || disabled}><label className="cursor-pointer"><Icon className="mr-2 size-4" />{label}<input type="file" accept=".pdf,application/pdf" aria-label={label} className="hidden" disabled={!!busy || disabled} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) read(f, mode); }} /></label></Button>;
  return <section className="space-y-2 rounded-lg border bg-card p-4">
    <h2 className="text-xl font-semibold uppercase">Resultados en PDF</h2>
    <p className="text-sm text-muted-foreground">Formato Meet Manager: lectura gratuita de reportes de resultados. Con IA: entiende otros formatos y PDF escaneados, consume créditos. Siempre verás el resumen antes de importar.</p>
    <div className="flex flex-wrap gap-2">{pick("local", "PDF Meet Manager", FileText)}{pick("ai", "PDF con IA", Sparkles)}</div>
    {busy && <p role="status" className="text-sm">{busy === "ai" ? "Leyendo con IA, puede tardar un minuto…" : "Leyendo PDF…"}</p>}
  </section>;
}
