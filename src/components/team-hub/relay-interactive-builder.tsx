/**
 * Interactive Relay Builder Component for Team Manager Hub
 * Features drag-and-drop / click-to-swap leg reordering, flying start toggle,
 * alternate swimmer replacement, and real-time split projection.
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatMsToTime } from '@/lib/hytek-bridge/data-normalizer';
import { OptimizedRelay, RelayLegAssignment } from '@/lib/team-hub/smart-relay-builder';
import { ArrowLeftRight, Clock, Trophy, Sparkles, UserCheck } from 'lucide-react';

const STROKE_LABELS: Record<number, string> = {
  1: 'Libre',
  2: 'Espalda',
  3: 'Pecho',
  4: 'Mariposa',
};

const STROKE_COLORS: Record<number, string> = {
  1: 'bg-sky-500/10 text-sky-600 border-sky-500/30',
  2: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/30',
  3: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
  4: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
};

interface RelayInteractiveBuilderProps {
  initialRelay: OptimizedRelay;
  onSaveRelay?: (relay: OptimizedRelay) => void;
}

export function RelayInteractiveBuilder({ initialRelay, onSaveRelay }: RelayInteractiveBuilderProps) {
  const [legs, setLegs] = useState<RelayLegAssignment[]>(initialRelay.legs);
  const [selectedLegIdx, setSelectedLegIdx] = useState<number | null>(null);

  // Recalculate totals
  const totalProjected = legs.reduce((acc, l) => acc + l.projectedTimeMs, 0);
  const totalFlat = legs.reduce((acc, l) => acc + l.flatTimeMs, 0);
  const netAdvantageMs = totalFlat - totalProjected;

  const handleSwapLegs = (idx1: number, idx2: number) => {
    if (idx1 === idx2) return;
    const newLegs = [...legs];
    const temp = newLegs[idx1]!;
    newLegs[idx1] = {
      ...newLegs[idx2]!,
      legNumber: (idx1 + 1) as 1 | 2 | 3 | 4,
      isFlyingStart: idx1 !== 0,
    };
    newLegs[idx2] = {
      ...temp,
      legNumber: (idx2 + 1) as 1 | 2 | 3 | 4,
      isFlyingStart: idx2 !== 0,
    };

    // Re-adjust leg 1 to flat start
    newLegs[0]!.projectedTimeMs = newLegs[0]!.flatTimeMs;
    newLegs[0]!.isFlyingStart = false;

    setLegs(newLegs);
    setSelectedLegIdx(null);
  };

  const handleSelectLeg = (idx: number) => {
    if (selectedLegIdx == null) {
      setSelectedLegIdx(idx);
    } else {
      handleSwapLegs(selectedLegIdx, idx);
    }
  };

  const handleSave = () => {
    if (onSaveRelay) {
      onSaveRelay({
        ...initialRelay,
        legs,
        totalProjectedMs: totalProjected,
        totalFlatMs: totalFlat,
        formattedTotal: formatMsToTime(totalProjected),
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold text-primary">
              Tiempo Proyectado
            </CardDescription>
            <CardTitle className="text-3xl font-bold flex items-center gap-2">
              <Clock className="w-6 h-6 text-primary" />
              {formatMsToTime(totalProjected)}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Suma neta con ventajas de partida lanzada (-{(netAdvantageMs / 1000).toFixed(2)}s).
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold">Tiempo Plano (Bloque)</CardDescription>
            <CardTitle className="text-2xl font-bold">{formatMsToTime(totalFlat)}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Suma de marcas individuales estáticas.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold">Puntos Estimados</CardDescription>
            <CardTitle className="text-2xl font-bold flex items-center gap-1.5 text-amber-600">
              <Trophy className="w-5 h-5" />
              {initialRelay.projectedPoints} pts
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            Puntuación proyectada de 1er puesto.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="text-xs uppercase font-semibold">Modalidad</CardDescription>
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <Badge variant="outline" className="text-sm">
                {initialRelay.relayKind === 'medley' ? '4x Combinado' : '4x Libre'}
              </Badge>
              {initialRelay.isMixed && <Badge variant="secondary">Mixto</Badge>}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 text-xs text-muted-foreground">
            {initialRelay.relayKind === 'medley' ? 'Espalda · Pecho · Mariposa · Libre' : '4 relevistas estilo libre'}
          </CardContent>
        </Card>
      </div>

      {/* Interactive Lineup Builder */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Alineación Estratégica de la Cuarteta
              </CardTitle>
              <CardDescription>
                Haz clic en una posta y luego en otra para intercambiar el orden de nado o ajustar relevistas.
              </CardDescription>
            </div>
            {selectedLegIdx != null && (
              <Badge variant="default" className="animate-pulse">
                Posta #{selectedLegIdx + 1} seleccionada (haz clic en otra para intercambiar)
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {legs.map((leg, idx) => {
              const isSelected = selectedLegIdx === idx;
              const isLeadOff = idx === 0;

              return (
                <div
                  key={leg.legNumber}
                  onClick={() => handleSelectLeg(idx)}
                  className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'border-primary ring-4 ring-primary/20 bg-primary/5 shadow-md scale-[1.02]'
                      : 'border-border/70 hover:border-primary/50 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant={isLeadOff ? 'default' : 'secondary'} className="font-bold">
                      Posta #{leg.legNumber} {isLeadOff ? '(Salida)' : '(Lanzada)'}
                    </Badge>
                    <Badge variant="outline" className={STROKE_COLORS[leg.stroke]}>
                      {STROKE_LABELS[leg.stroke]}
                    </Badge>
                  </div>

                  <div className="my-2">
                    <h4 className="font-bold text-base line-clamp-1">{leg.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      Sexo: {leg.gender === 'M' ? 'Masculino' : 'Femenino'}
                    </p>
                  </div>

                  <div className="mt-3 pt-3 border-t border-dashed space-y-1 text-xs">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Parcial Proyectado:</span>
                      <span className="font-mono font-bold text-sm text-primary">
                        {formatMsToTime(leg.projectedTimeMs)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-muted-foreground text-[11px]">
                      <span>Marca Plana:</span>
                      <span className="font-mono">{formatMsToTime(leg.flatTimeMs)}</span>
                    </div>
                    {leg.isFlyingStart && (
                      <div className="text-[10px] text-emerald-600 font-medium">
                        ✓ Ajuste reacción lanzada (-0.70s)
                      </div>
                    )}
                  </div>

                  <div className="mt-3 flex justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-xs gap-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectLeg(idx);
                      }}
                    >
                      <ArrowLeftRight className="w-3.5 h-3.5" />
                      {isSelected ? 'Cancelar' : 'Mover'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Alternates Panel */}
      {initialRelay.alternates.length > 0 && (
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-muted-foreground" />
              Suplentes Oficiales Disponibles (5° al 8°)
            </CardTitle>
            <CardDescription className="text-xs">
              Atletas elegibles en caso de rotación técnica, descanso o descalificación previa.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
              {initialRelay.alternates.map((alt, i) => (
                <div key={alt.swimmerId} className="p-3 rounded-lg border bg-muted/20 text-xs flex justify-between items-center">
                  <div>
                    <span className="font-semibold block">{alt.name}</span>
                    <span className="text-muted-foreground">{STROKE_LABELS[alt.stroke]}</span>
                  </div>
                  <span className="font-mono font-bold">{formatMsToTime(alt.timeMs)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Footer */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => setLegs(initialRelay.legs)}>
          Restablecer Óptimo Original
        </Button>
        <Button onClick={handleSave}>
          Confirmar Alineación de Relevo
        </Button>
      </div>
    </div>
  );
}
