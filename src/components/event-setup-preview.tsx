import { useState } from "react";
import type { ParsedFile } from "@/lib/hytek";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { eventLabel, formatTime } from "@/lib/swim";

export function EventSetupPreview({ parsed, disabled, onChange }: { parsed: ParsedFile; disabled: boolean; onChange: (parsed: ParsedFile) => void }) {
  const [filter, setFilter] = useState("");
  const events = parsed.events ?? [];
  const visible = events.filter(e => `${e.eventNumber} ${eventLabel(e.distance, e.stroke)} ${e.gender} ${e.minAge ?? 0}-${e.maxAge ?? "Abierta"}`.toLowerCase().includes(filter.toLowerCase()));
  return <div className="mt-4 space-y-4">
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-sm">Nombre<Input aria-label="Nombre de competencia" disabled={disabled} value={parsed.meet.name} onChange={e => onChange({ ...parsed, meet: { ...parsed.meet, name: e.target.value } })} /></label>
      <label className="text-sm">Inicio<Input aria-label="Fecha de inicio" type="date" disabled={disabled} value={parsed.meet.startDate ?? ""} onChange={e => onChange({ ...parsed, meet: { ...parsed.meet, startDate: e.target.value || null } })} /></label>
      <label className="text-sm">Fin<Input aria-label="Fecha de fin" type="date" disabled={disabled} value={parsed.meet.endDate ?? ""} onChange={e => onChange({ ...parsed, meet: { ...parsed.meet, endDate: e.target.value || null } })} /></label>
    </div>
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Pruebas · {events.length}</h3><Input className="w-full sm:w-64" aria-label="Filtrar pruebas" placeholder="Buscar prueba, género o edad" value={filter} onChange={e => setFilter(e.target.value)} /></div>
    <div className="max-h-96 overflow-auto rounded-md border">
      <table className="w-full min-w-[740px] text-left text-sm">
        <thead className="sticky top-0 bg-muted"><tr>{["N.º", "Prueba", "Género", "Edades", "Piscina", "Límite 50 m", "Límite 25 m", "Límite yardas", ""].map(h => <th className="p-3 font-medium" key={h}>{h}</th>)}</tr></thead>
        <tbody>{visible.map(e => <tr className="border-t" key={`${e.eventNumber}-${e.gender}-${e.minAge}-${e.maxAge}`}>
          <td className="p-3">{e.eventNumber}</td><td className="p-3 whitespace-nowrap">{eventLabel(e.distance, e.stroke)}</td><td className="p-3">{e.gender === "F" ? "Femenino" : e.gender === "M" ? "Masculino" : "Mixto"}</td><td className="p-3 whitespace-nowrap">{e.minAge ?? 0}–{e.maxAge ?? "Abierta"}</td><td className="p-3">{e.course === "LCM" ? "50 m" : e.course === "SCM" ? "25 m" : "25 yd"}</td>
          {["LCM", "SCM", "SCY"].map(c => <td className="time p-3" key={c}>{formatTime(e.qualifyingTimesMs[c])}</td>)}
          <td className="p-2"><Button variant="ghost" size="sm" disabled={disabled} aria-label={`Excluir prueba ${e.eventNumber}`} onClick={() => onChange({ ...parsed, events: events.filter(row => row !== e) })}>Excluir</Button></td>
        </tr>)}</tbody>
      </table>
    </div>
    {!visible.length && <p className="text-sm text-muted-foreground">Sin pruebas para mostrar.</p>}
    <p className="text-xs text-muted-foreground">Límites de inscripción del torneo; no sustituyen las mínimas nacionales. No se crearán atletas ni resultados.</p>
  </div>;
}