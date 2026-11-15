import { Building2, Users, CalendarDays, Timer, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { demoSummary } from "@/lib/demo-data";
import { LandingProgress } from "@/components/landing-progress";

// Only immutable public demo fixtures: no account queries or aggregate private data.
export function LandingStatistics() {
  const summary = demoSummary();
  const stats = [
    { icon: Building2, value: 1, label: "Club de ejemplo", detail: "Club Horizonte" },
    { icon: Users, value: summary.athletes, label: "Atletas", detail: "Una ficha por nadador" },
    { icon: CalendarDays, value: summary.meets, label: "Competencias", detail: "Una temporada conectada" },
    { icon: Timer, value: summary.swims, label: "Resultados", detail: "Cada tiempo cuenta" },
  ];
  return (
    <section id="estadisticas" className="border-b border-border" aria-labelledby="statistics-title">
      <div className="mx-auto max-w-6xl px-6 py-10 sm:px-10 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div><p className="text-xs font-medium uppercase tracking-widest text-primary">El club, en números</p><h2 id="statistics-title" className="mt-3 text-2xl font-semibold sm:text-3xl">Una mirada. Toda la temporada.</h2></div>
          <p className="max-w-xs text-sm text-muted-foreground">Datos ficticios de la demo, no estadísticas de usuarios reales.</p>
        </div>
        <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-7 border-y border-border py-6 lg:grid-cols-4">
          {stats.map(({ icon: Icon, value, label, detail }) => <div key={label} className="landing-stat min-w-0">
            <dt className="flex items-center gap-2 text-sm text-muted-foreground"><Icon className="size-4 shrink-0 text-primary" aria-hidden="true" />{label}</dt>
            <dd className="mt-2 text-4xl font-semibold tabular-nums sm:text-5xl">{value.toString().padStart(2, "0")}</dd>
            <dd className="mt-2 text-xs text-muted-foreground">{detail}</dd>
          </div>)}
        </dl>
        <div className="mt-10 grid items-center gap-8 lg:grid-cols-[0.85fr_1fr] lg:gap-16">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-primary">Del dato a la decisión</p>
            <h3 className="mt-3 max-w-md text-3xl font-semibold leading-tight">El progreso no se adivina.<br />Se ve.</h3>
            <p className="mt-4 max-w-md leading-relaxed text-muted-foreground">Atletas, competencias y resultados conectados para seguir la evolución de cada nadador.</p>
            <div className="mt-6 flex items-center gap-4 border-l-2 border-primary pl-4"><span className="text-3xl font-semibold tabular-nums text-primary">{summary.qualified}/{summary.athletes}</span><span className="text-sm text-muted-foreground">atletas alcanzan la mínima<br />ilustrativa de la demo</span></div>
            <Button asChild variant="link" className="mt-5 h-11 px-0"><Link to="/demo">Ver el club de ejemplo<ArrowUpRight aria-hidden="true" /></Link></Button>
          </div>
          <LandingProgress />
        </div>
      </div>
    </section>
  );
}