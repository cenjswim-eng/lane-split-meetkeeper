import { z } from "zod";
import type { Tables } from "@/integrations/supabase/types";
import type { QualificationStandard } from "./standard-rules";

export type StandardVersion = Tables<"standard_versions">;
const rowSchema = z.object({
  name: z.string(), season_year: z.number().nullable(), age_group: z.string().nullable(),
  age_min: z.number().nullable(), age_max: z.number().nullable(), gender: z.string().nullable(),
  distance: z.number().int().positive(), stroke: z.number().int().min(1).max(5),
  course: z.enum(["LCM", "SCM"]), qualifying_time_ms: z.number().int().positive(),
});

export function activeStandardVersion(versions: readonly StandardVersion[]) {
  return versions.filter(v => v.active).sort((a, b) => (b.imported_at ?? "").localeCompare(a.imported_at ?? ""))[0] ?? null;
}

export function versionStandards(version: StandardVersion | null): Tables<"time_standards">[] {
  if (!version) return [];
  return z.array(rowSchema).parse(version.standards).map((row, i) => ({ ...row, id: `${version.id}:${i}`, owner_id: version.owner_id }));
}

const key = (s: QualificationStandard) => JSON.stringify([s.age_min ?? null, s.age_max ?? null, s.age_group, s.gender, s.distance, s.stroke, s.course]);
export function compareStandardVersions(previous: readonly QualificationStandard[], next: readonly QualificationStandard[]) {
  const before = new Map(previous.map(s => [key(s), s]));
  const after = new Map(next.map(s => [key(s), s]));
  return {
    added: next.filter(s => !before.has(key(s))),
    changed: next.flatMap(s => { const old = before.get(key(s)); return old && old.qualifying_time_ms !== s.qualifying_time_ms ? [{ before: old, after: s }] : []; }),
    removed: previous.filter(s => !after.has(key(s))),
    unchanged: next.filter(s => before.get(key(s))?.qualifying_time_ms === s.qualifying_time_ms).length,
  };
}

export function standardSourceNote(version: StandardVersion | null) {
  if (!version) return "Marcas mínimas: — (sin versión activa).";
  const imported = version.imported_at ? new Date(version.imported_at).toLocaleDateString("es-VE", { timeZone: "UTC" }) : "fecha no registrada";
  return `Marcas mínimas: ${version.document_name}${version.season_year ? ` / ${version.season_year}` : ""}, importadas el ${imported}${version.effective_from ? ` · Vigencia: ${version.effective_from}` : ""}.`;
}

export const STANDARD_AGE_NOTE = "Categoría: edad al 31 de diciembre del año de cada competencia, no edad al generar el reporte; se conservan las edades del documento importado. Un cambio de año puede cambiar la categoría y la mínima aplicable.";