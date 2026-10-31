import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Natación Pro — Compatible con Meet Manager" },
      { name: "description", content: "Importa archivos HY3, CL2 y SD3 de Hy-Tek y sigue la progresión de cada nadador." },
      { property: "og:title", content: "Natación Pro — Compatible con Meet Manager" },
      { property: "og:description", content: "Importa archivos HY3, CL2 y SD3 de Hy-Tek y sigue la progresión de cada nadador." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
      <div className="lane-line mb-10 w-40" />
      <p className="time text-sm uppercase tracking-widest text-primary">HY3 · CL2 · SD3 · ZIP</p>
      <h1 className="mt-3 text-6xl font-bold uppercase leading-none md:text-8xl">
        Natación <span className="text-accent">Pro</span>
      </h1>
      <p className="mt-6 max-w-xl text-lg text-muted-foreground">
        Recibe los archivos de Meet Manager y Team Manager sin perder un solo parcial, y convierte cada resultado en la historia del nadador.
      </p>
      <div className="mt-10 flex gap-3">
        <Button asChild size="lg">
          <Link to="/athletes">Entrar al panel</Link>
        </Button>
      </div>
      <div className="mt-20 grid grid-cols-3 gap-px overflow-hidden rounded-lg border bg-border">
        {[
          ["Importa", "Resultados, inscripciones y parciales"],
          ["Analiza", "Progresión, puntos AQUA y mínimas"],
          ["Exporta", "SD3 listo para Team Manager"],
        ].map(([t, d]) => (
          <div key={t} className="bg-card p-5">
            <h3 className="text-xl font-semibold uppercase">{t}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
