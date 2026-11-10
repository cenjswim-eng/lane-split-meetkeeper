import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  ArrowRight, ChartNoAxesCombined, FileDown, FileUp, Waves, MessageCircle, LogIn, Play,
  UserRound, CreditCard, ShieldCheck, Table2, Target, Medal, FileSpreadsheet, LayoutDashboard,
} from "lucide-react";
import { LandingProgress } from "@/components/landing-progress";
import { LandingReveal } from "@/components/landing-reveal";
import summaryVideo from "@/assets/videos/natacion-pro-resumen.mp4.asset.json";
import summaryPoster from "@/assets/videos/natacion-pro-resumen-poster.jpg.asset.json";

const plansWhatsAppUrl = `https://wa.me/584128503939?text=${encodeURIComponent("Hola, soy entrenador y quiero solicitar acceso a Natación Pro.\nMi nombre: \nClub: \nPaís: \nQuisiera conocer los planes, precios, medios de pago y los pasos para activar mi cuenta.")}`;
const homeTitle = "Natación Pro | Software para entrenadores y clubes de natación";
const homeDescription = "Gestiona atletas, resultados y marcas mínimas de tu club de natación. Software para entrenadores, compatible con Meet Manager y Team Manager. Consulta planes.";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: homeTitle },
      { name: "description", content: homeDescription },
      { property: "og:title", content: homeTitle },
      { property: "og:site_name", content: "Natación Pro" },
      { name: "twitter:title", content: homeTitle },
      { property: "og:description", content: homeDescription },
      { name: "twitter:description", content: homeDescription },
      { property: "og:url", content: "https://swimlanecoach.app/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://swimlanecoach.app/" }],
  }),
  component: Index,
});

function WhatsAppButton({ label, className = "" }: { label: string; className?: string }) {
  return (
    <Button asChild size="lg" className={`min-h-12 h-auto max-w-full whitespace-normal px-6 py-3 text-base shadow-none ${className}`}>
      <a href={plansWhatsAppUrl} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />{label}<ArrowRight aria-hidden="true" /></a>
    </Button>
  );
}

function MockCompare() {
  const rows = [
    { name: "Equipo A", width: "86%" },
    { name: "Equipo B", width: "64%" },
    { name: "Equipo C", width: "48%" },
  ];
  return (
    <div className="space-y-3" role="img" aria-label="Maqueta de ejemplo: comparación de puntos entre tres equipos.">
      {rows.map(({ name, width }) => (
        <div key={name} className="flex items-center gap-3">
          <span className="w-20 shrink-0 truncate text-xs text-muted-foreground">{name}</span>
          <div className="h-3 flex-1 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width }} /></div>
        </div>
      ))}
    </div>
  );
}

function MockMinimum() {
  return (
    <div className="space-y-3" role="img" aria-label="Maqueta de ejemplo: dos nadadores cerca de la marca mínima y uno que ya la logró.">
      {[
        { name: "100 m Libre", state: "Faltan 0.42 s", ok: false },
        { name: "200 m Pecho", state: "Hizo marca", ok: true },
        { name: "50 m Mariposa", state: "Faltan 1.10 s", ok: false },
      ].map(({ name, state, ok }) => (
        <div key={name} className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2">
          <span className="truncate text-xs">{name}</span>
          <span className={`shrink-0 text-xs font-medium ${ok ? "text-primary" : "text-muted-foreground"}`}>{state}</span>
        </div>
      ))}
    </div>
  );
}

function MockSd3() {
  return (
    <div className="flex items-center gap-4 rounded-md border border-border p-4" role="img" aria-label="Maqueta de ejemplo: archivo SD3 de inscripciones listo para Team Manager.">
      <FileSpreadsheet className="size-10 shrink-0 text-primary" aria-hidden="true" />
      <div className="min-w-0">
        <p className="time truncate text-sm font-semibold">inscripciones-estadal.sd3</p>
        <p className="mt-1 text-xs text-muted-foreground">28 atletas · 64 inscripciones · listo para Team Manager</p>
      </div>
    </div>
  );
}

