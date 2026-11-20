import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  Upload,
  ClipboardList,
  Trophy,
  Timer,
  ArrowRight,
  Sparkles,
  HelpCircle,
  FileDown,
  Layers,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const workflowSteps = [
  {
    num: "1",
    title: "Tu Club y Plantilla",
    icon: Building2,
    badge: "Base de Datos",
    desc: "Crea tu club y registra a tus nadadores con sus fechas de nacimiento, sexo y cédula. Exporta la plantilla directamente a Meet Manager (.CL2 / .HY3).",
    action: { label: "Ir a Mi Club", to: "/clubs" },
    tag: "Team Manager / Meet Manager",
  },
  {
    num: "2",
    title: "Importar Convocatoria",
    icon: Upload,
    badge: "Pre-torneo",
    desc: "Sube las pruebas oficiales del torneo desde archivos de eventos (.EV3 / .HYV) o PDF para configurar distancias, estilos y categorías de edad.",
    action: { label: "Importar Pruebas", to: "/import" },
    tag: "Archivos EV3 / HYV",
  },
  {
    num: "3",
    title: "Inscripciones y Relevos",
    icon: ClipboardList,
    badge: "Inscripción",
    desc: "Inscribe atletas asociando automáticamente sus mejores marcas personales (PB) de los últimos 9 meses y arma relevos. Exporta el archivo .SD3 listo.",
    action: { label: "Nueva Inscripción", to: "/entries" },
    tag: "Exportación SDIF .SD3",
  },
  {
    num: "4",
    title: "Torneo en Vivo y Sembrado",
    icon: Timer,
    badge: "Competencia",
    desc: "Organiza series y carriles con siembra estándar (circular/finales por tiempo) y utiliza el cronómetro multicarril durante el torneo.",
    action: { label: "Organizar Torneo", to: "/seeding" },
    tag: "Consola en Vivo",
  },
  {
    num: "5",
    title: "Rankings y Rendimiento",
    icon: Trophy,
    badge: "Post-torneo",
    desc: "Analiza el rendimiento con puntuaciones World Aquatics (AQUA), verificación de marcas mínimas oficiales y reportes ejecutivos.",
    action: { label: "Ver Rankings AQUA", to: "/rankings" },
    tag: "Puntos AQUA & Mínimas",
  },
];

export function EcosystemGuide() {
  const [open, setOpen] = useState(false);

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm">
      <CardHeader className="cursor-pointer pb-3" onClick={() => setOpen(!open)}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Sparkles className="size-5" />
            </span>
            <div>
              <CardTitle className="text-lg font-bold">
                Ecosistema Swim Lane Coach
              </CardTitle>
              <CardDescription className="text-xs">
                Guía práctica de flujo de trabajo: de la plantilla del club a los resultados oficiales
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs text-primary border-primary/40">
              Compatible con Meet Manager & Team Manager
            </Badge>
            <Button variant="ghost" size="sm" className="size-8 p-0" aria-label="Alternar guía del ecosistema">
              {open ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
            </Button>
          </div>
        </div>
      </CardHeader>

      {open && (
        <CardContent className="space-y-5 pt-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Este sistema está diseñado para integrarse con el ciclo completo de la natación competitiva. Sigue estos 5 pasos para gestionar tu equipo sin escribir datos dos veces:
          </p>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {workflowSteps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="flex flex-col justify-between rounded-lg border bg-background p-3.5 shadow-xs transition-all hover:border-primary/50"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                        {step.num}
                      </span>
                      <span className="text-[10px] font-mono font-medium text-muted-foreground uppercase">
                        {step.badge}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 pt-1">
                      <Icon className="size-4 text-primary shrink-0" />
                      <h4 className="font-semibold text-xs leading-snug">{step.title}</h4>
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {step.desc}
                    </p>
                  </div>

                  <div className="mt-3 pt-2 border-t space-y-2">
                    <span className="block text-[10px] font-medium text-primary truncate">
                      {step.tag}
                    </span>
                    <Button asChild size="sm" variant="outline" className="w-full h-7 text-xs justify-between px-2">
                      <Link to={step.action.to}>
                        <span>{step.action.label}</span>
                        <ArrowRight className="size-3" />
                      </Link>
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="rounded-md border bg-muted/50 p-3 text-xs text-muted-foreground flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <HelpCircle className="size-4 text-primary shrink-0" />
              <span>
                <strong>¿Archivos Hy-Tek que puedes intercambiar?</strong> Exporta plantillas (.CL2, .HY3), exporta inscripciones (.SD3) e importa resultados oficiales (.HY3, .CL2, .ZIP, Access y PDF).
              </span>
            </div>
            <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
              <Link to="/import">Ir al centro de importación &rarr;</Link>
            </Button>
          </div>
        </CardContent>
      )}
    </Card>
  );
}
