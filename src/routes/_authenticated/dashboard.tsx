import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { eventLabel, formatTime } from "@/lib/swim";
import { Button } from '@/components/ui/button';

const dashQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: async () => {
    const [athletes, teams, meets, results] = await Promise.all([
      supabase.from("athletes").select("id", { count: "exact", head: true }),
      supabase.from("teams").select("id", { count: "exact", head: true }),
      supabase.from("meets").select("id, name, start_date"),
      supabase
        .from("results")
        .select("final_time_ms, aqua_points, is_dq, course, round, meets(start_date, name), events(distance, stroke), athletes(first_name, last_name)")
        .not("final_time_ms", "is", null),
    ]);
    for (const r of [athletes, teams, meets, results]) if (r.error) throw r.error;
    return { athletes: athletes.count ?? 0, teams: teams.count ?? 0, meets: meets.data ?? [], results: results.data ?? [] };
  },
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Panel de control — Natacion pro" },
      { name: "description", content: "Evolución de tiempos por temporada, actividad y mejores puntos AQUA del club." },
      { property: "og:title", content: "Panel de control — Natacion pro" }, { name: "twitter:title", content: "Panel de control — Natacion pro" },
      { property: "og:description", content: "Evolución de tiempos por temporada." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashQuery),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(dashQuery);
  const valid = data.results.filter((r) => r.final_time_ms && !r.is_dq && r.events && r.meets?.start_date);

  const years = [...new Set(valid.map((r) => new Date(`${r.meets!.start_date}T00:00:00`).getFullYear()))].sort((a, b) => b - a);
  const curYear = years[0] ?? new Date().getFullYear();
  const prevYear = curYear - 1;

  // Nados por mes (últimos 12 meses con actividad)
  const byMonth = new Map<string, number>();
  for (const r of valid) {
    const m = r.meets!.start_date!.slice(0, 7);
    byMonth.set(m, (byMonth.get(m) ?? 0) + 1);
  }
  const monthSeries = [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([m, n]) => ({ m, n }));

  // Mejor marca por prueba y temporada
  const bestBy = new Map<string, { cur?: number; prev?: number }>();
  for (const r of valid) {
    const y = new Date(`${r.meets!.start_date}T00:00:00`).getFullYear();
    if (y !== curYear && y !== prevYear) continue;
    const k = `${r.events!.distance}-${r.events!.stroke}-${r.course}`;
    const e = bestBy.get(k) ?? {};
    const t = r.final_time_ms!;
    if (y === curYear && (e.cur == null || t < e.cur)) e.cur = t;
    if (y === prevYear && (e.prev == null || t < e.prev)) e.prev = t;
    bestBy.set(k, e);
  }
  const seasonSeries = [...bestBy.entries()]
    .filter(([, v]) => v.cur != null && v.prev != null)
    .map(([k, v]) => {
      const [d = 0, s = 0] = k.split("-").map(Number);
      return { event: eventLabel(d, s), cur: v.cur! / 1000, prev: v.prev! / 1000, delta: ((v.prev! - v.cur!) / v.prev!) * 100 };
    })
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 12);

  // Top AQUA
  const topAqua = [...valid]
    .filter((r) => r.aqua_points)
    .sort((a, b) => (b.aqua_points ?? 0) - (a.aqua_points ?? 0))
    .slice(0, 10);

  const curCount = valid.filter((r) => new Date(`${r.meets!.start_date}T00:00:00`).getFullYear() === curYear).length;

  if (valid.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-4xl font-bold uppercase">Panel de control</h1>
        <Button asChild variant="outline"><Link to="/access">Accesos</Link></Button>
        <div className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          Aún no hay resultados. <Link to="/import" className="text-primary underline">Importa un archivo de Hy-Tek</Link> para ver la evolución.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold uppercase">Panel de control</h1>
        <Button asChild variant="outline"><Link to="/access">Accesos</Link></Button>
        <p className="text-muted-foreground">Temporada {curYear} vs {prevYear}</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Atletas" value={data.athletes} />
        <Kpi label="Clubes" value={data.teams} />
        <Kpi label="Competencias" value={data.meets.length} />
        <Kpi label={`Nados ${curYear}`} value={curCount} accent />
      </div>

      <section className="rounded-lg border bg-card p-5">
        <h2 className="text-2xl font-bold uppercase">Actividad por mes</h2>
        <div className="mt-4 h-56">
          <ResponsiveContainer>
            <BarChart data={monthSeries}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
              <XAxis dataKey="m" stroke="var(--color-muted-foreground)" fontSize={12} />
              <YAxis allowDecimals={false} stroke="var(--color-muted-foreground)" fontSize={12} />
              <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)" }} formatter={(v: number) => [`${v} nados`, ""]} />
              <Bar dataKey="n" fill="var(--color-chart-1)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {seasonSeries.length > 0 && (
        <section className="rounded-lg border bg-card p-5">
          <h2 className="text-2xl font-bold uppercase">Mejor marca por prueba · {prevYear} vs {curYear}</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer>
              <LineChart data={seasonSeries}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                <XAxis dataKey="event" stroke="var(--color-muted-foreground)" fontSize={11} angle={-25} textAnchor="end" height={60} />
                <YAxis reversed domain={["auto", "auto"]} stroke="var(--color-muted-foreground)" fontSize={12} tickFormatter={(v) => formatTime(v * 1000)} width={60} />
                <Tooltip contentStyle={{ background: "var(--color-popover)", border: "1px solid var(--color-border)" }} formatter={(v: number, name) => [formatTime(v * 1000), name === "cur" ? String(curYear) : String(prevYear)]} />
                <Legend formatter={(v) => (v === "cur" ? String(curYear) : String(prevYear))} />
                <Line type="monotone" dataKey="prev" stroke="var(--color-muted-foreground)" strokeWidth={2} dot={{ r: 3 }} />
                <Line type="monotone" dataKey="cur" stroke="var(--color-chart-1)" strokeWidth={2.5} dot={{ r: 4, fill: "var(--color-chart-2)" }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">Eje invertido: más arriba = más rápido. Solo pruebas nadadas en ambas temporadas.</p>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-2xl font-bold uppercase">Top 10 puntos AQUA</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-left text-xs uppercase text-muted-foreground">
              <tr><th className="p-3">#</th><th className="p-3">Atleta</th><th className="p-3">Prueba</th><th className="p-3 text-right">Tiempo</th><th className="p-3 text-right">AQUA</th><th className="p-3">Competencia</th></tr>
            </thead>
            <tbody>
              {topAqua.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="time p-3 text-muted-foreground">{i + 1}</td>
                  <td className="p-3 font-medium">{r.athletes ? `${r.athletes.first_name} ${r.athletes.last_name}` : "—"}</td>
                  <td className="p-3">{eventLabel(r.events!.distance, r.events!.stroke)} <span className="text-muted-foreground">{r.course}</span></td>
                  <td className="time p-3 text-right font-semibold text-primary">{formatTime(r.final_time_ms)}</td>
                  <td className="time p-3 text-right font-semibold text-accent">{r.aqua_points}</td>
                  <td className="p-3 text-muted-foreground">{r.meets?.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <div className={`time text-3xl font-semibold ${accent ? "text-accent" : ""}`}>{value}</div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}
