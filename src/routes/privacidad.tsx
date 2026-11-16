import { createFileRoute, Link } from "@tanstack/react-router";
import { publicHead } from "@/lib/public-seo";
import { Waves } from "lucide-react";

export const Route = createFileRoute("/privacidad")({
  staticData: { sitemap: true },
  head: () => publicHead("/privacidad", "Privacidad — Swim Lane Coach", "Privacidad de registros del club, consultas de contacto y reportes compartidos por autorización.", "website", false),
  component: Privacidad,
});

function Privacidad() {
  return (
    <main className="landing min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:px-10">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold"><Waves className="size-6 text-primary" aria-hidden="true" />Swim Lane <span className="text-primary">Coach</span></Link>
        <h1 className="mt-8 text-3xl font-semibold">Privacidad</h1>
        <div className="mt-6 space-y-5 leading-relaxed text-muted-foreground">
          <p>Cada cuenta de Swim Lane Coach es privada: solo tú ves los atletas, resultados, documentos y registros de tu club. Ninguna otra cuenta puede acceder a ellos.</p>
          <p>Los documentos que subes (archivos de competencias, registros del club, PDF) se almacenan de forma privada y solo se usan para prestarte el servicio.</p>
          <p>No vendemos tus registros. Las consultas del formulario (nombre, club, país, correo y campaña de origen si está presente) se guardan para que el dueño atienda tu solicitud y reciba un aviso por correo. Los planes y pagos se acuerdan por WhatsApp.</p><p>Los reportes solo se comparten cuando el entrenador confirma una copia seleccionada. Quien tenga el enlace podrá leerla durante su vigencia; el entrenador puede revocarlo.</p><p>La medición de visitas mediante Google Analytics solo se activa cuando se conecta el servicio. Los eventos no incluyen nombres, correos ni identificadores de atletas; las páginas privadas y los enlaces de reportes no se envían como páginas vistas.</p>
          <p>Puedes solicitar la eliminación de tus datos escribiéndonos por WhatsApp desde la página de inicio.</p>
        </div>
        <Link to="/" className="mt-10 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">Volver a la página de inicio</Link>
      </div>
    </main>
  );
}
