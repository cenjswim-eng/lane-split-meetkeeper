import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Check, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { versionStandards, type StandardVersion } from "@/lib/standard-versions";

export function StandardVersionHistory({ versions }: { versions: StandardVersion[] }) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  async function activate(id: string) {
    setBusy(true);
    try {
      const response = await supabase.rpc("activate_standard_version", { p_id: id });
      if (response.error) throw response.error;
      await qc.invalidateQueries();
      toast.success("Versión activa actualizada. Los PDF anteriores no cambian.");
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo activar la versión."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-3"><h2 className="flex items-center gap-2 text-2xl font-bold"><History className="size-5" />Versiones de mínimas</h2>
    <p className="text-sm text-muted-foreground">Solo los nuevos reportes usan la versión activa. Conserva los PDF descargados; puedes generar otro con la versión actual.</p>
    <div className="divide-y border-y">{versions.map(v => <div key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div className="min-w-0"><p className="break-words font-semibold">{v.document_name}</p><p className="text-sm text-muted-foreground">{v.season_year ?? "Sin año"} · {versionStandards(v).length} marcas · Importada: {v.imported_at ? new Date(v.imported_at).toLocaleString("es-VE") : "fecha no registrada"}{v.effective_from ? ` · Vigencia: ${v.effective_from}` : ""}</p></div><Button variant={v.active ? "secondary" : "outline"} disabled={busy || v.active} onClick={() => activate(v.id)}>{v.active && <Check />}{v.active ? "Activa" : "Usar esta versión"}</Button></div>)}{!versions.length && <p className="py-4 text-sm text-muted-foreground">Sin versiones importadas.</p>}</div>
  </section>;
}