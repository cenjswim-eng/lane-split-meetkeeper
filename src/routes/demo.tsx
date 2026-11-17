import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowLeft, ArrowRight, CalendarDays, FileText, LayoutDashboard, LockKeyhole, Medal, MessageCircle, Search, Timer, Users, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { demoAthletes, demoMeets, demoRanking, demoSummary, demoSwims, DEMO_SEASON } from "@/lib/demo-data";
import { ageAtDec31, formatTime } from "@/lib/swim";
import { DemoEntryAssistant } from '@/components/demo-entry-assistant';
import { demoAchievements } from '@/lib/demo-achievements';
import { AchievementList } from '@/components/achievement-list';
import { publicHead } from '@/lib/public-seo';
import { DemoBrandedReport } from '@/components/demo-branded-report';

export const Route = createFileRoute("/demo")({
  staticData: { sitemap: true },
  head: () => publicHead('/demo', 'Demo pública del panel — Swim Lane Coach', 'Explora atletas, competencias y reportes con datos ficticios de solo lectura, sin iniciar sesión.', 'website', false),
  component: PublicDemo,
});

const views = [
  { id: "panel", label: "Panel", icon: LayoutDashboard },
  { id: "athletes", label: "Atletas", icon: Users },
  { id: "meets", label: "Competencias", icon: CalendarDays },
  { id: "entries", label: "Inscripciones", icon: FileText },
  { id: "reports", label: "Reportes", icon: FileText },
  { id: "achievements", label: "Logros", icon: Medal },
] as const;
type View = typeof views[number]["id"];
const plansUrl = `https://wa.me/584128503939?text=${encodeURIComponent("Hola, exploré la demo de Swim Lane Coach y quiero conocer los planes y solicitar acceso para mi club.\nNombre: \nClub: \nPaís: ")}`;
const tooltipStyle = { background: "var(--popover)", color: "var(--foreground)", borderColor: "var(--border)", borderRadius: 6 };

function DataTable({ columns, children }: { columns: string[]; children: ReactNode }) {
  return <div className="mt-4 max-w-full overflow-x-auto rounded-md border"><table className="w-full text-left text-sm"><thead className="bg-muted/40"><tr>{columns.map(column => <th key={column} className="whitespace-nowrap px-4 py-3 font-medium text-muted-foreground">{column}</th>)}</tr></thead><tbody className="divide-y">{children}</tbody></table></div>;
}

function Minimum({ remaining }: { remaining: number }) {
  return <span className={`whitespace-nowrap text-xs ${remaining <= 0 ? "text-success" : "text-muted-foreground"}`}>{remaining <= 0 ? `Hizo marca · ${(-remaining / 1000).toFixed(2)} s por debajo` : `Faltan ${(remaining / 1000).toFixed(2)} s`}</span>;
}

function Change({ value }: { value: number | null }) {
  return <span className={`whitespace-nowrap text-xs ${value !== null && value < 0 ? "text-success" : "text-muted-foreground"}`}>{value === null ? "Sin referencia anterior" : value === 0 ? "Sin cambio" : `${value < 0 ? "Mejoró" : "Empeoró"} ${(Math.abs(value) / 1000).toFixed(2)} s`}</span>;
}

