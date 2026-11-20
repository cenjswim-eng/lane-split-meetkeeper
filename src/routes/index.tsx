import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  ArrowRight, ChartNoAxesCombined, FileDown, FileUp, Waves, MessageCircle, LogIn, Play,
  UserRound, CreditCard, ShieldCheck, Table2, Target, Medal, FileSpreadsheet, LayoutDashboard,
} from "lucide-react";
import { LandingStatistics } from "@/components/landing-statistics";
import { LandingReveal } from "@/components/landing-reveal";
import { publicHead, previewUrl } from "@/lib/public-seo";
import preview from "@/assets/swim-lane-coach-preview.asset.json";
import { ContactForm } from "@/components/contact-form";
import { FloatingWhatsApp } from "@/components/public-shell";
import { trackEvent } from "@/lib/marketing-analytics";
import { testimonials } from "@/lib/marketing";
import swimmingTraining from "@/assets/swimming-training.webp";
import demoPanel from "@/assets/demo-panel.webp";
import summaryVideo from "@/assets/videos/swim-lane-coach-resumen.mp4.asset.json";
import summaryPoster from "@/assets/videos/swim-lane-coach-resumen-poster.jpg.asset.json";

function whatsAppUrl(message: string) {
  return `https://wa.me/584128503939?text=${encodeURIComponent(message)}`;
}
const plansWhatsAppUrl = whatsAppUrl("Hola, soy entrenador y quiero solicitar acceso a Swim Lane Coach.\nMi nombre: \nClub: \nPaís: \nQuisiera conocer los planes, precios, medios de pago y los pasos para activar mi cuenta.");
function planWhatsAppUrl(plan: string) {
  return whatsAppUrl(`Hola, soy entrenador y me interesa el plan ${plan} de Swim Lane Coach.\nMi nombre: \nClub: \nPaís: \nQuisiera conocer el precio, los medios de pago y los pasos para activar mi cuenta.`);
}
const homeTitle = "Swim Lane Coach – Software para entrenadores y clubes de natación";
const homeDescription = "Software para entrenadores y clubes de natación compatible con Meet Manager y Team Manager: resultados, marcas mínimas y reportes por atleta en PDF.";

export const Route = createFileRoute("/")({
  staticData: { sitemap: true },
  head: () => ({ ...publicHead('/', homeTitle, homeDescription), scripts: [{type: 'application/ld+json', children: JSON.stringify({'@context':'https://schema.org','@graph':[{'@type':'Organization','@id':'https://swimlanecoach.app/#organization',name:'Swim Lane Coach',url:'https://swimlanecoach.app'},{'@type':'SoftwareApplication',name:'Swim Lane Coach',url:'https://swimlanecoach.app',applicationCategory:'SportsApplication',operatingSystem:'Web',description:homeDescription,publisher:{'@id':'https://swimlanecoach.app/#organization'},screenshot:previewUrl}]})}]}),
  component: Index,
});

