import { supabase } from "@/integrations/supabase/client";
import { prepareImportPayload } from "./swim-io/staging";
import type { ParsedFile } from "./hytek";
import type { Json } from '@/integrations/supabase/types';
import { toast } from 'sonner';
import { achievementSummary } from './achievements';

export interface ImportSummary {
  meetId: string;
  meetName: string;
  teams: number;
  athletesNew: number;
  athletesMatched: number;
  results: number;
  splits: number;
  events?: number;
  achievements?: string;
}

function must<T>(r: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
}

/** Writes a parsed Hy-Tek file into the database, de-duplicating athletes, teams, meets and events. */
export async function importParsed(fileName: string, p: ParsedFile, onProgress?: (pct: number) => void, options?: { hash?: string; clubId?: string; teamCode?: string; links?: Record<string,string> }): Promise<ImportSummary> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Inicia sesión para importar tus registros.');
  if (p.events) {
    if (!p.events.length) throw new Error("Selecciona al menos una prueba antes de guardar.");
    const meetId = must(await supabase.rpc("import_meet_setup", { p_setup: { format: p.format, meet: p.meet, events: p.events } as never, p_file_name: fileName }));
    onProgress?.(100);
    return { meetId, meetName: p.meet.name, teams: 0, athletesNew: 0, athletesMatched: 0, results: 0, splits: 0, events: p.events.length };
  }
  onProgress?.(15);
  const started = new Date().toISOString();
  const payload = prepareImportPayload(p, fileName, options?.hash, options?.clubId, options?.teamCode, options?.links);
  const response = must(await supabase.rpc("import_meet_payload", { p_payload: JSON.parse(JSON.stringify(payload)) as Json }));
  const summary = response as unknown as ImportSummary;
  const achievements = await supabase.from('athlete_achievements').select('kind').eq('meet_id',summary.meetId).gte('created_at',started);
  if (achievements.error) toast.warning('Competencia guardada. No se pudo leer el resumen de logros; revisa Logros.');
  else { summary.achievements=achievementSummary(achievements.data); toast.success(summary.achievements); }
  onProgress?.(100);
  return summary;
}
