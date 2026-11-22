import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  Upload,
  CheckCircle2,
  AlertCircle,
  FileArchive,
  Layers,
  ArrowRight,
  ShieldCheck,
  Zap,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { uploadAdaelFilesBatch } from '@/lib/adael-ranking/batch-uploader';
import type { BatchUploadReport } from '@/lib/adael-ranking/schema';

export function AdaelBatchUploaderModal({
  triggerButton,
  onUploadSuccess,
}: {
  triggerButton?: React.ReactNode;
  onUploadSuccess?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, percent: 0, currentFileName: '' });
  const [report, setReport] = useState<BatchUploadReport | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const handleFilesSelected = (filesList: FileList | null) => {
    if (!filesList || filesList.length === 0) return;
    const validFiles: File[] = [];
    for (let i = 0; i < filesList.length; i++) {
      const f = filesList[i];
      if (/\.(hy3|sd3|cl2|zip)$/i.test(f.name)) {
        validFiles.push(f);
      }
    }

    if (validFiles.length === 0) {
      toast.error('Formato no soportado. Selecciona archivos .hy3, .sd3 o paquetes .zip.');
      return;
    }

    setSelectedFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name));
      const newItems = validFiles.filter((f) => !existingNames.has(f.name));
      return [...prev, ...newItems];
    });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFilesSelected(e.dataTransfer.files);
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleStartBatchUpload = async () => {
    if (selectedFiles.length === 0) return;
    setIsProcessing(true);
    setProgress({ current: 0, total: selectedFiles.length, percent: 5, currentFileName: 'Iniciando...' });
    setReport(null);

    try {
      const result = await uploadAdaelFilesBatch(selectedFiles, (p) => {
        setProgress(p);
      });

      setReport(result);
      toast.success(
        `Carga masiva completada: ${result.totalMeetsProcessed} torneos, ${result.totalResultsIngested} marcas procesadas (${result.totalRelayLeadOffs} parciales de relevo).`
      );

      // Invalidate relevant queries so UI reflects updated ranking immediately
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['meets'] }),
        queryClient.invalidateQueries({ queryKey: ['results'] }),
        queryClient.invalidateQueries({ queryKey: ['coach-data'] }),
        queryClient.invalidateQueries({ queryKey: ['association-ranking'] }),
      ]);

      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error durante la carga masiva.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setReport(null);
    setProgress({ current: 0, total: 0, percent: 0, currentFileName: '' });
  };

  return (
    <>
      {triggerButton ? (
        <span onClick={() => setOpen(true)} className="inline-flex cursor-pointer">
          {triggerButton}
        </span>
      ) : (
        <Button
          onClick={() => setOpen(true)}
          className="gap-2 bg-gradient-to-r from-blue-700 to-indigo-700 text-white shadow-xs hover:from-blue-800 hover:to-indigo-800"
        >
          <Layers className="size-4" />
          <span>Carga Masiva ADAEL 2026 (Batch)</span>
        </Button>
      )}

      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (isProcessing) return;
          setOpen(v);
          if (!v) handleReset();
        }}
      >
        <DialogContent className="max-h-[90dvh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Layers className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">
                  Motor de Ingesta Masiva · Ranking ADAEL 2026
                </DialogTitle>
                <DialogDescription>
                  Carga múltiple de archivos (.hy3, .sd3 o .zip). Decodificación ISO-8859-1, extracción de C1, D1, E2 y parciales de relevo F3+G1 con deduplicación garantizada.
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-5 pt-2">
            {/* Feature Highlights */}
            <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2.5">
                <ShieldCheck className="size-4 text-primary shrink-0" />
                <span>
                  <strong>Decodificación ISO-8859-1:</strong> Cero desplazamiento en acentos y letra Ñ.
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2.5">
                <Zap className="size-4 text-amber-500 shrink-0" />
                <span>
                  <strong>Relevos F3 + G1:</strong> Reconoce el 1er relevista válido para el ranking oficial.
                </span>
              </div>
              <div className="flex items-center gap-2 rounded-md border bg-muted/30 p-2.5">
                <Sparkles className="size-4 text-emerald-500 shrink-0" />
                <span>
                  <strong>Idempotencia:</strong> Cero duplicados si se re-sube el mismo torneo.
                </span>
              </div>
            </div>

            {/* Drag & Drop Zone */}
            {!report && (
              <div
                className={`relative flex min-h-48 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center transition-all ${
                  isDragging
                    ? 'border-primary bg-primary/5'
                    : 'border-border/80 hover:border-primary/50 hover:bg-muted/30'
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  multiple
                  accept=".hy3,.sd3,.cl2,.zip"
                  onChange={(e) => handleFilesSelected(e.target.files)}
                />
                <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
                  <Upload className="size-6" />
                </div>
                <h4 className="font-semibold text-foreground text-sm">
                  Arrastra múltiples archivos o haz clic para seleccionar
                </h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Formatos soportados: .HY3 (Meet Manager / Team Manager), .SD3, .CL2 o .ZIP con múltiples torneos
                </p>
                <div className="mt-3 flex gap-2">
                  <Badge variant="outline" className="font-mono text-[10px]">.HY3</Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">.SD3</Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">.ZIP (Multi-torneo)</Badge>
                </div>
              </div>
            )}

            {/* Selected Files List */}
            {!report && selectedFiles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span>Archivos preparados para ingesta ({selectedFiles.length})</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs text-muted-foreground hover:text-destructive"
                    onClick={handleReset}
                    disabled={isProcessing}
                  >
                    Limpiar lista
                  </Button>
                </div>

                <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border p-2 bg-background">
                  {selectedFiles.map((file, idx) => {
                    const isZip = /\.zip$/i.test(file.name);
                    return (
                      <div
                        key={idx}
                        className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2 truncate">
                          {isZip ? (
                            <FileArchive className="size-4 text-amber-500 shrink-0" />
                          ) : (
                            <Layers className="size-4 text-primary shrink-0" />
                          )}
                          <span className="font-medium truncate">{file.name}</span>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        {!isProcessing && (
                          <button
                            type="button"
                            className="text-muted-foreground hover:text-destructive px-1"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveFile(idx);
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {isProcessing && (
                  <div className="space-y-2 pt-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Procesando: {progress.currentFileName}</span>
                      <span>{progress.percent}%</span>
                    </div>
                    <Progress value={progress.percent} />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setOpen(false)}
                    disabled={isProcessing}
                  >
                    Cancelar
                  </Button>
                  <Button
                    onClick={handleStartBatchUpload}
                    disabled={isProcessing || selectedFiles.length === 0}
                    className="gap-2"
                  >
                    {isProcessing ? 'Procesando archivos...' : 'Procesar e Ingestar Todo'}
                    <ArrowRight className="size-4" />
                  </Button>
                </div>
              </div>
            )}

            {/* Batch Report View */}
            {report && (
              <div className="space-y-4">
                <Card className="border-emerald-500/30 bg-emerald-500/5">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-3">
                      <CheckCircle2 className="size-8 text-emerald-600 shrink-0" />
                      <div>
                        <h4 className="font-bold text-foreground">
                          Ingesta Masiva ADAEL 2026 Completada
                        </h4>
                        <p className="text-xs text-muted-foreground">
                          Se procesaron con éxito {report.totalMeetsProcessed} competencias con {report.totalResultsIngested} marcas individuales y {report.totalRelayLeadOffs} parciales iniciales de relevo.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <div className="space-y-2">
                  <h5 className="text-xs font-bold text-foreground uppercase tracking-wider">
                    Detalle por Torneo Ingestado
                  </h5>
                  <div className="max-h-60 overflow-y-auto rounded-lg border">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b bg-muted/50 font-semibold text-muted-foreground">
                        <tr>
                          <th className="p-2.5">Archivo</th>
                          <th className="p-2.5">Torneo</th>
                          <th className="p-2.5">Piscina</th>
                          <th className="p-2.5">Fecha</th>
                          <th className="p-2.5 text-center">Clubes</th>
                          <th className="p-2.5 text-center">Marcas</th>
                          <th className="p-2.5 text-center">Lead-Offs</th>
                          <th className="p-2.5">Estatus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {report.fileSummaries.map((s, idx) => (
                          <tr key={idx} className="hover:bg-muted/20">
                            <td className="p-2.5 font-mono text-[11px] truncate max-w-[120px]">
                              {s.fileName}
                            </td>
                            <td className="p-2.5 font-medium truncate max-w-[160px]">
                              {s.meetName}
                            </td>
                            <td className="p-2.5">
                              <Badge variant="outline" className="font-mono text-[10px]">
                                {s.course}
                              </Badge>
                            </td>
                            <td className="p-2.5 text-muted-foreground">{s.startDate}</td>
                            <td className="p-2.5 text-center">{s.clubsDetected}</td>
                            <td className="p-2.5 text-center font-bold">{s.individualResults}</td>
                            <td className="p-2.5 text-center text-emerald-600 font-bold">
                              {s.relayLeadOffs > 0 ? `+${s.relayLeadOffs}` : '0'}
                            </td>
                            <td className="p-2.5">
                              {s.status === 'INGESTED' ? (
                                <Badge className="bg-emerald-600 text-white text-[10px]">
                                  Ingestado OK
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-[10px]">
                                  Error
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Button variant="outline" size="sm" onClick={handleReset}>
                    Cargar más archivos
                  </Button>
                  <Button onClick={() => setOpen(false)}>Finalizar y Ver Rankings</Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
