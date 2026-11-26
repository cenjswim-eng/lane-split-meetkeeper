/**
 * Centro Unificado de Importación de Resultados — SwimLaneCoach
 * Ubicación: src/components/imports/UnifiedResultsImportHub.tsx
 *
 * Unifica la subida de archivos (HY3, CL2, SD3, ZIP, PDF, Access), enlaces web
 * oficiales (ADAEL, FEVEDA) y pegado directo de tablas en UN SOLO APARTADO,
 * permitiendo al entrenador destinar los resultados a:
 * - Ranking Estadal y Análisis de Rivales
 * - Mis Atletas y Mi Club Registrado
 * - Circuito Oficial ADAEL / FEVEDA 2026
 */

import { useState, useMemo, useCallback } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  UploadCloud,
  Globe,
  Link2,
  FileText,
  ClipboardPaste,
  Trophy,
  Users,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Building2,
  Sparkles,
  Filter,
  Layers,
  ExternalLink,
  ShieldAlert,
  Trash2,
  Calendar,
  RotateCcw,
  Check,
  ChevronDown,
  ChevronUp,
  Database,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

import { profileQuery } from "@/lib/profile";
import { readHytekFile, type ParsedFile } from "@/lib/hytek";
import { readAccessFile, normalizeAccess, type AccessDatabase, type AccessTimeUnit } from "@/lib/access";
import { readPdfLines } from "@/lib/club-document";
import { parseMeetManagerResults } from "@/lib/pdf-results";
import {
  fetchResultsLink,
  startBrowserBatch,
  browserBatchStatus,
} from "@/lib/results-link.functions";
import {
  htmlToLines,
  commaTimes,
  meetIndexInfo,
  indexFrameUrl,
  meetEventPages,
  extractAllClubsFromParsed,
  type DetectedMeetClub,
} from "@/lib/results-link";
import {
  isFevedaDirectoryUrl,
  parseFevedaDirectory,
  normalizeResultsUrl,
  parseMeetUrlInfo,
  extractUrlsFromText,
  type FevedaMeet,
} from "@/lib/feveda";
import { normalizeTeamCode } from "@/data/fevedaClubs";
import { getCategoryNameByAge } from "@/lib/state-ranking";
import { formatTime } from "@/lib/swim";
import {
  type ImportDestinations,
  type DestinationPreset,
  DESTINATION_PRESETS,
  executeUnifiedImport,
  type UnifiedImportResult,
} from "@/lib/unified-import";

interface UnifiedResultsImportHubProps {
  onSuccess?: (result: UnifiedImportResult) => void;
  defaultDestinations?: Partial<ImportDestinations>;
  title?: string;
  subtitle?: string;
  compact?: boolean;
}