function WhatsAppButton({ label, className = "", href = plansWhatsAppUrl }: { label: string; className?: string; href?: string }) {
  return (
    <Button asChild size="lg" className={`min-h-12 h-auto max-w-full whitespace-normal px-6 py-3 text-base shadow-none ${className}`}>
      <a href={href} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('cta_click', {placement: 'home_whatsapp'})}><MessageCircle aria-hidden="true" />{label}<ArrowRight aria-hidden="true" /></a>
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
        <p className="mt-1 text-xs text-muted-foreground">24 atletas · 48 inscripciones · listo para Team Manager</p>
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
          <a href="#inicio" className="flex min-w-0 items-center gap-2"><Waves className="size-6 shrink-0 text-primary" aria-hidden="true" /><span className="text-base font-semibold leading-tight sm:text-xl">Swim Lane <span className="text-primary">Coach</span></span></a>
          <nav aria-label="Navegación de inicio" className="flex items-center gap-1 sm:gap-2">
            <Button asChild variant="ghost" className="hidden lg:inline-flex"><a href="#ecosistema">Ecosistema</a></Button>
            <Button asChild variant="ghost" className="hidden lg:inline-flex"><a href="#como-funciona">Cómo funciona</a></Button>
            <Button asChild variant="ghost" className="hidden sm:inline-flex"><a href="#planes">Planes</a></Button>
            <Button asChild variant="ghost" className="hidden sm:inline-flex"><a href="#preguntas">Preguntas</a></Button>
            <Button asChild variant="outline" size="sm" className="min-h-10"><Link to="/dashboard" aria-label="Iniciar sesión"><LogIn aria-hidden="true" /><span className="hidden sm:inline">Iniciar sesión</span></Link></Button>
            <Button asChild size="sm" className="min-h-10 shadow-none"><a href={plansWhatsAppUrl} target="_blank" rel="noopener noreferrer"><span className="hidden sm:inline">Solicitar acceso</span><span className="sm:hidden">Acceso</span></a></Button>
          </nav>
        </div>
      </header>

      <section id="inicio" className="landing-hero relative isolate overflow-hidden">
        <img src={swimmingTraining} alt="Nadadores entrenando estilo libre en carriles de una piscina" width={1920} height={1024} fetchPriority="high" className="landing-hero-photo absolute inset-0 -z-20 h-full w-full object-cover" />
        <div className="landing-hero-shade absolute inset-0 -z-10" aria-hidden="true" />
        <div className="landing-enter mx-auto grid max-w-6xl items-center gap-10 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[1.05fr_1fr] lg:py-20">
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-widest text-primary">Para entrenadores y clubes de natación</p>
            <h1 className="mt-4 max-w-2xl text-[42px] font-semibold leading-[1.08] sm:text-6xl lg:text-7xl">Swim Lane Coach</h1>
            <p className="mt-4 max-w-md text-2xl font-medium leading-tight sm:text-3xl">Cada parcial de tus nadadores,<br /><span className="text-primary">sin perder ninguno.</span></p>
            <p className="mt-5 max-w-md text-base leading-relaxed text-foreground/90">Importa tus archivos de Meet Manager y Team Manager y mira la progresión de cada nadador en un solo lugar.</p>
            <div className="mt-7 flex flex-col items-start gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="min-h-12 h-auto max-w-full whitespace-normal px-6 py-3 text-base shadow-none">
                <Link to="/demo" onClick={() => trackEvent("cta_click", {placement:"home_demo"})}><LayoutDashboard aria-hidden="true" />Probar gratis<ArrowRight aria-hidden="true" /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="min-h-12 h-auto max-w-full whitespace-normal border-border bg-background px-6 py-3 text-base shadow-none hover:bg-muted hover:text-foreground">
                <a href={plansWhatsAppUrl} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />Solicitar acceso por WhatsApp</a>
              </Button>
            </div>
            <div className="mt-6 flex flex-wrap items-center gap-2 text-xs text-foreground/80">
              <span className="mr-1">Compatible con</span>
              {["HY3", "CL2", "SD3", "ZIP", "MDB"].map((format) => <span key={format} className="rounded border border-border px-2 py-1 font-medium">{format}</span>)}
            </div>
          </div>
          <figure className="min-w-0 overflow-hidden rounded-lg border border-border bg-card shadow-2xl">
            <div className="flex items-center gap-2 border-b border-border px-4 py-2.5" aria-hidden="true">
              <span className="size-2.5 rounded-full bg-muted-foreground/40" /><span className="size-2.5 rounded-full bg-muted-foreground/40" /><span className="size-2.5 rounded-full bg-muted-foreground/40" />
              <span className="ml-2 truncate rounded bg-muted px-3 py-1 text-[11px] text-muted-foreground">swimlanecoach.app/demo</span>
            </div>
            <img src={demoPanel} alt="Captura del panel del club de ejemplo: 24 atletas, 6 competencias y 11 mínimas alcanzadas" width={1024} height={634} className="w-full" loading="lazy" />
            <figcaption className="border-t border-border px-4 py-2 text-xs text-muted-foreground">Datos de ejemplo</figcaption>
          </figure>
        </div>
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 border-t border-foreground/20 px-6 py-4 text-xs text-foreground/80 sm:px-10">
          <span className="flex items-center gap-2"><ShieldCheck className="size-4 shrink-0 text-primary" aria-hidden="true" />Los registros de tu club son privados</span>
          <a href="#estadisticas" className="flex min-h-10 items-center gap-2 font-medium">Ver estadísticas<ArrowRight className="size-4 rotate-90" aria-hidden="true" /></a>
        </div>
      </section>

      <LandingStatistics />

      <LandingReveal>
        <section id="como-funciona" className="mx-auto max-w-6xl px-6 py-12 sm:px-10 md:py-16">
          <p className="text-sm font-medium text-primary">Cómo funciona</p>
          <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">De la competencia al análisis en tres pasos</h2>
          <ol className="mt-8 grid gap-8 md:grid-cols-3 md:gap-10">
            {[
              { icon: FileUp, title: "01 · Importa sin fricción", text: "Arrastra archivos de Meet Manager y Team Manager (HY3, SD3, CL2, MDB, ZIP). Carga automática sin hojas de cálculo ni errores manuales." },
              { icon: ChartNoAxesCombined, title: "02 · Analiza y clasifica", text: "Progresión gráfica por nadador, parciales desglosados, puntos World Aquatics (AQUA) y marcas mínimas automáticas por categoría (edad al 31/12)." },
              { icon: FileDown, title: "03 · Inscribe y comparte", text: "Genera archivos .SD3 listos para torneos, optimiza relevos y descarga fichas ejecutivas en PDF y Excel para el club y padres." },
            ].map(({ icon: Icon, title, text }) => (
              <li key={title} className="landing-feature min-w-0 border-t border-border pt-5">
                <div className="flex items-center justify-between"><Icon className="size-5 text-primary" aria-hidden="true" /></div>
                <h3 className="mt-3 text-lg font-semibold">{title}</h3>
                <p className="mt-3 leading-relaxed text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </section>
      </LandingReveal>

      <LandingReveal>
        <section id="ecosistema" className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10 md:py-16">
            <p className="text-sm font-medium text-primary">Ecosistema Integrado</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Todo lo que el entrenador revisa en un solo lugar</h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">Unificamos la gestión de marcas, inscripciones y reportes eliminando la duplicación de datos entre programas.</p>
            <div className="mt-10 grid gap-6 sm:grid-cols-2">
              {[
                { icon: ChartNoAxesCombined, title: "Gráfica de progresión y parciales", text: "Evolución histórica de cada prueba y piscina de los últimos 9 meses, lista para el reporte en PDF del atleta.", mock: <MockChart /> },
                { icon: Medal, title: "Puntos World Aquatics (AQUA)", text: "Ranking interno automático por puntuación AQUA oficial y comparación de rendimiento entre categorías y temporadas.", mock: <MockCompare /> },
                { icon: Target, title: "Control de marcas mínimas por categoría", text: "Diferencia exacta con la mínima oficial por edad al 31 de diciembre. Importa y versiona las mínimas de tu federación.", mock: <MockMinimum /> },
                { icon: FileDown, title: "Inscripciones y exportación SD3", text: "Inscripciones con mejores tiempos válidos compatibles con Meet Manager y Team Manager, listas para enviar al organizador.", mock: <MockSd3 /> },
              ].map(({ icon: Icon, title, text, mock }) => (
                <article key={title} className="landing-feature min-w-0 rounded-lg border border-border bg-card p-6">
                  <div className="flex items-center gap-3"><Icon className="size-6 shrink-0 text-primary" aria-hidden="true" /><h3 className="text-lg font-semibold">{title}</h3></div>
                  <p className="mt-3 leading-relaxed text-muted-foreground">{text}</p>
                  <div className="mt-5 rounded-md border border-border bg-background p-4">{mock}</div>
                  <p className="mt-2 text-xs text-muted-foreground">Datos de ejemplo</p>
                </article>
              ))}
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" className="min-h-12 h-auto px-6 py-3 text-base shadow-none">
                <Link to="/demo"><LayoutDashboard aria-hidden="true" />Explorar la demo interactiva en vivo<ArrowRight aria-hidden="true" /></Link>
              </Button>
            </div>
          </div>
        </section>
      </LandingReveal>

      {testimonials.length > 0 && <section className="mx-auto max-w-6xl px-6 py-12"><h2 className="text-2xl font-semibold">Clubes que comparten su experiencia</h2><div className="mt-8 grid gap-6 sm:grid-cols-2">{testimonials.map(t=><figure key={t.name} className="border-t pt-5">{t.logo&&<img src={t.logo} alt={`Logo de ${t.club}`} loading="lazy" className="h-16 object-contain"/>}<blockquote className="mt-4">{t.quote}</blockquote><figcaption className="mt-3 text-sm text-muted-foreground">{t.name} · {t.club}</figcaption></figure>)}</div></section>}

      <LandingReveal>
        <section id="planes" className="border-t border-border bg-card/40">
          <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10 md:py-16">
            <p className="text-sm font-medium text-primary">Planes y Activación</p>
            <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">Elige el plan que se ajusta a tu club</h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted-foreground">Precios y activación coordinados directamente por WhatsApp según el tamaño de tu club y país.</p>
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
                  <WhatsAppButton label={`Consultar plan ${name}`} href={planWhatsAppUrl(name)} className="mt-6 w-full justify-center" />
                </article>
              ))}
            </div>

            <div className="mt-12 rounded-xl border border-border bg-background p-6 sm:p-8">
              <h3 className="text-lg font-semibold sm:text-xl">Activación sencilla en 3 pasos</h3>
              <ol className="mt-6 grid gap-6 md:grid-cols-3">
                {[
                  { icon: UserRound, title: "1. Consulta por WhatsApp", text: "Escríbenos indicando tu nombre, club y país para confirmar el plan adecuado." },
                  { icon: CreditCard, title: "2. Acuerda medios de pago", text: "Confirma el importe y los medios de pago disponibles según tu país." },
                  { icon: ShieldCheck, title: "3. Activación inmediata", text: "Crea tu cuenta desde la web e ingresa de inmediato tras la confirmación." },
                ].map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex flex-col gap-2 border-t border-border pt-4">
                    <div className="flex items-center gap-2"><Icon className="size-4 text-primary" /><span className="font-semibold text-sm">{title}</span></div>
                    <p className="text-xs leading-relaxed text-muted-foreground">{text}</p>
                  </li>
                ))}
              </ol>
              <p className="mt-6 text-xs text-muted-foreground border-t border-border/60 pt-4">Seguridad: los datos de tus atletas son completamente privados. Solo accede el personal autorizado de tu club.</p>
            </div>
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
                { q: "¿Mis datos están seguros?", a: "Sí. Cada cuenta es privada: solo tú ves los atletas, resultados y documentos de tu club. Ninguna otra cuenta puede acceder a ellos. Los datos de tus atletas son privados: solo los ve el personal autorizado de tu club y nunca se comparten ni se publican." },
                { q: "¿Puedo cargar las marcas mínimas de mi federación?", a: "Sí. Importas el documento de marcas mínimas que publica tu federación cada año, o cuando cambia, y la app compara cada resultado con la mínima de su categoría." },
                { q: "¿Sirve para clubes pequeños?", a: "Sí. Funciona igual para un entrenador con pocos atletas que para un club con varias categorías y entrenadores." },
                { q: "¿Qué medios de pago hay?", a: "Los medios de pago se acuerdan directamente por WhatsApp con el dueño, según tu país." },
                { q: "¿Hay prueba o demo?", a: "Sí. Abre «Explorar demo pública» para recorrer el panel, los atletas, las competencias y los reportes sin iniciar sesión. Todos los datos son ficticios y de solo lectura. Para usar los registros de tu club, consulta los planes por WhatsApp y solicita la activación." },
              ].map(({ q, a }, index) => (
                <AccordionItem key={q} value={`faq-${index}`}>
                  <AccordionTrigger className="min-h-12 text-left text-base">{q}</AccordionTrigger>
                  <AccordionContent forceMount className="leading-relaxed text-muted-foreground">{a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>
      </LandingReveal>

      <LandingReveal>
        <section aria-labelledby="video-heading" className="border-t border-border">
          <div className="mx-auto max-w-6xl px-6 py-12 sm:px-10 md:py-16">
            <div className="flex items-center gap-3"><Play className="size-6 text-primary" aria-hidden="true" /><h2 id="video-heading" className="text-2xl font-semibold sm:text-3xl">Swim Lane Coach en 10 segundos</h2></div>
            <video aria-label="Video resumen de Swim Lane Coach" className="mt-6 aspect-video w-full rounded-lg bg-muted object-contain" controls playsInline preload="none" poster={summaryPoster.url} src={summaryVideo.url}>
              Tu navegador no puede reproducir este video.
            </video>
            <p className="mt-3 text-sm text-muted-foreground">Atletas y resultados organizados, seguimiento del progreso y comparación con marcas mínimas. Escenas ilustrativas generadas.</p>
          </div>
        </section>
      </LandingReveal>

      <section className="border-t"><div className="mx-auto max-w-3xl px-6 py-12 sm:px-10"><p className="text-sm text-primary">Contacto</p><h2 className="mt-3 text-2xl font-semibold">Cuéntanos de tu club</h2><p className="mt-3 text-muted-foreground">Consulta el plan y la activación antes de usar tus registros reales.</p><div className="mt-8"><ContactForm/></div></div></section>
      <FloatingWhatsApp/>
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:px-10">
          <div className="flex items-center gap-2"><Waves className="size-5 text-primary" aria-hidden="true" /><span className="font-semibold text-foreground">Swim Lane <span className="text-primary">Coach</span></span></div>
          <p className="text-xs">Compatible con Meet Manager y Team Manager</p>
          <nav aria-label="Enlaces de pie de página" className="flex flex-wrap items-center gap-4">
            <a href={plansWhatsAppUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-11 items-center gap-1.5 hover:text-foreground"><MessageCircle className="size-4" aria-hidden="true" />WhatsApp</a>
            <Link to="/blog" className="flex min-h-11 items-center hover:text-foreground">Recursos</Link><Link to="/contacto" className="flex min-h-11 items-center hover:text-foreground">Contacto</Link><Link to="/terminos" className="flex min-h-11 items-center hover:text-foreground">Términos</Link>
            <Link to="/privacidad" className="flex min-h-11 items-center hover:text-foreground">Privacidad</Link>
          </nav>
          <p className="text-xs">© 2026 Swim Lane Coach</p>
        </div>
      </footer>
    </main>
  );
}
