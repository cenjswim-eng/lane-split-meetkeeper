import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { extractStandards } from "@/lib/standard-import.functions";
import { useSwimCategories } from "@/lib/categories";
import { categoryBounds, prepareStandardRows, standardIdentity, type StandardDraft } from "@/lib/standard-rules";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

const selectClass = "h-10 w-full rounded-md border bg-background px-2 text-sm";
export function ImportStandards({ existing }: { existing: Tables<"time_standards">[] }) {
  const cats = useSwimCategories();
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState("2026");
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<StandardDraft[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [replace, setReplace] = useState(false);
  const [pool, setPool] = useState<"LCM" | "SCM">("LCM");
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const extract = useServerFn(extractStandards);
  const qc = useQueryClient();
  let validRows: ReturnType<typeof prepareStandardRows> = [];
  let validation = "";
  try { validRows = prepareStandardRows(rows, Number(year), cats); } catch (e) { validation = e instanceof Error ? e.message : "Revisa los datos."; }
  const collisions = validRows.filter(row => existing.some(s => standardIdentity(s) === standardIdentity(row))).length;

  async function read() {
    if (!file) return;
    setBusy(true); setError(""); setRows([]); setWarnings([]); setReviewed(false);
    try {
      const mediaType = file.type as "application/pdf" | "image/png" | "image/jpeg" | "image/webp";
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("No se pudo abrir el archivo."));
        reader.readAsDataURL(file);
      });
      const response = await extract({ data: { base64, mediaType, filename: file.name.slice(0,200), year: Number(year) } });
      if (!response.ok) throw new Error(response.message);
      setRows(response.output.standards.map(s => ({ category: (()=>{try{return categoryBounds(s.category ?? "", cats).age_group ?? "Todas";}catch{return s.category ?? "";}})(), gender: s.gender ?? "?", distance: s.distance ?? 0, stroke: s.stroke ?? 0, course: pool, time: s.time ?? "", selected: true })));
      setWarnings([...response.output.warnings, ...(response.output.document_year != null && response.output.document_year !== Number(year) ? [`El documento indica ${response.output.document_year}; seleccionaste ${year}. Revisa el año antes de guardar.`] : [])]);
      if (!response.output.standards.length) setError("No se encontraron mínimas legibles en el archivo.");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo leer el archivo."); }
    finally { setBusy(false); }
  }
  async function save() {
    if (!reviewed || !validRows.length || validation || (collisions && !replace)) return;
    setBusy(true); setError("");
    try {
      const inserts = [];
      for (const row of validRows) {
        const matches = existing.filter(s => standardIdentity(s) === standardIdentity(row));
        if (matches.length) {
          const { error } = await supabase.from("time_standards").update(row).in("id", matches.map(s => s.id));
          if (error) throw error;
        } else inserts.push(row);
      }
      if (inserts.length) { const { error } = await supabase.from("time_standards").insert(inserts); if (error) throw error; }
      await Promise.all([qc.invalidateQueries({queryKey:["coach-data"]}), qc.invalidateQueries({queryKey:["dashboard"]}), qc.invalidateQueries({queryKey:["athlete"]})]);
      setOpen(false); setRows([]); setFile(null); setReviewed(false); setReplace(false);
      toast.success(`${validRows.length} mínimas de Venezuela guardadas para ${year}.`);
    } catch(e) { await qc.invalidateQueries({queryKey:["coach-data"]}); setError(e instanceof Error ? e.message : "No se pudieron guardar todas las mínimas. Revisa la tabla antes de reintentar."); }
    finally { setBusy(false); }
  }
  function patch(index: number, change: Partial<StandardDraft>) { setRows(current => current.map((r,i) => i === index ? {...r,...change} : r)); setReviewed(false); }
  return <><Button variant="outline" onClick={() => setOpen(true)}><Upload />Importar PDF o captura</Button>
    <Dialog open={open} onOpenChange={v => { if (!busy) setOpen(v); }}><DialogContent className="max-h-[90dvh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>Mínimas nacionales · Venezuela</DialogTitle><DialogDescription>PDF, PNG, JPG o WebP · hasta 8 MB. Lectura con Lovable AI; consume créditos de IA.</DialogDescription></DialogHeader>
      <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]"><div className="grid gap-1.5"><Label htmlFor="standards-year">Año</Label><Input id="standards-year" type="number" min={1900} max={2200} value={year} disabled={busy} onChange={e => {setYear(e.target.value);setReviewed(false);}} /></div><div className="grid gap-1.5"><Label>Documento de mínimas</Label><input ref={input} type="file" accept="application/pdf,image/png,image/jpeg,image/webp" className="hidden" aria-label="Documento de mínimas" onChange={e => {const f=e.target.files?.[0];e.target.value="";if(!f)return;if(!["application/pdf","image/png","image/jpeg","image/webp"].includes(f.type)||f.size>8*1024*1024||!f.size){setError("Selecciona un PDF o imagen válido de hasta 8 MB.");return;}setFile(f);setRows([]);setWarnings([]);setError("");setReviewed(false);}} /><Button variant="outline" disabled={busy} onClick={() => input.current?.click()} className="min-w-0 justify-start"><Upload /><span className="truncate">{file?.name ?? "Seleccionar PDF o captura"}</span></Button></div></div>
      <div className="grid gap-1.5"><Label htmlFor="standards-pool">Piscina de los tiempos</Label><select id="standards-pool" className={selectClass} value={pool} disabled={busy} onChange={e=>{const v=e.target.value as "LCM"|"SCM";setPool(v);setRows(rs=>rs.map(r=>({...r,course:v})));setReviewed(false);}}><option value="LCM">Piscina de 50 metros (normal)</option><option value="SCM">Piscina de 25 metros (tramos)</option></select></div>
      <Button disabled={!file || busy || !Number.isInteger(Number(year)) || Number(year)<1900 || Number(year)>2200} onClick={read}>{busy ? "Procesando…" : "Leer mínimas"}</Button>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      {warnings.length>0 && <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{warnings.map((w,i)=><li key={i}>{w}</li>)}</ul>}
      {rows.length>0 && <><h3 className="font-semibold">Revisión · {rows.length} marcas</h3><div className="divide-y border-y">{rows.map((r,i)=><div key={i} className="grid gap-2 py-3 sm:grid-cols-3"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={r.selected} disabled={busy} onChange={e=>patch(i,{selected:e.target.checked})} />Marca {i+1}</label><select aria-label={`Categoría ${i+1}`} className={selectClass} value={r.category} disabled={busy} onChange={e=>patch(i,{category:e.target.value})}><option value="Todas">Todas las categorías</option>{cats.map(c=><option key={c.name} value={c.label}>{c.label}</option>)}{r.category&&r.category!=="Todas"&&!cats.some(c=>c.label===r.category)&&<option value={r.category}>{r.category}</option>}</select><select aria-label={`Sexo ${i+1}`} className={selectClass} value={r.gender} disabled={busy} onChange={e=>patch(i,{gender:e.target.value})}><option value="?">Sexo no identificado</option><option value="M">Masculino</option><option value="F">Femenino</option><option value="">Ambos</option></select><Input aria-label={`Distancia ${i+1}`} type="number" min={1} value={r.distance || ""} placeholder="Distancia (m)" disabled={busy} onChange={e=>patch(i,{distance:Number(e.target.value)})}/><select aria-label={`Estilo ${i+1}`} className={selectClass} value={r.stroke} disabled={busy} onChange={e=>patch(i,{stroke:Number(e.target.value)})}><option value={0}>Estilo no identificado</option>{[[1,"Libre"],[2,"Espalda"],[3,"Pecho"],[4,"Mariposa"],[5,"Combinado"]].map(([v,n])=><option key={v} value={v}>{n}</option>)}</select><select aria-label={`Piscina ${i+1}`} className={selectClass} value={r.course} disabled={busy} onChange={e=>patch(i,{course:e.target.value})}><option value="">Piscina no identificada</option><option value="LCM">Piscina de 50 metros</option><option value="SCM">Piscina de 25 metros</option></select><Input aria-label={`Tiempo ${i+1}`} value={r.time} placeholder="1:02.34" disabled={busy} onChange={e=>patch(i,{time:e.target.value})}/><Button variant="ghost" size="icon" title="Retirar marca" aria-label={`Retirar marca ${i+1}`} disabled={busy} onClick={()=>{setRows(rows.filter((_,j)=>j!==i));setReviewed(false);}}><Trash2 /></Button></div>)}</div>
        {validation && <p className="text-sm text-destructive">{validation}</p>}
        {collisions>0 && <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={replace} disabled={busy} onChange={e=>setReplace(e.target.checked)}/>Actualizar {collisions} mínimas existentes de este año</label>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={reviewed} disabled={busy} onChange={e=>setReviewed(e.target.checked)}/>He revisado el año, categorías, sexo, piscina y tiempos con el documento original.</label>
        <Button disabled={busy||!reviewed||!!validation||!validRows.length||(collisions>0&&!replace)} onClick={save}>Guardar {validRows.length} mínimas · {year}</Button></>}
    </DialogContent></Dialog>
  </>;
}