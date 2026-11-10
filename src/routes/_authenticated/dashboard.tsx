import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Users, CalendarDays, Timer, Medal, Upload, ArrowUpRight, CalendarClock, Download, Waves } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { eventLabel, formatTime } from "@/lib/swim";
import { Button } from "@/components/ui/button";
import { NewAthlete } from "@/components/new-athlete";
import { ShareSummary } from "@/components/share-summary";
import { MeetExport } from "@/components/meet-export";
import { exportMeet, exportPdf } from "@/lib/meet-files";
import { dashboardSummary } from "@/lib/dashboard-summary";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const dashQuery = queryOptions({
  queryKey: ["dashboard"],
  queryFn: async () => {
    const [athletes, meets, standards] = await Promise.all([
      supabase.from("athletes").select("id", { count: "exact", head: true }),
      supabase.from("meets").select("id, name, start_date, end_date, location, course").order("start_date", { ascending: false }),
      supabase.from("time_standards").select("*"),
    ]);
    for (const r of [athletes, meets, standards]) if (r.error) throw r.error;
    const results = [];
    for (let offset = 0; ; offset += 1000) {
      const page = await supabase.from("results").select("id, athlete_id, final_time_ms, is_dq, course, meets(id, start_date, name), events(distance, stroke, is_relay), athletes(first_name, last_name, gender, birth_date)").not("final_time_ms", "is", null).order("id").range(offset, offset + 999);
      if (page.error) throw page.error;
      results.push(...page.data);
      if (page.data.length < 1000) break;
    }
    return { athletes: athletes.count ?? 0, meets: meets.data ?? [], standards: standards.data ?? [], results };
  },
});

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "Resumen del entrenador — Swim Lane Coach" },
    { name: "description", content: "Resumen privado del club: atletas, competencias, mejores marcas, mínimas y resultados recientes." },
    { property: "og:title", content: "Resumen del entrenador — Swim Lane Coach" },
    { property: "og:description", content: "Competencias, marcas recientes y actividad deportiva del club en Swim Lane Coach." },
    { name: "twitter:title", content: "Resumen del entrenador — Swim Lane Coach" },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(dashQuery),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useSuspenseQuery(dashQuery);
  const summary = dashboardSummary(data.results, data.standards);
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = data.meets.filter(m => m.start_date && m.start_date >= today).sort((a, b) => (a.start_date ?? "").localeCompare(b.start_date ?? "")).slice(0, 4);
  const [exportOpen, setExportOpen] = useState(false);
  const [selected, setSelected] = useState(data.meets[0]?.id ?? "");
  const meet = data.meets.find(m => m.id === selected);
  const dateLabel = new Date().toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return <div className="space-y-8">
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
      <div className="min-w-0"><p className="text-xs font-medium uppercase text-primary">Resumen del entrenador</p><h1 className="mt-1 text-4xl font-bold sm:text-5xl">Panel del club</h1><p className="mt-2 text-sm capitalize text-muted-foreground">{dateLabel}</p></div>
      <Waves className="mt-5 hidden size-10 shrink-0 text-primary sm:block" />
    </header>
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {[
        { label: "Total de atletas", value: data.athletes, detail: "Registro deportivo", icon: Users, color: "text-primary" },
        { label: "Competencias importadas", value: data.meets.length, detail: "Sin duplicar reimportaciones", icon: CalendarDays, color: "text-accent" },
        { label: "Mejores marcas recientes", value: summary.bestCount, detail: "Por atleta, prueba y piscina · 9 meses", icon: Timer, color: "text-primary" },
        { label: "Mínimas alcanzadas", value: summary.qualifiedCount, detail: data.standards.length ? "Marcas que cumplen una mínima · 9 meses" : "Sin mínimas configuradas", icon: Medal, color: "text-success" },
      ].map(({ label, value, detail, icon: Icon, color }) => <div key={label} className="flex min-w-0 flex-col rounded-lg border bg-card p-4 sm:p-5"><div className="flex items-center justify-between gap-2"><Icon className={`size-5 shrink-0 ${color}`} /><span className="text-[10px] text-muted-foreground">CLUB</span></div><p className={`time mt-4 text-3xl font-semibold ${color}`}>{value}</p><h2 className="mt-1 font-sans text-sm font-medium leading-snug">{label}</h2><p className="mt-2 text-xs leading-relaxed text-muted-foreground">{detail}</p></div>)}
    </div>
    <section aria-label="Accesos rápidos" className="border-y py-4"><div className="grid gap-2 sm:flex sm:flex-wrap">
      <Button asChild className="h-11"><Link to="/import"><Upload />Importar archivo</Link></Button><NewAthlete /><Button variant="outline" className="h-11" onClick={() => setExportOpen(true)}><Download />Exportar SD3</Button><ShareSummary text={`Swim Lane Coach\nResumen del club · ${today}\nAtletas: ${data.athletes}\nCompetencias: ${data.meets.length}\nMejores marcas vigentes: ${summary.bestCount}\nMínimas alcanzadas: ${summary.qualifiedCount}\nResultados de los últimos 9 meses: ${summary.recent.length}`} />
    </div></section>
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]">
      <section className="min-w-0"><div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"><div className="min-w-0"><h2 className="text-2xl font-semibold">Resultados recientes del club</h2><p className="mt-1 text-xs text-muted-foreground">Nados individuales por mes · últimos 9 meses</p></div><span className="time mt-1 text-lg text-primary">{summary.recent.length}</span></div>
        {summary.recent.length ? <><div className="mt-5 flex flex-wrap gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><span className="size-2 rounded-sm bg-primary" />Resultados</span><span className="flex items-center gap-2"><span className="size-2 rounded-sm bg-accent" />Mejores marcas vigentes</span></div><div className="mt-3 h-64 w-full" role="img" aria-label="Gráfico mensual de resultados y mejores marcas del club"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary.months} margin={{ top: 10, right: 0, left: -25, bottom: 0 }}><CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 5" /><XAxis dataKey="label" tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} interval="preserveStartEnd" /><YAxis allowDecimals={false} tickLine={false} axisLine={false} stroke="var(--muted-foreground)" fontSize={11} /><Tooltip contentStyle={{ background: "var(--popover)", borderColor: "var(--border)", borderRadius: 6, color: "var(--foreground)" }} cursor={{ fill: "var(--muted)" }} labelFormatter={(_, payload) => payload[0]?.payload.month ?? ""} /><Bar dataKey="swims" name="Resultados" fill="var(--primary)" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} /><Bar dataKey="bests" name="Mejores marcas" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={22} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></> : <div className="mt-5 flex h-64 flex-col items-center justify-center border-y border-dashed text-center"><Timer className="mb-3 size-8 text-muted-foreground" /><p className="text-sm text-muted-foreground">Sin resultados en los últimos nueve meses.</p><Button variant="link" asChild><Link to="/import">Importar resultados<ArrowUpRight /></Link></Button></div>}
      </section>
      <section className="min-w-0"><div className="flex items-center gap-2"><CalendarClock className="size-5 text-accent" /><h2 className="text-2xl font-semibold">Próximas competencias</h2></div><div className="mt-5 divide-y border-y">{upcoming.length ? upcoming.map(m => <Link key={m.id} to="/meets" className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 py-4"><div className="text-center"><span className="time text-xl text-accent">{m.start_date?.slice(8)}</span><p className="text-xs uppercase text-muted-foreground">{new Date(`${m.start_date}T12:00:00Z`).toLocaleDateString("es", { month: "short", timeZone: "UTC" })}</p></div><div className="min-w-0"><p className="break-words text-sm font-semibold">{m.name}</p><p className="mt-1 break-words text-xs text-muted-foreground">{m.location || "Sede por confirmar"} · {m.course}</p></div><ArrowUpRight className="size-4 shrink-0 text-muted-foreground" /></Link>) : <p className="py-8 text-sm text-muted-foreground">No hay competencias futuras registradas.</p>}</div><Button asChild variant="link" className="mt-2 px-0"><Link to="/meets">Todas las competencias<ArrowUpRight /></Link></Button></section>
    </div>
    <section><div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3"><h2 className="text-2xl font-semibold">Últimos resultados</h2><Button asChild variant="link" className="px-0"><Link to="/athletes">Atletas<ArrowUpRight /></Link></Button></div><div className="mt-3 divide-y border-y">{summary.latest.length ? summary.latest.map(r => <Link key={r.id} to="/athletes/$id" params={{ id: r.athlete_id }} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 py-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] hover:bg-secondary/30"><div className="min-w-0"><p className="break-words text-sm font-semibold">{r.athletes?.first_name} {r.athletes?.last_name}</p><p className="mt-1 text-xs text-primary">{r.events ? eventLabel(r.events.distance, r.events.stroke) : "—"} · {r.course}</p><p className="mt-1 break-words text-xs text-muted-foreground sm:hidden">{r.meets?.name} · {r.meets?.start_date}</p></div><div className="hidden min-w-0 sm:block"><p className="break-words text-sm text-muted-foreground">{r.meets?.name}</p><p className="mt-1 text-xs text-muted-foreground">{r.meets?.start_date}</p></div><p className="time shrink-0 text-lg font-semibold">{formatTime(r.final_time_ms)}</p></Link>) : <p className="py-8 text-sm text-muted-foreground">Aún no hay marcas recientes para mostrar.</p>}</div></section>
    <Dialog open={exportOpen} onOpenChange={setExportOpen}><DialogContent className="w-[calc(100%-2rem)] rounded-lg"><DialogHeader><DialogTitle>Exportar SD3</DialogTitle><DialogDescription>Competencia del club</DialogDescription></DialogHeader>{data.meets.length ? <><Select value={selected} onValueChange={setSelected}><SelectTrigger aria-label="Competencia a exportar"><SelectValue /></SelectTrigger><SelectContent>{data.meets.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select>{meet && <MeetExport name={meet.name} prepare={kind => kind === "sd3" ? exportMeet(meet) : exportPdf(meet, kind)} />}</> : <p className="text-sm text-muted-foreground">Importa una competencia antes de exportar.</p>}</DialogContent></Dialog>
  </div>;
}
