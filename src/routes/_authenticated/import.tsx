import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { readHytekFile, type ParsedFile } from "@/lib/hytek";
import { importParsed, type ImportSummary } from "@/lib/importer";
import { PdfResultsImport } from "@/components/pdf-results-import";
import { ResultsLinkImport } from "@/components/results-link-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { readAccessFile, normalizeAccess, type AccessDatabase, type AccessTimeUnit } from "@/lib/access";
import { AccessPreview } from "@/components/access-preview";
import { formatTime, eventLabel } from "@/lib/swim";
import { ResetData } from "@/components/reset-data";
import { EventSetupPreview } from "@/components/event-setup-preview";
import { Trash2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/import")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Importar resultados y eventos Hy-Tek — Swim Lane Coach" }, { name: "description", content: "Revisa eventos EV3/HYV, resultados HY3/CL2/SD3, ZIP y Access antes de guardar tus competencias." }, { property: "og:title", content: "Importar resultados y eventos Hy-Tek — Swim Lane Coach" }, { property: "og:description", content: "Carga y revisa pruebas, edades, piscinas y límites de inscripción de Meet Manager." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  component: ImportPage,
});

function ImportPage() {
  const qc = useQueryClient();
  const [files, setFiles] = useState<{ name: string; parsed: ParsedFile }[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState<ImportSummary[]>([]);
  const [dragging, setDragging] = useState(false);
  const [access, setAccess] = useState<{ db: AccessDatabase; unit: AccessTimeUnit; course: string }[]>([]);
  const [reading, setReading] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const accessFiles = access.flatMap(({ db, unit, course }) => normalizeAccess(db, unit, course).filter((parsed) => parsed.athletes.length > 0).map((parsed) => ({ name: db.name, parsed })));
  const pending = [...files, ...accessFiles];

  function updateFileMeet(fileIndex: number, patch: Partial<ParsedFile["meet"]>) {
    setFiles(prev => prev.map((item, i) => {
      if (i !== fileIndex) return item;
      return {
        ...item,
        parsed: {
          ...item.parsed,
          meet: {
            ...item.parsed.meet,
            ...patch,
          },
        },
      };
    }));
  }

  function removeFile(fileIndex: number) {
    setFiles(prev => prev.filter((_, i) => i !== fileIndex));
  }

  async function onPick(list: FileList | null) {
    if (!list || reading || progress != null) return;
    setReading(true);
    setErrors([]);
    const databases: typeof access = [];
    const all: { name: string; parsed: ParsedFile }[] = [];
    const today = new Date().toISOString().slice(0, 10);
    for (const f of Array.from(list)) {
      try {
        if (/\.mdb$/i.test(f.name)) {
          databases.push({ db: await readAccessFile(f), unit: "seconds", course: "LCM" });
          continue;
        }
        const r = await readHytekFile(f);
        if (!r.length) toast.error(`${f.name}: formato no reconocido`);
        for (const item of r) {
          item.parsed.meet = {
            ...item.parsed.meet,
            name: item.parsed.meet.name?.trim() || f.name.replace(/\.[^.]+$/, "").trim() || "Competencia",
            startDate: item.parsed.meet.startDate || today,
            endDate: item.parsed.meet.endDate || item.parsed.meet.startDate || today,
            course: (item.parsed.meet.course === "LCM" || item.parsed.meet.course === "SCM" || item.parsed.meet.course === "SCY") ? item.parsed.meet.course : "LCM",
          };
        }
        all.push(...r);
      } catch (e) {
        const message = `${f.name}: ${e instanceof Error ? e.message : "No se pudo leer el archivo. Revisa la exportación."}`;
        setErrors(prev => [...prev, message]);
        toast.error(message);
      }
    }
    setFiles(all);
    setAccess(databases);
    setDone([]);
    setReading(false);
  }

  async function run() {
    if (pending.some(f => f.parsed.events && (!f.parsed.events.length || !f.parsed.meet.name.trim() || !f.parsed.meet.startDate || !f.parsed.meet.endDate || f.parsed.meet.endDate < f.parsed.meet.startDate))) {
      toast.error("Revisa el nombre, fechas y selecciona al menos una prueba en la convocatoria.");
      return;
    }

    for (const f of pending) {
      if (!f.parsed.meet.name?.trim()) {
        toast.error(`Indica el nombre de la competencia para "${f.name}".`);
        return;
      }
      if (!f.parsed.meet.startDate) {
        toast.error(`Indica la fecha de la competencia para "${f.name}".`);
        return;
      }
      if (!["LCM", "SCM", "SCY"].includes(f.parsed.meet.course)) {
        toast.error(`Selecciona la piscina (50m o 25m) para "${f.name}".`);
        return;
      }
      if (!f.parsed.athletes.length) {
        toast.error(`"${f.name}" no tiene atletas seleccionados. Vincula al menos a un atleta.`);
        return;
      }
    }

    const summaries: ImportSummary[] = [];
    setProgress(0);
    try {
      for (const [i, f] of pending.entries()) {
        const s = await importParsed(f.name, f.parsed, (p) => setProgress(Math.round(((i + p / 100) / pending.length) * 100)));
        summaries.push(s);
      }
      setDone(summaries);
      setFiles([]);
      setAccess([]);
      toast.success("Importación completada con éxito.");
      qc.invalidateQueries();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setProgress(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold uppercase">Importar</h1>
        <p className="text-muted-foreground">Eventos: .ev3 y .hyv · Resultados e inscripciones: .hy3, .cl2, .sd3 · ZIP y Access (.mdb)</p>
      </div>

      <label
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card p-10 text-center transition-colors hover:border-primary ${dragging ? "border-primary bg-muted" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onPick(e.dataTransfer.files);
        }}
      >
        <span className="font-display text-2xl font-semibold uppercase">{dragging ? "Suelta aquí" : "Arrastra o elige archivos"}</span>
        <span className="mt-1 text-sm text-muted-foreground">Puedes seleccionar varios a la vez</span>
        <input type="file" aria-label="Elegir archivos para importar" multiple accept=".hy3,.cl2,.sd3,.ev3,.hyv,.zip,.mdb" disabled={reading || progress != null} className="hidden" onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} />
      </label>

      <ResultsLinkImport
        disabled={reading || progress != null}
        onParsed={(name, parsed) => {
          const today = new Date().toISOString().slice(0, 10);
          const safeParsed: ParsedFile = {
            ...parsed,
            meet: {
              ...parsed.meet,
              name: parsed.meet.name?.trim() || name || "Torneo FEVEDA",
              startDate: parsed.meet.startDate || today,
              endDate: parsed.meet.endDate || parsed.meet.startDate || today,
              course: (parsed.meet.course === "LCM" || parsed.meet.course === "SCM" || parsed.meet.course === "SCY") ? parsed.meet.course : "LCM",
            },
          };
          setFiles((prev) => [...prev, { name: safeParsed.meet.name, parsed: safeParsed }]);
          setDone([]);
        }}
      />
      <PdfResultsImport
        disabled={reading || progress != null}
        onParsed={(name, parsed) => {
          const today = new Date().toISOString().slice(0, 10);
          const safeParsed: ParsedFile = {
            ...parsed,
            meet: {
              ...parsed.meet,
              name: parsed.meet.name?.trim() || name.replace(/\.pdf$/i, "") || "Torneo de Natación",
              startDate: parsed.meet.startDate || today,
              endDate: parsed.meet.endDate || parsed.meet.startDate || today,
              course: (parsed.meet.course === "LCM" || parsed.meet.course === "SCM" || parsed.meet.course === "SCY") ? parsed.meet.course : "LCM",
            },
          };
          setFiles((prev) => [...prev, { name: safeParsed.meet.name, parsed: safeParsed }]);
          setDone([]);
        }}
      />
      {reading && <p role="status" className="text-muted-foreground">Leyendo archivos…</p>}
      {errors.length > 0 && <div role="alert" className="space-y-2 rounded-md border border-destructive p-4 text-sm text-destructive">{errors.map((error, i) => <p className="break-words" key={i}>{error}</p>)}</div>}
      {access.map((a, i) => <div key={`${a.db.name}-${i}`} className="min-w-0 space-y-3">
        <AccessPreview db={a.db} unit={a.unit} course={a.course} onUnit={(unit) => setAccess((prev) => prev.map((v, j) => j === i ? { ...v, unit } : v))} onCourse={(course) => setAccess((prev) => prev.map((v, j) => j === i ? { ...v, course } : v))} />
        {!normalizeAccess(a.db, a.unit, a.course).some((p) => p.athletes.length > 0) && <p role="alert" className="text-sm text-destructive">No hay atletas con columnas reconocidas. No se guardará esta base; conserva el original y proporciona un archivo de ejemplo para adaptar sus campos.</p>}
        <p className="text-xs text-muted-foreground">Solo se guardarán los datos del resumen siguiente. Las tablas y columnas no reconocidas permanecen en tu archivo original.</p>
      </div>)}

      {pending.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold uppercase">Archivos listos para importar ({pending.length})</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setFiles([]); setAccess([]); }}
              disabled={progress != null}
            >
              Limpiar lista
            </Button>
          </div>
          {pending.map((f, fileIndex) => {
            const isFromFiles = fileIndex < files.length;
            const withTimes = f.parsed.results.filter((r) => r.finalMs).length;
            const splits = f.parsed.results.reduce((n, r) => n + r.splits.length, 0);
            return (
              <div key={`${f.name}-${fileIndex}`} className="space-y-3 rounded-lg border bg-card p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                  <div className="min-w-0">
                    <span className="font-display text-xl font-semibold uppercase">{f.parsed.meet.name || f.name}</span>
                    <p className="time break-all text-xs text-muted-foreground">{f.name} · {f.parsed.format} · Piscina: {f.parsed.meet.course}</p>
                  </div>
                  {isFromFiles && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:bg-destructive/10"
                      disabled={progress != null}
                      onClick={() => removeFile(fileIndex)}
                      aria-label={`Quitar ${f.name}`}
                    >
                      <Trash2 className="mr-1.5 size-4" />
                      Quitar archivo
                    </Button>
                  )}
                </div>

                {/* Editable meet details (Name, Date, Pool Course) */}
                {isFromFiles && (
                  <div className="grid gap-3 rounded-md border bg-muted/40 p-3 sm:grid-cols-3">
                    <label className="space-y-1 text-xs font-medium">
                      Nombre de la competencia
                      <Input
                        aria-label="Nombre de la competencia"
                        value={f.parsed.meet.name}
                        disabled={progress != null}
                        onChange={(e) => updateFileMeet(fileIndex, { name: e.target.value })}
                        placeholder="Ej. Torneo FEVEDA 2026"
                        className="h-8 text-xs"
                      />
                    </label>
                    <label className="space-y-1 text-xs font-medium">
                      Fecha de inicio
                      <Input
                        aria-label="Fecha de la competencia"
                        type="date"
                        value={f.parsed.meet.startDate ?? ""}
                        disabled={progress != null}
                        onChange={(e) => updateFileMeet(fileIndex, { startDate: e.target.value, endDate: f.parsed.meet.endDate || e.target.value })}
                        className="h-8 text-xs"
                      />
                    </label>
                    <div className="space-y-1 text-xs font-medium">
                      Piscina
                      <Select
                        value={f.parsed.meet.course ?? "LCM"}
                        disabled={progress != null}
                        onValueChange={(course) => updateFileMeet(fileIndex, { course })}
                      >
                        <SelectTrigger aria-label="Piscina de la competencia" className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="LCM">50 m · LCM (Piscina Olímpica)</SelectItem>
                          <SelectItem value="SCM">25 m · SCM (Piscina Corta)</SelectItem>
                          <SelectItem value="SCY">25 yd · SCY (Yardas)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                )}

                <div className="time grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                  <span className="rounded bg-muted/50 p-1.5 text-center">{f.parsed.teams.length} clubes</span>
                  <span className="rounded bg-muted/50 p-1.5 text-center font-medium text-primary">{f.parsed.athletes.length} atletas</span>
                  <span className="rounded bg-muted/50 p-1.5 text-center">{f.parsed.results.length} nados</span>
                  <span className="rounded bg-muted/50 p-1.5 text-center">{withTimes} con tiempo</span>
                  <span className="rounded bg-muted/50 p-1.5 text-center">{splits} parciales</span>
                </div>

                {f.parsed.athletes.length === 0 && (
                  <div role="alert" className="flex items-center gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-2.5 text-xs text-destructive">
                    <AlertTriangle className="size-4 shrink-0" />
                    <span>No se encontraron atletas vinculados a tu club en este archivo. Revisa que tus atletas estén registrados en la sección «Atletas».</span>
                  </div>
                )}

                {f.parsed.events && <EventSetupPreview parsed={f.parsed} disabled={progress != null} onChange={parsed => setFiles(prev => prev.map((file, i) => i === fileIndex ? { ...file, parsed } : file))} />}
                {!f.parsed.events && withTimes === 0 && <p role="alert" className="text-xs text-accent">No se detectaron tiempos finales. Solo se guardarán atletas e inscripciones; las marcas existentes se conservarán.</p>}
                {f.parsed.warnings.map((warning, i) => <p key={i} className="break-words text-xs text-destructive">{warning}</p>)}
                {f.parsed.format === "MDB" && f.parsed.results.slice(0, 3).map((r, i) => <p key={i} className="text-xs text-muted-foreground">{eventLabel(r.distance, r.stroke)} · Sembrado {formatTime(r.seedMs)} · Final {formatTime(r.finalMs)}</p>)}
              </div>
            );
          })}
          {progress != null && <Progress value={progress} />}
          <Button size="lg" onClick={run} disabled={reading || progress != null || pending.some(f => f.parsed.events?.length === 0 || f.parsed.athletes.length === 0)}>
            Confirmar e importar {pending.length} archivo(s)
          </Button>
        </div>
      )}

      {done.map((s) => (
        <div key={s.meetId} className="rounded-lg border border-success bg-card p-4">
          <div className="font-display text-xl font-semibold uppercase">{s.meetName}</div>
          <p className="time mt-1 text-sm text-muted-foreground">
            {s.athletesNew} atletas nuevos · {s.athletesMatched} ya existentes · {s.results} resultados · {s.splits} parciales
            {s.events != null && ` · ${s.events} pruebas guardadas`}
          </p>
          <p className="mt-2 text-sm text-success">{s.achievements}</p>
          <Button variant="link" asChild><Link to="/achievements">Ver logros</Link></Button>
          <Link to="/athletes" className="mt-2 inline-block text-sm text-primary underline">Ver atletas</Link>
          {s.events != null && <Link to="/entries" className="ml-4 mt-2 inline-block text-sm text-primary underline">Ver pruebas e inscribir atletas</Link>}
        </div>
      ))}
      <section className="border-t pt-6">
        <h2 className="mb-3 text-xl font-bold uppercase">Administración de datos</h2>
        <ResetData />
      </section>
    </div>
  );
}
