import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { eventLabel, formatTime } from "@/lib/swim";
import { qualificationReport, type QualificationResult, type QualificationStandard } from "@/lib/standard-rules";

const selectClass = "h-10 rounded-md border bg-background px-2 text-sm";
export function StandardsCompliance({ standards, results }: { standards: QualificationStandard[]; results: QualificationResult[] }) {
  const years = [...new Set(standards.map(s => s.season_year).filter((y): y is number => y != null))].sort((a, b) => b - a);
  const [year, setYear] = useState(String(years[0] ?? new Date().getFullYear()));
  const [filter, setFilter] = useState<"all" | "met" | "not">("all");
  const [q, setQ] = useState("");
  const rows = useMemo(() => qualificationReport(standards, results, Number(year)), [standards, results, year]);
  const shown = rows.filter(r => (filter === "all" || (filter === "met") === r.met) && r.name.toLowerCase().includes(q.toLowerCase()));
  const met = rows.filter(r => r.met).length;
  return <section className="space-y-4">
    <div><h2 className="text-2xl font-bold">¿Quién hizo la marca?</h2><p className="text-sm text-muted-foreground">Mejor tiempo de cada atleta en las competencias del año, comparado con la mínima de su categoría, sexo y piscina.</p></div>
    <div className="flex flex-wrap items-end gap-3">
      <div className="grid gap-1.5"><Label htmlFor="cmp-year">Año</Label><select id="cmp-year" className={selectClass} value={year} onChange={e => setYear(e.target.value)}>{(years.length ? years : [Number(year)]).map(y => <option key={y} value={y}>{y}</option>)}</select></div>
      <div className="grid gap-1.5"><Label htmlFor="cmp-filter">Mostrar</Label><select id="cmp-filter" className={selectClass} value={filter} onChange={e => setFilter(e.target.value as typeof filter)}><option value="all">Todos</option><option value="met">Hicieron marca</option><option value="not">No lograron la marca</option></select></div>
      <div className="grid min-w-40 flex-1 gap-1.5"><Label htmlFor="cmp-q">Buscar atleta</Label><Input id="cmp-q" value={q} onChange={e => setQ(e.target.value)} /></div>
    </div>
    <p className="text-sm"><span className="font-semibold text-primary">{met} hicieron marca</span> · <span className="font-semibold text-destructive">{rows.length - met} no lograron la marca</span></p>
    <div className="divide-y border-y">{shown.map((r, i) => <div key={i} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
      <div className="min-w-0"><p className="break-words font-semibold">{r.name}</p><p className="text-sm text-muted-foreground">{eventLabel(r.distance, r.stroke)} · {r.course === "LCM" ? "50 m" : "25 m"} · {r.category ?? "Todas"} · {r.gender === "F" ? "Femenino" : "Masculino"} · {r.meet}</p></div>
      <div className="text-right"><p className={r.met ? "font-semibold text-primary" : "font-semibold text-destructive"}>{r.met ? "Hizo marca" : "No logró la marca"}</p><p className="time text-sm">{formatTime(r.time_ms)} / {formatTime(r.limit_ms)} ({r.diff_ms > 0 ? "+" : "−"}{formatTime(Math.abs(r.diff_ms))})</p></div>
    </div>)}{!shown.length && <p className="py-6 text-muted-foreground">No hay resultados de {year} que coincidan con las mínimas cargadas.</p>}</div>
  </section>;
}