function PublicDemo() {
  const [view, setView] = useState<View>("panel");
  const [search, setSearch] = useState("");
  const [selectedAthlete, setSelectedAthlete] = useState<string | null>(null);
  const [selectedMeet, setSelectedMeet] = useState(demoMeets.at(-1)?.id ?? "cierre");
  const summary = demoSummary();
  const ranking = demoRanking();
  const athlete = demoAthletes.find(row => row.id === selectedAthlete);
  const swims = athlete ? demoSwims(athlete) : [];
  const best = athlete ? ranking.find(row => row.athlete.id === athlete.id)?.best : undefined;
  const meet = demoMeets.find(row => row.id === selectedMeet);
  const visibleAthletes = demoAthletes.filter(row => row.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().includes(search.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim()));

  function openAthlete(id: string) { setSelectedAthlete(id); setView("athletes"); }
  function selectView(next: View) { setView(next); setSelectedAthlete(null); }
  function navigation(mobile = false) {
    return views.map(({ id, label, icon: Icon }) => <Button key={id} variant="ghost" aria-pressed={view === id} onClick={() => selectView(id)} className={`${mobile ? "h-14 min-w-0 flex-col gap-1 px-1 text-[10px]" : "h-11 w-full justify-start gap-3"} ${view === id ? "bg-sidebar-accent text-primary" : "text-muted-foreground"}`}><Icon className="size-5 shrink-0" />{label}</Button>);
  }

  return <div className="app-workspace min-h-screen">
    <aside className="fixed inset-y-0 left-0 hidden w-64 flex-col border-r bg-sidebar lg:flex">
      <Link to="/" className="flex items-center gap-3 border-b px-5 py-6 text-lg font-semibold"><Waves className="size-7 shrink-0 text-primary" />Swim Lane Coach</Link>
      <div className="px-5 pt-5"><p className="font-semibold">Club Horizonte</p><p className="mt-1 text-xs text-muted-foreground">Club ficticio · Temporada {DEMO_SEASON}</p></div>
      <nav aria-label="Paneles de la demo" className="space-y-1 px-3 py-6">{navigation()}</nav>
      <div className="mt-auto space-y-4 border-t p-5"><p className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="size-4" />Demo de solo lectura</p><Button asChild className="h-auto w-full whitespace-normal py-3"><a href={plansUrl} target="_blank" rel="noopener noreferrer"><MessageCircle />Consultar planes</a></Button><Button asChild variant="ghost" className="w-full justify-start"><Link to="/"><ArrowLeft />Volver al inicio</Link></Button></div>
    </aside>
    <div className="lg:ml-64">
      <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-8"><Link to="/" className="flex min-w-0 items-center gap-2 font-semibold"><Waves className="size-6 shrink-0 text-primary" /><span className="truncate">Swim Lane Coach</span></Link><Button asChild variant="outline" size="sm"><Link to="/auth">Iniciar sesión<ArrowRight className="size-4" /></Link></Button></div></header>
      <div className="border-b bg-secondary/30"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-xs sm:px-8"><span className="flex items-center gap-2 font-semibold text-primary"><LockKeyhole className="size-4" />Demo pública · Solo lectura</span><span className="text-muted-foreground">Todos los nombres, competencias, tiempos y mínimas son ficticios. No son marcas oficiales.</span></div></div>
      <main className="workspace-content mx-auto max-w-7xl space-y-8 px-4 py-6 pb-28 sm:px-8 lg:pb-12">
        <header className="border-b pb-6"><p className="text-xs font-medium uppercase text-primary">Club Horizonte · Temporada {DEMO_SEASON}</p><h1 className="mt-2">{athlete ? athlete.name : view === "panel" ? "Panel del club" : view === "athletes" ? "Atletas del club" : view === "meets" ? "Competencias y resultados" : view === 'entries' ? 'Inscripciones del club' : view === 'achievements' ? 'Logros del club' : "Reportes y ranking"}</h1><p className="mt-2 text-sm text-muted-foreground">{athlete ? `100 m Libre · Piscina de 50 m · ${ageAtDec31(athlete.birth, DEMO_SEASON)} años al 31 de diciembre` : "Resumen del entrenador · Datos de ejemplo"}</p></header>
        {view === 'entries' && <DemoEntryAssistant/>}
        {view === 'reports' && <DemoBrandedReport/>}
        {view === 'achievements' && <section className="space-y-4"><h2>Logros del club · Ejemplo</h2><AchievementList rows={demoAchievements()} filters readOnly/></section>}

        {view === "panel" && <>
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">{[
            { label: "Total de atletas", value: summary.athletes, icon: Users },
            { label: "Competencias importadas", value: summary.meets, icon: CalendarDays },
            { label: "Mejores marcas recientes", value: summary.bests, icon: Timer },
            { label: "Mínimas alcanzadas", value: summary.qualified, icon: Medal },
          ].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-lg border bg-card p-4 sm:p-5"><Icon className="size-5 text-primary" /><p className="time mt-4 text-3xl font-semibold">{value}</p><h2 className="mt-1 !text-sm">{label}</h2><p className="mt-2 text-xs text-muted-foreground">Datos de ejemplo · últimos 9 meses</p></div>)}</div>
          <div className="flex flex-wrap gap-2 border-y py-4"><Button onClick={() => selectView("athletes")}><Users />Ver atletas</Button><Button variant="outline" onClick={() => selectView("reports")}><FileText />Ver reportes</Button><Button variant="outline" onClick={() => selectView("meets")}><CalendarDays />Ver competencias</Button></div>
          <section className="space-y-4"><h2>Logros recientes</h2><AchievementList rows={demoAchievements()} limit={4} readOnly/><Button variant="link" onClick={()=>selectView('achievements')}>Todos los logros</Button></section>
          <div className="grid gap-8 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
            <section className="min-w-0"><h2>Resultados recientes del club</h2><p className="mt-1 text-xs text-muted-foreground">{summary.swims} nados individuales · Piscina de 50 m</p><div className="mt-5 h-64 w-full" role="img" aria-label="Resultados de ejemplo: nados del club en cada competencia de la temporada"><ResponsiveContainer width="100%" height="100%"><BarChart data={demoMeets.map(row => ({ month: new Date(`${row.date}T12:00:00`).toLocaleDateString("es", { month: "short" }), swims: demoAthletes.length }))}><CartesianGrid stroke="var(--border)" vertical={false} strokeDasharray="3 5" /><XAxis dataKey="month" stroke="var(--muted-foreground)" /><YAxis allowDecimals={false} stroke="var(--muted-foreground)" width={28} /><Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--muted)" }} /><Bar dataKey="swims" name="Resultados" fill="var(--primary)" maxBarSize={40} radius={[3, 3, 0, 0]} isAnimationActive={false} /></BarChart></ResponsiveContainer></div></section>
            <section><h2>Próximas competencias</h2><div className="mt-5 border-y py-5"><p className="text-xs text-accent">12 DIC 2026 · PISCINA DE 50 M</p><h3 className="mt-2 text-lg font-semibold">Encuentro de cierre Demo</h3><p className="mt-2 text-sm text-muted-foreground">Centro Acuático de Ejemplo</p></div><Button variant="link" className="mt-2 px-0" onClick={() => selectView("meets")}>Ver competencias cargadas<ArrowRight /></Button></section>
          </div>
          <section><h2>Últimos resultados</h2><div className="mt-4 divide-y border-y">{demoAthletes.map(row => <Button key={row.id} variant="ghost" className="h-auto w-full justify-between gap-4 rounded-none py-4 text-left" onClick={() => openAthlete(row.id)}><span className="min-w-0"><span className="block truncate font-semibold">{row.name}</span><span className="mt-1 block text-xs font-normal text-muted-foreground">100 m Libre · {demoMeets.at(-1)?.name}</span></span><span className="time shrink-0 text-base">{formatTime(row.times.at(-1))}</span><ArrowRight className="size-4 shrink-0" /></Button>)}</div></section>
        </>}

        {view === "athletes" && !athlete && <section><div className="relative max-w-sm"><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input aria-label="Buscar atleta en la demo" placeholder="Buscar atleta por nombre" value={search} onChange={event => setSearch(event.target.value)} className="pl-9" /></div><DataTable columns={["Atleta", "Edad (31 dic)", "Mejor 100 Libre", "AQUA", "Ficha"]}>{visibleAthletes.map(row => { const result = ranking.find(item => item.athlete.id === row.id)?.best; return <tr key={row.id}><td className="whitespace-nowrap px-4 py-3 font-semibold">{row.name}</td><td className="px-4 py-3">{ageAtDec31(row.birth, DEMO_SEASON)}</td><td className="time px-4 py-3">{formatTime(result?.time)}</td><td className="time px-4 py-3 text-primary">{result?.points}</td><td className="px-4 py-3"><Button variant="outline" size="sm" onClick={() => openAthlete(row.id)} aria-label={`Ver ficha de ${row.name}`}>Ver ficha<ArrowRight /></Button></td></tr>; })}</DataTable>{visibleAthletes.length === 0 && <p className="py-6 text-sm text-muted-foreground">No hay atletas de ejemplo con ese nombre.</p>}</section>}

        {view === "athletes" && athlete && <>
          <Button variant="outline" onClick={() => setSelectedAthlete(null)}><ArrowLeft />Todos los atletas</Button>
          <div className="grid gap-4 sm:grid-cols-3">{[{ label: "Mejor marca · 100 m Libre", value: formatTime(best?.time) }, { label: "Mejor puntuación AQUA", value: best?.points }, { label: "Mínima ilustrativa · 50 m", value: formatTime(best?.minimum) }].map(row => <div key={row.label} className="rounded-lg border bg-card p-5"><p className="text-xs text-muted-foreground">{row.label}</p><p className="time mt-3 text-2xl font-semibold text-primary">{row.value}</p></div>)}</div>
          <section><h2>Evolución · 100 m Libre</h2><p className="mt-1 text-xs text-muted-foreground">Tiempo en segundos · Menos es mejor · Piscina de 50 m</p><div className="mt-4 h-64" role="img" aria-label={`Evolución de tiempos ficticios de ${athlete.name}`}><ResponsiveContainer width="100%" height="100%"><LineChart data={swims.map(row => ({ date: row.meet.date, seconds: row.time / 1000 }))} margin={{ top: 12, left: 0, right: 15, bottom: 5 }}><CartesianGrid stroke="var(--border)" strokeDasharray="3 5" /><XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} /><YAxis domain={["dataMin - 1", "dataMax + 1"]} width={38} stroke="var(--muted-foreground)" /><Tooltip contentStyle={tooltipStyle} /><Line dataKey="seconds" name="Tiempo (s)" stroke="var(--primary)" strokeWidth={3} dot={{ r: 5, fill: "var(--primary)" }} isAnimationActive={false} /></LineChart></ResponsiveContainer></div></section>
          <section><h2>Reporte individual</h2><DataTable columns={["Competencia", "Fecha", "Tiempo", "Variación", "AQUA", "Mínima", "Diferencia con mínima"]}>{[...swims].sort((a, b) => a.time - b.time).map(row => <tr key={row.meet.id}><td className="whitespace-nowrap px-4 py-4">{row.meet.name}</td><td className="whitespace-nowrap px-4 py-4 text-muted-foreground">{row.meet.date}</td><td className="time px-4 py-4 font-semibold">{formatTime(row.time)}</td><td className="px-4 py-4"><Change value={row.change} /></td><td className="time px-4 py-4 text-primary">{row.points}</td><td className="time px-4 py-4">{formatTime(row.minimum)}</td><td className="px-4 py-4"><Minimum remaining={row.remaining} /></td></tr>)}</DataTable></section>
        </>}

        {view === "meets" && <><div className="grid gap-3 sm:grid-cols-3">{demoMeets.map(row => <Button key={row.id} variant="outline" aria-pressed={selectedMeet === row.id} className={`h-auto flex-col items-start whitespace-normal p-4 text-left ${selectedMeet === row.id ? "border-primary bg-secondary" : ""}`} onClick={() => setSelectedMeet(row.id)}><CalendarDays className="mb-2 text-primary" /><span className="font-semibold">{row.name}</span><span className="text-xs font-normal text-muted-foreground">{row.date} · 50 m · {demoAthletes.length} resultados</span></Button>)}</div><section><h2>{meet?.name}</h2><p className="mt-2 text-sm text-muted-foreground">{meet?.location} · 100 m Libre · Resultados de ejemplo</p><DataTable columns={["Atleta", "Tiempo oficial", "AQUA", "Mínima ilustrativa", "Ficha"]}>{demoAthletes.map(row => { const swim = demoSwims(row).find(result => result.meet.id === selectedMeet); return swim ? <tr key={row.id}><td className="whitespace-nowrap px-4 py-3">{row.name}</td><td className="time px-4 py-3">{formatTime(swim.time)}</td><td className="time px-4 py-3 text-primary">{swim.points}</td><td className="px-4 py-3"><Minimum remaining={swim.remaining} /></td><td className="px-4 py-3"><Button size="sm" variant="ghost" onClick={() => openAthlete(row.id)} aria-label={`Ver ficha de ${row.name}`}><ArrowRight /></Button></td></tr> : null; })}</DataTable></section></>}

        {view === "reports" && <section><h2>Ranking interno por puntos AQUA</h2><p className="mt-2 text-sm text-muted-foreground">Mejor puntuación individual por atleta · Últimos nueve meses · Datos de ejemplo</p><DataTable columns={["Puesto", "Atleta", "Prueba / piscina", "Mejor tiempo", "AQUA", "Reporte individual"]}>{ranking.map(({ athlete: row, best: result }, index) => <tr key={row.id}><td className="time px-4 py-4 text-accent">{index + 1}</td><td className="whitespace-nowrap px-4 py-4 font-semibold">{row.name}</td><td className="whitespace-nowrap px-4 py-4 text-muted-foreground">100 m Libre · 50 m</td><td className="time px-4 py-4">{formatTime(result.time)}</td><td className="time px-4 py-4 font-semibold text-primary">{result.points}</td><td className="px-4 py-4"><Button size="sm" variant="outline" onClick={() => openAthlete(row.id)} aria-label={`Ver reporte de ${row.name}`}>Ver reporte<ArrowRight /></Button></td></tr>)}</DataTable></section>}

        <footer className="flex flex-wrap items-center justify-between gap-4 border-t pt-6"><p className="text-xs text-muted-foreground">Compatible con Meet Manager y Team Manager</p><Button asChild variant="outline"><a href={plansUrl} target="_blank" rel="noopener noreferrer"><MessageCircle />Consultar planes y acceso</a></Button></footer>
      </main>
    </div>
    <nav aria-label="Paneles de la demo en móvil" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t bg-background/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1 backdrop-blur lg:hidden">{navigation(true)}</nav>
  </div>;
}