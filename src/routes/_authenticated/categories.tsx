import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { categoriesQuery } from "@/lib/categories";
import { categoryLabel, SWIM_CATEGORIES, validateCategories } from "@/lib/standard-rules";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/categories")({
  head: () => ({ meta: [{ title: "Categorías por edad — Swim Lane Coach" }, { name: "description", content: "Personaliza los nombres y edades de las categorías de tu país." }, { property: "og:title", content: "Categorías por edad — Swim Lane Coach" }, { property: "og:description", content: "Define las categorías por edad para mínimas y reportes." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(categoriesQuery),
  component: CategoriesPage,
});

type Row = { name: string; min: string; max: string };
const toRows = (list: readonly { name: string; age_min: number | null; age_max: number | null }[]): Row[] => list.map((c) => ({ name: c.name, min: c.age_min?.toString() ?? "", max: c.age_max?.toString() ?? "" }));
const num = (v: string) => (v.trim() === "" ? null : Number(v));

function CategoriesPage() {
  const { data } = useSuspenseQuery(categoriesQuery);
  const qc = useQueryClient();
  const [rows, setRows] = useState<Row[]>(() => toRows(data.list));
  const [busy, setBusy] = useState(false);
  useEffect(() => setRows(toRows(data.list)), [data]);
  const patch = (i: number, p: Partial<Row>) => setRows(rows.map((r, j) => (j === i ? { ...r, ...p } : r)));

  async function save() {
    setBusy(true);
    try {
      const list = validateCategories(rows.map((r) => ({ name: r.name, age_min: num(r.min), age_max: num(r.max) })));
      const { data: auth } = await supabase.auth.getUser();
      const owner = auth.user?.id;
      if (!owner) throw new Error("Inicia sesión de nuevo.");
      const del = await supabase.from("swim_categories").delete().eq("owner_id", owner);
      if (del.error) throw del.error;
      if (list.length) {
        const ins = await supabase.from("swim_categories").insert(list.map((c, i) => ({ name: c.name, age_min: c.age_min, age_max: c.age_max, sort: i })));
        if (ins.error) throw ins.error;
      }
      // Re-link loaded standards whose category keeps the same name to the new ages.
      const { data: standards } = await supabase.from("time_standards").select("id, age_group");
      const fold = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      let updated = 0;
      for (const c of list) {
        const ids = (standards ?? []).filter((s) => s.age_group && fold(s.age_group).startsWith(fold(c.name) + " (")).map((s) => s.id);
        if (!ids.length) continue;
        const up = await supabase.from("time_standards").update({ age_group: c.label, age_min: c.age_min, age_max: c.age_max }).in("id", ids);
        if (up.error) throw up.error;
        updated += ids.length;
      }
      await qc.invalidateQueries();
      toast.success(updated ? `Categorías guardadas. ${updated} mínimas actualizadas con las nuevas edades.` : "Categorías guardadas.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo guardar."); } finally { setBusy(false); }
  }

  return <div className="max-w-3xl space-y-6">
    <header><h1 className="text-4xl font-bold uppercase">Categorías</h1>
      <p className="text-muted-foreground">Define las categorías de tu país. La edad se calcula al 31 de diciembre. Se usan en las mínimas, las inscripciones y la ficha de cada atleta. Deja «Hasta» vacío para «y más».</p></header>
    <div className="space-y-3">
      <div className="hidden grid-cols-[minmax(0,1fr)_6rem_6rem_2.5rem] gap-2 text-sm text-muted-foreground sm:grid"><span>Nombre</span><span>Desde (años)</span><span>Hasta (años)</span><span /></div>
      {rows.map((r, i) => <div key={i} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.5rem] gap-2 rounded-lg border bg-card p-3 sm:grid-cols-[minmax(0,1fr)_6rem_6rem_2.5rem] sm:border-0 sm:bg-transparent sm:p-0">
        <Input className="col-span-3 sm:col-span-1" aria-label={`Nombre de la categoría ${i + 1}`} value={r.name} placeholder="Infantil A" onChange={(e) => patch(i, { name: e.target.value })} />
        <Input aria-label={`Desde ${i + 1}`} type="number" inputMode="numeric" min={0} max={120} placeholder="Desde" value={r.min} onChange={(e) => patch(i, { min: e.target.value })} />
        <Input aria-label={`Hasta ${i + 1}`} type="number" inputMode="numeric" min={0} max={120} placeholder="y más" value={r.max} onChange={(e) => patch(i, { max: e.target.value })} />
        <Button variant="ghost" size="icon" title="Quitar categoría" aria-label={`Quitar categoría ${i + 1}`} onClick={() => setRows(rows.filter((_, j) => j !== i))}><Trash2 /></Button>
        {r.name.trim() && (r.min || r.max) && <p className="col-span-3 text-xs text-muted-foreground sm:col-span-4">{categoryLabel(r.name, num(r.min), num(r.max))}</p>}
      </div>)}
    </div>
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" onClick={() => setRows([...rows, { name: "", min: "", max: "" }])}><Plus />Añadir categoría</Button>
      <Button variant="ghost" onClick={() => setRows(toRows(SWIM_CATEGORIES))}><RotateCcw />Restaurar Venezuela</Button>
      <Button onClick={save} disabled={busy}><Save />{busy ? "Guardando…" : "Guardar categorías"}</Button>
    </div>
    <p className="text-sm text-muted-foreground">Las versiones de documentos oficiales conservan sus categorías y edades originales. Estos cambios no modifican las versiones importadas ni los PDF generados.</p>
  </div>;
}
