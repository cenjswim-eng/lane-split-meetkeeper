/**
 * Consola de Auditoría Post-Importación ADAEL 2026
 * Ubicación: src/components/adael-2026/AuditConsoleModal.tsx
 *
 * Muestra el resumen consolidado de entidades extraídas y detalla
 * las líneas con advertencias o registros descartados con número de línea y causa.
 */

import { useState } from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Building2,
  Users,
  Timer,
  Search,
  Download,
  FileText,
  Waves,
  Eye,
  Check,
  X,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { type UniversalParseReport } from '@/lib/adael-2026/universal-parser';
import { downloadFile } from '@/lib/file-delivery';

interface AuditConsoleModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  report: UniversalParseReport | null;
}

export function AuditConsoleModal({ open, onOpenChange, report }: AuditConsoleModalProps) {
  const [activeTab, setActiveTab] = useState<'summary' | 'warnings'>('summary');
  const [filterQuery, setFilterQuery] = useState('');

  if (!report) return null;

  const filteredWarnings = report.warnings.filter((w) => {
    if (!filterQuery.trim()) return true;
    const q = filterQuery.toLowerCase();
    return (
      w.file.toLowerCase().includes(q) ||
      w.message.toLowerCase().includes(q) ||
      w.rawLine.toLowerCase().includes(q) ||
      w.lineCode.toLowerCase().includes(q) ||
      String(w.lineNumber).includes(q)
    );
  });

  const handleExportAuditLog = () => {
    const lines = [
      '=====================================================',
      'REPORTE DE AUDITORÍA POST-IMPORTACIÓN — ADAEL 2026',
      '=====================================================',
      `Fecha: ${new Date().toLocaleString()}`,
      `Archivos Procesados (${report.filesProcessed.length}):`,
      ...report.filesProcessed.map((f) => ` - ${f}`),
      '',
      'MÉTRICAS CLAVE:',
      `- Total Clubes Detectados: ${report.totalClubsDetected}`,
      `- Total Atletas Fichados/Padrón: ${report.totalAthletesEnrolled}`,
      `- Total Marcas/Tiempos Importados: ${report.totalResultsImported}`,
      `- Total Relevos Importados: ${report.totalRelaysImported}`,
      `- Total Registros DQ/NS/EXH Preservados: ${report.totalDqNsExh}`,
      `- Total Advertencias/Observaciones: ${report.warnings.length}`,
      '',
      'CLUBES DETECTADOS Y ATLETAS POR CLUB:',
      ...report.clubsDetectedList.map((c) => ` - ${c.code} (${c.name}): ${c.athleteCount} atletas`),
      '',
      '=====================================================',
      'LÍNEAS CON ADVERTENCIAS O REGISTROS OBSERVADOS:',
      '=====================================================',
      ...report.warnings.map(
        (w, i) =>
          `[${i + 1}] Archivo: ${w.file} | Línea: ${w.lineNumber} (${w.lineCode})\n    Motivo: ${w.message}\n    Línea Original: ${w.rawLine}\n`
      ),
    ];

    downloadFile(new File([lines.join('\n')], 'Auditoria_Importacion_ADAEL_2026.txt', { type: 'text/plain;charset=utf-8;' }));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-6">
        <DialogHeader className="pb-2 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <DialogTitle className="text-lg font-bold">
                  Consola de Auditoría Post-Importación (ADAEL 2026)
                </DialogTitle>
                <DialogDescription className="text-xs">
                  Revisión transparente de entidades detectadas, marcas cargadas y advertencias de parsing.
                </DialogDescription>
              </div>
            </div>
            <Badge
              variant={report.warnings.length === 0 ? 'default' : 'secondary'}
              className="text-xs font-semibold gap-1"
            >
              {report.warnings.length === 0 ? (
                <>
                  <CheckCircle2 className="h-3 w-3 text-emerald-500" /> Cero advertencias
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3 text-amber-500" /> {report.warnings.length} Observaciones
                </>
              )}
            </Badge>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="flex-1 flex flex-col min-h-0 pt-2">
          <TabsList className="grid grid-cols-2 w-full max-w-sm mb-3">
            <TabsTrigger value="summary" className="text-xs gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Resumen de Importación
            </TabsTrigger>
            <TabsTrigger value="warnings" className="text-xs gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" />
              Observaciones ({report.warnings.length})
            </TabsTrigger>
          </TabsList>

          {/* TAB 1: RESUMEN CONSOLIDADO */}
          <TabsContent value="summary" className="flex-1 overflow-y-auto space-y-4 pr-1">
            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Card className="bg-muted/40 border">
                <CardContent className="p-3">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                    <span>Clubes</span>
                    <Building2 className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="text-2xl font-bold mt-1 text-foreground">{report.totalClubsDetected}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Detectados y mapeados</div>
                </CardContent>
              </Card>

              <Card className="bg-muted/40 border">
                <CardContent className="p-3">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                    <span>Atletas Padrón</span>
                    <Users className="h-3.5 w-3.5 text-blue-500" />
                  </div>
                  <div className="text-2xl font-bold mt-1 text-foreground">{report.totalAthletesEnrolled}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Fichados temporada 2026</div>
                </CardContent>
              </Card>

              <Card className="bg-muted/40 border">
                <CardContent className="p-3">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                    <span>Marcas / Tiempos</span>
                    <Timer className="h-3.5 w-3.5 text-emerald-500" />
                  </div>
                  <div className="text-2xl font-bold mt-1 text-foreground">{report.totalResultsImported}</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Registrados en resultados</div>
                </CardContent>
              </Card>

              <Card className="bg-muted/40 border">
                <CardContent className="p-3">
                  <div className="text-[11px] font-medium text-muted-foreground flex items-center justify-between">
                    <span>Relevos & DQ/NS</span>
                    <Waves className="h-3.5 w-3.5 text-amber-500" />
                  </div>
                  <div className="text-2xl font-bold mt-1 text-foreground">
                    {report.totalRelaysImported + report.totalDqNsExh}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">
                    {report.totalRelaysImported} Relevos • {report.totalDqNsExh} DQ/NS
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Archivos Procesados */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Archivos Procesados ({report.filesProcessed.length}):
              </label>
              <div className="flex flex-wrap gap-1.5">
                {report.filesProcessed.map((f, idx) => (
                  <Badge key={idx} variant="outline" className="text-xs font-mono py-1 px-2 gap-1.5 bg-background">
                    <FileText className="h-3 w-3 text-primary" />
                    {f}
                  </Badge>
                ))}
              </div>
            </div>

            {/* Desglose de Clubes Detectados */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Desglose por Club Detectado:
              </label>
              <div className="rounded-md border overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b font-medium text-muted-foreground">
                    <tr>
                      <th className="py-2 px-3">Código</th>
                      <th className="py-2 px-3">Nombre del Club</th>
                      <th className="py-2 px-3 text-right">Atletas Fichados</th>
                      <th className="py-2 px-3 text-center">Estatus</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {report.clubsDetectedList.map((c, i) => (
                      <tr key={i} className="hover:bg-muted/20">
                        <td className="py-2 px-3 font-mono font-bold text-primary">{c.code}</td>
                        <td className="py-2 px-3">{c.name}</td>
                        <td className="py-2 px-3 text-right font-mono font-semibold">{c.athleteCount}</td>
                        <td className="py-2 px-3 text-center">
                          <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/20">
                            Vinculado
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>

          {/* TAB 2: REGISTROS CON ADVERTENCIAS O DESCARTADOS */}
          <TabsContent value="warnings" className="flex-1 flex flex-col min-h-0 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={filterQuery}
                  onChange={(e) => setFilterQuery(e.target.value)}
                  placeholder="Buscar en observaciones o número de línea..."
                  className="h-8 pl-8 text-xs"
                />
              </div>
              <span className="text-xs text-muted-foreground">
                Mostrando {filteredWarnings.length} de {report.warnings.length}
              </span>
            </div>

            {filteredWarnings.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-muted-foreground">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-2 opacity-80" />
                <p className="text-sm font-semibold text-foreground">¡Cero registros descartados o advertencias!</p>
                <p className="text-xs">Todos los atletas, pruebas y relevos fueron parseados y guardados limpiamente.</p>
              </div>
            ) : (
              <div className="flex-1 rounded-md border overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/60 border-b font-medium text-muted-foreground sticky top-0">
                    <tr>
                      <th className="py-2 px-2.5">Archivo</th>
                      <th className="py-2 px-2.5 text-center">Línea</th>
                      <th className="py-2 px-2.5 text-center">Código</th>
                      <th className="py-2 px-2.5">Motivo de Observación</th>
                      <th className="py-2 px-2.5 font-mono">Texto Original</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y font-mono text-[11px]">
                    {filteredWarnings.map((w, idx) => (
                      <tr key={idx} className="hover:bg-muted/30">
                        <td className="py-2 px-2.5 font-sans font-medium truncate max-w-[140px] text-foreground">
                          {w.file}
                        </td>
                        <td className="py-2 px-2.5 text-center text-muted-foreground font-semibold">
                          #{w.lineNumber}
                        </td>
                        <td className="py-2 px-2.5 text-center">
                          <Badge variant="secondary" className="text-[10px] py-0 px-1 font-mono">
                            {w.lineCode}
                          </Badge>
                        </td>
                        <td className="py-2 px-2.5 font-sans text-foreground">{w.message}</td>
                        <td className="py-2 px-2.5 text-muted-foreground truncate max-w-[220px]" title={w.rawLine}>
                          {w.rawLine || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
        </Tabs>

        <DialogFooter className="pt-3 border-t flex flex-row items-center justify-between sm:justify-between">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportAuditLog}
            className="text-xs gap-1.5"
          >
            <Download className="h-3.5 w-3.5" />
            Exportar Registro de Auditoría (.txt)
          </Button>

          <Button size="sm" onClick={() => onOpenChange(false)} className="text-xs">
            Cerrar Consola
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
