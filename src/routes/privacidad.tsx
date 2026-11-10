import { createFileRoute, Link } from "@tanstack/react-router";
import { Waves } from "lucide-react";

export const Route = createFileRoute("/privacidad")({
  head: () => ({
    meta: [
      { title: "Privacidad | Swim Lane Coach" },
      { name: "description", content: "Política de privacidad de Swim Lane Coach: cada cuenta ve solo sus propios clubes, atletas y documentos." },
    ],
  }),
  component: Privacidad,
});

function Privacidad() {
  return (
    <main className="landing min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:px-10">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold"><Waves className="size-6 text-primary" aria-hidden="true" />Natación <span className="text-primary">Pro</span></Link>
        <h1 className="mt-8 text-3xl font-semibold">Privacidad</h1>
        <div className="mt-6 space-y-5 leading-relaxed text-muted-foreground">
          <p>Cada cuenta de Swim Lane Coach es privada: solo tú ves los atletas, resultados, documentos y registros de tu club. Ninguna otra cuenta puede acceder a ellos.</p>
          <p>Los documentos que subes (archivos de competencias, registros del club, PDF) se almacenan de forma privada y solo se usan para prestarte el servicio.</p>
          <p>No vendemos ni compartimos tus datos con terceros. Las conversaciones de planes y pagos ocurren directamente por WhatsApp con el dueño del software.</p>
          <p>Puedes solicitar la eliminación de tus datos escribiéndonos por WhatsApp desde la página de inicio.</p>
        </div>
        <Link to="/" className="mt-10 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">Volver a la página de inicio</Link>
      </div>
    </main>
  );
}
