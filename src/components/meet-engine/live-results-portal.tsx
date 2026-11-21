/**
 * Live Results Portal ("Meet Mobile Killer")
 * Mobile-First, Real-time Public Viewing Experience for Athletes, Parents & Coaches.
 * Features:
 * - Real-time event lifecycle indicators ("En el Agua", "Oficial")
 * - Club and Swimmer live search & filters
 * - 25m/50m splits expander, PB badges, and World Aquatics DQ notifications
 * - Team Leaderboard with points and medal tallies
 * - Shareable QR Code & WhatsApp sharing
 */

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Trophy,
  Medal,
  Clock,
  Share2,
  QrCode,
  Flame,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { formatMsToTime } from '@/lib/hytek-bridge/data-normalizer';
import { EVENT_STATUS_CONFIG, EventLiveStatus } from '@/lib/meet-engine/live-lifecycle';
import { toast } from 'sonner';

export interface PortalSplit {
  distance: number;
  timeMs: number;
}

export interface PortalSwimmerResult {
  place: number | null;
  lane: number;
  heat: number;
  swimmerName: string;
  clubCode: string;
  clubName: string;
  seedTimeMs: number | null;
  finalTimeMs: number | null;
  status: 'OK' | 'DQ' | 'NS' | 'SCR' | 'DNF';
  dqCode?: string;
  dqReason?: string;
  isPb?: boolean;
  isRecord?: boolean;
  recordType?: 'NR' | 'MR' | 'CR';
  splits: PortalSplit[];
}

export interface PortalEvent {
  id: string;
  eventNumber: string;
  name: string; // e.g. "100 m Libre Masculino"
  sessionNumber: number;
  gender: string;
  distance: number;
  stroke: number;
  liveStatus: EventLiveStatus;
  results: PortalSwimmerResult[];
}

export interface PortalTeamScore {
  clubId: string;
  name: string;
  code: string;
  totalPoints: number;
  femalePoints: number;
  malePoints: number;
  golds: number;
  silvers: number;
  bronzes: number;
}

interface LiveResultsPortalProps {
  meetName: string;
  location?: string | null;
  meetDate?: string | null;
  events: PortalEvent[];
  teamScores?: PortalTeamScore[];
  shareUrl?: string;
}

