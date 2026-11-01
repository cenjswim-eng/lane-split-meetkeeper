import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { aquaPoints } from "./swim";
import type { ParsedFile } from "./hytek";

export interface ImportSummary {
  meetId: string;
  meetName: string;
  teams: number;
  athletesNew: number;
  athletesMatched: number;
  results: number;
  splits: number;
}

function must<T>(r: { data: T; error: { message: string } | null }): NonNullable<T> {
  if (r.error) throw new Error(r.error.message);
  return r.data as NonNullable<T>;
}
function maybe<T>(r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(r.error.message);
  return r.data;
}

/** Writes a parsed Hy-Tek file into the database, de-duplicating athletes, teams, meets and events. */
export async function importParsed(fileName: string, p: ParsedFile, onProgress?: (pct: number) => void): Promise<ImportSummary> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw new Error('Inicia sesión para importar tus registros.');
  const ownerId = auth.user.id;
  // Teams
  const teamIds = new Map<string, string>();
  if (p.teams.length) {
    const rows = must(await supabase.from("teams").upsert(p.teams.map((t) => ({ owner_id: ownerId, code: t.code, name: t.name, lsc: t.lsc ?? null })), { onConflict: "owner_id,code" }).select("id, code"));
    rows.forEach((t) => teamIds.set(t.code, t.id));
  }

  // Atomic identity resolution also covers parallel uploads and null dates.
  const meetId = must(await supabase.rpc("resolve_import_identity", { p_kind: "meet", p_data: { ...p.meet } }));

  // Athletes
  const athleteIds = new Map<string, string>();
  const athleteGender = new Map<string, string | null>();
  let created = 0, matched = 0;
  for (const a of p.athletes) {
    athleteGender.set(a.key, a.gender);
    let found: { id: string } | null = null;
    if (a.tmId) found = maybe(await supabase.from("athletes").select("id").eq("tm_athlete_id", a.tmId).maybeSingle());
    if (!found && a.federationId) found = maybe(await supabase.from("athletes").select("id").eq("federation_id", a.federationId).limit(1).maybeSingle());
    if (!found) {
      let q = supabase.from("athletes").select("id").ilike("last_name", a.lastName).ilike("first_name", a.firstName);
      q = a.birthDate ? q.eq("birth_date", a.birthDate) : q.is("birth_date", null);
      found = maybe(await q.limit(1).maybeSingle());
    }
    const teamId = a.teamCode ? teamIds.get(a.teamCode) ?? null : null;
    if (found) {
      matched++;
      const patch: TablesUpdate<"athletes"> = {};
      if (a.tmId) patch.tm_athlete_id = a.tmId;
      if (a.federationId) patch.federation_id = a.federationId;
      if (a.birthDate) patch.birth_date = a.birthDate;
      if (teamId) patch.team_id = teamId;
      if (Object.keys(patch).length) maybe(await supabase.from("athletes").update(patch).eq("id", found.id));
      athleteIds.set(a.key, found.id);
    } else {
      created++;
      const row = must(await supabase.from("athletes").insert({ tm_athlete_id: a.tmId, federation_id: a.federationId, first_name: a.firstName, last_name: a.lastName, birth_date: a.birthDate, gender: a.gender === "M" || a.gender === "F" ? a.gender : null, team_id: teamId }).select("id").single());
      athleteIds.set(a.key, row.id);
    }
  }

  // Events
  const events = must(await supabase.from("events").select("id, event_number, distance, stroke, gender, min_age, max_age").eq("meet_id", meetId));
  const evKey = (e: { event_number: string | null; distance: number; stroke: number; gender: string | null; min_age: number | null; max_age: number | null }) => [e.event_number, e.distance, e.stroke, e.gender, e.min_age, e.max_age].join("|");
  const eventIds = new Map(events.map((e) => [evKey(e), e.id]));

  let resultCount = 0, splitCount = 0;
  const total = p.results.length || 1;
  for (const [i, r] of p.results.entries()) {
    const athleteId = athleteIds.get(r.athleteKey);
    if (!athleteId || !r.distance) continue;
    const ev = { event_number: r.eventNumber, distance: r.distance, stroke: r.stroke, gender: r.gender, min_age: r.minAge, max_age: r.maxAge };
    let eventId = eventIds.get(evKey(ev));
    if (!eventId) {
      eventId = must(await supabase.rpc("resolve_import_identity", { p_kind: "event", p_data: { meetId, number: r.eventNumber, distance: r.distance, stroke: r.stroke, gender: r.gender, minAge: r.minAge, maxAge: r.maxAge } }));
      eventIds.set(evKey(ev), eventId);
    }
    const course = r.course ?? p.meet.course;
    const pts = r.isDq ? null : aquaPoints(r.finalMs, course, athleteGender.get(r.athleteKey) ?? r.gender, r.distance, r.stroke);
    // An entry-only upload must never erase an already imported race time.
    const timing: TablesUpdate<"results"> = r.finalMs != null || r.isDq
      ? { final_time_ms: r.finalMs, place: r.place, is_dq: r.isDq, aqua_points: pts }
      : {};
    const res = must(await supabase.from("results").upsert({ athlete_id: athleteId, meet_id: meetId, event_id: eventId, ...(r.seedMs != null ? { seed_time_ms: r.seedMs } : {}), course, ...timing, round: r.round }, { onConflict: "athlete_id,event_id,round" }).select("id").single());
    resultCount++;
    if (r.splits.length) {
      let prev = 0;
      const rows = r.splits.map((s) => {
        const lap = s.cumulative_ms - prev;
        prev = s.cumulative_ms;
        return { result_id: res.id, split_distance: s.distance, cumulative_time_ms: s.cumulative_ms, lap_time_ms: lap };
      });
      maybe(await supabase.from("splits").upsert(rows, { onConflict: "result_id,split_distance" }));
      splitCount += rows.length;
    }
    if (i % 10 === 0) onProgress?.(Math.round((i / total) * 100));
  }
  onProgress?.(100);

  const summary: ImportSummary = { meetId, meetName: p.meet.name, teams: p.teams.length, athletesNew: created, athletesMatched: matched, results: resultCount, splits: splitCount };
  maybe(await supabase.from("import_logs").insert({ file_name: fileName, file_type: p.format, summary: summary as never }));
  return summary;
}
