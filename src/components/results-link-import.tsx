import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Trophy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { readPdfLines } from "@/lib/club-document";
import { parseMeetManagerResults } from "@/lib/pdf-results";
import { browserBatchStatus, fetchResultsLink, startBrowserBatch } from "@/lib/results-link.functions";
import { commaTimes, filterToRoster, htmlToLines, indexFrameUrl, meetEventPages, meetIndexInfo, type RosterAthlete } from "@/lib/results-link";
import { isFevedaDirectoryUrl, parseFevedaDirectory, type FevedaMeet } from "@/lib/feveda";
import type { ParsedFile } from "@/lib/hytek/types";

export function ResultsLinkImport({ disabled, onParsed }: { disabled?: boolean; onParsed: (name: string, parsed: ParsedFile) => void }) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [allowBrowser, setAllowBrowser] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [fevedaMeets, setFevedaMeets] = useState<FevedaMeet[] | null>(null);
  const fetchLink = useServerFn(fetchResultsLink);
  const startBatch = useServerFn(startBrowserBatch);
  const batchStatus = useServerFn(browserBatchStatus);

  async function finish(name: string, parsed: ParsedFile) {
    const { data, error } = await supabase.from("athletes").select("id, first_name, last_name, birth_date, gender, federation_id, tm_athlete_id");
    if (error) throw new Error("No se pudo leer tu lista de atletas.");
    const total = new Set(parsed.athletes.map((a) => a.key)).size;
    const r = filterToRoster(parsed, (data ?? []) as RosterAthlete[]);
    if (!r.parsed.results.length) {
      setSummary(`Se leyeron ${parsed.results.length} resultados de ${total} nadadores, pero ninguno coincide con tus atletas registrados.`);
      return false;
    }
    setSummary(`¡Éxito! ${r.found} de tus atletas encontrados con ${r.parsed.results.length} resultados oficiales: ${r.names.join(", ")}. Revisa el resumen abajo y pulsa «Importar».`);
    onParsed(name, r.parsed);
    return true;
  }

  async function read(targetUrl?: string, customName?: string) {
    const inputUrl = (targetUrl || url).trim();
    if (!inputUrl) return;
    setBusy(true);
    setSummary(null);
    setProgress(null);
    try {
      const link = /^https?:\/\//i.test(inputUrl) ? inputUrl : `https://${inputUrl}`;

      // Check if it's the FEVEDA results portal directory
      if (isFevedaDirectoryUrl(link)) {
        setProgress("Consultando portal FEVEDA…");
        const res = await fetchLink({ data: { url: link, allowBrowser } });
        if (res.kind === "html") {
          const meets = parseFevedaDirectory(res.html, res.url);
          if (meets.length > 0) {
            setFevedaMeets(meets);
            setSummary(`Directorio FEVEDA cargado con éxito: ${meets.length} campeonatos encontrados. Elige abajo el torneo para extraer las marcas de tus atletas:`);
            return;
          }
        }
      }

      const res = await fetchLink({ data: { url: link, allowBrowser } });
      const name = customName || decodeURIComponent(new URL(res.url).pathname.split("/").filter(Boolean).pop() ?? "Resultados").replace(/\.(pdf|html?)$/i, "") || "Resultados";
      let lines: string[];
      let eventParsed: ParsedFile[] | null = null;
      let info: ReturnType<typeof meetIndexInfo> | null = null;

      if (res.kind === "pdf") {
        const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
        lines = await readPdfLines(new File([bytes], `${name}.pdf`, { type: "application/pdf" }));
      } else {
        // Meet Manager web results: open the event index and read each event page
        let indexHtml = res.html, indexUrl = res.url, protectedSite = res.via === "browser";
        const visited = new Set([indexUrl]);
        for (let depth = 0; depth < 5 && !meetEventPages(indexHtml, indexUrl).length; depth++) {
          const frame = indexFrameUrl(indexHtml, indexUrl) ?? (/<frameset/i.test(indexHtml) ? new URL("evtindex.htm", indexUrl).toString() : null);
          if (!frame || visited.has(frame)) break;
          visited.add(frame);
          const idx = await fetchLink({ data: { url: frame, allowBrowser } });
          if (idx.kind !== "html") break;
          indexHtml = idx.html;
          indexUrl = idx.url;
          protectedSite ||= idx.via === "browser";
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
                try {
                  const r = await fetchLink({ data: { url: pageUrl, allowBrowser } });
                  if (r.kind === "html") htmls[i] = r.html;
                } catch {
                  /* retry */
                }
              }
              setProgress(`${++done}/${pages.length}`);
            }
          };
          if (protectedSite) {
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
              while (next) {
                page = await batchStatus({ data: { id, next } });
                for (const p of page.pages) byUrl.set(p.url, p.html);
                next = page.next;
              }
              break;
            }
            pages.forEach((u, i) => {
              htmls[i] = byUrl.get(u) ?? byUrl.get(u.replace(/^http:/, "https:")) ?? "";
            });
          } else {
            await Promise.all(Array.from({ length: 6 }, worker));
          }
          const missing = htmls.filter((h) => !h).length;
          if (missing === pages.length) throw new Error("No se pudo abrir ninguna prueba del enlace.");
          if (missing) toast.warning(`${missing} pruebas no se pudieron abrir; el resto se leyó.`);
          lines = htmls.flatMap((h) => htmlToLines(h));
          eventParsed = htmls.flatMap((h, i) => {
            if (!h) return [];
            const p = parseMeetManagerResults(htmlToLines(h).map(commaTimes), name);
            const round = pages[i]?.match(/([FPS])\d{3,4}\.html?/i)?.[1]?.toUpperCase();
            if (round === "P" || round === "S") p.results = p.results.map((r) => ({ ...r, round }));
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
        parsed.athletes = [...new Map(eventParsed.flatMap((p) => p.athletes).map((a) => [a.key, a])).values()];
        parsed.teams = [...new Map(eventParsed.flatMap((p) => p.teams).map((t) => [t.code, t])).values()];
        parsed.results = eventParsed.flatMap((p) => p.results);
        parsed.warnings = [...new Set(eventParsed.flatMap((p) => p.warnings))].filter((w) => !/No se reconoci/.test(w));
      }
      if (info) {
        parsed.meet = {
          ...parsed.meet,
          name: customName || info.title || parsed.meet.name,
          startDate: info.startDate ?? parsed.meet.startDate,
          endDate: info.endDate ?? parsed.meet.endDate,
        };
      }
      if (!parsed.results.length) {
        if (res.kind === "pdf") setSummary("No se reconoció el formato del PDF. No se consumieron créditos; usa un reporte de resultados Meet Manager o un archivo HY3/SD3.");
        else setSummary("No se encontraron resultados en esa página. Pega el enlace principal de los resultados (el que muestra la lista de pruebas) o el de un PDF de resultados.");
        return;
      }
      await finish(name, parsed);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold uppercase">Resultados desde un enlace / FEVEDA</h2>
        <span className="rounded bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">Meet Manager & FEVEDA</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Pega el enlace de resultados de Meet Manager, el enlace de un PDF o el portal de la <strong>Federación Venezolana (FEVEDA)</strong>. 
        El sistema filtra y toma <strong>únicamente los tiempos de los atletas que ya tienes registrados en tu club</strong>; el resto se ignora automáticamente.
      </p>

      <form className="flex flex-col gap-2 sm:flex-row" onSubmit={(e) => { e.preventDefault(); if (url.trim()) read(); }}>
        <Input
          type="text"
          inputMode="url"
          autoCapitalize="none"
          autoCorrect="off"
          placeholder="https://feveda.org/resultados/ o enlace de resultados"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          aria-label="Enlace de resultados"
          disabled={busy || disabled}
        />
        <Button type="submit" disabled={busy || disabled || !url.trim()}>
          {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <Link2 className="mr-2 size-4" />}
          Extraer mis atletas
        </Button>
      </form>

      {/* Quick shortcuts for Venezuelan FEVEDA circuits */}
      <div className="flex flex-wrap items-center gap-2 pt-1 text-xs text-muted-foreground">
        <span className="font-medium">Accesos directos FEVEDA:</span>
        <button
          type="button"
          disabled={busy}
          className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/20"
          onClick={() => {
            setUrl("https://feveda.org/resultados/");
            read("https://feveda.org/resultados/");
          }}
        >
          🇻🇪 Explorar Directorio FEVEDA
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-full border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-muted"
          onClick={() => {
            setUrl("https://natacionvenezuela.com/2026/occidente/");
            read("https://natacionvenezuela.com/2026/occidente/", "Campeonato Regional Occidente 2026");
          }}
        >
          Regional Occidente 2026
        </button>
        <button
          type="button"
          disabled={busy}
          className="rounded-full border bg-background px-2.5 py-1 text-xs transition-colors hover:bg-muted"
          onClick={() => {
            setUrl("https://feveda.org/2026/regionalcentro/");
            read("https://feveda.org/2026/regionalcentro/", "Campeonato Regional Central 2026");
          }}
        >
          Regional Central 2026
        </button>
      </div>

      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input type="checkbox" checked={allowBrowser} disabled={busy} onChange={(e) => setAllowBrowser(e.target.checked)} />
        Permitir lectura con créditos solo si el sitio bloquea el acceso. Los PDF se leen localmente sin créditos.
      </label>

      {busy && (
        <div className="flex items-center gap-2 text-sm text-primary">
          <Loader2 className="size-4 animate-spin" />
          <span>Leyendo todas las pruebas del enlace{progress ? ` (${progress})` : ""}, puede tardar un minuto…</span>
        </div>
      )}

      {summary && (
        <div role="status" className="rounded border bg-muted/50 p-3 text-sm">
          {summary}
        </div>
      )}

      {/* Interactive FEVEDA Championship Cards */}
      {fevedaMeets && fevedaMeets.length > 0 && (
        <div className="mt-3 space-y-3 rounded-lg border border-primary/20 bg-muted/30 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="size-5 text-primary" />
              <h3 className="font-semibold text-foreground">Campeonatos Oficiales FEVEDA ({fevedaMeets.length})</h3>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setFevedaMeets(null)}>Ocultar</Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Haz clic en <strong>«Extraer de mi club»</strong> en el campeonato que deseas cargar. SwimLaneCoach revisará todas las pruebas y tomará únicamente las marcas de tus atletas.
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {fevedaMeets.map((m, i) => (
              <div key={i} className="flex flex-col justify-between rounded-lg border bg-card p-3 shadow-sm transition-all hover:border-primary/50">
                <div>
                  <div className="font-semibold text-foreground leading-snug">{m.name}</div>
                  {(m.startDate || m.location) && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {m.startDate && <span>📅 {m.startDate}{m.endDate && m.endDate !== m.startDate ? ` al ${m.endDate}` : ""} · </span>}
                      {m.location && <span>📍 {m.location}</span>}
                    </div>
                  )}
                  {m.description && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground/80">{m.description}</div>}
                </div>
                <div className="mt-3 flex items-center justify-between gap-2 border-t pt-2">
                  <a href={m.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
                    Ver web oficial ↗
                  </a>
                  <Button
                    size="sm"
                    disabled={busy || disabled}
                    onClick={() => {
                      setUrl(m.url);
                      read(m.url, m.name);
                    }}
                  >
                    Extraer de mi club
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