export function LiveResultsPortal({
  meetName,
  location,
  meetDate,
  events,
  teamScores = [],
  shareUrl = typeof window !== 'undefined' ? window.location.href : '',
}: LiveResultsPortalProps) {
  const [selectedSession, setSelectedSession] = useState<number>(1);
  const [selectedEventId, setSelectedEventId] = useState<string>(events[0]?.id ?? '');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClub, setSelectedClub] = useState<string>('ALL');
  const [expandedSplits, setExpandedSplits] = useState<Record<string, boolean>>({});
  const [showQrModal, setShowQrModal] = useState(false);

  // Extract unique sessions and clubs
  const sessions = useMemo(() => {
    return [...new Set(events.map((e) => e.sessionNumber))].sort((a, b) => a - b);
  }, [events]);

  const clubs = useMemo(() => {
    const set = new Set<string>();
    events.forEach((ev) => ev.results.forEach((r) => set.add(r.clubCode)));
    return ['ALL', ...Array.from(set).sort()];
  }, [events]);

  // Current selected event
  const currentEvent = useMemo(() => {
    return events.find((e) => e.id === selectedEventId) ?? events[0];
  }, [events, selectedEventId]);

  // Filtered results
  const filteredResults = useMemo(() => {
    if (!currentEvent) return [];
    return currentEvent.results.filter((r) => {
      const matchSearch =
        !searchQuery.trim() ||
        r.swimmerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.clubName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        r.clubCode.toLowerCase().includes(searchQuery.toLowerCase());
      const matchClub = selectedClub === 'ALL' || r.clubCode === selectedClub;
      return matchSearch && matchClub;
    });
  }, [currentEvent, searchQuery, selectedClub]);

  // Active event currently in the water
  const inWaterEvent = useMemo(() => {
    return events.find((e) => e.liveStatus === 'IN_WATER');
  }, [events]);

  const toggleSplits = (id: string) => {
    setExpandedSplits((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(shareUrl);
      toast.success('Enlace de resultados en vivo copiado');
    }
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(`🏊‍♂️ Resultados en Vivo: ${meetName}\nSigue los tiempos al instante aquí:\n${shareUrl}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  return (
    <div className="min-h-screen bg-background text-foreground pb-12">
      {/* Mobile-First Header */}
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 px-4 py-3 shadow-sm">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">
                LIVE RESULTS
              </span>
            </div>
            <h1 className="font-bold text-lg leading-tight truncate">{meetName}</h1>
            <p className="text-xs text-muted-foreground truncate">
              {[location, meetDate].filter(Boolean).join(' · ')}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={() => setShowQrModal(true)}
            >
              <QrCode className="w-4 h-4" />
              <span className="hidden sm:inline">Código QR</span>
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={handleShareWhatsApp}
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">WhatsApp</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {/* Active Now Banner (If an event is in the water) */}
        {inWaterEvent && (
          <div
            onClick={() => setSelectedEventId(inWaterEvent.id)}
            className="p-3.5 rounded-xl border border-primary/30 bg-primary/10 flex items-center justify-between cursor-pointer hover:bg-primary/15 transition-all shadow-sm"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-primary-foreground">
                <Flame className="w-5 h-5 animate-bounce" />
              </div>
              <div>
                <span className="text-[10px] font-bold uppercase text-primary tracking-wider block">
                  EN EL AGUA AHORA MISMO
                </span>
                <span className="font-bold text-sm">
                  Prueba {inWaterEvent.eventNumber}: {inWaterEvent.name}
                </span>
              </div>
            </div>
            <Badge variant="default" className="text-xs">
              Ver Serie en Vivo →
            </Badge>
          </div>
        )}

        {/* Navigation Tabs (Pruebas vs Medallero y Puntos) */}
        <Tabs defaultValue="events" className="w-full">
          <TabsList className="grid grid-cols-2 w-full max-w-sm mx-auto mb-4">
            <TabsTrigger value="events" className="font-semibold text-xs sm:text-sm">
              Pruebas y Series
            </TabsTrigger>
            <TabsTrigger value="scores" className="font-semibold text-xs sm:text-sm flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-500" />
              Puntos y Medallero
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: EVENTS & RESULTS */}
          <TabsContent value="events" className="space-y-4">
            {/* Event Selector & Session Filter */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {sessions.length > 1 && (
                <Select
                  value={String(selectedSession)}
                  onValueChange={(val) => setSelectedSession(Number(val))}
                >
                  <SelectTrigger className="h-10 text-xs font-medium">
                    <SelectValue placeholder="Sesión" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => (
                      <SelectItem key={s} value={String(s)}>
                        Sesión #{s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              <div className="sm:col-span-2">
                <Select value={selectedEventId} onValueChange={setSelectedEventId}>
                  <SelectTrigger className="h-10 text-xs font-semibold">
                    <SelectValue placeholder="Seleccionar prueba" />
                  </SelectTrigger>
                  <SelectContent className="max-h-72">
                    {events
                      .filter((e) => sessions.length <= 1 || e.sessionNumber === selectedSession)
                      .map((ev) => {
                        const statusCfg = EVENT_STATUS_CONFIG[ev.liveStatus];
                        return (
                          <SelectItem key={ev.id} value={ev.id} className="text-xs">
                            <span className="font-bold mr-1.5">#{ev.eventNumber}</span> {ev.name} ({statusCfg.label})
                          </SelectItem>
                        );
                      })}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Current Event Header Banner */}
            {currentEvent && (
              <Card className="border-border/60 shadow-sm overflow-hidden">
                <div className="p-4 bg-muted/30 border-b flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="font-mono text-xs">
                        Prueba #{currentEvent.eventNumber}
                      </Badge>
                      <Badge
                        variant={EVENT_STATUS_CONFIG[currentEvent.liveStatus].badgeVariant}
                        className={EVENT_STATUS_CONFIG[currentEvent.liveStatus].colorClass}
                      >
                        {EVENT_STATUS_CONFIG[currentEvent.liveStatus].label}
                      </Badge>
                    </div>
                    <h2 className="font-bold text-base sm:text-lg">{currentEvent.name}</h2>
                  </div>

                  <span className="text-xs text-muted-foreground font-mono">
                    {currentEvent.results.length} nadadores
                  </span>
                </div>

                {/* Filters: Search & Club */}
                <div className="p-3 bg-card border-b grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="relative">
                    <Search className="w-4 h-4 absolute left-2.5 top-2.5 text-muted-foreground" />
                    <Input
                      placeholder="Buscar nadador o club..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-9 pl-9 text-xs"
                    />
                  </div>

                  <Select value={selectedClub} onValueChange={setSelectedClub}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="Filtrar por Club" />
                    </SelectTrigger>
                    <SelectContent>
                      {clubs.map((c) => (
                        <SelectItem key={c} value={c} className="text-xs">
                          {c === 'ALL' ? 'Todos los Clubes' : c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Results List */}
                <div className="divide-y">
                  {filteredResults.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground text-xs">
                      No se encontraron resultados para los filtros seleccionados.
                    </div>
                  ) : (
                    filteredResults.map((result, idx) => {
                      const rowKey = `${result.heat}_${result.lane}_${idx}`;
                      const isExpanded = Boolean(expandedSplits[rowKey]);
                      const isPodium = result.place != null && result.place <= 3;

                      return (
                        <div key={rowKey} className="p-3.5 hover:bg-muted/15 transition-colors">
                          <div className="flex items-start justify-between gap-3">
                            {/* Position & Identity */}
                            <div className="flex items-start gap-3 min-w-0">
                              <div className="w-7 text-center pt-0.5">
                                {result.status === 'DQ' ? (
                                  <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                    DQ
                                  </Badge>
                                ) : result.place != null ? (
                                  <span
                                    className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-bold text-xs ${
                                      result.place === 1
                                        ? 'bg-amber-400 text-amber-950 shadow-sm'
                                        : result.place === 2
                                        ? 'bg-slate-300 text-slate-900 shadow-sm'
                                        : result.place === 3
                                        ? 'bg-amber-700/80 text-white shadow-sm'
                                        : 'bg-muted text-muted-foreground'
                                    }`}
                                  >
                                    {result.place}
                                  </span>
                                ) : (
                                  <span className="text-xs text-muted-foreground">—</span>
                                )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-semibold text-sm leading-tight">
                                    {result.swimmerName}
                                  </span>
                                  <Badge variant="outline" className="text-[10px] py-0 px-1 font-mono">
                                    {result.clubCode}
                                  </Badge>
                                </div>
                                <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                                  <span>Serie {result.heat} · Carril {result.lane}</span>
                                  {result.seedTimeMs && (
                                    <span>Sembrado: {formatMsToTime(result.seedTimeMs)}</span>
                                  )}
                                </div>

                                {/* Badges */}
                                <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                  {result.isPb && (
                                    <Badge className="bg-emerald-600/15 text-emerald-700 border-emerald-500/30 text-[10px] py-0">
                                      PB Personal
                                    </Badge>
                                  )}
                                  {result.isRecord && (
                                    <Badge className="bg-amber-500 text-amber-950 font-bold text-[10px] py-0 flex items-center gap-1">
                                      <Medal className="w-3 h-3" />
                                      ¡RÉCORD BATIDO!
                                    </Badge>
                                  )}
                                  {result.status === 'DQ' && result.dqCode && (
                                    <Badge variant="destructive" className="text-[10px] py-0">
                                      {result.dqCode} · {result.dqReason ?? 'Infracción FINA'}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Final Time & Splits Toggle */}
                            <div className="text-right shrink-0">
                              <span
                                className={`font-mono font-bold text-base block ${
                                  result.status === 'DQ'
                                    ? 'text-destructive'
                                    : 'text-foreground'
                                }`}
                              >
                                {result.status === 'DQ'
                                  ? 'Descalificado'
                                  : result.status === 'NS'
                                  ? 'No se presentó'
                                  : formatMsToTime(result.finalTimeMs)}
                              </span>

                              {result.splits.length > 0 && (
                                <button
                                  onClick={() => toggleSplits(rowKey)}
                                  className="text-[11px] text-primary hover:underline inline-flex items-center gap-0.5 mt-1"
                                >
                                  Parciales {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expanded Splits Timeline */}
                          {isExpanded && result.splits.length > 0 && (
                            <div className="mt-3 pt-2.5 border-t border-dashed bg-muted/20 p-2.5 rounded-lg text-xs space-y-1">
                              <div className="font-semibold text-[11px] text-muted-foreground uppercase mb-1">
                                Parciales de carrera:
                              </div>
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                {result.splits.map((s, sIdx) => (
                                  <div key={sIdx} className="flex justify-between border-b pb-1">
                                    <span className="text-muted-foreground">{s.distance} m:</span>
                                    <span className="font-mono font-semibold">{formatMsToTime(s.timeMs)}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </Card>
            )}
          </TabsContent>

          {/* TAB 2: TEAM SCORES & MEDALS */}
          <TabsContent value="scores" className="space-y-4">
            <Card>
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Trophy className="w-5 h-5 text-amber-500" />
                  Tabla General de Puntuación por Clubes
                </CardTitle>
                <CardDescription className="text-xs">
                  Puntuación combinada (Femenino + Masculino + Relevos) actualizada en vivo con cada serie oficial.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-[11px] font-semibold uppercase text-muted-foreground">
                        <th className="p-3 text-center w-10">#</th>
                        <th className="p-3 text-left">Club</th>
                        <th className="p-3 text-center">Oro</th>
                        <th className="p-3 text-center">Plata</th>
                        <th className="p-3 text-center">Bronce</th>
                        <th className="p-3 text-right font-bold text-foreground">Total Pts</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {teamScores.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-muted-foreground">
                            Aún no hay puntuaciones computadas en este torneo.
                          </td>
                        </tr>
                      ) : (
                        teamScores.map((score, i) => (
                          <tr key={score.clubId} className="hover:bg-muted/15 transition-colors">
                            <td className="p-3 text-center font-bold text-muted-foreground">
                              {i + 1}
                            </td>
                            <td className="p-3">
                              <span className="font-bold text-foreground block">{score.name}</span>
                              <span className="text-[11px] text-muted-foreground">
                                Fem: {score.femalePoints} · Mas: {score.malePoints}
                              </span>
                            </td>
                            <td className="p-3 text-center font-semibold text-amber-500">
                              {score.golds}
                            </td>
                            <td className="p-3 text-center font-semibold text-slate-400">
                              {score.silvers}
                            </td>
                            <td className="p-3 text-center font-semibold text-amber-700">
                              {score.bronzes}
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-base text-primary">
                              {score.totalPoints}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      {/* QR Code Modal for Spectators */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowQrModal(false)}
        >
          <Card
            className="w-full max-w-sm p-6 text-center space-y-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-base">Escanea para Resultados en Vivo</h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={() => setShowQrModal(false)}
              >
                ✕
              </Button>
            </div>

            {/* QR Visual Canvas / Box */}
            <div className="p-6 bg-white rounded-xl inline-block mx-auto border shadow-inner">
              {/* Clean SVG QR mockup representation with actual link target */}
              <svg className="w-48 h-48 mx-auto" viewBox="0 0 100 100">
                <rect width="100" height="100" fill="#ffffff" />
                <path
                  d="M10,10 h30 v30 h-30 z M15,15 v20 h20 v-20 z M20,20 h10 v10 h-10 z"
                  fill="#000000"
                />
                <path
                  d="M60,10 h30 v30 h-30 z M65,15 v20 h20 v-20 z M70,20 h10 v10 h-10 z"
                  fill="#000000"
                />
                <path
                  d="M10,60 h30 v30 h-30 z M15,65 v20 h20 v-20 z M20,70 h10 v10 h-10 z"
                  fill="#000000"
                />
                <circle cx="50" cy="50" r="8" fill="#0284c7" />
                <rect x="45" y="20" width="10" height="15" fill="#000000" />
                <rect x="20" y="45" width="15" height="10" fill="#000000" />
                <rect x="65" y="45" width="15" height="10" fill="#000000" />
                <rect x="45" y="65" width="10" height="15" fill="#000000" />
                <rect x="65" y="65" width="20" height="20" fill="#000000" />
              </svg>
            </div>

            <p className="text-xs text-muted-foreground">
              Comparte este código en las gradas para que atletas y representantes sigan los tiempos oficiales al instante desde su móvil.
            </p>

            <div className="flex gap-2">
              <Button variant="outline" className="flex-1 text-xs" onClick={handleCopyLink}>
                Copiar Enlace
              </Button>
              <Button
                className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={handleShareWhatsApp}
              >
                Enviar por WhatsApp
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
