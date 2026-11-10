import { createFileRoute, Link } from "@tanstack/react-router";
import { Waves } from "lucide-react";

export const Route = createFileRoute("/terminos")({
  head: () => ({
    meta: [
      { title: "Términos de uso | Natación Pro" },
      { name: "description", content: "Términos de uso de Natación Pro, software para entrenadores y clubes de natación." },
    ],
  }),
  component: Terminos,
});

function Terminos() {
  return (
    <main className="landing min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-12 sm:px-10">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold"><Waves className="size-6 text-primary" aria-hidden="true" />Natación <span className="text-primary">Pro</span></Link>
        <h1 className="mt-8 text-3xl font-semibold">Términos de uso</h1>
        <div className="mt-6 space-y-5 leading-relaxed text-muted-foreground">
          <p>Natación Pro es un software de gestión para entrenadores y clubes de natación, compatible con archivos de Meet Manager y Team Manager.</p>
          <p>El acceso es por suscripción y requiere la aprobación del dueño del software. Cada cuenta gestiona exclusivamente sus propios clubes, atletas y registros.</p>
          <p>El pago y la duración del plan se acuerdan directamente por WhatsApp. Si una suscripción no se renueva, el acceso puede suspenderse hasta regularizar el pago.</p>
          <p>Para cualquier duda sobre estos términos, escríbenos por WhatsApp desde la página de inicio.</p>
        </div>
        <Link to="/" className="mt-10 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline">Volver a la página de inicio</Link>
      </div>
    </main>
  );
}
