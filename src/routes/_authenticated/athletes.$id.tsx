import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { ageAt, eventLabel, formatTime } from "@/lib/swim";
import { Badge } from "@/components/ui/badge";
import { PdfExport } from "@/components/pdf-export";
import { DeleteAthlete } from "@/components/delete-athlete";
import { athleteProgressPdf } from "@/lib/reports";
import { rankedAthleteRecords } from "@/lib/athlete-records";
import { Button } from "@/components/ui/button";
import { AthleteTrainingZones } from "@/components/athlete-training-zones";
import { standardApplies } from "@/lib/standard-rules";
import { HistoryTransfer, TransferLog } from "@/components/history-transfer";

const profileQuery = (id: string) =>
  queryOptions({
    queryKey: ["athlete", id],
    queryFn: async () => {
      const [a, r, s] = await Promise.all([
        supabase.from("athletes").select("*, teams(code, name), groups(name)").eq("id", id).single(),
        supabase
          .from("results")
          .select("id, seed_time_ms, final_time_ms, course, place, aqua_points, is_dq, round, origin_team, meets(id, name, start_date, location), events(distance, stroke, event_number), splits(split_distance, cumulative_time_ms, lap_time_ms)")
          .eq("athlete_id", id),
        supabase.from("time_standards").select("*"),
      ]);
      if (a.error) throw a.error;
      if (r.error) throw r.error;
      return { athlete: a.data, results: rankedAthleteRecords(r.data), total: r.data.length, standards: s.data ?? [] };
    },
  });

