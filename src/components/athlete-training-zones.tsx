import { useMemo, useState } from "react";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { eventLabel, formatTime } from "@/lib/swim";
import { TRAINING_ZONES, trainingReferences, trainingTimeRange, type TrainingReference, type TrainingZone } from "@/lib/training-zones";

type Calibration = { min: string; max: string; objective: string };

export function AthleteTrainingZones({ records }: { records: TrainingReference[] }) {
  const [open, setOpen] = useState(false);
  const references = useMemo(() => trainingReferences(records), [records]);
  const [selected, setSelected] = useState("");
  const reference = references.find((r) => r.id === selected) ?? references[0];
  // Isolated per event/course/reference: never reuse another swimmer's calibration.
  const [calibrations, setCalibrations] = useState<Record<string, Partial<Record<TrainingZone, Calibration>>>>({});
  function update(zone: TrainingZone, field: keyof Calibration, value: string) {
    if (!reference) return;
    const id = reference.id;
    setCalibrations((previous) => ({ ...previous, [id]: { ...previous[id], [zone]: { min: "", max: "", objective: "", ...previous[id]?.[zone], [field]: value } } }));
  }
  return <section className="border-y py-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 className="text-2xl font-bold uppercase">Zonas de trabajo</h2><p className="text-sm text-muted-foreground">Referencia teórica: Jan Olbrecht</p></div>
      <Button variant="outline" aria-expanded={open} aria-controls="training-zone-panel" onClick={() => setOpen((value) => !value)}><Activity />Tabla de tiempos{open ? <ChevronUp /> : <ChevronDown />}</Button>
    </div>
    {open && <div id="training-zone-panel" className="mt-5 space-y-5">
      <p className="max-w-4xl text-sm text-muted-foreground">Olbrecht distingue capacidad y potencia aeróbica y anaeróbica. R1, R2, VO2 Max, anaeróbico 1 y 2 son etiquetas de planificación, no equivalencias universales. Las marcas de competencia no determinan por sí solas las zonas fisiológicas: los rangos requieren evaluación y validación del entrenador.</p>
      {!reference?.events || reference.final_time_ms == null ? <p className="border border-dashed p-5 text-muted-foreground">Sin marcas individuales válidas en LCM o SCM durante los últimos 9 meses.</p> : <>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2"><label htmlFor="training-reference" className="text-sm font-medium">Marca de referencia · prueba y piscina</label>
            <Select value={reference.id} onValueChange={setSelected}><SelectTrigger id="training-reference"><SelectValue /></SelectTrigger><SelectContent>{references.map((r) => <SelectItem value={r.id} key={r.id}>{r.events ? eventLabel(r.events.distance, r.events.stroke) : "—"} · {r.course} · {formatTime(r.final_time_ms)}</SelectItem>)}</SelectContent></Select>
          </div>
          <div className="text-sm"><p className="font-medium break-words">{reference.meets?.name}</p><p className="mt-1 text-muted-foreground">{reference.meets?.start_date} · Mejor marca vigente</p><p className="time mt-1 text-primary">Velocidad de referencia: {(reference.events.distance / (reference.final_time_ms / 1000)).toFixed(3)} m/s</p></div>
        </div>
        <p className="text-sm text-muted-foreground">Rangos definidos por el entrenador como % de la velocidad de referencia. Tiempos equivalentes a ritmo constante, no predicción de carrera ni prescripción de series. Ajustes temporales de esta sesión, sin guardar.</p>
        <div className="overflow-x-auto rounded-md border"><table className="w-full min-w-[900px] text-sm">
          <caption className="sr-only">Tabla individual de zonas y tiempos equivalentes calibrados por el entrenador</caption>
          <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground"><tr><th className="p-3">Zona</th><th className="p-3">Objetivo / evaluación</th><th className="p-3">Velocidad mín. %</th><th className="p-3">Velocidad máx. %</th>{[25, 50, 100, 200].map((d) => <th key={d} className="p-3 text-right">{d} m</th>)}</tr></thead>
          <tbody>{TRAINING_ZONES.map((zone) => {
            const values = calibrations[reference.id]?.[zone] ?? { min: "", max: "", objective: "" };
            const range = { minPercent: Number(values.min), maxPercent: Number(values.max) };
            const invalid = values.min !== "" && values.max !== "" && !trainingTimeRange(reference.final_time_ms ?? 0, reference.events?.distance ?? 0, 100, range);
            return <tr key={zone} className="border-t align-top"><th scope="row" className="p-3 text-left font-semibold">{zone}</th>
              <td className="p-3"><Input aria-label={`Objetivo ${zone}`} value={values.objective} placeholder="Sin evaluar" onChange={(e) => update(zone, "objective", e.target.value)} className="min-w-40" /></td>
              <td className="p-3"><Input type="number" inputMode="decimal" min="0.01" step="any" aria-label={`Velocidad mínima ${zone}`} aria-invalid={Boolean(invalid)} value={values.min} placeholder="—" onChange={(e) => update(zone, "min", e.target.value)} className="w-24" /></td>
              <td className="p-3"><Input type="number" inputMode="decimal" min="0.01" step="any" aria-label={`Velocidad máxima ${zone}`} aria-invalid={Boolean(invalid)} value={values.max} placeholder="—" onChange={(e) => update(zone, "max", e.target.value)} className="w-24" />{invalid && <p className="mt-2 max-w-32 text-xs text-destructive">Rango inválido: valores positivos, mínimo ≤ máximo.</p>}</td>
              {[25, 50, 100, 200].map((distance) => { const times = trainingTimeRange(reference.final_time_ms ?? 0, reference.events?.distance ?? 0, distance, range); return <td key={distance} className="time p-3 text-right whitespace-nowrap">{times ? `${formatTime(times.fastMs)} – ${formatTime(times.slowMs)}` : <span className="font-sans text-xs text-muted-foreground">Sin calibrar</span>}</td>; })}
            </tr>;
          })}</tbody>
        </table></div>
        <p className="text-xs text-muted-foreground">Tiempo = tiempo de referencia × (distancia / distancia de referencia) ÷ (% velocidad / 100). Recuperación, volumen y tolerancia individual deben definirse aparte.</p>
      </>}
      <a className="inline-block text-sm text-primary underline underline-offset-4" href="https://scientifictriathlon.com/tts198/" target="_blank" rel="noreferrer">Fundamento: entrevista a Jan Olbrecht · capacidad y potencia</a>
    </div>}
  </section>;
}