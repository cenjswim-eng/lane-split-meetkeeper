import { createFileRoute, Link } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { readHytekFile, type ParsedFile } from "@/lib/hytek";
import { importParsed, type ImportSummary } from "@/lib/importer";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/_authenticated/import")({
  head: () => ({ meta: [{ title: "Importar archivos Hy-Tek — Natación Pro" }, { name: "description", content: "Carga archivos HY3, CL2, SD3 o ZIP de Meet Manager y Team Manager." }, { property: "og:title", content: "Importar — Natación Pro" }, { property: "og:description", content: "Carga archivos HY3, CL2, SD3 o ZIP." }] }),
  component: ImportPage,
});

function ImportPage() {
  const qc = useQueryClient();
  const [files, setFiles] = useState<{ name: string; parsed: ParsedFile }[]>([]);
  const [progress, setProgress] = useState<number | null>(null);
  const [done, setDone] = useState<ImportSummary[]>([]);

  async function onPick(list: FileList | null) {
    if (!list) return;
    const all: { name: string; parsed: ParsedFile }[] = [];
    for (const f of Array.from(list)) {
      try {
        const r = await readHytekFile(f);
        if (!r.length) toast.error(`${f.name}: formato no reconocido`);
        all.push(...r);
      } catch (e) {
        toast.error(`${f.name}: ${(e as Error).message}`);
      }
    }
    setFiles(all);
    setDone([]);
  }

  async function run() {
    const summaries: ImportSummary[] = [];
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        const s = await importParsed(f.name, f.parsed, (p) => setProgress(Math.round(((i + p / 100) / files.length) * 100)));
        summaries.push(s);
      }
      setDone(summaries);
      setFiles([]);
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
        <p className="text-muted-foreground">Resultados e inscripciones de Meet Manager / Team Manager: .hy3, .cl2, .sd3 o .zip</p>
      </div>

      <label className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed bg-card p-10 text-center transition-colors hover:border-primary">
        <span className="font-display text-2xl font-semibold uppercase">Arrastra o elige archivos</span>
        <span className="mt-1 text-sm text-muted-foreground">Puedes seleccionar varios a la vez</span>
        <input type="file" multiple accept=".hy3,.cl2,.sd3,.zip" className="hidden" onChange={(e) => onPick(e.target.files)} />
      </label>

      {files.length > 0 && (
        <div className="space-y-3">
          {files.map((f) => {
            const withTimes = f.parsed.results.filter((r) => r.finalMs).length;
            const splits = f.parsed.results.reduce((n, r) => n + r.splits.length, 0);
            return (
              <div key={f.name} className="rounded-lg border bg-card p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-display text-xl font-semibold uppercase">{f.parsed.meet.name}</span>
                  <span className="time text-xs text-muted-foreground">{f.name} · {f.parsed.format} · {f.parsed.meet.course}</span>
                </div>
                <div className="time mt-2 grid grid-cols-2 gap-2 text-sm sm:grid-cols-5">
                  <span>{f.parsed.teams.length} clubes</span>
                  <span>{f.parsed.athletes.length} atletas</span>
                  <span>{f.parsed.results.length} nados</span>
                  <span>{withTimes} con tiempo</span>
                  <span>{splits} parciales</span>
                </div>
                {withTimes === 0 && <p className="mt-2 text-xs text-accent">Archivo de inscripciones: se guardarán los tiempos de sembrado.</p>}
              </div>
            );
          })}
          {progress != null && <Progress value={progress} />}
          <Button size="lg" onClick={run} disabled={progress != null}>Importar {files.length} archivo(s)</Button>
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
    </div>
  );
}
