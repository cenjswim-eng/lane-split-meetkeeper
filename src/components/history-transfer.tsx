import { Fragment, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { eventLabel, formatTime } from "@/lib/swim";
import { HIGH_MATCH, MIN_MATCH, matchScore, nameTokens, type MatchPerson } from "@/lib/history-match";

type Ath = MatchPerson & { team_id: string | null; teams: { code: string; name: string } | null };
type Row = {
  key: string; resultId: string; targetId: string; options: string[]; cand: Ath; score: number;
  meet: string; date: string; event: string; time: string; splits: string; ambiguous: boolean;
};

const fullName = (a: { first_name: string; last_name: string }) => `${a.last_name}, ${a.first_name}`;
const teamName = (a: Ath) => a.teams?.name ?? a.teams?.code ?? "Sin club";

async function loadAll<T>(q: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await q(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) return out;
  }
}

async function findHistory(targetIds: string[] | null, teamId: string | null): Promise<{ rows: Row[]; targets: Ath[] }> {
  const athletes = await loadAll<Ath>((f, t) => supabase.from("athletes").select("id, first_name, last_name, birth_date, gender, federation_id, team_id, teams(code, name)").range(f, t) as never);
  const targets = targetIds ? athletes.filter((a) => targetIds.includes(a.id)) : athletes.filter((a) => a.team_id === teamId);
  const targetSet = new Set(targets.map((t) => t.id));
  const pool = athletes.filter((a) => !targetSet.has(a.id) && (targetIds || a.team_id !== teamId));

  // candidate athlete -> matching targets
  const matches = new Map<string, { target: Ath; score: number }[]>();
  for (const t of targets) {
    const tt = new Set(nameTokens(`${t.first_name} ${t.last_name}`).filter((x) => x.length > 2));
    for (const c of pool) {
      if (!t.federation_id && !nameTokens(`${c.first_name} ${c.last_name}`).some((x) => tt.has(x) || [...tt].some((y) => y.slice(0, 3) === x.slice(0, 3)))) continue;
      const { score } = matchScore(t, c);
      if (score >= MIN_MATCH) matches.set(c.id, [...(matches.get(c.id) ?? []), { target: t, score }]);
    }
  }
  const candIds = [...matches.keys()];
  if (!candIds.length) return { rows: [], targets };

  const results: { id: string; athlete_id: string; final_time_ms: number | null; is_dq: boolean; meets: { name: string; start_date: string | null } | null; events: { distance: number; stroke: number } | null; splits: { split_distance: number; cumulative_time_ms: number }[] }[] = [];
  for (let i = 0; i < candIds.length; i += 100) {
    const chunk = candIds.slice(i, i + 100);
    results.push(...await loadAll((f, t) => supabase.from("results").select("id, athlete_id, final_time_ms, is_dq, meets(name, start_date), events(distance, stroke), splits(split_distance, cumulative_time_ms)").in("athlete_id", chunk).range(f, t) as never) as typeof results);
  }
  const copied = await loadAll<{ source_result_id: string | null; athlete_id: string }>((f, t) => supabase.from("results").select("source_result_id, athlete_id").not("source_result_id", "is", null).in("athlete_id", [...targetSet]).range(f, t) as never);
  const done = new Set(copied.map((c) => `${c.athlete_id}:${c.source_result_id}`));
  const byId = new Map(athletes.map((a) => [a.id, a]));

  // Same-name ambiguity: several candidate identities for one target with different birth dates.
  const perTarget = new Map<string, Set<string>>();
  for (const [cid, ms] of matches) for (const m of ms) {
    const c = byId.get(cid)!;
    perTarget.set(m.target.id, (perTarget.get(m.target.id) ?? new Set()).add(c.birth_date ?? `?${cid}`));
  }

  const rows: Row[] = [];
  for (const r of results) {
    const ms = [...(matches.get(r.athlete_id) ?? [])].sort((a, b) => b.score - a.score);
    const best = ms[0];
    if (!best || done.has(`${best.target.id}:${r.id}`)) continue;
    const ambiguous = ms.length > 1 || (perTarget.get(best.target.id)?.size ?? 0) > 1;
    rows.push({
      key: r.id, resultId: r.id, targetId: best.target.id, options: ms.map((m) => m.target.id), cand: byId.get(r.athlete_id)!,
      score: best.score, ambiguous,
      meet: r.meets?.name ?? "—", date: r.meets?.start_date ?? "", event: r.events ? eventLabel(r.events.distance, r.events.stroke) : "—",
      time: r.is_dq ? "DQ" : formatTime(r.final_time_ms),
      splits: [...r.splits].sort((a, b) => a.split_distance - b.split_distance).map((s) => `${s.split_distance}m ${formatTime(s.cumulative_time_ms)}`).join(" · "),
    });
  }
  rows.sort((a, b) => a.targetId.localeCompare(b.targetId) || b.score - a.score || b.date.localeCompare(a.date));
  return { rows, targets };
}

