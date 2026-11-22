/**
 * Technical Desk Console Component (Consola de Mesa Técnica)
 * World Aquatics Official Meet Operations:
 * - Automatic 3-watch median / 2-watch average calculation
 * - World Aquatics DQ Codes Selector
 * - Real-time Record Broken Detector
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  calculateOfficialTime,
  verifyRecordsBroken,
  WORLD_AQUATICS_DQ_CODES,
  MeetRecord,
  WatchTimeInput,
} from '@/lib/meet-engine/technical-console';
import { normalizeSwimTimeToMs, formatMsToTime } from '@/lib/hytek-bridge/data-normalizer';
import { ShieldAlert, Award, Timer, CheckCircle2 } from 'lucide-react';

export interface HeatLaneSwimmerEntry {
  laneNumber: number;
  swimmerName: string;
  clubCode: string;
  seedTimeMs: number | null;
  timing: WatchTimeInput;
  status: 'OK' | 'DQ' | 'NS' | 'SCR' | 'DNF';
  dqCode?: string;
  officialTimeMs?: number | null;
}

interface TechnicalDeskConsoleProps {
  eventName: string;
  heatNumber: number;
  records?: MeetRecord[];
  entries: HeatLaneSwimmerEntry[];
  onSaveHeatResults?: (results: HeatLaneSwimmerEntry[]) => void;
}

export function TechnicalDeskConsole({
  eventName,
  heatNumber,
  records = [],
  entries: initialEntries,
  onSaveHeatResults,
}: TechnicalDeskConsoleProps) {
  const [entries, setEntries] = useState<HeatLaneSwimmerEntry[]>(initialEntries);

  const handleTimingChange = (laneNumber: number, field: keyof WatchTimeInput, rawValue: string) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.laneNumber !== laneNumber) return entry;
        const parsed = normalizeSwimTimeToMs(rawValue);
        const updatedTiming: WatchTimeInput = {
          ...entry.timing,
          [field]: parsed.timeMs,
        };
        const official = calculateOfficialTime(updatedTiming);

        return {
          ...entry,
          timing: updatedTiming,
          officialTimeMs: entry.status === 'DQ' || entry.status === 'NS' ? null : official.officialTimeMs,
        };
      })
    );
  };

  const handleStatusChange = (laneNumber: number, status: 'OK' | 'DQ' | 'NS' | 'SCR' | 'DNF', dqCode?: string) => {
    setEntries((prev) =>
      prev.map((entry) => {
        if (entry.laneNumber !== laneNumber) return entry;
        const official = calculateOfficialTime(entry.timing);
        const nextDqCode = status === 'DQ' ? dqCode ?? entry.dqCode : undefined;
        return {
          ...entry,
          status,
          ...(nextDqCode ? { dqCode: nextDqCode } : {}),
          officialTimeMs: status === 'DQ' || status === 'NS' ? null : official.officialTimeMs,
        };
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Console Header */}
      <Card className="border-primary/30 bg-muted/20">
        <CardHeader className="p-4 sm:p-6 pb-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="default" className="text-xs">
                  MESA TÉCNICA OFICIAL
                </Badge>
                <Badge variant="outline">World Aquatics Rules</Badge>
              </div>
              <CardTitle className="text-2xl font-bold">
                {eventName} — Serie #{heatNumber}
              </CardTitle>
              <CardDescription className="text-xs">
                Cálculo de tiempos con regla de 3 cronos (mediana) / 2 cronos (promedio) y códigos de descalificación oficiales.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Lanes Table */}
      <div className="border rounded-xl bg-card overflow-x-auto shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs font-semibold uppercase text-muted-foreground">
              <th className="p-3 text-center w-12">Carril</th>
              <th className="p-3 text-left">Nadador / Club</th>
              <th className="p-3 text-center w-24">Sembrado</th>
              <th className="p-3 text-center w-28">Placa Táctil</th>
              <th className="p-3 text-center w-28">Crono 1</th>
              <th className="p-3 text-center w-28">Crono 2</th>
              <th className="p-3 text-center w-28">Crono 3</th>
              <th className="p-3 text-center w-32">Tiempo Oficial</th>
              <th className="p-3 text-center w-36">Estado / WA DQ</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.map((entry) => {
              const official = calculateOfficialTime(entry.timing);
              const recordCheck = verifyRecordsBroken(official.officialTimeMs, records);
              const isDq = entry.status === 'DQ';

              return (
                <tr key={entry.laneNumber} className="hover:bg-muted/20 transition-colors">
                  {/* Lane Badge */}
                  <td className="p-3 text-center font-bold text-base text-primary">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-primary/10">
                      {entry.laneNumber}
                    </span>
                  </td>

                  {/* Swimmer Info */}
                  <td className="p-3">
                    <div className="font-semibold text-foreground">{entry.swimmerName}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {entry.clubCode}
                      </Badge>
                      {recordCheck.isRecordBroken && (
                        <Badge className="bg-amber-600 text-white text-[10px] py-0 px-1.5 flex items-center gap-1 animate-pulse">
                          <Award className="w-3 h-3" />
                          ¡Récord batido! ({recordCheck.brokenRecords[0]?.recordType})
                        </Badge>
                      )}
                    </div>
                  </td>

                  {/* Seed Time */}
                  <td className="p-3 text-center font-mono text-xs text-muted-foreground">
                    {formatMsToTime(entry.seedTimeMs)}
                  </td>

                  {/* Electronic Touchpad */}
                  <td className="p-2 text-center">
                    <Input
                      placeholder="Placa"
                      className="h-8 text-center text-xs font-mono font-bold border-primary/40 focus:border-primary"
                      defaultValue={entry.timing.touchpadMs ? formatMsToTime(entry.timing.touchpadMs) : ''}
                      onBlur={(e) => handleTimingChange(entry.laneNumber, 'touchpadMs', e.target.value)}
                    />
                  </td>

                  {/* Manual Watch 1 */}
                  <td className="p-2 text-center">
                    <Input
                      placeholder="Crono 1"
                      className="h-8 text-center text-xs font-mono"
                      defaultValue={entry.timing.watch1Ms ? formatMsToTime(entry.timing.watch1Ms) : ''}
                      onBlur={(e) => handleTimingChange(entry.laneNumber, 'watch1Ms', e.target.value)}
                    />
                  </td>

                  {/* Manual Watch 2 */}
                  <td className="p-2 text-center">
                    <Input
                      placeholder="Crono 2"
                      className="h-8 text-center text-xs font-mono"
                      defaultValue={entry.timing.watch2Ms ? formatMsToTime(entry.timing.watch2Ms) : ''}
                      onBlur={(e) => handleTimingChange(entry.laneNumber, 'watch2Ms', e.target.value)}
                    />
                  </td>

                  {/* Manual Watch 3 */}
                  <td className="p-2 text-center">
                    <Input
                      placeholder="Crono 3"
                      className="h-8 text-center text-xs font-mono"
                      defaultValue={entry.timing.watch3Ms ? formatMsToTime(entry.timing.watch3Ms) : ''}
                      onBlur={(e) => handleTimingChange(entry.laneNumber, 'watch3Ms', e.target.value)}
                    />
                  </td>

                  {/* Official Result */}
                  <td className="p-3 text-center">
                    {isDq ? (
                      <span className="font-bold text-destructive flex items-center justify-center gap-1">
                        <ShieldAlert className="w-4 h-4" />
                        DQ
                      </span>
                    ) : (
                      <div>
                        <span className="font-mono font-bold text-sm text-foreground block">
                          {official.formatted}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {official.timingMethod === 'TOUCHPAD'
                            ? 'Placa'
                            : official.timingMethod === '3_WATCHES_MEDIAN'
                            ? '3 Cronos (Mediana)'
                            : official.timingMethod === '2_WATCHES_AVERAGE'
                            ? '2 Cronos (Promedio)'
                            : ''}
                        </span>
                      </div>
                    )}
                  </td>

                  {/* Status / WA DQ Code */}
                  <td className="p-2 text-center">
                    <Select
                      value={entry.status === 'DQ' && entry.dqCode ? entry.dqCode : entry.status}
                      onValueChange={(val) => {
                        if (val === 'OK' || val === 'NS' || val === 'SCR' || val === 'DNF') {
                          handleStatusChange(entry.laneNumber, val);
                        } else {
                          handleStatusChange(entry.laneNumber, 'DQ', val);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Estado" />
                      </SelectTrigger>
                      <SelectContent className="max-h-64">
                        <SelectItem value="OK" className="text-emerald-600 font-semibold">
                          Válido (OK)
                        </SelectItem>
                        <SelectItem value="NS">No se presentó (NS)</SelectItem>
                        <SelectItem value="SCR">Baja (SCR)</SelectItem>
                        <SelectItem value="DNF">No terminó (DNF)</SelectItem>
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground border-t mt-1">
                          Códigos DQ World Aquatics:
                        </div>
                        {WORLD_AQUATICS_DQ_CODES.map((dq) => (
                          <SelectItem key={dq.code} value={dq.code} className="text-xs text-destructive">
                            <span className="font-mono font-bold mr-1">{dq.code}</span> · {dq.descriptionEs.slice(0, 38)}...
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Action Save Bar */}
      <div className="flex justify-between items-center pt-2">
        <div className="text-xs text-muted-foreground flex items-center gap-2">
          <Timer className="w-4 h-4" />
          Los tiempos oficiales se calculan en milisegundos enteros (`duration_ms`) compatibles con Meet Manager y exportadores .hy3.
        </div>
        <Button
          onClick={() => onSaveHeatResults?.(entries)}
          className="gap-2"
        >
          <CheckCircle2 className="w-4 h-4" />
          Guardar Resultados de la Serie
        </Button>
      </div>
    </div>
  );
}