export function UnifiedResultsImportHub({
  onSuccess,
  defaultDestinations,
  title,
  subtitle,
  compact = false,
}: UnifiedResultsImportHubProps) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { data: profile } = useQuery(profileQuery);

  // Club y Estado Activo del Entrenador
  const myClubCode = useMemo(() => {
    const raw = profile?.club?.code || "JSWIM";
    return normalizeTeamCode(raw).code;
  }, [profile?.club?.code]);

  const myClubName = profile?.club?.name || "Mi Club";
  const myClubState = profile?.club?.region_lsc || "Lara";

  // Tab de entrada: archivo | enlace | texto
  const [inputTab, setInputTab] = useState<"file" | "link" | "paste">("file");

  // Estado del Archivo / Drag & Drop
  const [isDragging, setIsDragging] = useState(false);
  const [isReadingFile, setIsReadingFile] = useState(false);

  // Estado del Enlace Web
  const [linkUrl, setLinkUrl] = useState("");
  const [allowBrowser, setAllowBrowser] = useState(false);
  const [isFetchingLink, setIsFetchingLink] = useState(false);
  const [linkProgressText, setLinkProgressText] = useState<string | null>(null);
  const [fevedaMeets, setFevedaMeets] = useState<FevedaMeet[] | null>(null);
  const [blockedHostError, setBlockedHostError] = useState<{
    message: string;
    targetUrl: string;
    hostname: string;
  } | null>(null);

  // Estado del Pegado de Texto
  const [pastedText, setPastedText] = useState("");
  const [isProcessingText, setIsProcessingText] = useState(false);

  // Datos Parseados Cargados en el Hub
  const [parsedData, setParsedData] = useState<ParsedFile | null>(null);
  const [sourceName, setSourceName] = useState<string>("");

  // Edición rápida de la competencia
  const [meetName, setMeetName] = useState("");
  const [meetStartDate, setMeetStartDate] = useState(new Date().toISOString().slice(0, 10));
  const [meetEndDate, setMeetEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [meetCourse, setMeetCourse] = useState<"LCM" | "SCM" | "SCY">("LCM");

  // Destinos de los Resultados: Por defecto EXCLUSIVO para el equipo configurado
  const [selectedPreset, setSelectedPreset] = useState<DestinationPreset>("my_club_only");
  const [destinations, setDestinations] = useState<ImportDestinations>({
    stateRanking: defaultDestinations?.stateRanking ?? false,
    myClub: defaultDestinations?.myClub ?? true,
    officialCircuit: defaultDestinations?.officialCircuit ?? true,
    teamDatabases: defaultDestinations?.teamDatabases ?? false,
  });

  // Filtro de Clubes (Opcional)
  const [showClubFilter, setShowClubFilter] = useState(false);
  const [selectedClubCodes, setSelectedClubCodes] = useState<Set<string>>(new Set());

  // Proceso de Importación
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<number | null>(null);
  const [importStatusStage, setImportStatusStage] = useState<string>("");
  const [importSuccessResult, setImportSuccessResult] = useState<UnifiedImportResult | null>(null);

  // Server functions para lectura web
  const fetchLink = useServerFn(fetchResultsLink);
  const startBatch = useServerFn(startBrowserBatch);
  const batchStatus = useServerFn(browserBatchStatus);

  // 1. CARGA DE ARCHIVOS (.hy3, .cl2, .sd3, .ev3, .zip, .pdf, .mdb)
  const handleFileDropOrPick = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || isReadingFile) return;
    setIsReadingFile(true);
    setBlockedHostError(null);
    setImportSuccessResult(null);

    const file = fileList[0];
    try {
      // PDF Meet Manager
      if (/\.pdf$/i.test(file.name)) {
        if (file.size > 15 * 1024 * 1024) throw new Error("El archivo PDF debe pesar menos de 15 MB.");
        const lines = await readPdfLines(file);
        const baseName = file.name.replace(/\.pdf$/i, "");
        const parsed = parseMeetManagerResults(lines, baseName);
        if (!parsed.results.length) {
          throw new Error("No se detectaron marcas individuales en este PDF. Asegúrate de que sea un reporte oficial de Meet Manager.");
        }
        setupStagedData(parsed, file.name);
        toast.success(`PDF leído: ${parsed.results.length} resultados de ${parsed.teams.length} clubes`);
        return;
      }

      // MS Access .mdb
      if (/\.mdb$/i.test(file.name)) {
        const db = await readAccessFile(file);
        const normalized = normalizeAccess(db, "seconds", "LCM");
        if (!normalized.length || !normalized[0].athletes.length) {
          throw new Error("No se encontraron nadadores ni tiempos compatibles en la base de datos Access (.mdb).");
        }
        setupStagedData(normalized[0], file.name);
        toast.success(`Access .mdb leído: ${normalized[0].results.length} resultados`);
        return;
      }

      // Hy-Tek .hy3, .cl2, .sd3, .zip (incluyendo ZIPs anidados)
      const hytekResults = await readHytekFile(file);
      if (!hytekResults.length) {
        throw new Error("Formato no reconocido. Sube un archivo .hy3, .cl2, .sd3, .zip o .pdf de Meet Manager.");
      }

      // Tomamos el primer archivo de resultados con pruebas
      const chosen = hytekResults.find((r) => r.parsed.results.length > 0) || hytekResults[0];
      setupStagedData(chosen.parsed, chosen.name || file.name);
      toast.success(`Archivo leído: ${chosen.parsed.results.length} resultados de ${chosen.parsed.teams.length} clubes`);
    } catch (err: any) {
      toast.error(err?.message || "No se pudo leer el archivo. Revisa el formato.");
    } finally {
      setIsReadingFile(false);
    }
  };

  // 2. EXTRACCIÓN POR ENLACE WEB (ADAEL / FEVEDA)
  const handleFetchLink = async (targetUrl?: string) => {
    const raw = (targetUrl || linkUrl).trim();
    if (!raw) {
      toast.error("Ingresa una URL válida de resultados (ej. adael.com.ve o natacionvenezuela.com).");
      return;
    }

    const cleanLink = normalizeResultsUrl(raw);
    setLinkUrl(cleanLink);
    setBlockedHostError(null);
    setFevedaMeets(null);
    setImportSuccessResult(null);
    setIsFetchingLink(true);
    setLinkProgressText("Conectando con el servidor de natación...");

    try {
      // Directorio FEVEDA
      if (isFevedaDirectoryUrl(cleanLink)) {
        setLinkProgressText("Consultando índice de torneos FEVEDA...");
        const res = await fetchLink({ data: { url: cleanLink, allowBrowser } });
        if (res.kind === "html") {
          const meets = parseFevedaDirectory(res.html, res.url);
          if (meets.length > 0) {
            setFevedaMeets(meets);
            toast.info(`Se encontraron ${meets.length} campeonatos en FEVEDA. Selecciona uno abajo.`);
            setIsFetchingLink(false);
            setLinkProgressText(null);
            return;
          }
        }
      }

      // Descarga de HTML o PDF
      const res = await fetchLink({ data: { url: cleanLink, allowBrowser } });
      const urlInfo = parseMeetUrlInfo(cleanLink);
      const name =
        urlInfo.meetName ||
        decodeURIComponent(new URL(res.url).pathname.split("/").filter(Boolean).pop() ?? "Torneo Oficial").replace(
          /\.(pdf|html?)$/i,
          ""
        ) ||
        "Torneo Oficial";

      let lines: string[] = [];
      let eventParsed: ParsedFile[] | null = null;
      let info: ReturnType<typeof meetIndexInfo> | null = null;

      if (res.kind === "pdf") {
        setLinkProgressText("Extrayendo texto del PDF oficial...");
        const bytes = Uint8Array.from(atob(res.base64), (c) => c.charCodeAt(0));
        lines = await readPdfLines(new File([bytes], `${name}.pdf`, { type: "application/pdf" }));
      } else {
        // Meet Manager web results: seguir recursivamente hasta encontrar el marco con las pruebas
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
          setLinkProgressText("Siguiendo estructura de pruebas del torneo...");
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
          setLinkProgressText(`Extrayendo ${pages.length} pruebas del campeonato (0/${pages.length})...`);

          if (protectedSite) {
            try {
              const { id } = await startBatch({ data: { urls: pages } });
              for (let tries = 0; tries < 120; tries++) {
                await new Promise((r) => setTimeout(r, 2000));
                const st = await batchStatus({ data: { id } });
                setLinkProgressText(`Descargando pruebas protegidas: ${st.completed}/${st.total || pages.length}...`);
                if (st.status === "failed") break;
                if (st.status !== "completed") continue;
                let page = st,
                  nextCursor = st.next;
                for (const p of page.pages) {
                  const idx = pages.indexOf(p.url);
                  if (idx >= 0 && p.html) htmls[idx] = p.html;
                }
                while (nextCursor) {
                  page = await batchStatus({ data: { id, next: nextCursor } });
                  for (const p of page.pages) {
                    const idx = pages.indexOf(p.url);
                    if (idx >= 0 && p.html) htmls[idx] = p.html;
                  }
                  nextCursor = page.next;
                }
                break;
              }
            } catch {
              // fallback a descarga concurrente
            }
          }

          // Descarga directa mediante pool de workers concurrentes (para ADAEL, Natación Venezuela, etc.)
          if (htmls.some((h) => !h)) {
            const worker = async () => {
              while (next < pages.length) {
                const i = next++;
                if (htmls[i]) continue;
                for (let attempt = 0; attempt < 3 && !htmls[i]; attempt++) {
                  const pageUrl = pages[i];
                  if (!pageUrl) break;
                  try {
                    const r = await fetchLink({ data: { url: pageUrl, allowBrowser } });
                    if (r.kind === "html" && r.html) {
                      htmls[i] = r.html;
                    }
                  } catch {
                    // reintentar
                  }
                }
                setLinkProgressText(`Descargando pruebas: ${++done}/${pages.length}...`);
              }
            };
            await Promise.all(Array.from({ length: 6 }, worker));
          }

          const validHtmls = htmls.filter(Boolean);
          if (validHtmls.length === 0) {
            throw new Error("No se pudo descargar ninguna prueba del campeonato.");
          }

          lines = validHtmls.flatMap((h) => htmlToLines(h));
        } else if (!lines.length) {
          lines = htmlToLines(res.html);
          info = meetIndexInfo(res.html, res.html);
        }
      }

      setLinkProgressText("Normalizando tiempos y categorías...");
      lines = lines.map(commaTimes);
      const parsed = parseMeetManagerResults(lines, name);

      if (!parsed.results.length) {
        throw new Error("No se reconocieron tiempos de natación en la dirección web indicada.");
      }

      if (urlInfo.meetName) parsed.meet.name = urlInfo.meetName;
      if (urlInfo.year) parsed.meet.startDate = `${urlInfo.year}-01-01`;
      if (urlInfo.course) parsed.meet.course = urlInfo.course;

      setupStagedData(parsed, cleanLink);
      toast.success(`Enlace procesado: ${parsed.results.length} resultados de ${parsed.teams.length} clubes`);
    } catch (err: any) {
      const msg = err?.message || "Error al conectar con el servidor.";
      const isBlocked = /530|403|401|406|429|503|520|521|522|523|524|525|526|cloudflare|escudo|bloque/i.test(msg);
      if (isBlocked) {
        let host = "el servidor";
        try {
          host = new URL(cleanLink).hostname;
        } catch {}
        setBlockedHostError({
          message: msg,
          targetUrl: cleanLink,
          hostname: host,
        });
      }
      toast.error(msg);
    } finally {
      setIsFetchingLink(false);
      setLinkProgressText(null);
    }
  };

  // 3. EXTRACCIÓN POR TEXTO PEGADO (Inmune a 530)
  const handleProcessPastedText = async () => {
    const raw = pastedText.trim();
    if (!raw) {
      toast.error("Pega primero la tabla o reporte de resultados en el área de texto.");
      return;
    }

    setIsProcessingText(true);
    setBlockedHostError(null);
    setImportSuccessResult(null);

    try {
      const lines = htmlToLines(raw).map(commaTimes);
      const title = meetName.trim() || "Competencia Estadal";
      const parsed = parseMeetManagerResults(lines, title, meetCourse);

      if (!parsed.results.length) {
        throw new Error("No se detectaron nadadores ni marcas válidas en el texto pegado.");
      }

      setupStagedData(parsed, "Tabla de Texto Pegado");
      toast.success(`Texto procesado: ${parsed.results.length} marcas de ${parsed.teams.length} clubes`);
    } catch (err: any) {
      toast.error(err?.message || "Error al procesar el texto.");
    } finally {
      setIsProcessingText(false);
    }
  };

  // Pegar directamente desde portapapeles
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text.trim()) {
        toast.warning("El portapapeles está vacío.");
        return;
      }
      setPastedText(text);
      toast.info("Texto pegado desde el portapapeles. Pulsa «Procesar texto».");
    } catch {
      toast.error("No se pudo acceder al portapapeles automáticamente. Pega con Ctrl+V.");
    }
  };

  // Inicializar los datos cargados en el formulario de configuración
  const setupStagedData = (parsed: ParsedFile, source: string) => {
    setParsedData(parsed);
    setSourceName(source);

    const today = new Date().toISOString().slice(0, 10);
    setMeetName(parsed.meet.name?.trim() || "Competencia Oficial");
    setMeetStartDate(parsed.meet.startDate || today);
    setMeetEndDate(parsed.meet.endDate || parsed.meet.startDate || today);
    setMeetCourse(
      parsed.meet.course === "LCM" || parsed.meet.course === "SCM" || parsed.meet.course === "SCY"
        ? parsed.meet.course
        : "LCM"
    );

    // Auto-detección y preselección EXCLUSIVA de nuestro equipo
    const normMyClub = normalizeTeamCode(myClubCode).code;
    const detected = extractAllClubsFromParsed(parsed, myClubCode);
    const foundMyClub = detected.find((c) => c.code === normMyClub);

    if (foundMyClub) {
      setSelectedClubCodes(new Set([normMyClub]));
      toast.success(
        `Detectado tu equipo ${normMyClub} (${foundMyClub.resultCount} marcas, ${foundMyClub.athleteCount} nadadores). Se importará de forma exclusiva.`
      );
    } else if (detected.length === 1) {
      setSelectedClubCodes(new Set([detected[0].code]));
    } else if (detected.length > 0) {
      setSelectedClubCodes(new Set([detected[0].code]));
      toast.info(
        `Se detectaron ${detected.length} equipos. Confirma cuál es tu club para importar únicamente sus resultados.`
      );
    } else {
      setSelectedClubCodes(new Set([normMyClub]));
    }
  };

  // Clubes agrupados y clasificados
  const detectedClubs: DetectedMeetClub[] = useMemo(() => {
    if (!parsedData) return [];
    return extractAllClubsFromParsed(parsedData, myClubCode);
  }, [parsedData, myClubCode]);

  // Desglose de categorías
  const detectedCategories = useMemo(() => {
    if (!parsedData) return [];
    const athMap = new Map(parsedData.athletes.map((a) => [a.key, a]));
    const refYear = Number(meetStartDate.slice(0, 4)) || 2026;
    const counts: Record<string, number> = {};

    for (const r of parsedData.results) {
      if (!r.finalMs || r.finalMs <= 0 || r.isDq) continue;
      const ath = athMap.get(r.athleteKey);
      const birth = ath?.birthDate || `${refYear - 14}-01-01`;
      const birthYear = parseInt(birth.slice(0, 4), 10) || refYear - 14;
      const age = refYear - birthYear;
      const cat = getCategoryNameByAge(age);
      counts[cat] = (counts[cat] || 0) + 1;
    }

    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [parsedData, meetStartDate]);

  // Selección de preset
  const handleApplyPreset = (preset: DestinationPreset) => {
    setSelectedPreset(preset);
    if (preset !== "custom") {
      setDestinations(DESTINATION_PRESETS[preset].destinations);
    }
  };

  const handleToggleDestination = (key: keyof ImportDestinations) => {
    setDestinations((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      setSelectedPreset("custom");
      return next;
    });
  };

  // Seleccionar / Deseleccionar clubes
  const handleToggleClub = (code: string) => {
    setSelectedClubCodes((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const handleSelectAllClubs = (select: boolean) => {
    if (select && parsedData) {
      setSelectedClubCodes(new Set(parsedData.teams.map((t) => normalizeTeamCode(t.code).code)));
    } else {
      setSelectedClubCodes(new Set());
    }
  };

  const handleSelectOnlyLaraClubs = () => {
    const laraCodes = new Set<string>();
    detectedClubs.forEach((c) => {
      if (c.state.toLowerCase() === "lara" || c.lsc.toUpperCase() === "ADAEL") {
        laraCodes.add(c.code);
      }
    });
    setSelectedClubCodes(laraCodes);
    toast.info(`Seleccionados ${laraCodes.size} clubes de Lara`);
  };

  // 4. CONFIRMAR E IMPORTAR A LOS DESTINOS SELECCIONADOS
  const handleConfirmImport = async () => {
    if (!parsedData) {
      toast.error("Carga primero un archivo, enlace o texto con resultados.");
      return;
    }

    if (!destinations.stateRanking && !destinations.myClub && !destinations.officialCircuit) {
      toast.error("Selecciona al menos un destino para los resultados (Ranking, Club o Circuito).");
      return;
    }

    setIsImporting(true);
    setImportProgress(10);
    setImportStatusStage("Preparando datos de la competencia...");

    try {
      const safeParsed: ParsedFile = {
        ...parsedData,
        meet: {
          ...parsedData.meet,
          name: meetName.trim() || parsedData.meet.name || "Torneo Oficial",
          startDate: meetStartDate,
          endDate: meetEndDate || meetStartDate,
          course: meetCourse,
        },
      };

      const result = await executeUnifiedImport({
        fileName: sourceName || "Importacion_Resultados",
        parsed: safeParsed,
        destinations,
        myClubCode,
        selectedClubs: selectedClubCodes,
        queryClient: qc,
        onProgress: (pct, stage) => {
          setImportProgress(pct);
          setImportStatusStage(stage);
        },
      });

      setImportSuccessResult(result);
      toast.success("¡Importación completada con éxito!");
      if (onSuccess) onSuccess(result);
    } catch (err: any) {
      toast.error(err?.message || "Error al completar la importación.");
    } finally {
      setIsImporting(false);
      setImportProgress(null);
    }
  };

  // Resetear para importar otro torneo
  const handleReset = () => {
    setParsedData(null);
    setSourceName("");
    setImportSuccessResult(null);
    setPastedText("");
    setLinkUrl("");
    setBlockedHostError(null);
  };

  return (
    <div className="space-y-6">
      {/* 1. ENCABEZADO Y CONTEXTO DEL CLUB */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-3xl font-extrabold uppercase tracking-tight text-foreground flex items-center gap-2.5">
            <Layers className="h-7 w-7 text-primary" />
            {title || "Centro de Importación de Resultados"}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {subtitle ||
              "Sube archivos Hy-Tek, enlaces oficiales ADAEL/FEVEDA o tablas de texto en un solo apartado y canalízalos a tu club, a sus rankings o al circuito oficial."}
          </p>
        </div>

        {/* Badges de Estado y Club */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5 border-primary/30 py-1 text-xs font-semibold text-primary">
            <Building2 className="h-3.5 w-3.5" />
            Mi Club: {myClubCode} ({myClubName})
          </Badge>
          <Badge variant="secondary" className="gap-1.5 py-1 text-xs font-medium">
            <Trophy className="h-3.5 w-3.5 text-amber-500" />
            Estado: {myClubState}
          </Badge>
        </div>
      </div>

      {/* 2. PANTALLA DE ÉXITO CUANDO SE COMPLETA LA IMPORTACIÓN */}
      {importSuccessResult && (
        <Card className="border-2 border-emerald-500/50 bg-emerald-500/5 shadow-md animate-in fade-in-50 duration-300">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-6 w-6" />
              <CardTitle className="text-xl font-bold">¡Resultados Importados y Destinados con Éxito!</CardTitle>
            </div>
            <CardDescription className="text-foreground/80">
              Torneo: <span className="font-semibold text-foreground">{importSuccessResult.meetName}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* KPIs de Resultados */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="rounded-lg border bg-card p-3 text-center">
                <span className="text-xs text-muted-foreground">Resultados Guardados</span>
                <p className="font-mono text-2xl font-bold text-primary">{importSuccessResult.resultsImported}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center">
                <span className="text-xs text-muted-foreground">Clubes Sincronizados</span>
                <p className="font-mono text-2xl font-bold text-foreground">{importSuccessResult.clubsCount}</p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center">
                <span className="text-xs text-muted-foreground">Atletas Vinculados</span>
                <p className="font-mono text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                  {importSuccessResult.athletesMatched}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-3 text-center">
                <span className="text-xs text-muted-foreground">Nuevos Atletas</span>
                <p className="font-mono text-2xl font-bold text-foreground">{importSuccessResult.athletesNew}</p>
              </div>
            </div>

            {/* Resumen de Destinos Aplicados */}
            <div className="rounded-md border bg-card p-3 text-xs space-y-1">
              <span className="font-semibold text-muted-foreground uppercase tracking-wider">Destinos actualizados:</span>
              <div className="flex flex-wrap gap-2 pt-1">
                {importSuccessResult.stateRankingSaved && (
                  <Badge className="bg-primary/10 text-primary border-primary/20">
                    🏆 Rankings y Marcas del Club Actualizados
                  </Badge>
                )}
                {importSuccessResult.myClubSaved && (
                  <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20">
                    🏊 Fichas y Logros de Mi Club Actualizados
                  </Badge>
                )}
                {importSuccessResult.officialCircuitSaved && (
                  <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20">
                    📋 Circuito Oficial ADAEL 2026 ({importSuccessResult.officialCircuitCount} marcas)
                  </Badge>
                )}
                {importSuccessResult.teamDatabasesSynced && (
                  <Badge className="bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20">
                    🏛️ Base de Datos de Equipos ({importSuccessResult.clubsCount} clubes) Sincronizada
                  </Badge>
                )}
              </div>
            </div>

            {/* BOTONES DE NAVEGACIÓN INMEDIATA A DESTINOS */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button asChild size="default" className="gap-2 bg-primary font-semibold shadow-sm">
                <Link to="/rankings">
                  <Trophy className="h-4 w-4" />
                  Ver Rankings del Club
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>

              <Button asChild variant="outline" size="default" className="gap-2">
                <Link to="/clubs" search={{ tab: "directory" }}>
                  <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                  Ver Atletas por Club
                </Link>
              </Button>

              <Button asChild variant="outline" size="default" className="gap-2">
                <Link to="/athletes">
                  <Users className="h-4 w-4 text-primary" />
                  Mis Atletas
                </Link>
              </Button>

              <Button asChild variant="outline" size="default" className="gap-2">
                <Link to="/ranking-adael-2026">
                  <Trophy className="h-4 w-4 text-amber-500" />
                  Circuito ADAEL 2026
                </Link>
              </Button>

              <Button variant="ghost" size="default" onClick={handleReset} className="gap-2 ml-auto">
                <RotateCcw className="h-4 w-4" />
                Importar Otro Torneo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 3. PASO 1: ENTRADA UNIFICADA (Si no hay datos parseados pendientes) */}
      {!parsedData && !importSuccessResult && (
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-primary" />
              1. Elige cómo deseas subir los resultados
            </CardTitle>
            <CardDescription>
              Aceptamos todos los formatos estándar de natación venezolana e internacional.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Tabs value={inputTab} onValueChange={(v) => setInputTab(v as any)} className="space-y-4">
              <TabsList className="grid w-full grid-cols-3 max-w-xl">
                <TabsTrigger value="file" className="gap-2 text-xs font-semibold">
                  <FileText className="h-4 w-4" />
                  Subir Archivo
                </TabsTrigger>
                <TabsTrigger value="link" className="gap-2 text-xs font-semibold">
                  <Globe className="h-4 w-4" />
                  Enlace Web ADAEL/FEVEDA
                </TabsTrigger>
                <TabsTrigger value="paste" className="gap-2 text-xs font-semibold">
                  <ClipboardPaste className="h-4 w-4" />
                  Pegar Tabla de Texto
                </TabsTrigger>
              </TabsList>

              {/* TAB 1: SUBIR ARCHIVOS (.hy3, .cl2, .sd3, .ev3, .zip, .pdf, .mdb) */}
              <TabsContent value="file" className="space-y-4">
                <label
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card/50 p-10 text-center transition-all hover:border-primary hover:bg-muted/40 ${
                    isDragging ? "border-primary bg-primary/5 scale-[1.005]" : "border-muted-foreground/25"
                  }`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragging(false);
                    handleFileDropOrPick(e.dataTransfer.files);
                  }}
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                    <UploadCloud className="h-7 w-7" />
                  </div>
                  <span className="font-display text-xl font-bold uppercase tracking-tight">
                    {isDragging ? "Suelta aquí tu archivo de natación" : "Arrastra o haz clic para subir"}
                  </span>
                  <p className="mt-1.5 text-xs text-muted-foreground max-w-md">
                    Formatos admitidos: <span className="font-semibold text-foreground">.hy3, .cl2, .sd3, .zip</span> (con
                    descompresión recursiva automática), <span className="font-semibold text-foreground">.pdf</span> (Meet
                    Manager) o <span className="font-semibold text-foreground">.mdb</span> (Access).
                  </p>
                  <input
                    type="file"
                    aria-label="Elegir archivo para importar"
                    accept=".hy3,.cl2,.sd3,.ev3,.hyv,.zip,.pdf,.mdb,application/pdf"
                    disabled={isReadingFile}
                    className="hidden"
                    onChange={(e) => {
                      handleFileDropOrPick(e.target.files);
                      e.target.value = "";
                    }}
                  />
                </label>

                {isReadingFile && (
                  <div className="flex items-center justify-center gap-2 text-sm text-primary py-2 font-medium">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Leyendo y desglosando archivo...</span>
                  </div>
                )}
              </TabsContent>

              {/* TAB 2: ENLACE WEB OFICIAL (ADAEL / FEVEDA) */}
              <TabsContent value="link" className="space-y-4">
                <div className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1">
                      <Link2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="https://www.adael.com.ve/3erEstadalADAEL2026/index.htm"
                        value={linkUrl}
                        onChange={(e) => setLinkUrl(e.target.value)}
                        disabled={isFetchingLink}
                        className="pl-9 text-xs"
                      />
                    </div>
                    <Button
                      onClick={() => handleFetchLink()}
                      disabled={isFetchingLink || !linkUrl.trim()}
                      className="gap-2 bg-primary font-semibold text-xs shrink-0"
                    >
                      {isFetchingLink ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Conectando...
                        </>
                      ) : (
                        <>
                          <Globe className="h-4 w-4" />
                          Conectar y Extraer
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Atajos Rápidos de 1 Clic con los 7 Torneos Oficiales 2026 */}
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-foreground/80 uppercase tracking-wider flex items-center gap-1.5">
                        <Trophy className="h-3.5 w-3.5 text-amber-500" />
                        Torneos Oficiales 2026 (Haz clic para extraer al instante):
                      </span>
                      <span className="text-[11px] text-muted-foreground">7 competencias oficiales venezolanas</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const u = "https://natacionvenezuela.com/2026/lara/";
                          setLinkUrl(u);
                          handleFetchLink(u);
                        }}
                        className="flex flex-col text-left p-2.5 rounded-lg border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-primary group-hover:underline">🏊 I Estadal Lara 2026</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-primary/40 text-primary">Lara</Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-0.5 truncate">Piscinas Bolivarianas (ADAEL)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const u = "http://www.adael.com.ve/3erEstadalADAEL2026/";
                          setLinkUrl(u);
                          handleFetchLink(u);
                        }}
                        className="flex flex-col text-left p-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-emerald-700 dark:text-emerald-300 group-hover:underline">🛡️ 3er Estadal ADAEL 2026</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-emerald-500/40 text-emerald-600">ADAEL</Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-0.5 truncate">Portal Oficial adael.com.ve</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const u = "https://natacionvenezuela.com/2026/occidente/";
                          setLinkUrl(u);
                          handleFetchLink(u);
                        }}
                        className="flex flex-col text-left p-2.5 rounded-lg border border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-sky-700 dark:text-sky-300 group-hover:underline">🌊 Regional Occidente 2026</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-sky-500/40 text-sky-600">Occidente</Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-0.5 truncate">FEVEDA / ADAEF (172 pruebas)</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const u = "https://feveda.org/2026/jdnj/";
                          setLinkUrl(u);
                          handleFetchLink(u);
                        }}
                        className="flex flex-col text-left p-2.5 rounded-lg border border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-amber-700 dark:text-amber-300 group-hover:underline">🏅 JDNJ FEVEDA 2026</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-amber-500/40 text-amber-600">Nacional</Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-0.5 truncate">Juegos Deportivos Nacionales</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const u = "https://feveda.org/2026/nacionalcategorias/";
                          setLinkUrl(u);
                          handleFetchLink(u);
                        }}
                        className="flex flex-col text-left p-2.5 rounded-lg border border-purple-500/20 bg-purple-500/5 hover:bg-purple-500/10 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-purple-700 dark:text-purple-300 group-hover:underline">🏆 Nac. Categorías 2026</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-purple-500/40 text-purple-600">Nacional</Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-0.5 truncate">FEVEDA Categorías</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const u = "https://feveda.org/2026/infantil/";
                          setLinkUrl(u);
                          handleFetchLink(u);
                        }}
                        className="flex flex-col text-left p-2.5 rounded-lg border border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-indigo-700 dark:text-indigo-300 group-hover:underline">🧒 Nacional Infantil 2026</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-indigo-500/40 text-indigo-600">Nacional</Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-0.5 truncate">FEVEDA Infantil A y B</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          const u = "https://feveda.org/2026/juvenil/";
                          setLinkUrl(u);
                          handleFetchLink(u);
                        }}
                        className="flex flex-col text-left p-2.5 rounded-lg border border-pink-500/20 bg-pink-500/5 hover:bg-pink-500/10 transition-all group"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-xs text-pink-700 dark:text-pink-300 group-hover:underline">🌟 Nacional Juvenil 2026</span>
                          <Badge variant="outline" className="text-[10px] py-0 px-1 border-pink-500/40 text-pink-600">Nacional</Badge>
                        </div>
                        <span className="text-[11px] text-muted-foreground mt-0.5 truncate">FEVEDA Juvenil A y B</span>
                      </button>
                    </div>
                  </div>

                  {/* Detección de múltiples enlaces en el texto pegado */}
                  {extractUrlsFromText(linkUrl).length > 1 && (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-primary">
                          📋 Se detectaron {extractUrlsFromText(linkUrl).length} enlaces en tu texto (haz clic en cualquiera para importar):
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {extractUrlsFromText(linkUrl).map((u, idx) => {
                          const meta = parseMeetUrlInfo(u);
                          return (
                            <Button
                              key={idx}
                              size="sm"
                              variant="secondary"
                              className="h-7 text-xs gap-1.5 border"
                              onClick={() => {
                                setLinkUrl(u);
                                handleFetchLink(u);
                              }}
                            >
                              <span>{meta.meetName || u}</span>
                            </Button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Toggle para sitios con JS redirect */}
                  <div className="flex items-center gap-2 pt-2 text-xs text-muted-foreground">
                    <Checkbox
                      id="allow-browser-hub"
                      checked={allowBrowser}
                      onCheckedChange={(c) => setAllowBrowser(Boolean(c))}
                    />
                    <label htmlFor="allow-browser-hub" className="cursor-pointer">
                      Activar modo navegador (recomendado si el sitio usa JavaScript dinámico o frameset)
                    </label>
                  </div>

                  {/* ALERTA DE BLOQUEO 530 / CLOUDFLARE CON SOLUCIÓN DIRECTA */}
                  {blockedHostError && (
                    <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 text-xs space-y-2">
                      <div className="flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
                        <ShieldAlert className="h-4 w-4 shrink-0" />
                        <span>Servidor protegido o no disponible (Error 530 / Firewall en {blockedHostError.hostname})</span>
                      </div>
                      <p className="text-muted-foreground">
                        El servidor web bloqueó la conexión automática. Para solucionarlo en 5 segundos sin complicaciones:
                      </p>
                      <div className="flex flex-wrap items-center gap-2 pt-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setInputTab("paste")}
                          className="h-7 text-xs gap-1.5"
                        >
                          <ClipboardPaste className="h-3.5 w-3.5" />
                          Usar «Pegar Tabla de Texto» (100% Inmune)
                        </Button>
                        <a
                          href={blockedHostError.targetUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-primary underline"
                        >
                          Abrir página en otra pestaña <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Lista de Campeonatos FEVEDA detectados si aplica */}
                  {fevedaMeets && (
                    <div className="rounded-lg border bg-card p-3 space-y-2">
                      <span className="text-xs font-semibold text-muted-foreground">Campeonatos encontrados en FEVEDA:</span>
                      <div className="divide-y max-h-48 overflow-y-auto">
                        {fevedaMeets.map((m, idx) => (
                          <div key={idx} className="flex items-center justify-between py-2 text-xs">
                            <span className="font-medium text-foreground">{(m as any).title ?? (m as any).name}</span>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleFetchLink(m.url)}
                              className="h-6 text-xs"
                            >
                              Extraer
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {isFetchingLink && linkProgressText && (
                    <div className="flex items-center gap-2 text-xs text-primary font-medium py-1">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{linkProgressText}</span>
                    </div>
                  )}
                </div>
              </TabsContent>

              {/* TAB 3: PEGAR TABLA DE TEXTO DIRECTO (Inmune a 530) */}
              <TabsContent value="paste" className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Copia la tabla o reporte de resultados desde tu navegador o PDF y pégalo aquí:</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handlePasteFromClipboard}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    Pegar del Portapapeles
                  </Button>
                </div>

                <Textarea
                  placeholder={`Ejemplo:\nPrueba 1 50m Libre Femenino 12-13\n1 PEREZ, MARIA        13 HOCAL   30.50\n2 GOMEZ, ANA          12 JSWIM   31.20\n3 SUAREZ, SOFIA       13 PIBOL   32.10`}
                  value={pastedText}
                  onChange={(e) => setPastedText(e.target.value)}
                  disabled={isProcessingText}
                  rows={8}
                  className="font-mono text-xs"
                />

                <div className="flex items-center justify-between pt-1">
                  <span className="text-xs text-muted-foreground">
                    💡 <span className="font-medium">Ventaja:</span> Inmune a bloqueos 530, firewalls o CAPTCHAs.
                  </span>
                  <Button
                    onClick={handleProcessPastedText}
                    disabled={isProcessingText || !pastedText.trim()}
                    className="gap-2 bg-primary font-semibold text-xs"
                  >
                    {isProcessingText ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Procesando...
                      </>
                    ) : (
                      <>
                        <Check className="h-4 w-4" />
                        Procesar Texto
                      </>
                    )}
                  </Button>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* 4. PASO 2: PREVISUALIZACIÓN Y ELECCIÓN DE DESTINOS (Cuando hay datos listos) */}
      {parsedData && !importSuccessResult && (
        <div className="space-y-6">
          {/* Card A: Ficha Editable de la Competencia */}
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Database className="h-5 w-5 text-primary" />
                    2. Datos de la Competencia Detectada
                  </CardTitle>
                  <CardDescription>Origen: {sourceName}</CardDescription>
                </div>
                <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs gap-1.5 text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                  Cambiar archivo
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Nombre de la Competencia</label>
                  <Input
                    value={meetName}
                    onChange={(e) => setMeetName(e.target.value)}
                    placeholder="Ej. 3er Campeonato Estadal ADAEL 2026"
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Fecha de Inicio</label>
                  <Input
                    type="date"
                    value={meetStartDate}
                    onChange={(e) => {
                      setMeetStartDate(e.target.value);
                      if (!meetEndDate || meetEndDate < e.target.value) setMeetEndDate(e.target.value);
                    }}
                    className="text-xs h-9"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-muted-foreground">Tipo de Piscina (Curso)</label>
                  <Select value={meetCourse} onValueChange={(v) => setMeetCourse(v as any)}>
                    <SelectTrigger className="text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LCM">50m · LCM (Olímpica)</SelectItem>
                      <SelectItem value="SCM">25m · SCM (Piscina Corta)</SelectItem>
                      <SelectItem value="SCY">25yd · SCY (Yardas)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Indicadores Rápidos Detectados */}
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 pt-1">
                <div className="rounded-lg bg-muted/40 p-2.5 text-center border">
                  <span className="text-[11px] text-muted-foreground uppercase">Nadadores</span>
                  <p className="font-mono text-xl font-bold text-foreground">{parsedData.athletes.length}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5 text-center border">
                  <span className="text-[11px] text-muted-foreground uppercase">Marcas con Tiempo</span>
                  <p className="font-mono text-xl font-bold text-primary">
                    {parsedData.results.filter((r) => r.finalMs && r.finalMs > 0).length}
                  </p>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5 text-center border">
                  <span className="text-[11px] text-muted-foreground uppercase">Clubes Detectados</span>
                  <p className="font-mono text-xl font-bold text-foreground">{parsedData.teams.length}</p>
                </div>
                <div className="rounded-lg bg-muted/40 p-2.5 text-center border">
                  <span className="text-[11px] text-muted-foreground uppercase">Categorías</span>
                  <p className="font-mono text-xl font-bold text-foreground">{detectedCategories.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Card B: ELECCIÓN DE DESTINOS (¿A dónde deseas destinar los resultados?) */}
          <Card className="border-2 border-primary/30 shadow-md">
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-xl font-bold flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-primary" />
                    3. Elige el destino de los resultados
                  </CardTitle>
                  <CardDescription>
                    Marca los módulos donde deseas canalizar y guardar los resultados de este torneo.
                  </CardDescription>
                </div>

                {/* Presets de 1 Clic */}
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button
                    size="sm"
                    variant={selectedPreset === "my_club_only" ? "default" : "outline"}
                    onClick={() => handleApplyPreset("my_club_only")}
                    className="h-7 text-xs font-semibold gap-1"
                  >
                    🏊 Solo Mi Equipo (Recomendado)
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedPreset === "entry_lists" ? "default" : "outline"}
                    onClick={() => handleApplyPreset("entry_lists")}
                    className="h-7 text-xs font-semibold gap-1"
                  >
                    📋 Entry Lists
                  </Button>
                  <Button
                    size="sm"
                    variant={selectedPreset === "all_in_one" ? "default" : "outline"}
                    onClick={() => handleApplyPreset("all_in_one")}
                    className="h-7 text-xs font-semibold gap-1"
                  >
                    ⚡ Torneo Completo
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* SELECTOR Y AUDITORÍA DE CLUB A IMPORTAR */}
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Equipo a Importar:
                  </span>
                  <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 text-xs font-semibold">
                    🛡️ Modo Equipo Exclusivo Activado
                  </Badge>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <Select
                    value={Array.from(selectedClubCodes)[0] || detectedClubs[0]?.code || "JSWIM"}
                    onValueChange={(val) => {
                      setSelectedClubCodes(new Set([val]));
                      const found = detectedClubs.find((c) => c.code === val);
                      if (found) {
                        toast.info(`Seleccionado ${found.name} (${found.resultCount} marcas, ${found.athleteCount} nadadores).`);
                      }
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-96 h-9 text-xs font-semibold bg-background">
                      <SelectValue placeholder="Selecciona tu equipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {detectedClubs.map((c) => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.code} — {c.name} ({c.athleteCount} nadadores · {c.resultCount} marcas)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <p className="text-xs text-muted-foreground">
                    Solo se guardarán los nadadores y marcas de este equipo. Los datos de los demás clubes se descartan automáticamente para no alterar tu base de datos.
                  </p>
                </div>
              </div>
              {/* TARJETAS DE DESTINO CON CHECKBOX (4 DESTINOS) */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {/* DESTINO 1: RANKING Y MARCAS DEL CLUB */}
                <div
                  onClick={() => handleToggleDestination("stateRanking")}
                  className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                    destinations.stateRanking
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-muted hover:border-muted-foreground/30 opacity-70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Trophy className="h-4 w-4 text-primary" />
                        <span className="font-bold text-sm text-foreground">Rankings del Club</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] py-0 border-primary/30 text-primary">
                        Marcas y Mejores Tiempos
                      </Badge>
                    </div>
                    <Checkbox
                      checked={destinations.stateRanking}
                      onCheckedChange={() => handleToggleDestination("stateRanking")}
                    />
                  </div>
                  <p className="mt-2.5 text-xs text-muted-foreground">
                    Actualiza las marcas oficiales, mejores tiempos personales (PB) y clasificación de los nadadores del club.
                  </p>
                </div>

                {/* DESTINO 2: MIS ATLETAS Y MI CLUB */}
                <div
                  onClick={() => handleToggleDestination("myClub")}
                  className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                    destinations.myClub
                      ? "border-emerald-500 bg-emerald-500/5 shadow-sm"
                      : "border-muted hover:border-muted-foreground/30 opacity-70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Users className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                        <span className="font-bold text-sm text-foreground">Mis Atletas / Mi Club</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] py-0 border-emerald-500/30 text-emerald-600">
                        Marcas Personales (PB)
                      </Badge>
                    </div>
                    <Checkbox
                      checked={destinations.myClub}
                      onCheckedChange={() => handleToggleDestination("myClub")}
                    />
                  </div>
                  <p className="mt-2.5 text-xs text-muted-foreground">
                    Vincula los tiempos a tus atletas registrados ({myClubCode}) para actualizar sus mejores marcas personales e historial.
                  </p>
                </div>

                {/* DESTINO 3: CIRCUITO OFICIAL ADAEL 2026 */}
                <div
                  onClick={() => handleToggleDestination("officialCircuit")}
                  className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                    destinations.officialCircuit
                      ? "border-amber-500 bg-amber-500/5 shadow-sm"
                      : "border-muted hover:border-muted-foreground/30 opacity-70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="h-4 w-4 text-amber-500" />
                        <span className="font-bold text-sm text-foreground">Circuito ADAEL 2026</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] py-0 border-amber-500/30 text-amber-600">
                        Marcas Mínimas
                      </Badge>
                    </div>
                    <Checkbox
                      checked={destinations.officialCircuit}
                      onCheckedChange={() => handleToggleDestination("officialCircuit")}
                    />
                  </div>
                  <p className="mt-2.5 text-xs text-muted-foreground">
                    Registra en el calendario oficial 2026 (<code className="text-[10px]">meets_2026</code>,{" "}
                    <code className="text-[10px]">official_results_2026</code>) para marcas mínimas.
                  </p>
                </div>

                {/* DESTINO 4: BASE DE DATOS DE EQUIPOS Y ATLETAS POR CLUB */}
                <div
                  onClick={() => handleToggleDestination("teamDatabases")}
                  className={`cursor-pointer rounded-xl border-2 p-4 transition-all ${
                    destinations.teamDatabases
                      ? "border-indigo-500 bg-indigo-500/5 shadow-sm"
                      : "border-muted hover:border-muted-foreground/30 opacity-70"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                        <span className="font-bold text-sm text-foreground">Equipos y Rosters</span>
                      </div>
                      <Badge variant="outline" className="text-[10px] py-0 border-indigo-500/30 text-indigo-600">
                        Atletas por Club
                      </Badge>
                    </div>
                    <Checkbox
                      checked={destinations.teamDatabases}
                      onCheckedChange={() => handleToggleDestination("teamDatabases")}
                    />
                  </div>
                  <p className="mt-2.5 text-xs text-muted-foreground">
                    Crea y sincroniza la base de datos de cada club con todos los atletas que lo representan y sus pruebas inscritas.
                  </p>
                </div>
              </div>

              {/* Acordeón Opcional: Filtro y Auditoría de Clubes */}
              <div className="border-t pt-3">
                <button
                  type="button"
                  onClick={() => setShowClubFilter((prev) => !prev)}
                  className="flex w-full items-center justify-between text-xs font-semibold text-muted-foreground hover:text-foreground py-1"
                >
                  <span className="flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5" />
                    Inspeccionar y filtrar clubes detectados ({selectedClubCodes.size} de {detectedClubs.length}{" "}
                    seleccionados)
                  </span>
                  {showClubFilter ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>

                {showClubFilter && (
                  <div className="mt-3 space-y-3 rounded-lg border bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelectAllClubs(true)}
                        className="h-6 text-[11px]"
                      >
                        Seleccionar Todos
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={handleSelectOnlyLaraClubs}
                        className="h-6 text-[11px]"
                      >
                        Solo Clubes de Lara
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSelectAllClubs(false)}
                        className="h-6 text-[11px] text-destructive"
                      >
                        Deseleccionar Todos
                      </Button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 max-h-48 overflow-y-auto pt-1">
                      {detectedClubs.map((club) => {
                        const isChecked = selectedClubCodes.has(club.code);
                        return (
                          <div
                            key={club.code}
                            onClick={() => handleToggleClub(club.code)}
                            className={`flex cursor-pointer items-center justify-between rounded-md border p-2 text-xs transition-colors ${
                              isChecked ? "border-primary/50 bg-primary/5" : "border-muted bg-card opacity-50"
                            }`}
                          >
                            <div className="min-w-0 pr-1">
                              <span className="font-bold text-foreground truncate block">{club.code}</span>
                              <span className="text-[10px] text-muted-foreground truncate block">{club.name}</span>
                            </div>
                            <Checkbox checked={isChecked} onCheckedChange={() => handleToggleClub(club.code)} />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Barra de Progreso durante la Importación */}
              {isImporting && importProgress !== null && (
                <div className="space-y-1.5 pt-2">
                  <div className="flex items-center justify-between text-xs text-primary font-medium">
                    <span className="flex items-center gap-1.5">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {importStatusStage || "Importando resultados..."}
                    </span>
                    <span>{importProgress}%</span>
                  </div>
                  <Progress value={importProgress} className="h-2" />
                </div>
              )}

              {/* BOTÓN PRINCIPAL DE ACCIÓN */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3">
                <Button variant="outline" size="sm" onClick={handleReset} disabled={isImporting} className="text-xs">
                  Cancelar
                </Button>

                <Button
                  size="lg"
                  onClick={handleConfirmImport}
                  disabled={isImporting || selectedClubCodes.size === 0}
                  className="gap-2 bg-primary font-bold shadow-md text-sm px-6"
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Importando a los destinos...
                    </>
                  ) : (
                    <>
                      <Check className="h-4 w-4" />
                      Confirmar e Importar al Sistema
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
