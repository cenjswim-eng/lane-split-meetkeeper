import { useState, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight, Calculator, CheckCircle2, Flame, Info, Sparkles, Trophy, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { aquaPoints, aquaBaseTime, timeForAquaPoints, parseSwimTime, formatTime, STROKES } from '@/lib/swim';
import { trackEvent } from '@/lib/marketing-analytics';

const STROKE_DISTANCES: Record<number, { LCM: number[]; SCM: number[] }> = {
  1: { LCM: [50, 100, 200, 400, 800, 1500], SCM: [50, 100, 200, 400, 800, 1500] },
  2: { LCM: [50, 100, 200], SCM: [50, 100, 200] },
  3: { LCM: [50, 100, 200], SCM: [50, 100, 200] },
  4: { LCM: [50, 100, 200], SCM: [50, 100, 200] },
  5: { LCM: [200, 400], SCM: [100, 200, 400] },
};

function getTier(points: number) {
  if (points >= 750) return { label: 'Nivel Internacional / Élite', color: 'bg-amber-500/10 text-amber-500 border-amber-500/30' };
  if (points >= 600) return { label: 'Nivel Nacional / Alta Competencia', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
  if (points >= 450) return { label: 'Nivel Regional / Avanzado', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' };
  if (points >= 300) return { label: 'Nivel Desarrollo / Intermedio', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
  return { label: 'Iniciación Deportiva', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' };
}

export function AquaCalculator() {
  const [course, setCourse] = useState<'LCM' | 'SCM'>('LCM');
  const [gender, setGender] = useState<'M' | 'F'>('M');
  const [stroke, setStroke] = useState<number>(1);
  const [distance, setDistance] = useState<number>(100);
  const [rawTime, setRawTime] = useState<string>('58.20');

  // Asegurar distancia válida al cambiar estilo o piscina
  const validDistances = STROKE_DISTANCES[stroke]?.[course] ?? [100];
  const activeDistance = validDistances.includes(distance) ? distance : validDistances[0] ?? 100;

  const parsed = useMemo(() => parseSwimTime(rawTime), [rawTime]);
  const timeMs = parsed.timeMs;

  const points = useMemo(() => {
    if (!timeMs) return null;
    return aquaPoints(timeMs, course, gender, activeDistance, stroke);
  }, [timeMs, course, gender, activeDistance, stroke]);

  const baseTimeMs = useMemo(() => {
    return aquaBaseTime(course, gender, activeDistance, stroke);
  }, [course, gender, activeDistance, stroke]);

  const tier = points ? getTier(points) : null;

  // Hitos objetivos (ej. 400, 500, 600, 700, 800)
  const milestones = useMemo(() => {
    if (!baseTimeMs) return [];
    const targets = [350, 450, 550, 650, 750];
    return targets.map(targetPts => ({
      points: targetPts,
      timeMs: timeForAquaPoints(targetPts, course, gender, activeDistance, stroke),
    }));
  }, [baseTimeMs, course, gender, activeDistance, stroke]);

  return (
    <div className="space-y-8">
      {/* Selector interactivo y Formulario */}
      <Card className="border-border/60 bg-card/60 backdrop-blur">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Calculator className="size-5 text-primary" />
            <CardTitle className="text-xl">Calculadora oficial de puntos World Aquatics</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            Ingresa los parámetros de la prueba y el tiempo del nadador para obtener su puntuación según las tablas oficiales vigentes.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Piscina y Género */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Piscina
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={course === 'LCM' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCourse('LCM')}
                  className="w-full"
                >
                  50 m (Larga / LCM)
                </Button>
                <Button
                  type="button"
                  variant={course === 'SCM' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setCourse('SCM')}
                  className="w-full"
                >
                  25 m (Corta / SCM)
                </Button>
              </div>
            </div>

            <div>
              <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Rama / Sexo
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={gender === 'M' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGender('M')}
                  className="w-full"
                >
                  Masculino
                </Button>
                <Button
                  type="button"
                  variant={gender === 'F' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setGender('F')}
                  className="w-full"
                >
                  Femenino
                </Button>
              </div>
            </div>
          </div>

          {/* Estilo */}
          <div>
            <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Estilo
            </Label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {[1, 2, 3, 4, 5].map((st) => (
                <Button
                  key={st}
                  type="button"
                  variant={stroke === st ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    setStroke(st);
                    const newValid = STROKE_DISTANCES[st]?.[course] ?? [100];
                    if (!newValid.includes(distance)) {
                      setDistance(newValid[0] ?? 100);
                    }
                  }}
                  className="w-full text-xs"
                >
                  {STROKES[st]}
                </Button>
              ))}
            </div>
          </div>

          {/* Distancia y Tiempo */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Distancia (metros)
              </Label>
              <div className="flex flex-wrap gap-2">
                {validDistances.map((d) => (
                  <Button
                    key={d}
                    type="button"
                    variant={activeDistance === d ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setDistance(d)}
                    className="min-w-14"
                  >
                    {d} m
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <Label htmlFor="swim-time-input" className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Tiempo realizado
              </Label>
              <div className="space-y-1">
                <Input
                  id="swim-time-input"
                  value={rawTime}
                  onChange={(e) => setRawTime(e.target.value)}
                  placeholder="ej. 58.20 o 1:04.10"
                  className="text-lg font-mono tracking-wide"
                />
                <span className="text-xs text-muted-foreground">
                  Formato: <code>segundos.centésimas</code> (ej. 58.20) o <code>min:seg.cent</code> (ej. 1:04.10)
                </span>
              </div>
            </div>
          </div>

          {/* Resultado destacado */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center sm:text-left">
            <div className="flex flex-col items-center justify-between gap-6 sm:flex-row">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Resultado Oficial de Puntuación
                </p>
                <div className="mt-2 flex items-baseline justify-center gap-3 sm:justify-start">
                  <span className="text-5xl font-black tracking-tight text-foreground sm:text-6xl font-mono">
                    {points !== null ? points.toLocaleString() : '—'}
                  </span>
                  <span className="text-xl font-semibold text-primary">
                    Puntos AQUA
                  </span>
                </div>
                {tier && (
                  <div className="mt-3 flex items-center justify-center gap-2 sm:justify-start">
                    <Badge variant="outline" className={`px-2.5 py-1 text-xs font-medium ${tier.color}`}>
                      <Trophy className="mr-1.5 size-3.5" />
                      {tier.label}
                    </Badge>
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-border/80 bg-background/80 p-4 text-xs text-muted-foreground shadow-sm w-full sm:w-auto sm:min-w-64">
                <p className="font-semibold text-foreground mb-2 flex items-center gap-1.5">
                  <Info className="size-3.5 text-primary" />
                  Referencia de cálculo
                </p>
                <div className="space-y-1 font-mono text-[11px]">
                  <div className="flex justify-between">
                    <span>Prueba:</span>
                    <span className="font-semibold text-foreground">{activeDistance} m {STROKES[stroke]}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Piscina:</span>
                    <span className="font-semibold text-foreground">{course === 'LCM' ? '50 m' : '25 m'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tiempo base (B):</span>
                    <span className="font-semibold text-foreground">{baseTimeMs ? formatTime(baseTimeMs) : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fórmula:</span>
                    <span className="text-foreground">1000 × (B / T)³</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Hitos y objetivos de tiempo */}
          {milestones.length > 0 && (
            <div className="rounded-lg border bg-card/40 p-5">
              <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                <Zap className="size-4 text-amber-400" />
                Tiempos necesarios para alcanzar hitos de puntuación
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                ¿Qué marca necesita registrar tu nadador en esta prueba para alcanzar cada nivel de puntos?
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5 text-center font-mono">
                {milestones.map((m) => (
                  <div key={m.points} className="rounded-md border border-border/50 bg-background/50 p-2.5">
                    <div className="text-xs font-bold text-primary">{m.points} pts</div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {m.timeMs ? formatTime(m.timeMs) : '—'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tarjeta de Conversión a Swim Lane Coach */}
          <div className="relative overflow-hidden rounded-xl border border-primary/30 bg-gradient-to-br from-card via-card to-primary/10 p-6 sm:p-8">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-3">
                <Sparkles className="size-3.5" />
                Para entrenadores y clubes de natación
              </div>
              <h3 className="text-xl font-bold sm:text-2xl text-foreground">
                Deja de calcular puntos y marcas mínimas a mano
              </h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                Con <strong>Swim Lane Coach</strong>, solo arrastras el archivo de resultados (.HY3, .CL2, .SD3, .ZIP o .MDB) de cualquier torneo y el sistema calcula automáticamente los puntos AQUA, la evolución de los parciales y el estatus frente a mínimas de todos tus nadadores.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button asChild size="lg" onClick={() => trackEvent('cta_click', { placement: 'aqua_calculator_demo' })}>
                  <Link to="/demo">
                    Ver demo interactiva del club
                    <ArrowRight className="ml-2 size-4" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg">
                  <Link to="/como-funciona">
                    Cómo funciona
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contenido Educativo y SEO */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="border-border/60 bg-card/40">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Flame className="size-4 text-primary" />
              ¿Cómo se calculan los puntos World Aquatics?
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              La fórmula oficial definida por <strong>World Aquatics</strong> (anteriormente FINA) es:
            </p>
            <div className="rounded bg-muted/60 p-3 text-center font-mono text-foreground font-semibold text-sm">
              P = 1000 × (B / T)³
            </div>
            <p>
              Donde <strong>B</strong> es el tiempo base oficial (el récord mundial de referencia para esa prueba y piscina) y <strong>T</strong> es el tiempo cronometrado por el nadador, ambos expresados en las mismas unidades.
            </p>
            <p>
              Un tiempo igual al récord mundial otorga exactamente <strong>1000 puntos</strong>. Superar el récord genera más de 1000 puntos.
            </p>
          </CardContent>
        </Card>

        <Card className="border-border/60 bg-card/40">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="size-4 text-emerald-400" />
              Diferencia entre puntos AQUA y puntos de torneo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            <p>
              <strong>Puntos de Torneo (Premiación):</strong> Son los puntos que el comité organizador asigna a las posiciones (ej. 9 puntos al 1º, 7 al 2º). Solo reflejan la posición en esa carrera específica.
            </p>
            <p>
              <strong>Puntos AQUA:</strong> Miden la calidad técnica absoluta de la marca comparada con el nivel mundial. Permiten comparar nadadores de diferentes estilos, distancias y sexos con una vara objetiva.
            </p>
            <p>
              En <strong>Swim Lane Coach</strong>, los rankings internos del club utilizan la mejor puntuación individual de cada atleta para evitar distorsiones.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
