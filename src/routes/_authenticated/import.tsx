import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { readHytekFile, type ParsedFile } from "@/lib/hytek";
import { importParsed, type ImportSummary } from "@/lib/importer";
import { PdfResultsImport } from "@/components/pdf-results-import";
import { ResultsLinkImport } from "@/components/results-link-import";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { readAccessFile, normalizeAccess, type AccessDatabase, type AccessTimeUnit } from "@/lib/access";
import { AccessPreview } from "@/components/access-preview";
import { formatTime, eventLabel } from "@/lib/swim";
import { ResetData } from "@/components/reset-data";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({ meta: [{ title: "Importar Hy-Tek y Access — Natacion pro" }, { name: "description", content: "Carga archivos HY3, CL2, SD3, ZIP y Microsoft Access Jet 4.0 (.mdb)." }, { property: "og:title", content: "Importar Hy-Tek y Access — Natacion pro" }, { name: "twitter:title", content: "Importar Hy-Tek y Access — Natacion pro" }, { property: "og:description", content: "Importa y revisa archivos de natación, incluyendo bases Access .mdb." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
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
  const accessFiles = access.flatMap(({ db, unit, course }) => normalizeAccess(db, unit, course).filter((parsed) => parsed.athletes.length > 0).map((parsed) => ({ name: db.name, parsed })));
  const pending = [...files, ...accessFiles];

  async function onPick(list: FileList | null) {
    if (!list || reading || progress != null) return;
    setReading(true);
    const databases: typeof access = [];
    const all: { name: string; parsed: ParsedFile }[] = [];
    for (const f of Array.from(list)) {
      try {
        if (/\.mdb$/i.test(f.name)) {
          databases.push({ db: await readAccessFile(f), unit: "seconds", course: "LCM" });
          continue;
        }
        const r = await readHytekFile(f);
        if (!r.length) toast.error(`${f.name}: formato no reconocido`);
        all.push(...r);
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`);
      }
    }
    setFiles(all);
    setAccess(databases);
    setDone([]);
    setReading(false);
  }

  async function run() {
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
      toast.success("Importación completada");
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
        <p className="text-muted-foreground">Resultados e inscripciones: .hy3, .cl2, .sd3, .zip y Access Jet 4.0 (.mdb)</p>
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
        <input type="file" aria-label="Elegir archivos para importar" multiple accept=".hy3,.cl2,.sd3,.zip,.mdb" disabled={reading || progress != null} className="hidden" onChange={(e) => { onPick(e.target.files); e.target.value = ""; }} />
      </label>

      <ResultsLinkImport disabled={reading || progress != null} onParsed={(name, parsed) => { setFiles((prev) => [...prev, { name, parsed }]); setDone([]); }} />
      <PdfResultsImport disabled={reading || progress != null} onParsed={(name, parsed) => { setFiles((prev) => [...prev, { name, parsed }]); setDone([]); }} />
      {reading && <p role="status" className="text-muted-foreground">Leyendo archivos…</p>}
      {access.map((a, i) => <div key={`${a.db.name}-${i}`} className="min-w-0 space-y-3">
        <AccessPreview db={a.db} unit={a.unit} course={a.course} onUnit={(unit) => setAccess((prev) => prev.map((v, j) => j === i ? { ...v, unit } : v))} onCourse={(course) => setAccess((prev) => prev.map((v, j) => j === i ? { ...v, course } : v))} />
        {!normalizeAccess(a.db, a.unit, a.course).some((p) => p.athletes.length > 0) && <p role="alert" className="text-sm text-destructive">No hay atletas con columnas reconocidas. No se guardará esta base; conserva el original y proporciona un archivo de ejemplo para adaptar sus campos.</p>}
        <p className="text-xs text-muted-foreground">Solo se guardarán los datos del resumen siguiente. Las tablas y columnas no reconocidas permanecen en tu archivo original.</p>
      </div>)}

      {pending.length > 0 && (
        <div className="space-y-3">
          {pending.map((f, fileIndex) => {
            const withTimes = f.parsed.results.filter((r) => r.finalMs).length;
            const splits = f.parsed.results.reduce((n, r) => n + r.splits.length, 0);
            return (
              <div key={`${f.name}-${fileIndex}`} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-xl font-semibold uppercase">{f.parsed.meet.name}</span>
                  <span className="time break-all text-xs text-muted-foreground">{f.name} · {f.parsed.format} · {f.parsed.meet.course}</span>
                </div>
                <div className="time mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                  <span>{f.parsed.teams.length} clubes</span>
                  <span>{f.parsed.athletes.length} atletas</span>
                  <span>{f.parsed.results.length} nados</span>
                  <span>{withTimes} con tiempo</span>
                  <span>{splits} parciales</span>
                </div>
                {withTimes === 0 && <p role="alert" className="mt-2 text-xs text-accent">No se detectaron tiempos finales. Solo se guardarán atletas e inscripciones; las marcas existentes se conservarán. Si esperabas resultados, carga el archivo CL2/SD3 de la competencia.</p>}
                {f.parsed.warnings.map((warning, i) => <p key={i} className="mt-2 break-words text-xs text-destructive">{warning}</p>)}
                {f.parsed.format === "MDB" && f.parsed.results.slice(0, 3).map((r, i) => <p key={i} className="mt-2 text-xs text-muted-foreground">{eventLabel(r.distance, r.stroke)} · Sembrado {formatTime(r.seedMs)} · Final {formatTime(r.finalMs)}</p>)}
              </div>
            );
          })}
          {progress != null && <Progress value={progress} />}
          <Button size="lg" onClick={run} disabled={reading || progress != null}>Importar {pending.length} archivo(s)</Button>
        </div>
      )}

      {done.map((s) => (
        <div key={s.meetId} className="rounded-lg border border-success bg-card p-4">
          <div className="font-display text-xl font-semibold uppercase">{s.meetName}</div>
          <p className="time mt-1 text-sm text-muted-foreground">
            {s.athletesNew} atletas nuevos · {s.athletesMatched} ya existentes · {s.results} resultados · {s.splits} parciales
          </p>
          <Link to="/athletes" className="mt-2 inline-block text-sm text-primary underline">Ver atletas</Link>
        </div>
      ))}
      <section className="border-t pt-6">
        <h2 className="mb-3 text-xl font-bold uppercase">Administración de datos</h2>
        <ResetData />
      </section>
    </div>
  );
}