export function HistoryTransfer({ athleteId, label = "Buscar historial en otros clubes" }: { athleteId?: string; label?: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [teamId, setTeamId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<{ rows: Row[]; targets: Ath[] } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [choice, setChoice] = useState<Record<string, string>>({});

  const teams = useQuery({
    queryKey: ["history-teams"], enabled: open && !athleteId,
    queryFn: async () => {
      const { data } = await supabase.from("teams").select("id, code, name, athletes(count)").order("name");
      return (data ?? []).map((t) => ({ ...t, n: (t.athletes as unknown as { count: number }[])?.[0]?.count ?? 0 })).sort((a, b) => b.n - a.n);
    },
  });
  const team = teamId || teams.data?.[0]?.id || "";

  async function search() {
    setBusy(true);
    try {
      const d = await findHistory(athleteId ? [athleteId] : null, athleteId ? null : team);
      setData(d); setChoice({});
      setSel(new Set(d.rows.filter((r) => r.score >= HIGH_MATCH && !r.ambiguous).map((r) => r.key)));
    } catch (e) { toast.error(e instanceof Error ? e.message : "No se pudo buscar"); }
    setBusy(false);
  }

  async function confirm() {
    if (!data) return;
    const byTarget = new Map<string, string[]>();
    for (const r of data.rows) if (sel.has(r.key)) {
      const t = choice[r.key] ?? r.targetId;
      byTarget.set(t, [...(byTarget.get(t) ?? []), r.resultId]);
    }
    setBusy(true);
    let copied = 0, skipped = 0;
    for (const [target, ids] of byTarget) {
      const { data: res, error } = await supabase.rpc("copy_athlete_history", { _target: target, _results: ids });
      if (error) { toast.error(error.message); setBusy(false); return; }
      const r = res as { copied: number; skipped: number };
      copied += r.copied; skipped += r.skipped;
    }
    setBusy(false);
    toast.success(`${copied} marcas agregadas a ${byTarget.size} ficha(s)` + (skipped ? ` · ${skipped} ya existían y se omitieron` : ""));
    await qc.invalidateQueries();
    setOpen(false); setData(null);
  }

  const targetName = useMemo(() => new Map((data?.targets ?? []).map((t) => [t.id, fullName(t)])), [data]);
  const toggle = (k: string) => setSel((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setData(null); }}>
      <DialogTrigger asChild><Button variant="outline">{label}</Button></DialogTrigger>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>Buscar y traspasar historial de atletas</DialogTitle>
          <DialogDescription>Busca en todas las competencias cargadas, de cualquier equipo, por nombre y apellido (sin tildes, mayúsculas ni orden y tolerando errores de escritura), y confirma con fecha de nacimiento, sexo e ID. Nada se agrega sin tu confirmación y los resultados originales no se modifican.</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-end gap-2">
          {!athleteId && (
            <div className="space-y-1">
              <Label htmlFor="ht-team">Mi club</Label>
              <select id="ht-team" className="h-9 rounded-md border bg-background px-2 text-sm" value={team} onChange={(e) => setTeamId(e.target.value)}>
                {(teams.data ?? []).map((t) => <option key={t.id} value={t.id}>{t.name} ({t.n})</option>)}
              </select>
            </div>
          )}
          <Button onClick={search} disabled={busy || (!athleteId && !team)}>{busy && !data ? "Buscando…" : "Buscar historial"}</Button>
        </div>
        {data && (data.rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No se encontraron marcas nuevas en otros clubes.</p>
        ) : (
          <div className="max-h-[55vh] overflow-auto rounded-md border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-secondary text-left uppercase text-muted-foreground">
                <tr><th className="p-2" /><th className="p-2">Nombre encontrado</th><th className="p-2">Club de origen</th><th className="p-2">Competencia</th><th className="p-2">Fecha</th><th className="p-2">Prueba</th><th className="p-2 text-right">Tiempo</th><th className="p-2">Parciales</th><th className="p-2 text-right">%</th></tr>
              </thead>
              <tbody>
                {data.rows.map((r, i) => (
                  <Fragment key={r.key}>
                    {!athleteId && r.targetId !== data.rows[i - 1]?.targetId && (
                      <tr className="bg-muted"><td colSpan={9} className="p-2 font-semibold">Ficha: {targetName.get(r.targetId)}</td></tr>
                    )}
                    <tr className="border-t align-top">
                      <td className="p-2"><Checkbox checked={sel.has(r.key)} onCheckedChange={() => toggle(r.key)} aria-label="Confirmar marca" /></td>
                      <td className="p-2">
                        <div className="font-medium">{fullName(r.cand)}</div>
                        <div className="text-muted-foreground">{r.cand.birth_date ?? "s/f"} · {r.cand.gender ?? "-"} · ID {r.cand.federation_id ?? "—"}</div>
                        {r.ambiguous && (
                          <div className="mt-1 space-y-1">
                            <Badge variant="destructive">Hay varios atletas con este nombre: elige</Badge>
                            {r.options.length > 1 && (
                              <select className="block w-full rounded border bg-background p-1" value={choice[r.key] ?? r.targetId} onChange={(e) => setChoice({ ...choice, [r.key]: e.target.value })}>
                                {r.options.map((o) => <option key={o} value={o}>{targetName.get(o)}</option>)}
                              </select>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="p-2">{teamName(r.cand)}</td>
                      <td className="p-2">{r.meet}</td>
                      <td className="p-2 time">{r.date}</td>
                      <td className="p-2">{r.event}</td>
                      <td className="p-2 time text-right font-semibold">{r.time}</td>
                      <td className="p-2 time text-muted-foreground">{r.splits || "—"}</td>
                      <td className="p-2 text-right"><Badge variant={r.score >= HIGH_MATCH ? "default" : "secondary"}>{r.score}%</Badge></td>
                    </tr>
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        ))}
        {data && data.rows.length > 0 && (
          <DialogFooter><Button onClick={confirm} disabled={busy || sel.size === 0}>{busy ? "Traspasando…" : `Confirmar ${sel.size} marca(s)`}</Button></DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function TransferLog({ athleteId }: { athleteId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["athlete", athleteId, "transfers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("record_transfers").select("id, copied, skipped, created_at, undone_at").eq("target_athlete_id", athleteId).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  if (!q.data?.length) return null;
  async function undo(id: string) {
    const { data, error } = await supabase.rpc("undo_athlete_history", { _transfer: id });
    if (error) { toast.error(error.message); return; }
    toast.success(`Traspaso deshecho: ${data} marcas retiradas de la ficha`);
    await qc.invalidateQueries();
  }
  return (
    <section>
      <h2 className="mb-3 text-2xl font-bold uppercase">Registro de traspasos</h2>
      <div className="space-y-2">
        {q.data.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3 text-sm">
            <span className="time text-muted-foreground">{new Date(t.created_at).toLocaleString("es-VE")}</span>
            <span className="flex-1">{t.copied} marcas agregadas{t.skipped ? ` · ${t.skipped} omitidas por duplicadas` : ""}</span>
            {t.undone_at ? <Badge variant="secondary">Deshecho</Badge> : <Button size="sm" variant="outline" onClick={() => undo(t.id)}>Deshacer</Button>}
          </div>
        ))}
      </div>
    </section>
  );
}
