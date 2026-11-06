import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChartNoAxesCombined, FileDown, FileUp, Waves, MessageCircle } from "lucide-react";
import { LandingProgress } from "@/components/landing-progress";

const plansWhatsAppUrl = `https://wa.me/584128503939?text=${encodeURIComponent("Hola, soy entrenador y quiero solicitar acceso a Natacion pro.\nMi nombre: \nClub: \nPaís: \nQuisiera conocer los planes, precios, medios de pago y los pasos para activar mi cuenta.")}`;

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
      <header className="mx-auto flex max-w-6xl items-center gap-3 border-b border-border px-6 py-6 sm:px-10">
        <Waves className="size-6 text-primary" aria-hidden="true" />
        <span className="text-xl font-semibold">Natación <span className="text-accent">Pro</span></span>
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
            <Button asChild variant="outline" className="mt-3 min-h-11 h-auto max-w-full whitespace-normal border-border bg-background px-4 py-3 shadow-none hover:bg-muted hover:text-foreground"><a href={plansWhatsAppUrl} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />Consultar planes por WhatsApp<ArrowRight aria-hidden="true" /></a></Button>
            <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">Consulta el plan y la forma de pago por WhatsApp. El acceso requiere aprobación del dueño; crear una cuenta no lo activa automáticamente.</p>
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
      <section aria-labelledby="plans-heading" className="border-t border-border">
        <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10 md:py-16">
          <p className="text-sm font-medium text-primary">Planes y acceso para entrenadores</p>
          <h2 id="plans-heading" className="mt-3 text-2xl font-semibold sm:text-3xl">De la consulta al acceso de tu club</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
            {[
              { title: "Consulta por WhatsApp", text: "Envíanos tu nombre, club y país. Consulta los planes disponibles, su precio, duración y qué incluyen antes de decidir." },
              { title: "Acuerda el plan y el pago", text: "Confirma por WhatsApp el importe y el medio de pago con el dueño. Una vez acordados, realiza el pago y envía el comprobante en esa conversación." },
              { title: "Solicita la activación", text: "Crea tu cuenta desde «Iniciar sesión» e indica por WhatsApp el correo que registraste. El dueño revisa tu solicitud y confirma la aprobación del acceso." },
            ].map(({ title, text }, index) => (
              <li key={title} className="min-w-0">
                <span className="time text-sm text-primary">0{index + 1}</span>
                <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
          <div className="mt-8 flex flex-col items-start gap-3">
            <Button asChild size="lg" className="min-h-12 h-auto max-w-full whitespace-normal px-5 py-3 text-base shadow-none"><a href={plansWhatsAppUrl} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />Solicitar plan y acceso por WhatsApp<ArrowRight aria-hidden="true" /></a></Button>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">El pago se coordina directamente por WhatsApp, no en esta página. No compartas contraseñas ni datos de tarjetas en el chat. La activación no es automática.</p>
          </div>
        </div>
      </section>
      <section className="border-t border-border bg-muted">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-12 sm:px-10 md:flex-row md:items-center">
          <h2 className="text-2xl font-semibold">Prueba con el archivo de tu última competencia</h2>
          <Button asChild size="lg" className="h-12 max-w-full shrink-0 px-6 text-base shadow-none"><Link to="/dashboard">Importar mi primer archivo<ArrowRight aria-hidden="true" /></Link></Button>
        </div>
      </section>
      <footer className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-6 text-xs text-muted-foreground sm:px-10"><span>Compatible con Meet Manager y Team Manager</span><Button asChild variant="link" className="h-auto min-h-11 px-0 text-sm"><a href={plansWhatsAppUrl} target="_blank" rel="noopener noreferrer"><MessageCircle />Planes y suscripciones</a></Button></footer>
    </main>
  );
}
