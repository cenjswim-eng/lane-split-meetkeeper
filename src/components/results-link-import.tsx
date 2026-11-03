import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { readPdfLines } from "@/lib/club-document";
import { aiResultsToParsed, parseMeetManagerResults, type AiResults } from "@/lib/pdf-results";
import { extractPdfWithAi } from "@/lib/pdf-ai.functions";
import { fetchResultsLink } from "@/lib/results-link.functions";
import { filterToRoster, htmlToLines, type RosterAthlete } from "@/lib/results-link";
import type { ParsedFile } from "@/lib/hytek/types";

export function ResultsLinkImport({ disabled, onParsed }: { disabled?: boolean; onParsed: (name: string, parsed: ParsedFile) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [pdf, setPdf] = useState<{ base64: string; name: string } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const fetchLink = useServerFn(fetchResultsLink);
  const extract = useServerFn(extractPdfWithAi);

  async function finish(name: string, parsed: ParsedFile) {
    const { data, error } = await supabase.from("athletes").select("id, first_name, last_name, birth_date, gender, federation_id, tm_athlete_id");
    if (error) throw new Error("No se pudo leer tu lista de atletas.");
    const total = new Set(parsed.athletes.map((a) => a.key)).size;
    const r = filterToRoster(parsed, (data ?? []) as RosterAthlete[]);
    if (!r.parsed.results.length) { setSummary(`Se leyeron ${parsed.results.length} resultados de ${total} nadadores, pero ninguno coincide con tus atletas.`); return false; }
    setSummary(`${r.found} de tus atletas encontrados con ${r.parsed.results.length} resultados: ${r.names.join(", ")}. Revisa abajo y pulsa «Importar».`);
    onParsed(name, r.parsed);
    return true;
  }

  async function read() {
    setBusy(true); setSummary(null); setPdf(null);
    try {
      const res = await fetchLink({ data: { url } });
      const name = decodeURIComponent(new URL(res.url).pathname.split("/").filter(Boolean).pop() ?? "Resultados").replace(/\.(pdf|html?)$/i, "") || "Resultados";
      let lines: string[];
      if (res.kind === "pdf") {
        const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
        lines = await readPdfLines(new File([bytes], `${name}.pdf`, { type: "application/pdf" }));
      } else lines = htmlToLines(res.html);
      const parsed = parseMeetManagerResults(lines, name);
      if (!parsed.results.length) {
        if (res.kind === "pdf") { setPdf({ base64: res.base64, name }); setSummary("No se reconoció el formato Meet Manager. Puedes intentar la lectura con IA."); }
        else setSummary("No se encontraron resultados en esa página. Si la página tiene un enlace a un PDF de resultados, pega ese enlace.");
        return;
      }
      await finish(name, parsed);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  async function readAi() {
    if (!pdf) return;
    setBusy(true);
    try {
      const out = await extract({ data: { kind: "results", base64: pdf.base64 } });
      if (await finish(pdf.name, aiResultsToParsed(out.output as AiResults, pdf.name))) setPdf(null);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return <section className="space-y-2 rounded-lg border bg-card p-4">
    <h2 className="text-xl font-semibold uppercase">Resultados desde un enlace</h2>
    <p className="text-sm text-muted-foreground">Pega el enlace de una página o PDF de resultados. Solo se toman los tiempos de los atletas que ya tienes registrados; el resto se ignora. Siempre verás el resumen antes de importar.</p>
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (url.trim()) read(); }}>
      <Input type="url" inputMode="url" placeholder="https://…/resultados.pdf" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Enlace de resultados" disabled={busy || disabled} />
      <Button type="submit" disabled={busy || disabled || !url.trim()}><Link2 className="mr-2 size-4" />Extraer mis atletas</Button>
    </form>
    {pdf && <Button variant="outline" onClick={readAi} disabled={busy}><Sparkles className="mr-2 size-4" />Leer con IA</Button>}
    {busy && <p role="status" className="text-sm">Leyendo el enlace…</p>}
    {summary && <p role="status" className="text-sm">{summary}</p>}
  </section>;
}
