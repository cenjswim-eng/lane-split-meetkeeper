/**
 * Modal y Sección Interactiva: Extraer Tiempos de Atletas de Otros Clubes por Enlace
 * Ubicación: src/components/rankings/RivalResultsLinkExtractorModal.tsx
 *
 * Permite pegar enlaces (FEVEDA, Meet Manager HTML o PDF) o tablas de texto copiado
 * para extraer los tiempos de nadadores de clubes rivales y poblar el Ranking Estadal.
 */

import { useState, useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import {
  Globe,
  Link2,
  ClipboardPaste,
  Building2,
  Users,
  Timer,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Search,
  Filter,
  Layers,
  Sparkles,
  Download,
  Calendar,
  X,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { fetchResultsLink, startBrowserBatch, browserBatchStatus } from "@/lib/results-link.functions";
import {
  htmlToLines,
  commaTimes,
  meetEventPages,
  indexFrameUrl,
  meetIndexInfo,
  extractAllClubsFromParsed,
  filterParsedByClubCodes,
  type DetectedMeetClub,
} from "@/lib/results-link";
import { parseMeetManagerResults } from "@/lib/pdf-results";
import { readPdfLines } from "@/lib/club-document";
import { importParsed } from "@/lib/importer";
import { isFevedaDirectoryUrl, parseFevedaDirectory, normalizeResultsUrl, type FevedaMeet } from "@/lib/feveda";
import { normalizeTeamCode } from "@/data/fevedaClubs";
import { formatTime } from "@/lib/swim";
import type { ParsedFile } from "@/lib/hytek/types";

export function RivalResultsLinkExtractorModal({
  triggerButton,
  myClubCode = "JSWIM",
  onResultsImported,
}: {
  triggerButton?: React.ReactNode;
  myClubCode?: string;
  onResultsImported?: (count: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"link" | "paste">("link");
  const [url, setUrl] = useState("");
  const [pastedText, setPastedText] = useState("");
  const [meetNameInput, setMeetNameInput] = useState("");
  const [meetDateInput, setMeetDateInput] = useState(new Date().toISOString().slice(0, 10));
  const [meetCourseInput, setMeetCourseInput] = useState<"LCM" | "SCM">("LCM");
  const [allowBrowser, setAllowBrowser] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progressText, setProgressText] = useState<string | null>(null);
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [blockedError, setBlockedError] = useState<{ message: string; targetUrl: string; hostname: string } | null>(null);

  // Resultados parseados crudos
  const [parsedFile, setParsedFile] = useState<ParsedFile | null>(null);
  const [detectedClubs, setDetectedClubs] = useState<DetectedMeetClub[]>([]);
  const [selectedClubs, setSelectedClubs] = useState<Set<string>>(new Set());
  const [excludeMyClub, setExcludeMyClub] = useState(true);
  const [searchPreview, setSearchPreview] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const qc = useQueryClient();
  const fetchLink = useServerFn(fetchResultsLink);
  const startBatch = useServerFn(startBrowserBatch);
  const batchStatus = useServerFn(browserBatchStatus);

  const cleanMyClub = useMemo(() => normalizeTeamCode(myClubCode).code, [myClubCode]);

  // Manejar extracción desde URL
  const handleExtractFromLink = async () => {
    const inputUrl = url.trim();
    if (!inputUrl) {
      toast.error("Pega primero un enlace de resultados válido (https://...).");
      return;
    }

    const cleanLink = normalizeResultsUrl(inputUrl);
    setUrl(cleanLink);
    setBlockedError(null);

    setIsProcessing(true);
    setProgressPercent(15);
    setProgressText("Conectando con el servidor de resultados...");

    try {
      const link = cleanLink;

      // 1. Fetch link (HTML or PDF)
      const res = await fetchLink({ data: { url: link, allowBrowser } });
      setProgressPercent(40);
      setProgressText("Descargando contenido de la competencia...");

      const name =
        meetNameInput.trim() ||
        decodeURIComponent(new URL(res.url).pathname.split("/").filter(Boolean).pop() ?? "Torneo Oficial").replace(
          /\.(pdf|html?)$/i,
          ""
        ) ||
        "Torneo Oficial";

      let lines: string[] = [];
      let eventParsed: ParsedFile[] | null = null;
      let info: ReturnType<typeof meetIndexInfo> | null = null;

      if (res.kind === "pdf") {
        setProgressPercent(60);
        setProgressText("Extrayendo líneas de texto del PDF...");
        const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
        lines = await readPdfLines(new File([bytes], `${name}.pdf`, { type: "application/pdf" }));
      } else {
        // Meet Manager web
        let indexHtml = res.html;
        let indexUrl = res.url;
        let protectedSite = res.via === "browser";
        const visited = new Set([indexUrl]);

        for (let depth = 0; depth < 5 && !meetEventPages(indexHtml, indexUrl).length; depth++) {
          const frame =
            indexFrameUrl(indexHtml, indexUrl) ??
            (/<frameset/i.test(indexHtml) ? new URL("evtindex.htm", indexUrl).toString() : null);
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
          let done = 0;
          let next = 0;
          setProgressText(`Descargando pruebas (0/${pages.length})...`);

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
                  /* reintento */
                }
              }
              done++;
              setProgressPercent(40 + Math.round((done / pages.length) * 40));
              setProgressText(`Descargando pruebas (${done}/${pages.length})...`);
            }
          };

          if (protectedSite) {
            const { id } = await startBatch({ data: { urls: pages } });
            const byUrl = new Map<string, string>();
            for (let tries = 0; tries < 120; tries++) {
              await new Promise((r) => setTimeout(r, 3000));
              const st = await batchStatus({ data: { id } });
              if (st.status === "failed") throw new Error("No se pudieron abrir las pruebas protegidas.");
              if (st.status !== "completed") continue;
              let page = st;
              let nextCursor = st.next;
              for (const p of page.pages) byUrl.set(p.url, p.html);
              while (nextCursor) {
                page = await batchStatus({ data: { id, next: nextCursor } });
                for (const p of page.pages) byUrl.set(p.url, p.html);
                nextCursor = page.next;
              }
              break;
            }
            pages.forEach((u, i) => {
              htmls[i] = byUrl.get(u) ?? byUrl.get(u.replace(/^http:/, "https:")) ?? "";
            });
          } else {
            await Promise.all(Array.from({ length: 6 }, worker));
          }

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

      setProgressPercent(85);
      setProgressText("Parseando y normalizando marcas por club...");

      lines = lines.map(commaTimes);
      const parsed = parseMeetManagerResults(lines, name);

      if (eventParsed?.length) {
        parsed.athletes = [...new Map(eventParsed.flatMap((p) => p.athletes).map((a) => [a.key, a])).values()];
        parsed.teams = [...new Map(eventParsed.flatMap((p) => p.teams).map((t) => [t.code, t])).values()];
        parsed.results = eventParsed.flatMap((p) => p.results);
      }

      const today = new Date().toISOString().slice(0, 10);
      parsed.meet.name = meetNameInput.trim() || info?.title || parsed.meet.name || name;
      parsed.meet.startDate = meetDateInput || info?.startDate || parsed.meet.startDate || today;
      parsed.meet.endDate = parsed.meet.endDate || parsed.meet.startDate;
      parsed.meet.course = meetCourseInput || parsed.meet.course || "LCM";

      if (!parsed.results.length) {
        toast.warning("No se reconocieron tiempos de natación en la página indicada.");
        return;
      }

      setParsedFile(parsed);

      // Extraer y agrupar clubes
      const clubs = extractAllClubsFromParsed(parsed, cleanMyClub);
      setDetectedClubs(clubs);

      // Preseleccionar todos los clubes rivales
      const initialSelected = new Set<string>();
      clubs.forEach((c) => {
        if (!excludeMyClub || !c.isMyClub) {
          initialSelected.add(c.code);
        }
      });
      setSelectedClubs(initialSelected);

      setProgressPercent(100);
      toast.success(`Se extrajeron ${parsed.results.length} marcas de ${clubs.length} clubes`);
    } catch (err: any) {
      const msg = err?.message || "Error al procesar el enlace.";
      const isBlocked = /530|403|401|406|429|503|520|521|522|523|524|525|526|cloudflare|escudo|bloque/i.test(msg);
      if (isBlocked) {
        let host = "el servidor de resultados";
        try {
          host = new URL(cleanLink).hostname;
        } catch {}
        setBlockedError({
          message: msg,
          targetUrl: cleanLink,
          hostname: host,
        });
      }
      toast.error(msg);
    } finally {
      setIsProcessing(false);
      setProgressText(null);
    }
  };

  // Manejar extracción desde texto pegado
  const handleExtractFromPasted = async () => {
    setBlockedError(null);
    const text = pastedText.trim();
    if (!text) {
      toast.error("Pega primero la tabla o texto de resultados.");
      return;
    }

    setIsProcessing(true);
    setProgressPercent(40);
    setProgressText("Procesando tabla de texto...");

    try {
      const lines = htmlToLines(text).map(commaTimes);
      const meetTitle = meetNameInput.trim() || "Competencia Estadal";
      const parsed = parseMeetManagerResults(lines, meetTitle, meetCourseInput);

      parsed.meet.name = meetTitle;
      parsed.meet.startDate = meetDateInput || new Date().toISOString().slice(0, 10);
      parsed.meet.endDate = parsed.meet.startDate;
      parsed.meet.course = meetCourseInput;

      if (!parsed.results.length) {
        toast.warning("No se encontraron nadadores ni marcas válidas en el texto pegado.");
        return;
      }

      setParsedFile(parsed);
      const clubs = extractAllClubsFromParsed(parsed, cleanMyClub);
      setDetectedClubs(clubs);

      const initialSelected = new Set<string>();
      clubs.forEach((c) => {
        if (!excludeMyClub || !c.isMyClub) {
          initialSelected.add(c.code);
        }
      });
      setSelectedClubs(initialSelected);

      setProgressPercent(100);
      toast.success(`Se detectaron ${parsed.results.length} resultados de ${clubs.length} clubes`);
    } catch (err: any) {
      toast.error(err?.message || "Error al procesar el texto.");
    } finally {
      setIsProcessing(false);
      setProgressText(null);
    }
  };

  // Alternar selección de un club
  const toggleClubSelection = (code: string) => {
    setSelectedClubs((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  // Seleccionar / Deseleccionar todos
  const handleSelectAllClubs = (select: boolean) => {
    if (!select) {
      setSelectedClubs(new Set());
      return;
    }
    const all = new Set<string>();
    detectedClubs.forEach((c) => {
      if (!excludeMyClub || !c.isMyClub) {
        all.add(c.code);
      }
    });
    setSelectedClubs(all);
  };

  // Seleccionar solo clubes de Lara / ADAEL
  const handleSelectOnlyLaraClubs = () => {
    const laraSet = new Set<string>();
    detectedClubs.forEach((c) => {
      if (c.state.toLowerCase() === "lara" || c.lsc.toUpperCase() === "ADAEL") {
        if (!excludeMyClub || !c.isMyClub) {
          laraSet.add(c.code);
        }
      }
    });
    setSelectedClubs(laraSet);
    toast.info(`Seleccionados ${laraSet.size} clubes de Lara`);
  };

  // Archivo filtrado listo para guardar
  const filteredParsed = useMemo(() => {
    if (!parsedFile || selectedClubs.size === 0) return null;
    return filterParsedByClubCodes(parsedFile, Array.from(selectedClubs));
  }, [parsedFile, selectedClubs]);

  // Lista de previsualización para la tabla
  const previewRows = useMemo(() => {
    if (!filteredParsed) return [];
    const athMap = new Map(filteredParsed.athletes.map((a) => [a.key, a]));
    const teamMap = new Map(filteredParsed.teams.map((t) => [t.code, t]));

    const strokeNames: Record<number, string> = {
      1: "Libre",
      2: "Espalda",
      3: "Pecho",
      4: "Mariposa",
      5: "C. Individual",
    };

    return filteredParsed.results
      .filter((r) => r.finalMs && r.finalMs > 0 && !r.isDq)
      .map((r, idx) => {
        const ath = athMap.get(r.athleteKey);
        const team = ath?.teamCode ? teamMap.get(ath.teamCode) : null;
        const norm = normalizeTeamCode(ath?.teamCode || "CLUB", team?.name);

        return {
          id: `${r.athleteKey}-${idx}`,
          athleteName: ath ? `${ath.lastName}, ${ath.firstName}` : "Atleta",
          gender: ath?.gender || r.gender || "M",
          birthDate: ath?.birthDate || "2010-01-01",
          clubCode: norm.code,
          clubName: norm.name,
          eventLabel: `${r.distance}m ${strokeNames[r.stroke] || "Libre"}`,
          timeFormatted: formatTime(r.finalMs!),
          timeMs: r.finalMs!,
          place: r.place || idx + 1,
        };
      });
  }, [filteredParsed]);

  // Búsqueda en la previsualización
  const displayedPreviewRows = useMemo(() => {
    if (!searchPreview.trim()) return previewRows.slice(0, 50);
    const q = searchPreview.toLowerCase().trim();
    return previewRows
      .filter(
        (r) =>
          r.athleteName.toLowerCase().includes(q) ||
          r.clubCode.toLowerCase().includes(q) ||
          r.clubName.toLowerCase().includes(q) ||
          r.eventLabel.toLowerCase().includes(q)
      )
      .slice(0, 50);
  }, [previewRows, searchPreview]);

  // Guardar resultados en base de datos para el Ranking Estadal
  const handleSaveToRanking = async () => {
    if (!filteredParsed || !filteredParsed.results.length) {
      toast.error("No hay resultados de clubes rivales seleccionados para guardar.");
      return;
    }

    setIsSaving(true);
    try {
      // 1. Guardar mediante importParsed (crea teams, athletes y results en la base de datos)
      await importParsed(filteredParsed.meet.name, filteredParsed);

      // 2. Si es de la temporada 2026, también registrar en official_results_2026 para ranking oficial ADAEL
      const is2026 = filteredParsed.meet.startDate.startsWith("2026");
      if (is2026) {
        try {
          // Upsert meet
          const { data: meetRow } = await supabase
            .from("meets_2026" as any)
            .upsert(
              {
                name: filteredParsed.meet.name,
                start_date: filteredParsed.meet.startDate,
                end_date: filteredParsed.meet.endDate || filteredParsed.meet.startDate,
                course: filteredParsed.meet.course === "SCM" ? "SCM" : "LCM",
                location: filteredParsed.meet.location || "Piscina Oficial",
                updated_at: new Date().toISOString(),
              },
              { onConflict: "name,start_date,course" }
            )
            .select("id")
            .single();

          if (meetRow?.id) {
            // Upsert clubs
            const clubsPayload = filteredParsed.teams.map((t) => {
              const norm = normalizeTeamCode(t.code, t.name);
              return {
                code: norm.code,
                name: norm.name,
                association: norm.lsc || "LARA",
                is_federated_2026: true,
                updated_at: new Date().toISOString(),
              };
            });

            await supabase.from("adael_clubs" as any).upsert(clubsPayload, { onConflict: "code" });

            // Upsert results
            const athMap = new Map(filteredParsed.athletes.map((a) => [a.key, a]));
            const strokeMap: Record<number, string> = {
              1: "FREE",
              2: "BACK",
              3: "BREAST",
              4: "FLY",
              5: "IM",
            };

            const officialPayload = filteredParsed.results
              .filter((r) => r.finalMs && r.finalMs > 0 && !r.isDq)
              .map((r) => {
                const ath = athMap.get(r.athleteKey);
                const norm = normalizeTeamCode(ath?.teamCode || "CLUB");
                return {
                  meet_id: meetRow.id,
                  swimmer_name: ath ? `${ath.lastName}, ${ath.firstName}` : "Atleta",
                  birth_date: ath?.birthDate || "2010-01-01",
                  gender: ath?.gender || r.gender || "M",
                  club_code: norm.code,
                  distance: r.distance,
                  stroke: strokeMap[r.stroke] || "FREE",
                  course: r.course === "SCM" ? "SCM" : "LCM",
                  time_ms: r.finalMs,
                  status: "OK",
                  round: r.round || "F",
                  is_relay_leadoff: false,
                };
              });

            await supabase
              .from("official_results_2026" as any)
              .upsert(officialPayload, {
                onConflict: "meet_id,swimmer_name,birth_date,distance,stroke,course,round,is_relay_leadoff",
              });
          }
        } catch (adaelErr) {
          console.warn("No se pudo reflejar en official_results_2026:", adaelErr);
        }
      }

      // 3. Invalidar queries para refrescar la UI de rankings
      await qc.invalidateQueries({ queryKey: ["coach-data"] });
      await qc.invalidateQueries({ queryKey: ["official_results_2026_state_ranking"] });
      await qc.invalidateQueries({ queryKey: ["meets_2026"] });

      toast.success("¡Resultados de rivales importados exitosamente!", {
        description: `Se guardaron ${filteredParsed.results.length} marcas de ${selectedClubs.size} clubes adversarios en el Ranking Estadal.`,
      });

      if (onResultsImported) {
        onResultsImported(filteredParsed.results.length);
      }

      setOpen(false);
      setParsedFile(null);
      setDetectedClubs([]);
      setSelectedClubs(new Set());
    } catch (err: any) {
      toast.error(err?.message || "Error al guardar resultados en la base de datos.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button
            variant="outline"
            className="flex items-center gap-2 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-semibold shadow-sm"
          >
            <Globe className="h-4 w-4 text-primary" />
            Extraer Marcas de Otros Clubes (Link)
            <Badge variant="secondary" className="text-[10px] uppercase font-bold tracking-wider">
              Rivales
            </Badge>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                Extraer Tiempos de Atletas de Otros Clubes
                <Badge variant="outline" className="text-xs bg-muted/60">
                  Ranking Estadal
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Pega el enlace de una competencia (FEVEDA, Meet Manager HTML o PDF oficial) o pega la tabla de texto
                directamente para extraer las marcas oficiales de los clubes rivales.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {/* Selector de Modo: Por Enlace vs Pegar Texto */}
          <div className="flex rounded-lg border bg-muted/50 p-1 text-xs">
            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md font-semibold transition-colors ${
                mode === "link"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMode("link")}
            >
              <Link2 className="h-3.5 w-3.5" />
              Por Enlace Web o PDF Oficial
            </button>
            <button
              type="button"
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-md font-semibold transition-colors ${
                mode === "paste"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMode("paste")}
            >
              <ClipboardPaste className="h-3.5 w-3.5" />
              Pegar Texto Directo (Sin Bloqueos)
            </button>
          </div>

          {/* Formulario de Entrada */}
          <div className="space-y-4 rounded-lg border bg-card p-4">
            {mode === "link" ? (
              <div className="space-y-3">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <Link2 className="h-3.5 w-3.5 text-primary" />
                  URL de los Resultados de la Competencia
                </label>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://natacionvenezuela.com/2026/lara/ o https://feveda.org/... o PDF"
                    value={url}
                    onChange={(e) => {
                      setUrl(e.target.value);
                      if (blockedError) setBlockedError(null);
                    }}
                    disabled={isProcessing}
                    className="font-mono text-xs"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        const clip = await navigator.clipboard.readText();
                        if (clip) {
                          setUrl(normalizeResultsUrl(clip.trim()));
                          if (blockedError) setBlockedError(null);
                        }
                      } catch {
                        toast.info("Pega el enlace con Ctrl + V.");
                      }
                    }}
                  >
                    Pegar
                  </Button>
                </div>

                {/* Formatos rápidos de ejemplo */}
                <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                  <span className="text-[10px] text-muted-foreground font-medium">Formatos frecuentes:</span>
                  <button
                    type="button"
                    className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border transition-colors font-mono"
                    onClick={() => {
                      setUrl("https://natacionvenezuela.com/2026/lara/");
                      setMeetNameInput("Campeonato Estadal Lara 2026");
                      setBlockedError(null);
                    }}
                  >
                    natacionvenezuela.com/2026/lara/
                  </button>
                  <button
                    type="button"
                    className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border transition-colors font-mono"
                    onClick={() => {
                      setUrl("https://natacionvenezuela.com/2026/occidente/");
                      setMeetNameInput("Campeonato Regional Occidente 2026");
                      setBlockedError(null);
                    }}
                  >
                    Regional Occidente 2026
                  </button>
                  <button
                    type="button"
                    className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border transition-colors font-mono"
                    onClick={() => {
                      setUrl("https://feveda.org/resultados/");
                      setMeetNameInput("Directorio FEVEDA");
                      setBlockedError(null);
                    }}
                  >
                    feveda.org/resultados/
                  </button>
                </div>

                {/* Banner de Solución Inmediata para Bloqueo Cloudflare / Error 530 / 403 */}
                {blockedError && (
                  <div className="rounded-lg border-2 border-amber-500/50 bg-amber-500/10 p-3.5 text-xs text-amber-950 dark:text-amber-100 shadow-sm animate-in fade-in duration-200">
                    <div className="flex items-start gap-3">
                      <div className="rounded-full bg-amber-500/20 p-2 text-amber-600 dark:text-amber-400 shrink-0">
                        <ShieldAlert className="size-5" />
                      </div>
                      <div className="space-y-2 flex-1">
                        <div className="font-semibold text-sm flex items-center gap-2">
                          <span>Escudo Cloudflare / Antibot Detectado ({blockedError.hostname})</span>
                          <Badge variant="outline" className="text-[10px] font-mono border-amber-600/40 text-amber-700 dark:text-amber-300">
                            Error 530 / Bloqueo WAF
                          </Badge>
                        </div>
                        <p className="leading-relaxed opacity-90 text-[11px]">
                          El sitio <strong>{blockedError.hostname}</strong> bloquea las peticiones automáticas de servidores en la nube. 
                          Sin embargo, <strong>tu navegador personal sí puede abrir la página normalmente</strong> sin restricciones.
                        </p>
                        <div className="rounded bg-background/70 p-2 text-[11px] space-y-1 text-foreground border border-border/50">
                          <div className="font-semibold text-primary flex items-center gap-1 text-[11px]">
                            <Sparkles className="size-3" /> Solución en 2 pasos (100% garantizada y sin servidores):
                          </div>
                          <ol className="list-decimal list-inside space-y-0.5 text-muted-foreground text-[10px]">
                            <li>Haz clic en el botón naranja de abajo para abrir el enlace en tu navegador.</li>
                            <li>En la página abierta, selecciona la tabla o texto de resultados, presiona <kbd className="px-1 py-0.2 bg-muted rounded font-mono">Ctrl + C</kbd> y pégala en la pestaña <strong>"Pegar Texto Directo"</strong>. Nuestro motor extraerá todos los clubes rivales y sus mejores marcas al instante.</li>
                          </ol>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <Button
                            size="sm"
                            variant="default"
                            className="bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs h-8"
                            onClick={() => {
                              if (blockedError.targetUrl) {
                                window.open(blockedError.targetUrl, "_blank", "noopener,noreferrer");
                              }
                              setMode("paste");
                              setBlockedError(null);
                              toast.info("Página abierta. Copia la tabla de resultados y pégala aquí.");
                            }}
                          >
                            <ClipboardPaste className="mr-1.5 size-3.5" />
                            Abrir en mi navegador y Pegar Resultados
                          </Button>
                          {blockedError.targetUrl && (
                            <a
                              href={blockedError.targetUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 dark:text-amber-300 hover:underline px-2 py-1"
                            >
                              Solo abrir enlace <ExternalLink className="size-3" />
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="allowBrowser"
                    checked={allowBrowser}
                    onCheckedChange={(v) => setAllowBrowser(Boolean(v))}
                  />
                  <label htmlFor="allowBrowser" className="text-xs text-muted-foreground cursor-pointer">
                    Autorizar lector con navegador web si el sitio tiene protecciones antibot (Cloudflare / FEVEDA)
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <ClipboardPaste className="h-3.5 w-3.5 text-primary" />
                  Pega la tabla o texto copiado de los resultados:
                </label>
                <Textarea
                  placeholder="Selecciona y copia en tu navegador las pruebas y resultados (Ctrl+A / Ctrl+C) y pégalos aquí..."
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  disabled={isProcessing}
                  rows={6}
                  className="font-mono text-xs"
                />
              </div>
            )}

            {/* Metadatos Opcionales de Torneo */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 border-t">
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Nombre del Torneo (Opcional)</label>
                <Input
                  placeholder="Ej. I Invitacional Estadal 2026"
                  value={meetNameInput}
                  onChange={(e) => setMeetNameInput(e.target.value)}
                  className="text-xs h-8 mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Fecha de Competencia</label>
                <Input
                  type="date"
                  value={meetDateInput}
                  onChange={(e) => setMeetDateInput(e.target.value)}
                  className="text-xs h-8 mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-muted-foreground">Piscina (Curso)</label>
                <Select value={meetCourseInput} onValueChange={(v: "LCM" | "SCM") => setMeetCourseInput(v)}>
                  <SelectTrigger className="text-xs h-8 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LCM">50m — LCM (Piscina Larga)</SelectItem>
                    <SelectItem value="SCM">25m — SCM (Piscina Corta)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Botón de Extracción */}
            <div className="flex justify-end pt-2">
              <Button
                onClick={mode === "link" ? handleExtractFromLink : handleExtractFromPasted}
                disabled={isProcessing || (mode === "link" ? !url.trim() : !pastedText.trim())}
                className="font-semibold text-xs"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                    {progressText || "Extrayendo..."}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Extraer Resultados de Clubes
                  </>
                )}
              </Button>
            </div>

            {isProcessing && (
              <div className="space-y-1.5 pt-2">
                <Progress value={progressPercent} className="h-2" />
                <p className="text-[11px] text-muted-foreground text-center">{progressText}</p>
              </div>
            )}
          </div>

          {/* Panel de Resultados Extraídos y Filtro por Club */}
          {detectedClubs.length > 0 && (
            <div className="space-y-4 rounded-lg border bg-card p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
                <div>
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Clubes Adversarios Detectados ({detectedClubs.length})
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Selecciona los clubes cuyos tiempos deseas importar al Ranking Estadal.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleSelectAllClubs(true)}
                  >
                    Seleccionar Todos
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-xs h-7 text-primary border-primary/30"
                    onClick={handleSelectOnlyLaraClubs}
                  >
                    Solo Lara (ADAEL)
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => handleSelectAllClubs(false)}
                  >
                    Deseleccionar
                  </Button>
                </div>
              </div>

              {/* Checkbox para excluir mi propio club */}
              <div className="flex items-center gap-2 bg-muted/30 p-2 rounded-md">
                <Checkbox
                  id="excludeMyClub"
                  checked={excludeMyClub}
                  onCheckedChange={(v) => {
                    const checked = Boolean(v);
                    setExcludeMyClub(checked);
                    if (checked) {
                      setSelectedClubs((prev) => {
                        const next = new Set(prev);
                        next.delete(cleanMyClub);
                        return next;
                      });
                    }
                  }}
                />
                <label htmlFor="excludeMyClub" className="text-xs font-medium cursor-pointer">
                  Excluir mi propio club ({cleanMyClub}) para concentrar la importación únicamente en clubes rivales
                </label>
              </div>

              {/* Lista de Clubes con Pills */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-48 overflow-y-auto p-1">
                {detectedClubs.map((club) => {
                  const isSelected = selectedClubs.has(club.code);
                  const isMy = club.isMyClub;

                  return (
                    <div
                      key={club.code}
                      onClick={() => toggleClubSelection(club.code)}
                      className={`flex items-center justify-between p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 shadow-xs"
                          : "border-border bg-background hover:bg-muted/50"
                      } ${isMy ? "opacity-75" : ""}`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <Checkbox checked={isSelected} onCheckedChange={() => toggleClubSelection(club.code)} />
                        <div className="truncate">
                          <span className="font-bold">{club.code}</span>
                          <span className="block text-[10px] text-muted-foreground truncate">{club.name}</span>
                        </div>
                      </div>
                      <Badge variant={isSelected ? "default" : "secondary"} className="text-[10px] shrink-0 ml-1">
                        {club.resultCount} nados
                      </Badge>
                    </div>
                  );
                })}
              </div>

              {/* Resumen de Métricas */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-2">
                <Card className="bg-muted/40 border-0 p-3">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Torneo</p>
                  <p className="text-xs font-semibold truncate mt-0.5">{parsedFile?.meet.name}</p>
                </Card>
                <Card className="bg-muted/40 border-0 p-3">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Clubes Seleccionados</p>
                  <p className="text-base font-bold text-primary mt-0.5">{selectedClubs.size}</p>
                </Card>
                <Card className="bg-muted/40 border-0 p-3">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Atletas Rivales</p>
                  <p className="text-base font-bold mt-0.5">{filteredParsed?.athletes.length || 0}</p>
                </Card>
                <Card className="bg-muted/40 border-0 p-3">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Marcas a Importar</p>
                  <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {previewRows.length}
                  </p>
                </Card>
              </div>

              {/* Tabla de Previsualización */}
              {previewRows.length > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">
                      Vista previa de marcas ({previewRows.length} resultados válidos)
                    </span>
                    <div className="relative w-48">
                      <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Buscar nadador o club..."
                        value={searchPreview}
                        onChange={(e) => setSearchPreview(e.target.value)}
                        className="pl-8 text-xs h-7"
                      />
                    </div>
                  </div>

                  <div className="border rounded-md overflow-x-auto max-h-56">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-muted/60 sticky top-0 border-b">
                        <tr>
                          <th className="p-2 font-semibold">Pos</th>
                          <th className="p-2 font-semibold">Atleta</th>
                          <th className="p-2 font-semibold">Club Rival</th>
                          <th className="p-2 font-semibold">Prueba</th>
                          <th className="p-2 font-semibold text-right">Tiempo</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {displayedPreviewRows.map((row) => (
                          <tr key={row.id} className="hover:bg-muted/30">
                            <td className="p-2 font-mono font-bold text-muted-foreground">#{row.place}</td>
                            <td className="p-2 font-medium">{row.athleteName}</td>
                            <td className="p-2">
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {row.clubCode}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground ml-1.5 truncate hidden sm:inline">
                                {row.clubName}
                              </span>
                            </td>
                            <td className="p-2 text-muted-foreground">{row.eventLabel}</td>
                            <td className="p-2 font-mono font-bold text-right text-foreground">
                              {row.timeFormatted}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Botón de Confirmación y Guardado */}
              <div className="flex items-center justify-between pt-3 border-t">
                <span className="text-xs text-muted-foreground">
                  Al confirmar, los tiempos se guardarán en la base de datos y se reflejarán de inmediato en el Ranking
                  Estadal.
                </span>
                <Button
                  onClick={handleSaveToRanking}
                  disabled={isSaving || previewRows.length === 0}
                  className="font-bold text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
                      Guardando en Base de Datos...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 mr-1.5" />
                      Importar {previewRows.length} Resultados al Ranking Estadal
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
