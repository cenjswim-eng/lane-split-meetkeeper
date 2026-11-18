import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Link2, Trophy, Loader2, ClipboardPaste, AlertTriangle, ExternalLink, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { readPdfLines } from "@/lib/club-document";
import { parseMeetManagerResults } from "@/lib/pdf-results";
import { browserBatchStatus, fetchResultsLink, startBrowserBatch } from "@/lib/results-link.functions";
import { commaTimes, filterToRoster, htmlToLines, indexFrameUrl, meetEventPages, meetIndexInfo, type RosterAthlete } from "@/lib/results-link";
import { isFevedaDirectoryUrl, parseFevedaDirectory, type FevedaMeet } from "@/lib/feveda";
import type { ParsedFile } from "@/lib/hytek/types";

export function ResultsLinkImport({ disabled, onParsed }: { disabled?: boolean; onParsed: (name: string, parsed: ParsedFile) => void }) {
  const [mode, setMode] = useState<"link" | "paste">("link");
  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [meetNameInput, setMeetNameInput] = useState("");
  const [meetDateInput, setMeetDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [meetCourseInput, setMeetCourseInput] = useState<"LCM" | "SCM" | "SCY">("LCM");
  const [busy, setBusy] = useState(false);
  const [allowBrowser, setAllowBrowser] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [summary, setSummary] = useState<string | null>(null);
  const [fevedaMeets, setFevedaMeets] = useState<FevedaMeet[] | null>(null);
  const [blockedError, setBlockedError] = useState<string | null>(null);

  const fetchLink = useServerFn(fetchResultsLink);
  const startBatch = useServerFn(startBrowserBatch);
  const batchStatus = useServerFn(browserBatchStatus);

  async function finish(name: string, parsed: ParsedFile) {
    const { data, error } = await supabase.from("athletes").select("id, first_name, last_name, birth_date, gender, federation_id, tm_athlete_id");
    if (error) throw new Error("No se pudo leer tu lista de atletas.");
    const roster = (data ?? []) as RosterAthlete[];
    const total = new Set(parsed.athletes.map((a) => a.key)).size;

    const today = new Date().toISOString().slice(0, 10);
    parsed.meet.name = parsed.meet.name?.trim() || name || "Torneo FEVEDA";
    parsed.meet.startDate = parsed.meet.startDate || today;
    parsed.meet.endDate = parsed.meet.endDate || parsed.meet.startDate;
    parsed.meet.course = (parsed.meet.course === "LCM" || parsed.meet.course === "SCM" || parsed.meet.course === "SCY") ? parsed.meet.course : "LCM";

    if (roster.length === 0) {
      setSummary(`Se leyeron ${parsed.results.length} resultados de ${total} nadadores, pero aún no tienes atletas registrados en tu club. Registra primero a tus atletas para poder vincularlos e importar sus tiempos.`);
      return false;
    }

    const r = filterToRoster(parsed, roster);
    if (!r.parsed.results.length) {
      const sample = roster.map((a) => `${a.first_name} ${a.last_name}`).slice(0, 4).join(", ");
      setSummary(`Se leyeron ${parsed.results.length} resultados de ${total} nadadores, pero ninguno coincide con tus atletas registrados (${sample}${roster.length > 4 ? "..." : ""}). Revisa que los nombres estén escritos exactamente igual.`);
      return false;
    }

    r.parsed.meet = {
      ...parsed.meet,
      name: parsed.meet.name,
      startDate: parsed.meet.startDate,
      endDate: parsed.meet.endDate,
      course: parsed.meet.course,
    };

    setSummary(`¡Éxito! ${r.found} de tus atletas encontrados con ${r.parsed.results.length} resultados oficiales: ${r.names.join(", ")}. Revisa los datos de competencia abajo y pulsa «Confirmar e importar».`);
    onParsed(parsed.meet.name, r.parsed);
    return true;
  }

  async function read(targetUrl?: string, customName?: string) {
    const inputUrl = (targetUrl || url).trim();
    if (!inputUrl) return;
    setBusy(true);
    setSummary(null);
    setProgress(null);
    setBlockedError(null);

    try {
      const link = /^https?:\/\//i.test(inputUrl) ? inputUrl : `https://${inputUrl}`;

      // 1. Check if it's the FEVEDA results portal directory
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

      // 2. Fetch the meet URL (PDF or Meet Manager HTML)
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
      const msg = (e as Error).message || "";
      if (/403|bloquea/i.test(msg)) {
        setBlockedError(msg);
      } else {
        toast.error(msg);
      }
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  async function readPasted() {
    const text = pastedText.trim();
    if (!text) {
      toast.error("Pega primero el texto o tabla de resultados copiado de FEVEDA.");
      return;
    }
    setBusy(true);
    setSummary(null);
    try {
      const lines = htmlToLines(text).map(commaTimes);
      const meetTitle = meetNameInput.trim() || "Resultados FEVEDA";
      const parsed = parseMeetManagerResults(lines, meetTitle, meetCourseInput);
      if (meetNameInput.trim()) parsed.meet.name = meetNameInput.trim();
      if (meetDateInput) {
        parsed.meet.startDate = meetDateInput;
        parsed.meet.endDate = meetDateInput;
      }
      if (meetCourseInput) {
        parsed.meet.course = meetCourseInput;
      }
      if (!parsed.results.length) {
        setSummary("No se reconocieron pruebas ni tiempos en el texto pegado. Asegúrate de copiar la tabla de resultados completa desde tu navegador.");
        return;
      }
      await finish(parsed.meet.name, parsed);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div>
          <h2 className="text-xl font-semibold uppercase">Extracción de Resultados FEVEDA / Meet Manager</h2>
          <p className="text-xs text-muted-foreground">
            Extrae de forma automática <strong>únicamente los tiempos de los atletas registrados en tu club</strong>.
          </p>
        </div>
        {/* Toggle between Link mode and Direct Paste mode */}
        <div className="flex rounded-lg border bg-muted/60 p-1 text-xs">
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${mode === "link" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setMode("link")}
          >
            <Link2 className="size-3.5" />
            Por Enlace
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 rounded-md px-3 py-1 font-medium transition-colors ${mode === "paste" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            onClick={() => setMode("paste")}
          >
            <ClipboardPaste className="size-3.5" />
            Pegar Texto (Sin Bloqueos)
          </button>
        </div>
      </div>

      {mode === "link" ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pega el enlace oficial del torneo de <strong>FEVEDA</strong> o de <strong>Meet Manager</strong>.
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
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
            Permitir lectura con navegador emulado si el servidor remoto restringe el acceso directo.
          </label>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-md border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
            💡 <strong>100% inmune a bloqueos de Cloudflare:</strong> Abre la página de resultados en tu navegador (FEVEDA, Natación Venezuela o Meet Manager), selecciona el contenido de los resultados con <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Ctrl + A</kbd>, cópialo con <kbd className="rounded bg-muted px-1 py-0.5 font-mono">Ctrl + C</kbd> y pégalo aquí. SwimLaneCoach extraerá en menos de 1 segundo solo las marcas de tus nadadores.
          </div>
          <div className="grid gap-2 sm:grid-cols-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Nombre de la competencia</label>
              <Input
                placeholder="Ej. Campeonato Nacional FEVEDA"
                value={meetNameInput}
                onChange={(e) => setMeetNameInput(e.target.value)}
                disabled={busy || disabled}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Fecha del torneo</label>
              <Input
                type="date"
                value={meetDateInput}
                onChange={(e) => setMeetDateInput(e.target.value)}
                disabled={busy || disabled}
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Piscina</label>
              <select
                value={meetCourseInput}
                onChange={(e) => setMeetCourseInput(e.target.value as "LCM" | "SCM" | "SCY")}
                disabled={busy || disabled}
                className="flex h-8 w-full rounded-md border border-input bg-transparent px-3 py-1 text-xs shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              >
                <option value="LCM">50 m · LCM (Olímpica)</option>
                <option value="SCM">25 m · SCM (Corta)</option>
                <option value="SCY">25 yd · SCY (Yardas)</option>
              </select>
            </div>
          </div>
          <Textarea
            rows={6}
            placeholder="Pega aquí el texto o tabla de resultados copiado de FEVEDA..."
            value={pastedText}
            onChange={(e) => setPastedText(e.target.value)}
            disabled={busy || disabled}
            className="font-mono text-xs"
          />
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              disabled={busy || disabled || !pastedText.trim()}
              onClick={() => readPasted()}
            >
              {busy ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ClipboardPaste className="mr-2 size-4" />}
              Extraer marcas de mis atletas
            </Button>
          </div>
        </div>
      )}

      {/* Cloudflare 403 Solution Banner */}
      {blockedError && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-200">
          <div className="flex items-start gap-3">
            <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-2">
              <div className="font-semibold">Protección Cloudflare detectada en FEVEDA (Bloqueo 403)</div>
              <p className="text-xs leading-relaxed opacity-90">
                El servidor de <code>feveda.org</code> tiene activado un escudo antibot que rechaza las conexiones de servidores en la nube. 
                Sin embargo, <strong>tu navegador personal sí puede abrirlo con normalidad</strong>.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => {
                    setMode("paste");
                    setBlockedError(null);
                  }}
                >
                  <ClipboardPaste className="mr-1.5 size-3.5" />
                  Solución rápida: Pegar resultados aquí
                </Button>
                {url && (
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    Abrir enlace en mi navegador <ExternalLink className="size-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {busy && (
        <div className="flex items-center gap-2 text-sm text-primary">
          <Loader2 className="size-4 animate-spin" />
          <span>Leyendo y analizando pruebas{progress ? ` (${progress})` : ""}, un momento por favor…</span>
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
