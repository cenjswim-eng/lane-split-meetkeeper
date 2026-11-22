/**
 * Modal Interactivo: Subir Listado de Clubes en PDF y Generar Ranking
 * Ubicación: src/components/adael/AdaelClubPdfImporterModal.tsx
 */

import { useState, useRef, useMemo } from 'react';
import {
  FileText,
  Upload,
  Building2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Search,
  Plus,
  Trash2,
  Save,
  Trophy,
  ArrowRight,
  Filter,
  RefreshCw,
  Layers,
  ShieldCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import {
  extractClubsFromPdf,
  saveExtractedClubsToDb,
  loadSavedExtractedClubs,
  type ExtractedPdfClub,
} from '@/lib/adael-ranking/club-pdf-extractor';

export function AdaelClubPdfImporterModal({
  triggerButton,
  onClubsConfirmed,
}: {
  triggerButton?: React.ReactNode;
  onClubsConfirmed?: (selectedClubCodes: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [extractedClubs, setExtractedClubs] = useState<ExtractedPdfClub[]>(() =>
    loadSavedExtractedClubs()
  );
  const [warnings, setWarnings] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isSavingDb, setIsSavingDb] = useState(false);

  // Formulario para añadir club manual
  const [showAddManual, setShowAddManual] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualAssoc, setManualAssoc] = useState('LARA');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Manejar selección de archivo PDF
  const handleFile = async (selectedFile: File) => {
    if (!selectedFile) return;
    setFile(selectedFile);
    setIsProcessing(true);
    setProgress(20);

    try {
      setProgress(40);
      const result = await extractClubsFromPdf(selectedFile);
      setProgress(80);

      setExtractedClubs(result.clubs);
      setWarnings(result.warnings);
      setProgress(100);

      if (result.clubs.length > 0) {
        toast.success(`Se detectaron ${result.clubs.length} clubes en el documento`, {
          description: `Archivo: ${selectedFile.name}`,
        });
      } else {
        toast.warning('No se detectaron clubes en formato estándar en el PDF', {
          description: 'Puedes añadir clubes manualmente a la lista.',
        });
      }
    } catch (err: any) {
      toast.error('Error al procesar el archivo PDF', {
        description: err?.message || 'Asegúrate de que sea un PDF válido.',
      });
      setWarnings([err?.message || 'Error al procesar archivo.']);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      handleFile(droppedFile);
    }
  };

  // Alternar selección de un club
  const toggleSelectClub = (code: string) => {
    setExtractedClubs((prev) =>
      prev.map((c) => (c.code === code ? { ...c, selected: !c.selected } : c))
    );
  };

  // Seleccionar todos / deseleccionar todos
  const toggleSelectAll = (select: boolean) => {
    setExtractedClubs((prev) => prev.map((c) => ({ ...c, selected: select })));
  };

  // Seleccionar solo Lara
  const selectOnlyLara = () => {
    setExtractedClubs((prev) =>
      prev.map((c) => ({
        ...c,
        selected: c.association.toUpperCase() === 'LARA',
      }))
    );
  };

  // Eliminar un club de la lista extraída
  const removeClub = (code: string) => {
    setExtractedClubs((prev) => prev.filter((c) => c.code !== code));
  };

  // Añadir club manualmente
  const handleAddManualClub = () => {
    const codeClean = manualCode.trim().toUpperCase();
    const nameClean = manualName.trim();
    if (!codeClean || codeClean.length < 2) {
      toast.error('Indica un código válido de 2 a 7 caracteres (ej. PISBO).');
      return;
    }
    if (!nameClean) {
      toast.error('Indica el nombre del club.');
      return;
    }

    const newClub: ExtractedPdfClub = {
      id: `manual-${codeClean}`,
      code: codeClean,
      name: nameClean,
      association: manualAssoc.trim().toUpperCase() || 'LARA',
      isFederated: true,
      statusLabel: 'Afiliado 2026',
      selected: true,
      confidence: 'HIGH',
    };

    setExtractedClubs((prev) => {
      const filtered = prev.filter((c) => c.code !== codeClean);
      return [newClub, ...filtered];
    });

    setManualCode('');
    setManualName('');
    setShowAddManual(false);
    toast.success(`Club ${codeClean} añadido a la lista.`);
  };

  // Guardar en Base de Datos Supabase y LocalStorage
  const handleSaveToDb = async () => {
    setIsSavingDb(true);
    try {
      const res = await saveExtractedClubsToDb(extractedClubs);
      if (res.success) {
        toast.success(`Padrón guardado exitosamente`, {
          description: `${res.savedCount} clubes registrados para la temporada 2026.`,
        });
      } else {
        toast.error('No se pudo guardar en la base de datos', { description: res.error });
      }
    } finally {
      setIsSavingDb(false);
    }
  };

  // Acción Principal: Extraer Resultados y Generar Ranking con estos Clubes
  const handleGenerateRanking = async () => {
    const selectedCodes = extractedClubs.filter((c) => c.selected).map((c) => c.code);

    if (selectedCodes.length === 0) {
      toast.error('Debes seleccionar al menos un club para generar el ranking.');
      return;
    }

    // Guardar en base de datos / storage
    await saveExtractedClubsToDb(extractedClubs);

    // Notificar al componente padre
    if (onClubsConfirmed) {
      onClubsConfirmed(selectedCodes);
    }

    toast.success('¡Filtro de clubes aplicado al Ranking!', {
      description: `Generando ranking oficial con los resultados de ${selectedCodes.length} clubes.`,
    });

    setOpen(false);
  };

  // Clubes filtrados por búsqueda
  const filteredClubs = useMemo(() => {
    if (!searchQuery.trim()) return extractedClubs;
    const q = searchQuery.toLowerCase().trim();
    return extractedClubs.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.association.toLowerCase().includes(q)
    );
  }, [extractedClubs, searchQuery]);

  const selectedCount = extractedClubs.filter((c) => c.selected).length;
  const laraCount = extractedClubs.filter((c) => c.association.toUpperCase() === 'LARA').length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" className="gap-2 shadow-sm border-primary/30">
            <FileText className="h-4 w-4 text-primary" />
            Subir Listado de Clubes (PDF)
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-6 overflow-hidden">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-lg font-bold">
                Importar Padrón de Clubes desde PDF — ADAEL 2026
              </DialogTitle>
              <DialogDescription className="text-xs">
                Sube una resolución o listado en PDF. El sistema extraerá los clubes afiliados para
                filtrar los resultados y generar el ranking federado oficial.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto py-4 space-y-5 pr-1">
          {/* 1. Zona de Carga de Archivo Drag & Drop */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
              isDragging
                ? 'border-primary bg-primary/5'
                : file
                ? 'border-emerald-500/50 bg-emerald-500/5'
                : 'border-muted-foreground/30 hover:border-primary/50 hover:bg-muted/30'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
                e.target.value = '';
              }}
            />

            <div className="flex flex-col items-center justify-center gap-2">
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-full ${
                  file ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'
                }`}
              >
                {file ? <FileText className="h-6 w-6" /> : <Upload className="h-6 w-6" />}
              </div>

              <div>
                <p className="text-sm font-semibold text-foreground">
                  {file ? file.name : 'Haz clic o arrastra aquí el archivo PDF con el listado de clubes'}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Formatos compatibles: PDF con tablas de clubes, resoluciones federativas o boletines ADAEL.
                </p>
              </div>

              {file && (
                <Badge variant="outline" className="text-xs text-emerald-700 dark:text-emerald-300 border-emerald-300">
                  <CheckCircle2 className="h-3 w-3 mr-1" />
                  Archivo cargado ({(file.size / 1024).toFixed(1)} KB)
                </Badge>
              )}
            </div>
          </div>

          {/* Barra de Progreso */}
          {isProcessing && (
            <div className="space-y-1.5 animate-in fade-in">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Extrayendo texto y procesando clubes con OCR...</span>
                <span>{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Avisos o Advertencias */}
          {warnings.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Nota de análisis:</p>
                <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                  {warnings.map((w, idx) => (
                    <li key={idx}>{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* 2. Resumen y Controles de la Lista de Clubes */}
          {extractedClubs.length > 0 && (
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Clubes Detectados:
                  </span>
                  <Badge variant="secondary" className="font-mono text-xs">
                    {extractedClubs.length} totales
                  </Badge>
                  <Badge variant="outline" className="border-primary/40 text-primary text-xs font-semibold">
                    {selectedCount} seleccionados
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    {laraCount} de Lara
                  </Badge>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 text-xs">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={() => toggleSelectAll(true)}
                  >
                    Seleccionar todos
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2"
                    onClick={selectOnlyLara}
                  >
                    Solo Lara
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-muted-foreground"
                    onClick={() => toggleSelectAll(false)}
                  >
                    Deseleccionar
                  </Button>
                </div>
              </div>

              {/* Barra de búsqueda y botón añadir manual */}
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="Buscar club por código o nombre..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAddManual(!showAddManual)}
                  className="h-8 gap-1 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Añadir Club
                </Button>
              </div>

              {/* Formulario rápido para añadir club manual */}
              {showAddManual && (
                <div className="p-3 border rounded-lg bg-muted/40 space-y-2 animate-in fade-in">
                  <p className="text-xs font-semibold text-foreground">Añadir club al padrón:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                    <Input
                      placeholder="Código (ej. PISBO)"
                      value={manualCode}
                      onChange={(e) => setManualCode(e.target.value.toUpperCase())}
                      className="h-8 text-xs font-mono uppercase"
                    />
                    <Input
                      placeholder="Nombre del Club"
                      value={manualName}
                      onChange={(e) => setManualName(e.target.value)}
                      className="h-8 text-xs sm:col-span-2"
                    />
                    <Input
                      placeholder="Asoc. (ej. LARA)"
                      value={manualAssoc}
                      onChange={(e) => setManualAssoc(e.target.value.toUpperCase())}
                      className="h-8 text-xs uppercase"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowAddManual(false)}
                      className="h-7 text-xs"
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={handleAddManualClub}
                      className="h-7 text-xs"
                    >
                      Guardar Club
                    </Button>
                  </div>
                </div>
              )}

              {/* Tabla de Clubes Extraídos */}
              <div className="rounded-lg border overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/80 text-muted-foreground uppercase sticky top-0 z-10">
                    <tr>
                      <th className="py-2 px-3 w-8 text-center">
                        <Checkbox
                          checked={selectedCount === extractedClubs.length && extractedClubs.length > 0}
                          onCheckedChange={(checked) => toggleSelectAll(Boolean(checked))}
                          aria-label="Seleccionar todos"
                        />
                      </th>
                      <th className="py-2 px-3 w-24">Código</th>
                      <th className="py-2 px-3">Nombre del Club</th>
                      <th className="py-2 px-3 text-center w-24">Asociación</th>
                      <th className="py-2 px-3 text-center w-28">Estatus</th>
                      <th className="py-2 px-2 text-center w-12">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredClubs.map((club) => (
                      <tr
                        key={club.code}
                        className={`hover:bg-muted/40 transition-colors ${
                          club.selected ? 'bg-primary/5' : ''
                        }`}
                      >
                        <td className="py-2 px-3 text-center">
                          <Checkbox
                            checked={club.selected}
                            onCheckedChange={() => toggleSelectClub(club.code)}
                            aria-label={`Seleccionar ${club.code}`}
                          />
                        </td>
                        <td className="py-2 px-3 font-mono font-bold text-foreground">
                          {club.code}
                        </td>
                        <td className="py-2 px-3 font-medium text-foreground">
                          {club.name}
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge
                            variant="outline"
                            className={`text-[10px] uppercase font-mono ${
                              club.association === 'LARA'
                                ? 'border-primary/40 text-primary bg-primary/5 font-bold'
                                : 'text-muted-foreground'
                            }`}
                          >
                            {club.association}
                          </Badge>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <Badge
                            variant="secondary"
                            className="text-[10px] bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-300"
                          >
                            <ShieldCheck className="h-3 w-3 mr-0.5 inline" />
                            {club.statusLabel || 'Afiliado 2026'}
                          </Badge>
                        </td>
                        <td className="py-2 px-2 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-red-600"
                            onClick={() => removeClub(club.code)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer con Acciones */}
        <div className="pt-3 border-t flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>Los clubes seleccionados filtrarán los resultados oficiales de la temporada 2026.</span>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {extractedClubs.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleSaveToDb}
                disabled={isSavingDb}
                className="gap-1.5 text-xs"
              >
                <Save className="h-3.5 w-3.5 text-muted-foreground" />
                Guardar en Padrón
              </Button>
            )}

            <Button
              type="button"
              variant="default"
              size="sm"
              onClick={handleGenerateRanking}
              disabled={selectedCount === 0}
              className="gap-1.5 text-xs shadow-sm bg-primary text-primary-foreground font-semibold"
            >
              <Trophy className="h-3.5 w-3.5" />
              Extraer Resultados y Generar Ranking ({selectedCount})
              <ArrowRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