function MockChart() {
  return (
    <svg viewBox="0 0 220 90" className="w-full" role="img" aria-label="Maqueta de ejemplo: línea de progresión de tiempos a la baja.">
      <path d="M10 20L60 34L110 30L160 58L210 72" className="text-primary" stroke="currentColor" strokeWidth="3" fill="none" strokeLinejoin="round" />
      <g className="text-primary" fill="currentColor">
        <circle cx="10" cy="20" r="4" /><circle cx="60" cy="34" r="4" /><circle cx="110" cy="30" r="4" /><circle cx="160" cy="58" r="4" /><circle cx="210" cy="72" r="4" />
      </g>
    </svg>
  );
}

function Index() {
  return (
    <main className="landing min-h-screen">
      <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-6 py-4 sm:px-10">
          <a href="#inicio" className="flex items-center gap-2"><Waves className="size-7 text-primary" aria-hidden="true" /><span className="text-xl font-semibold">Natación <span className="text-primary">Pro</span></span></a>
          <nav aria-label="Navegación de inicio" className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" className="hidden lg:inline-flex"><a href="#funciones">Funciones</a></Button>
            <Button asChild variant="ghost" className="hidden lg:inline-flex"><a href="#como-funciona">Cómo funciona</a></Button>
            <Button asChild variant="ghost" className="hidden sm:inline-flex"><a href="#planes">Planes</a></Button>
            <Button asChild variant="ghost" className="hidden sm:inline-flex"><a href="#preguntas">Preguntas</a></Button>
            <Button asChild variant="outline" size="sm" className="min-h-10"><Link to="/dashboard" aria-label="Iniciar sesión"><LogIn aria-hidden="true" /><span className="hidden sm:inline">Iniciar sesión</span></Link></Button>
            <Button asChild size="sm" className="min-h-10 shadow-none"><a href={plansWhatsAppUrl} target="_blank" rel="noopener noreferrer"><span className="hidden sm:inline">Solicitar acceso</span><span className="sm:hidden">Acceso</span></a></Button>
          </nav>
        </div>
      </header>

      <section id="inicio" className="mx-auto grid max-w-6xl items-center gap-10 px-6 pb-14 pt-8 sm:px-10 sm:pt-12 lg:grid-cols-[1.05fr_1fr] lg:gap-14 lg:pb-16">
        <div className="landing-enter min-w-0">
          <p className="flex items-center gap-2 text-sm font-medium text-primary"><span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden="true" />Natación Pro · Para entrenadores y clubes</p>
          <h1 className="mt-5 max-w-xl text-[42px] font-semibold leading-[1.08] sm:text-5xl lg:text-[56px]">Cada parcial de tus nadadores, <span className="text-primary">sin perder ninguno</span></h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">Importa tus archivos de Meet Manager y Team Manager y mira la progresión de cada nadador en un solo lugar.</p>
          <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <WhatsAppButton label="Solicitar acceso por WhatsApp" />
            <Button asChild variant="outline" size="lg" className="min-h-12 h-auto max-w-full whitespace-normal border-border bg-background px-6 py-3 text-base shadow-none hover:bg-muted hover:text-foreground">
              <a href="#como-funciona">Ver cómo funciona</a>
            </Button>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="mr-1">Compatible con</span>
            {["HY3", "CL2", "SD3", "ZIP", "MDB"].map((format) => <span key={format} className="rounded border border-border px-2 py-1 font-medium">{format}</span>)}
          </div>
        </div>
        <div className="landing-enter landing-preview min-w-0">
          <div className="overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-2.5" aria-hidden="true">
              <span className="size-2.5 rounded-full bg-muted-foreground/40" /><span className="size-2.5 rounded-full bg-muted-foreground/40" /><span className="size-2.5 rounded-full bg-muted-foreground/40" />
              <span className="ml-3 truncate rounded bg-muted px-3 py-1 text-[11px] text-muted-foreground">app.Swim Lane Coach — panel del entrenador</span>
            </div>
            <LandingProgress />
          </div>
        </div>
      </section>

      <LandingReveal>
        <section className="border-y border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10 md:py-16">
            <h2 className="max-w-2xl text-2xl font-semibold sm:text-3xl">Deja de perseguir tiempos entre hojas de cálculo</h2>
            <div className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
              {[
                { icon: Table2, title: "Sin hojas de cálculo", text: "Los resultados, parciales e inscripciones se cargan solos desde el archivo de la competencia." },
                { icon: ChartNoAxesCombined, title: "Parciales y progresión por nadador", text: "Cada atleta tiene su ficha con tiempos, parciales y evolución de los últimos nueve meses." },
                { icon: Target, title: "Marcas mínimas y puntos AQUA al instante", text: "Compara cada resultado con la mínima de su categoría y conoce su puntuación sin calcular a mano." },
              ].map(({ icon: Icon, title, text }) => (
                <div key={title} className="landing-feature min-w-0 border-l-2 border-border pl-5">
                  <Icon className="size-6 text-primary" aria-hidden="true" />
                  <h3 className="mt-4 text-xl font-semibold">{title}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </LandingReveal>

      <LandingReveal>
        <section id="como-funciona" className="mx-auto max-w-6xl px-6 py-12 sm:px-10 md:py-16">
          <p className="text-sm font-medium text-primary">Cómo funciona</p>
          <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">De la competencia al análisis en tres pasos</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
            {[
              { icon: FileUp, title: "Importa", text: "Arrastra el archivo de la competencia y se cargan resultados, inscripciones y parciales." },
              { icon: ChartNoAxesCombined, title: "Analiza", text: "Ve la progresión de cada nadador, sus puntos AQUA y quién está cerca de las mínimas." },
              { icon: FileDown, title: "Exporta", text: "Genera el SD3 listo para cargar en Team Manager." },
            ].map(({ icon: Icon, title, text }, index) => (
              <li key={title} className="landing-feature min-w-0 border-t border-border pt-5">
                <div className="flex items-center justify-between"><span className="time text-sm text-primary">0{index + 1}</span><Icon className="size-5 text-primary" aria-hidden="true" /></div>
                <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>
      </LandingReveal>

      <LandingReveal>
        <section id="funciones" className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10 md:py-16">
            <p className="text-sm font-medium text-primary">Funciones</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Todo lo que el entrenador revisa después de cada competencia</h2>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {[
                { icon: ChartNoAxesCombined, title: "Gráfica de progresión", text: "La evolución de cada prueba y piscina, lista para el reporte en PDF del atleta.", mock: <MockChart /> },
                { icon: Medal, title: "Comparación entre equipos y temporadas", text: "Ranking interno por puntos AQUA y comparación entre categorías y temporadas.", mock: <MockCompare /> },
                { icon: Target, title: "Cercanía a marcas mínimas", text: "Cuánto falta para la mínima de cada categoría, por prueba, sexo y piscina.", mock: <MockMinimum /> },
                { icon: FileDown, title: "Exportación SD3", text: "Inscripciones compatibles con Meet Manager y Team Manager, listas para compartir.", mock: <MockSd3 /> },
              ].map(({ icon: Icon, title, text, mock }) => (
                <article key={title} className="landing-feature min-w-0 rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center gap-3"><Icon className="size-6 shrink-0 text-primary" aria-hidden="true" /><h3 className="text-lg font-semibold">{title}</h3></div>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{text}</p>
                  <div className="mt-5 rounded-md border border-border bg-background p-4">{mock}</div>
                  <p className="mt-2 text-xs text-muted-foreground">Datos de ejemplo</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </LandingReveal>

      <LandingReveal>
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10 md:py-16">
            <div className="flex items-center gap-3"><LayoutDashboard className="size-6 text-primary" aria-hidden="true" /><h2 className="text-2xl font-semibold sm:text-3xl">Mira el panel por dentro</h2></div>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">Así se ve el trabajo diario: el resumen del club, la ficha de cada atleta y los reportes listos para compartir.</p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              <figure className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-3 text-sm font-semibold">Panel principal</div>
                <div className="space-y-3 p-4" role="img" aria-label="Maqueta de ejemplo del panel principal con totales de atletas y competencias.">
                  <div className="grid grid-cols-3 gap-2">
                    {["24 atletas", "6 competencias", "11 mínimas"].map((label) => <span key={label} className="rounded-md border border-border px-2 py-2 text-center text-[11px] text-muted-foreground">{label}</span>)}
                  </div>
                  <MockChart />
                </div>
                <figcaption className="px-4 pb-4 text-xs text-muted-foreground">Datos de ejemplo</figcaption>
              </figure>
              <figure className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-3 text-sm font-semibold">Ficha del atleta</div>
                <div className="space-y-2 p-4" role="img" aria-label="Maqueta de ejemplo de la ficha del atleta con tiempos y marcas mínimas.">
                  {[
                    ["100 m Libre", "1:06.00", "Hizo marca"],
                    ["200 m CI", "2:28.40", "Faltan 0.90 s"],
                    ["50 m Espalda", "31.25", "Faltan 0.35 s"],
                  ].map(([event, time, state]) => (
                    <div key={event} className="flex items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-[11px]">
                      <span className="truncate">{event}</span><span className="time shrink-0">{time}</span><span className="shrink-0 text-muted-foreground">{state}</span>
                    </div>
                  ))}
                </div>
                <figcaption className="px-4 pb-4 text-xs text-muted-foreground">Datos de ejemplo</figcaption>
              </figure>
              <figure className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-3 text-sm font-semibold">Reportes</div>
                <div className="space-y-2 p-4" role="img" aria-label="Maqueta de ejemplo de reportes en PDF y Excel listos para compartir.">
                  {["Ficha del atleta · PDF", "Resultados de la competencia · PDF", "Ranking del club · Excel"].map((label) => (
                    <div key={label} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-[11px]"><FileSpreadsheet className="size-4 shrink-0 text-primary" aria-hidden="true" /><span className="truncate">{label}</span></div>
                  ))}
                </div>
                <figcaption className="px-4 pb-4 text-xs text-muted-foreground">Datos de ejemplo</figcaption>
              </figure>
            </div>
          </div>
        </section>
      </LandingReveal>

      {/* Bloque listo pero oculto hasta tener contenido real: "Clubes que ya lo usan" y "Testimonios". */}

      <LandingReveal>
        <section id="planes" className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10 md:py-16">
            <p className="text-sm font-medium text-primary">Planes</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Elige el plan que se ajusta a tu club</h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">Los precios y la duración se confirman por WhatsApp según el tamaño de tu club.</p>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {[
                { name: "Entrenador", text: "Para un entrenador con su grupo de atletas.", benefits: ["Atletas y resultados ilimitados", "Progresión y puntos AQUA", "Marcas mínimas por categoría", "Reportes en PDF y Excel"] },
                { name: "Club", text: "Para clubes con varios entrenadores y categorías.", benefits: ["Todo lo del plan Entrenador", "Registro completo del club", "Inscripciones y exportación SD3", "Ranking interno del club"] },
                { name: "Liga o federación", text: "Para organizaciones con varios clubes.", benefits: ["Todo lo del plan Club", "Varios clubes y cuentas", "Soporte prioritario por WhatsApp"] },
              ].map(({ name, text, benefits }) => (
                <article key={name} className="landing-feature flex min-w-0 flex-col rounded-lg border border-border bg-card p-6">
                  <h3 className="text-xl font-semibold">{name}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
                  <p className="time mt-4 text-lg font-semibold text-primary">Consulta tu plan</p>
                  <ul className="mt-4 flex-1 space-y-2 text-sm text-muted-foreground">
                    {benefits.map((benefit) => <li key={benefit} className="flex items-start gap-2"><ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />{benefit}</li>)}
                  </ul>
                  <WhatsAppButton label="Consultar este plan" className="mt-6 w-full justify-center" />
                </article>
              ))}
            </div>
          </div>
        </section>
      </LandingReveal>

      <LandingReveal>
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10 md:py-16">
            <p className="text-sm font-medium text-primary">Activación</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Cómo activar tu cuenta</h2>
            <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
              {[
                { icon: UserRound, title: "Escríbenos por WhatsApp", text: "Envíanos tu nombre, club y país para conocer los planes disponibles." },
                { icon: CreditCard, title: "Acuerda plan y pago", text: "Confirma el importe y el medio de pago directamente en la conversación." },
                { icon: ShieldCheck, title: "Crea tu cuenta y te activamos", text: "Regístrate desde «Iniciar sesión» e indica tu correo; el dueño aprueba tu acceso." },
              ].map(({ icon: Icon, title, text }, index) => (
                <li key={title} className="landing-feature min-w-0 border-t border-border pt-5">
                  <div className="flex items-center justify-between"><span className="time text-sm text-primary">0{index + 1}</span><Icon className="size-5 text-primary" aria-hidden="true" /></div>
                  <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-8 max-w-2xl rounded-md border border-border bg-card px-4 py-3 text-sm leading-relaxed text-muted-foreground">Seguridad: nunca compartas contraseñas ni datos de tarjeta por el chat. El pago se coordina por WhatsApp, no en esta página.</p>
          </div>
        </section>
      </LandingReveal>

      <LandingReveal>
        <section id="preguntas" className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-3xl px-6 py-12 sm:px-10 md:py-16">
            <p className="text-sm font-medium text-primary">Preguntas frecuentes</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Lo que preguntan los entrenadores</h2>
            <Accordion type="single" collapsible className="mt-8">
              {[
                { q: "¿Qué archivos acepta?", a: "Archivos HY3, CL2, SD3 y ZIP de Meet Manager y Team Manager, bases de datos de Access (.mdb) y PDF de resultados. También puedes importar marcas mínimas desde PDF o captura." },
                { q: "¿Cuánto tarda la activación?", a: "Después de acordar el plan y confirmar el pago por WhatsApp, el dueño revisa tu solicitud y activa tu cuenta. Te avisamos en la misma conversación." },
                { q: "¿Mis datos están seguros?", a: "Sí. Cada cuenta es privada: solo tú ves los atletas, resultados y documentos de tu club. Ninguna otra cuenta puede acceder a ellos." },
                { q: "¿Sirve para clubes pequeños?", a: "Sí. Funciona igual para un entrenador con pocos atletas que para un club con varias categorías y entrenadores." },
                { q: "¿Qué medios de pago hay?", a: "Los medios de pago se acuerdan directamente por WhatsApp con el dueño, según tu país." },
                { q: "¿Hay prueba o demo?", a: "Escríbenos por WhatsApp y te contamos las opciones. Una vez activada tu cuenta, puedes probar de inmediato con el archivo de tu última competencia." },
              ].map(({ q, a }, index) => (
                <AccordionItem key={q} value={`faq-${index}`}>
                  <AccordionTrigger className="min-h-12 text-left text-base">{q}</AccordionTrigger>
                  <AccordionContent className="leading-relaxed text-muted-foreground">{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </LandingReveal>

      <LandingReveal>
        <section aria-labelledby="video-heading" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10 md:py-16">
            <div className="flex items-center gap-3"><Play className="size-6 text-primary" aria-hidden="true" /><h2 id="video-heading" className="text-2xl font-semibold sm:text-3xl">Natación Pro en 10 segundos</h2></div>
            <video aria-label="Video resumen de Natación Pro" className="mt-6 aspect-video w-full rounded-lg bg-muted object-contain" controls playsInline preload="none" poster={summaryPoster.url} src={summaryVideo.url}>
              Tu navegador no puede reproducir este video.
            </video>
            <p className="mt-3 text-sm text-muted-foreground">Atletas y resultados organizados, seguimiento del progreso y comparación con marcas mínimas. Escenas ilustrativas generadas.</p>
          </div>
        </section>
      </LandingReveal>

      <section className="border-t border-border bg-muted">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 px-6 py-12 sm:px-10 md:flex-row md:items-center md:py-16">
          <h2 className="max-w-xl text-2xl font-semibold sm:text-3xl">Prueba Natación Pro con el archivo de tu última competencia</h2>
          <WhatsAppButton label="Solicitar acceso por WhatsApp" className="shrink-0" />
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:px-10">
          <div className="flex items-center gap-2"><Waves className="size-5 text-primary" aria-hidden="true" /><span className="font-semibold text-foreground">Natación <span className="text-primary">Pro</span></span></div>
          <p className="text-xs">Compatible con Meet Manager y Team Manager</p>
          <nav aria-label="Enlaces de pie de página" className="flex flex-wrap items-center gap-4">
            <a href={plansWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-1.5 hover:text-foreground"><MessageCircle className="size-4" aria-hidden="true" />WhatsApp</a>
            <Link to="/terminos" className="flex min-h-11 items-center hover:text-foreground">Términos</Link>
            <Link to="/privacidad" className="flex min-h-11 items-center hover:text-foreground">Privacidad</Link>
          </nav>
          <p className="text-xs">© 2026 Natación Pro</p>
        </div>
      </footer>
    </main>
  );
}