export const Route = createFileRoute("/_authenticated/athletes/$id")({
  head: () => ({ meta: [{ title: "Perfil del atleta — Natacion pro" }, { name: "description", content: "Mejores marcas, progresión y parciales del nadador." }, { property: "og:title", content: "Perfil del atleta — Natacion pro" }, { name: "twitter:title", content: "Perfil del atleta — Natacion pro" }, { property: "og:description", content: "Mejores marcas, progresión y parciales del nadador." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: ({ context, params }) => context.queryClient.ensureQueryData(profileQuery(params.id)),
  component: Profile,
});

type Res = Awaited<ReturnType<ReturnType<typeof profileQuery>["queryFn"] & {}>>["results"][number];

function Profile() {
  const navigate = useNavigate();
  const { id } = Route.useParams();
  const { data } = useSuspenseQuery(profileQuery(id));
  const { athlete, results, standards, total } = data;

  const valid = useMemo(() => results.filter((r) => r.events != null && r.final_time_ms != null && !r.is_dq), [results]);
  const byEvent = useMemo(() => {
    const m = new Map<string, Res[]>();
    for (const r of valid) {
      if (!r.events) continue;
      const k = `${r.events.distance}-${r.events.stroke}-${r.course}`;
      const list = m.get(k) ?? [];
      list.push(r);
      m.set(k, list);
    }
    return [...m.entries()].sort(([a], [b]) => {
      const [da, sa] = a.split("-").map(Number), [db, sb] = b.split("-").map(Number);
      return (sa ?? 0) - (sb ?? 0) || (da ?? 0) - (db ?? 0);
    });
  }, [valid]);

  const [selected, setSelected] = useState<string | null>(byEvent[0]?.[0] ?? null);
  const series = [...(byEvent.find(([k]) => k === selected)?.[1] ?? [])].sort((a, b) => (a.meets?.start_date ?? "").localeCompare(b.meets?.start_date ?? ""));
  const first = series[0];
  const best = (list: Res[]) => list[0];
  const age = ageAt(athlete.birth_date);
  const totalPts = Math.max(0, ...valid.map((r) => r.aqua_points ?? 0));

  const clubOf = (r: Res) => r.origin_team ?? athlete.teams?.name ?? "Sin club";
  const clubs = [...new Set(results.map(clubOf))];
  const [club, setClub] = useState("");
  const recent = club ? results.filter((r) => clubOf(r) === club) : results;
  const [openSplit, setOpenSplit] = useState<string | null>(null);

  function standardFor(r: Res) {
    const event = r.events;
    const time = r.final_time_ms;
    if (!event || time == null) return undefined;
    const year = Number(r.meets?.start_date?.slice(0, 4) ?? new Date().getFullYear());
    const s = standards
      .filter((s) => s.distance === event.distance && s.stroke === event.stroke && s.course === r.course && (!s.gender || s.gender === athlete.gender) && standardApplies(s, athlete.birth_date, year))
      .sort((a, b) => (b.season_year != null ? 1 : 0) - (a.season_year != null ? 1 : 0) || a.qualifying_time_ms - b.qualifying_time_ms)[0];
    if (!s) return undefined;
    return { name: s.name, limit: s.qualifying_time_ms, met: time <= s.qualifying_time_ms, diff: time - s.qualifying_time_ms };
  }

  return (
    <div className="space-y-8">
      <Link to="/athletes" className="text-sm text-muted-foreground hover:text-foreground">← Atletas</Link>
      <div className="flex flex-wrap justify-end gap-2"><HistoryTransfer athleteId={id} /><PdfExport title="Seguimiento del atleta" label="PDF de seguimiento" prepare={() => athleteProgressPdf(athlete, results, standards)} /><DeleteAthlete id={id} name={`${athlete.first_name} ${athlete.last_name}`} onDeleted={() => navigate({ to: "/athletes" })} /></div>
      <section className="grid gap-6 rounded-lg border bg-card p-6 md:grid-cols-[1fr_auto]">
        <div>
          <p className="time text-xs uppercase tracking-widest text-primary">{athlete.teams?.name ?? "Sin club"}</p>
          <h1 className="mt-1 text-5xl font-bold uppercase leading-none">
            {athlete.first_name} <span className="text-accent">{athlete.last_name}</span>
          </h1>
          <div className="mt-3 flex flex-wrap gap-2 text-sm">
            <Badge variant="secondary">{athlete.gender === "F" ? "Femenino" : athlete.gender === "M" ? "Masculino" : "—"}</Badge>
            <Badge variant="secondary">{age != null ? `${age} años` : "Edad desconocida"}</Badge>
            {athlete.federation_id && <Badge variant="secondary" className="time">ID {athlete.federation_id}</Badge>}
            {athlete.tm_athlete_id && <Badge variant="outline" className="time">{athlete.tm_athlete_id}</Badge>}
            {!athlete.active_status && <Badge variant="destructive">Inactivo</Badge>}
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4 text-center md:text-right">
          <Stat label="Pruebas" value={byEvent.length} />
          <Stat label="Nados" value={valid.length} />
          <Stat label="Mejor AQUA" value={totalPts || "—"} accent />
        </div>
      </section>

      {byEvent.length === 0 ? (
        total === 0 ? (
          <div className="space-y-3 rounded-lg border border-dashed p-8 text-center text-muted-foreground">
            <p className="font-semibold text-foreground">Este atleta aún no tiene tiempos cargados.</p>
            <p>Si compitió con otro club, sus resultados no están en los archivos que subiste porque fueron exportados solo para tu equipo.</p>
            <p>Sube los resultados completos de la competencia (HY3, CL2, SD3 o PDF con todos los equipos) en <Link to="/import" className="text-primary underline">Importar</Link> y luego pulsa «Buscar historial en otros clubes».</p>
            <div className="flex justify-center"><HistoryTransfer athleteId={id} /></div>
          </div>
        ) : <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">Sin marcas válidas en los últimos 9 meses.</div>
      ) : (
        <>
          <section>
            <h2 className="mb-3 text-2xl font-bold uppercase">Mejores marcas</h2>
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
                  <tr><th className="p-3">Prueba</th><th className="p-3">Piscina</th><th className="p-3 text-right">Mejor</th><th className="p-3 text-right">AQUA</th><th className="p-3">Competencia</th><th className="p-3">Mínima</th></tr>
                </thead>
                <tbody>
                  {byEvent.map(([k, list]) => {
                    const b = best(list);
                     if (!b?.events) return null;
                    const std = standardFor(b);
                    return (
                      <tr key={k} onClick={() => setSelected(k)} className={`cursor-pointer border-t hover:bg-muted ${selected === k ? "bg-muted" : ""}`}>
                        <td className="p-3 font-medium">{eventLabel(b.events.distance, b.events.stroke)}</td>
                        <td className="p-3 text-muted-foreground">{b.course}</td>
                        <td className="time p-3 text-right text-base font-semibold text-primary">{formatTime(b.final_time_ms)}</td>
                        <td className="time p-3 text-right">{b.aqua_points ?? "—"}</td>
                        <td className="p-3 text-muted-foreground">{b.meets?.name}</td>
                        <td className="p-3">{std ? (
                          <div className="space-y-1">
                            <div className="time font-semibold">{formatTime(std.limit)}</div>
                            <Badge variant={std.met ? "default" : "destructive"} className={std.met ? "bg-success text-primary-foreground" : ""}>
                              {std.met ? "Hizo marca" : `Faltan ${(std.diff / 1000).toFixed(2)} s`}
                            </Badge>
                          </div>
                        ) : <span className="text-xs text-muted-foreground">Sin mínima cargada</span>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {first?.events && (
            <section className="rounded-lg border bg-card p-5">
              <h2 className="text-2xl font-bold uppercase">Progresión · {eventLabel(first.events.distance, first.events.stroke)} <span className="text-muted-foreground">{first.course}</span></h2>
              <div className="mt-4 h-64">
                <ResponsiveContainer>
                  <LineChart data={series.map((r) => ({ date: r.meets?.start_date ?? "", t: (r.final_time_ms ?? 0) / 1000, meet: r.meets?.name }))}>
                    <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                    <XAxis dataKey="date" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis reversed domain={["auto", "auto"]} stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => formatTime(v * 1000)} width={60} />
                    <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)" }} formatter={(v: number) => formatTime(v * 1000)} labelFormatter={(l, p) => `${l} · ${p?.[0]?.payload?.meet ?? ""}`} />
                    <Line type="monotone" dataKey="t" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--color-chart-2)" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">El eje está invertido: más arriba = más rápido.</p>
            </section>
          )}
        </>
      )}

      <AthleteTrainingZones key={id} records={results} />

      <TransferLog athleteId={id} />

      <section>
        <h2 className="mb-3 text-2xl font-bold uppercase">Marcas · mejor a peor <span className="text-base font-normal text-muted-foreground">Últimos 9 meses</span></h2>
        {clubs.length > 1 && (
          <select aria-label="Filtrar por club" className="mb-3 h-9 rounded-md border bg-background px-2 text-sm" value={club} onChange={(e) => setClub(e.target.value)}>
            <option value="">Todos los clubes</option>
            {clubs.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        )}
        <div className="space-y-2">
          {recent.map((r) => (
            <div key={r.id} className="rounded-lg border bg-card">
              <Button variant="ghost" className="flex h-auto w-full flex-wrap items-center justify-start gap-3 whitespace-normal p-3 text-left" onClick={() => setOpenSplit(openSplit === r.id ? null : r.id)}>
                <span className="w-16 time text-xs text-muted-foreground">{r.meets?.start_date ?? ""}</span>
                <span className="flex-1 font-medium">{r.events ? eventLabel(r.events.distance, r.events.stroke) : "—"} <span className="text-muted-foreground">· {r.meets?.name}</span></span>
                {r.round === "P" && <Badge variant="outline">Elim.</Badge>}
                {r.origin_team && <Badge variant="secondary">Club anterior: {r.origin_team}</Badge>}
                <span className="time text-xs text-muted-foreground">sembrado {formatTime(r.seed_time_ms)}</span>
                <span className="time w-20 text-right font-semibold">{r.is_dq ? <span className="text-destructive">DQ</span> : formatTime(r.final_time_ms)}</span>
                <span className="time w-10 text-right text-accent">{r.place ? `${r.place}º` : ""}</span>
                {r.splits.length > 0 && <span className="text-xs text-primary">{openSplit === r.id ? "▲" : "▼"} parciales</span>}
              </Button>
              {openSplit === r.id && r.splits.length > 0 && <Splits splits={r.splits} />}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Splits({ splits }: { splits: { split_distance: number; cumulative_time_ms: number; lap_time_ms: number | null }[] }) {
  const s = [...splits].sort((a, b) => a.split_distance - b.split_distance);
  return (
    <div className="grid gap-4 border-t p-4 md:grid-cols-2">
      <table className="text-sm">
        <thead className="text-xs uppercase text-muted-foreground"><tr><th className="text-left">Dist.</th><th className="text-right">Acumulado</th><th className="text-right">Parcial</th></tr></thead>
        <tbody>
          {s.map((x) => (
            <tr key={x.split_distance}><td>{x.split_distance} m</td><td className="time text-right">{formatTime(x.cumulative_time_ms)}</td><td className="time text-right text-primary">{formatTime(x.lap_time_ms)}</td></tr>
          ))}
        </tbody>
      </table>
      <div className="h-40">
        <ResponsiveContainer>
          <BarChart data={s.map((x) => ({ d: x.split_distance, lap: (x.lap_time_ms ?? 0) / 1000 }))}>
            <XAxis dataKey="d" stroke="var(--color-muted-foreground)" fontSize={11} />
            <YAxis domain={["dataMin - 1", "auto"]} hide />
            <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)" }} formatter={(v: number) => formatTime(v * 1000)} />
            <Bar dataKey="lap" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: React.ReactNode; accent?: boolean }) {
  return (
    <div>
      <div className={`time text-3xl font-semibold ${accent ? "text-accent" : ""}`}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
