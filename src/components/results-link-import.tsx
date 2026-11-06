import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { readPdfLines } from "@/lib/club-document";
import { parseMeetManagerResults } from "@/lib/pdf-results";
import { browserBatchStatus, fetchResultsLink, startBrowserBatch } from "@/lib/results-link.functions";
import { commaTimes, filterToRoster, htmlToLines, indexFrameUrl, meetEventPages, meetIndexInfo, type RosterAthlete } from "@/lib/results-link";
import type { ParsedFile } from "@/lib/hytek/types";

export function ResultsLinkImport({ disabled, onParsed }: { disabled?: boolean; onParsed: (name: string, parsed: ParsedFile) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [allowBrowser, setAllowBrowser] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const fetchLink = useServerFn(fetchResultsLink);
  const startBatch = useServerFn(startBrowserBatch);
  const batchStatus = useServerFn(browserBatchStatus);

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
    setBusy(true); setSummary(null); setProgress(null);
    try {
      const link = /^https?:\/\//i.test(url.trim()) ? url.trim() : `https://${url.trim()}`;
      const res = await fetchLink({ data: { url: link, allowBrowser } });
      const name = decodeURIComponent(new URL(res.url).pathname.split("/").filter(Boolean).pop() ?? "Resultados").replace(/\.(pdf|html?)$/i, "") || "Resultados";
      let lines: string[];
      let eventParsed: ParsedFile[] | null = null;
      let info: ReturnType<typeof meetIndexInfo> | null = null;
      if (res.kind === "pdf") {
        const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
        lines = await readPdfLines(new File([bytes], `${name}.pdf`, { type: "application/pdf" }));
      } else {
        // Meet Manager web results: open the event index and read each event page (one request each).
        let indexHtml = res.html, indexUrl = res.url, protectedSite = res.via === "browser";
        const visited = new Set([indexUrl]);
        for (let depth = 0; depth < 5 && !meetEventPages(indexHtml, indexUrl).length; depth++) {
          const frame = indexFrameUrl(indexHtml, indexUrl) ?? (/<frameset/i.test(indexHtml) ? new URL("evtindex.htm", indexUrl).toString() : null);
          if (!frame || visited.has(frame)) break;
          visited.add(frame);
          const idx = await fetchLink({ data: { url: frame, allowBrowser } });
          if (idx.kind !== "html") break;
          indexHtml = idx.html; indexUrl = idx.url; protectedSite ||= idx.via === "browser";
        }
        const pages = meetEventPages(indexHtml, indexUrl);
        if (pages.length) {
          info = meetIndexInfo(res.html, indexHtml);
          const htmls: string[] = new Array(pages.length).fill("");
          let done = 0, next = 0;
          setProgress(`0/${pages.length}`);
          const worker = async () => {
            while (next < pages.length) {
              const i = next++;
              for (let attempt = 0; attempt < 3 && !htmls[i]; attempt++) {
                const pageUrl = pages[i];
                if (!pageUrl) break;
                try { const r = await fetchLink({ data: { url: pageUrl, allowBrowser } }); if (r.kind === "html") htmls[i] = r.html; } catch { /* retry */ }
              }
              setProgress(`${++done}/${pages.length}`);
            }
          };
          if (protectedSite) {
            // Protected sites are opened with a real browser in one batch, so per-page limits don't apply.
            const { id } = await startBatch({ data: { urls: pages } });
            const byUrl = new Map<string, string>();
            for (let tries = 0; tries < 120; tries++) {
              await new Promise((r) => setTimeout(r, 3000));
              const st = await batchStatus({ data: { id } });
              setProgress(`${st.completed}/${st.total || pages.length}`);
              if (st.status === "failed") throw new Error("No se pudieron abrir las pruebas protegidas.");
              if (st.status !== "completed") continue;
              let page = st, next = st.next;
              for (const p of page.pages) byUrl.set(p.url, p.html);
              while (next) { page = await batchStatus({ data: { id, next } }); for (const p of page.pages) byUrl.set(p.url, p.html); next = page.next; }
              break;
            }
            pages.forEach((u, i) => { htmls[i] = byUrl.get(u) ?? byUrl.get(u.replace(/^http:/, "https:")) ?? ""; });
          } else await Promise.all(Array.from({ length: 6 }, worker));
          const missing = htmls.filter((h) => !h).length;
          if (missing === pages.length) throw new Error("No se pudo abrir ninguna prueba del enlace.");
          if (missing) toast.warning(`${missing} pruebas no se pudieron abrir; el resto se leyó.`);
          lines = htmls.flatMap((h) => htmlToLines(h));
          eventParsed = htmls.flatMap((h, i) => {
            if (!h) return [];
            const p = parseMeetManagerResults(htmlToLines(h).map(commaTimes), name);
            const round = pages[i]?.match(/([FPS])\d{3,4}\.html?/i)?.[1]?.toUpperCase();
            if (round === "P" || round === "S") p.results = p.results.map(r => ({ ...r, round }));
            return [p];
          });
        } else {
          lines = htmlToLines(res.html);
          info = meetIndexInfo(res.html, res.html);
        }
      }
      lines = lines.map(commaTimes);
      const parsed = parseMeetManagerResults(lines, name);
      if (eventParsed?.length) {
        parsed.athletes = [...new Map(eventParsed.flatMap(p => p.athletes).map(a => [a.key,a])).values()];
        parsed.teams = [...new Map(eventParsed.flatMap(p => p.teams).map(t => [t.code,t])).values()];
        parsed.results = eventParsed.flatMap(p => p.results);
        parsed.warnings = [...new Set(eventParsed.flatMap(p => p.warnings))].filter(w => !/No se reconoci/.test(w));
      }
      if (info) parsed.meet = { ...parsed.meet, name: info.title ?? parsed.meet.name, startDate: info.startDate ?? parsed.meet.startDate, endDate: info.endDate ?? parsed.meet.endDate };
      if (!parsed.results.length) {
        if (res.kind === "pdf") setSummary("No se reconoció el formato del PDF. No se consumieron créditos; usa un reporte de resultados Meet Manager o un archivo HY3/SD3.");
        else setSummary("No se encontraron resultados en esa página. Pega el enlace principal de los resultados (el que muestra la lista de pruebas) o el de un PDF de resultados.");
        return;
      }
      await finish(name, parsed);
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); setProgress(null); }
  }

  return <section className="space-y-2 rounded-lg border bg-card p-4">
    <h2 className="text-xl font-semibold uppercase">Resultados desde un enlace</h2>
    <p className="text-sm text-muted-foreground">Pega el enlace de resultados en vivo de Meet Manager (por ejemplo, el de ADAEL), de una página o de un PDF. Se revisan todas las pruebas. Solo se toman los tiempos de los atletas que ya tienes registrados; el resto se ignora. Siempre verás el resumen antes de importar.</p>
    <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (url.trim()) read(); }}>
      <Input type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://…/resultados.pdf" value={url} onChange={(e) => setUrl(e.target.value)} aria-label="Enlace de resultados" disabled={busy || disabled} />
      <Button type="submit" disabled={busy || disabled || !url.trim()}><Link2 className="mr-2 size-4" />Extraer mis atletas</Button>
    </form>
    <label className="flex items-start gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={allowBrowser} disabled={busy} onChange={e => setAllowBrowser(e.target.checked)} />Permitir lectura con créditos solo si el sitio bloquea el acceso. Los PDF se leen localmente sin créditos.</label>
    {busy && <p role="status" className="text-sm">Leyendo todas las pruebas del enlace{progress ? ` (${progress})` : ""}, puede tardar un minuto…</p>}
    {summary && <p role="status" className="text-sm">{summary}</p>}
  </section>;
}
