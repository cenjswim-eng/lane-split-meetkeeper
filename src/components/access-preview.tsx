import { useState } from "react";
import type { AccessDatabase, AccessTimeUnit } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export function AccessPreview({ db, unit, course, onUnit, onCourse }: { db: AccessDatabase; unit: AccessTimeUnit; course: string; onUnit: (v: AccessTimeUnit) => void; onCourse: (v: string) => void }) {
  const [selected, setSelected] = useState(db.tables[0]?.name ?? "");
  const table = db.tables.find((t) => t.name === selected);
  const display = (v: unknown): string => v == null ? "—" : v instanceof Date ? v.toISOString().slice(0, 10) : typeof v === "object" ? "[Dato binario/complejo]" : String(v);
  return <section className="space-y-4 border-b pb-6">
    <h2 className="break-all text-xl font-semibold">{db.name} · Access Jet 4.0</h2>
    <div className="grid gap-3 sm:grid-cols-3">
      <div><label className="mb-1 block text-sm">Tabla</label><Select value={selected} onValueChange={setSelected}><SelectTrigger aria-label="Tabla Access"><SelectValue /></SelectTrigger><SelectContent>{db.tables.map((t) => <SelectItem key={t.name} value={t.name}>{t.name} ({t.rows.length})</SelectItem>)}</SelectContent></Select></div>
      <div><label className="mb-1 block text-sm">Tiempos numéricos sin unidad</label><Select value={unit} onValueChange={(v) => onUnit(v as AccessTimeUnit)}><SelectTrigger aria-label="Unidad de tiempos Access"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="seconds">Segundos</SelectItem><SelectItem value="centiseconds">Centésimas</SelectItem><SelectItem value="milliseconds">Milisegundos</SelectItem></SelectContent></Select></div>
      <div><label className="mb-1 block text-sm">Piscina si falta en Access</label><Select value={course} onValueChange={onCourse}><SelectTrigger aria-label="Piscina Access"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="LCM">LCM · 50 m</SelectItem><SelectItem value="SCM">SCM · 25 m</SelectItem></SelectContent></Select></div>
    </div>
    {table && <><p className="text-sm text-muted-foreground">{table.rows.length} filas · {table.columns.length} columnas · Vista de las primeras 5 filas</p><div className="max-w-full overflow-x-auto border"><table className="w-full text-left text-xs"><thead><tr>{table.columns.map((c) => <th key={c} className="whitespace-nowrap border-b bg-muted p-2">{c}</th>)}</tr></thead><tbody>{table.rows.slice(0, 5).map((r, i) => <tr key={i}>{table.columns.map((c) => <td key={c} className="max-w-64 truncate border-b p-2" title={display(r[c])}>{display(r[c])}</td>)}</tr>)}</tbody></table></div></>}
    <Button variant="outline" onClick={() => { setSelected(db.tables[0]?.name ?? ""); }}>Primera tabla</Button>
  </section>;
}