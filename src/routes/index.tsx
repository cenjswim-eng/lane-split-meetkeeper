import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChartNoAxesCombined, FileDown, FileUp, Waves } from "lucide-react";
import { LandingProgress } from "@/components/landing-progress";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Natación Pro — Compatible con Meet Manager y Team Manager" },
      { name: "description", content: "Natación Pro. Importa tus archivos de Meet Manager y Team Manager y mira la progresión de cada nadador en un solo lugar." },
      { property: "og:title", content: "Natación Pro — Compatible con Meet Manager y Team Manager" },
      { property: "og:site_name", content: "Natación Pro" },
      { name: "twitter:title", content: "Natación Pro — Compatible con Meet Manager y Team Manager" },
      { property: "og:description", content: "Importa tus archivos de Meet Manager y Team Manager y mira la progresión de cada nadador en un solo lugar." },
      { name: "twitter:description", content: "Importa tus archivos de Meet Manager y Team Manager y mira la progresión de cada nadador en un solo lugar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="landing min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center gap-2 px-6 py-6 sm:px-10">
        <Waves className="size-6 text-primary" aria-hidden="true" />
        <span className="text-lg font-semibold">Natación Pro</span>
      </header>
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-14 pt-6 sm:px-10 sm:pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-20 lg:pt-16">
        <div className="min-w-0">
          <p className="text-sm font-medium text-muted-foreground">Natación Pro · Para entrenadores y clubes</p>
          <h1 className="mt-5 max-w-xl text-[42px] font-semibold leading-[1.08] sm:text-5xl lg:text-[56px]">Cada parcial de tus nadadores, sin perder ninguno</h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">Importa tus archivos de Meet Manager y Team Manager y mira la progresión de cada nadador en un solo lugar.</p>
          <div className="mt-7 flex flex-col items-start gap-1">
            <Button asChild size="lg" className="h-12 max-w-full px-6 text-base shadow-none">
              <Link to="/dashboard">Importar mi primer archivo<ArrowRight aria-hidden="true" /></Link>
            </Button>
            <Button asChild variant="link" className="min-h-11 h-auto max-w-full whitespace-normal px-0 text-sm text-muted-foreground">
              <Link to="/dashboard">Ya tengo cuenta, iniciar sesión</Link>
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="mr-1">Compatible con</span>
            {["HY3", "CL2", "SD3", "ZIP", "MDB"].map((format) => <span key={format} className="rounded border border-border px-2 py-1 font-medium">{format}</span>)}
          </div>
        </div>
        <LandingProgress />
      </section>
      <section className="border-y border-border">
        <div className="mx-auto grid max-w-6xl gap-10 px-6 py-12 sm:px-10 md:grid-cols-3 md:gap-12 md:py-16">
          {[
            { icon: FileUp, title: "Importa", text: "Arrastra el archivo de la competencia y se cargan resultados, inscripciones y parciales." },
            { icon: ChartNoAxesCombined, title: "Analiza", text: "Ve la progresión de cada nadador, sus puntos AQUA y quién está cerca de las mínimas." },
            { icon: FileDown, title: "Exporta", text: "Genera el SD3 listo para cargar en Team Manager." },
          ].map(({ icon: Icon, title, text }, index) => (
            <div key={title} className="min-w-0">
              <div className="mb-4 flex items-center justify-between"><span className="time text-sm text-muted-foreground">{index + 1}.</span><Icon className="size-6 text-primary" aria-hidden="true" /></div>
              <h2 className="text-xl font-semibold">{title}</h2>
              <p className="mt-3 leading-relaxed text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-6 py-14 sm:px-10 md:py-20">
        <h2 className="max-w-3xl text-2xl font-medium leading-relaxed sm:text-3xl">Todo tu club en un panel: compara equipos, categorías y temporadas sin armar hojas de cálculo a mano.</h2>
      </section>
      <section className="border-t border-border bg-muted">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-12 sm:px-10 md:flex-row md:items-center">
          <h2 className="text-2xl font-semibold">Prueba con el archivo de tu última competencia</h2>
          <Button asChild size="lg" className="h-12 max-w-full shrink-0 px-6 text-base shadow-none"><Link to="/dashboard">Importar mi primer archivo<ArrowRight aria-hidden="true" /></Link></Button>
        </div>
      </section>
      <footer className="mx-auto max-w-6xl px-6 py-6 text-xs text-muted-foreground sm:px-10">Compatible con Meet Manager y Team Manager</footer>
    </main>
  );
}
