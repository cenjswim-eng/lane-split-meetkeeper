import { useState, useMemo } from "react";
import { Building2, Calendar, Check, Copy, Download, FileSpreadsheet, FileText, Filter, Layers, ShieldCheck, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  extractClubsFromMeetResults,
  exportAssociationClubsCsv,
  generateAssociationClubsPdf,
  type DetectedClub,
  type AssociationClubExportItem,
} from "@/lib/association-ranking";
import { downloadFile } from "@/lib/file-delivery";
import type { DashboardResult } from "@/lib/dashboard-summary";

export interface DetectedMeetOption {
  id: string;
  name: string;
  startDate: string | null;
  year: number;
  resultsCount: number;
}

export function ExportAssociationClubsModal({
  results,
  athletes,
  detectedClubs,
  detectedMeets,
  associationOptions,
  initialAssociation = "all",
  initialMeetId = "all",
  triggerButton,
}: {
  results: DashboardResult[];
  athletes: any[];
  detectedClubs: DetectedClub[];
  detectedMeets: DetectedMeetOption[];
  associationOptions: [string, number][];
  initialAssociation?: string;
  initialMeetId?: string;
  triggerButton?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [selectedMeetId, setSelectedMeetId] = useState<string>(initialMeetId);
  const [selectedAssociation, setSelectedAssociation] = useState<string>(initialAssociation);
  const [onlyAffiliated, setOnlyAffiliated] = useState<boolean>(true);
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  // Sync initial values when modal opens
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      if (initialAssociation && initialAssociation !== "all") {
        setSelectedAssociation(initialAssociation);
      }
      if (initialMeetId && initialMeetId !== "all") {
        setSelectedMeetId(initialMeetId);
      }
    }
    setOpen(nextOpen);
  };

  // Selected meet object
  const activeMeet = useMemo(() => {
    if (selectedMeetId === "all") return null;
    return detectedMeets.find((m) => m.id === selectedMeetId || m.name === selectedMeetId) || null;
  }, [detectedMeets, selectedMeetId]);

  // Extract clubs matching current meet and association criteria
  const extractedClubs: AssociationClubExportItem[] = useMemo(() => {
    return extractClubsFromMeetResults(results, athletes, detectedClubs, {
      meetId: selectedMeetId,
      association: selectedAssociation,
      onlyAffiliatedClubs: onlyAffiliated,
    });
  }, [results, athletes, detectedClubs, selectedMeetId, selectedAssociation, onlyAffiliated]);

  // Search filtered clubs
  const filteredClubs = useMemo(() => {
    if (!search.trim()) return extractedClubs;
    const q = search.toLowerCase();
    return extractedClubs.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.association.toLowerCase().includes(q)
    );
  }, [extractedClubs, search]);

  // Totals
  const totalAthletes = useMemo(
    () => extractedClubs.reduce((acc, c) => acc + c.athleteCount, 0),
    [extractedClubs]
  );
  const totalResults = useMemo(
    () => extractedClubs.reduce((acc, c) => acc + c.resultsCount, 0),
    [extractedClubs]
  );

  // Export to CSV / Excel
  const handleExportCsv = () => {
    if (extractedClubs.length === 0) {
      toast.warning("No hay clubes detectados para exportar con los filtros seleccionados.");
      return;
    }
    setExporting("csv");
    try {
      const meetName = activeMeet?.name || (selectedMeetId === "all" ? "Todos los campeonatos estadales" : selectedMeetId);
      const assocName = selectedAssociation === "all" ? "Todas las Asociaciones" : selectedAssociation;
      const file = exportAssociationClubsCsv(extractedClubs, {
        associationName: assocName,
        meetName,
        seasonYear: activeMeet?.year ? String(activeMeet.year) : String(new Date().getFullYear()),
        federationName: "FEVEDA",
      });
      downloadFile(file);
      toast.success(`Archivo Excel/CSV exportado con éxito (${extractedClubs.length} clubes).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al exportar CSV.");
    } finally {
      setExporting(null);
    }
  };

  // Export to official PDF
  const handleExportPdf = () => {
    if (extractedClubs.length === 0) {
      toast.warning("No hay clubes detectados para exportar con los filtros seleccionados.");
      return;
    }
    setExporting("pdf");
    try {
      const meetName = activeMeet?.name || (selectedMeetId === "all" ? "Todos los campeonatos estadales" : selectedMeetId);
      const assocName = selectedAssociation === "all" ? "Todas las Asociaciones" : selectedAssociation;
      const file = generateAssociationClubsPdf(extractedClubs, {
        associationName: assocName,
        meetName,
        seasonYear: activeMeet?.year ? String(activeMeet.year) : String(new Date().getFullYear()),
        federationName: "FEVEDA",
        onlyAffiliated,
      });
      downloadFile(file);
      toast.success(`Reporte PDF generado con éxito (${extractedClubs.length} clubes).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al exportar PDF.");
    } finally {
      setExporting(null);
    }
  };

  // Copy to clipboard
  const handleCopyClipboard = () => {
    if (extractedClubs.length === 0) {
      toast.info("No hay clubes para copiar.");
      return;
    }
    const meetName = activeMeet?.name || (selectedMeetId === "all" ? "Todos los campeonatos" : selectedMeetId);
    const assocName = selectedAssociation === "all" ? "Todas las Asociaciones" : selectedAssociation;
    const lines = [
      `NÓMINA DE CLUBES - ${assocName.toUpperCase()}`,
      `Campeonato Estadal: ${meetName}`,
      `Total de Clubes: ${extractedClubs.length} | Atletas: ${totalAthletes} | Marcas: ${totalResults}`,
      "--------------------------------------------------------------------------------",
      ...extractedClubs.map(
        (c, idx) =>
          `${idx + 1}. [${c.code}] ${c.name} — ${c.association} (${c.athleteCount} atletas, ${c.resultsCount} marcas)`
      ),
      "--------------------------------------------------------------------------------",
      `Fecha: ${new Date().toLocaleDateString("es-VE")}`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Listado de clubes copiado al portapapeles.");
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" className="gap-2">
            <Download className="size-4 text-primary" />
            <span>Exportar Clubes de Asociación</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            <DialogTitle>Exportar Clubes de una Asociación desde Resultados</DialogTitle>
          </div>
          <DialogDescription>
            Extrae y exporta los clubes afiliados a una asociación a partir de los resultados importados de un campeonato estadal a formatos Excel (CSV) y PDF oficial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Controls row */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-lg border bg-muted/40">
            {/* Campeonato Estadal / Meet selector */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Layers className="size-3.5 text-primary" />
                <span>Campeonato Estadal:</span>
              </label>
              <Select value={selectedMeetId} onValueChange={setSelectedMeetId}>
                <SelectTrigger className="h-9 text-xs" aria-label="Seleccionar campeonato estadal">
                  <SelectValue placeholder="Seleccionar campeonato" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">Todos los campeonatos importados</SelectItem>
                  {detectedMeets.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.resultsCount} marcas · {m.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Asociación Regional */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <Building2 className="size-3.5 text-primary" />
                <span>Asociación Regional:</span>
              </label>
              <Select value={selectedAssociation} onValueChange={setSelectedAssociation}>
                <SelectTrigger className="h-9 text-xs" aria-label="Seleccionar asociación regional">
                  <SelectValue placeholder="Seleccionar asociación" />
                </SelectTrigger>
                <SelectContent className="max-h-60">
                  <SelectItem value="all">Todas las asociaciones</SelectItem>
                  {associationOptions.map(([assoc, count]) => (
                    <SelectItem key={assoc} value={assoc}>
                      {assoc} ({count} {count === 1 ? "club" : "clubes"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Padrón oficial filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-primary" />
                <span>Padrón de Clubes:</span>
              </label>
              <Select
                value={onlyAffiliated ? "affiliated" : "all"}
                onValueChange={(val) => setOnlyAffiliated(val === "affiliated")}
              >
                <SelectTrigger className="h-9 text-xs" aria-label="Seleccionar padrón de clubes">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="affiliated">Solo clubes afiliados oficiales</SelectItem>
                  <SelectItem value="all">Todos los clubes participantes</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Metrics summary banner */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Clubes Extraídos</span>
              <span className="text-xl font-bold font-mono text-primary">{extractedClubs.length}</span>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Atletas Participantes</span>
              <span className="text-xl font-bold font-mono text-foreground">{totalAthletes}</span>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Marcas / Tiempos</span>
              <span className="text-xl font-bold font-mono text-foreground">{totalResults}</span>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Campeonato</span>
              <span className="text-xs font-semibold text-foreground truncate block" title={activeMeet?.name || "Todos"}>
                {activeMeet?.name || "Todos los torneos"}
              </span>
            </div>
          </div>

          {/* Action buttons & search */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pt-1">
            <div className="relative flex-1 max-w-sm">
              <Input
                placeholder="Buscar por código, nombre o asociación..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 text-xs"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyClipboard}
                disabled={extractedClubs.length === 0}
                className="h-8 text-xs gap-1.5"
              >
                <Copy className="size-3.5" />
                <span>Copiar Listado</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleExportCsv}
                disabled={extractedClubs.length === 0 || exporting === "csv"}
                className="h-8 text-xs gap-1.5 border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
              >
                <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Descargar Excel (CSV)</span>
              </Button>

              <Button
                size="sm"
                onClick={handleExportPdf}
                disabled={extractedClubs.length === 0 || exporting === "pdf"}
                className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs"
              >
                <FileText className="size-3.5" />
                <span>Descargar PDF Oficial</span>
              </Button>
            </div>
          </div>

          {/* Club list table */}
          <div className="rounded-md border divide-y max-h-72 overflow-y-auto">
            {filteredClubs.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                <Building2 className="size-8 mx-auto text-muted-foreground/60" />
                <p className="font-semibold text-foreground">No se encontraron clubes con los filtros actuales</p>
                <p>
                  Asegúrate de haber importado los resultados del campeonato estadal o selecciona otra asociación regional arriba.
                </p>
              </div>
            ) : (
              filteredClubs.map((club, idx) => (
                <div
                  key={`${club.code}-${idx}`}
                  className="p-3 flex items-center justify-between gap-3 bg-card hover:bg-muted/30 transition-colors text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-primary">{club.code}</span>
                      <span className="font-semibold text-foreground truncate">{club.name}</span>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {club.association}
                      </Badge>
                      {club.isAffiliated && (
                        <Badge variant="secondary" className="text-[9px] bg-primary/10 text-primary border-primary/20">
                          Oficial
                        </Badge>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                      <span>Torneo: {club.meetName}</span>
                      {club.affiliationYears.length > 0 && (
                        <span>Temporadas: {club.affiliationYears.join(", ")}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 font-mono text-[11px]">
                    <Badge variant="secondary" className="gap-1 font-mono">
                      <Users className="size-3" />
                      <span>{club.athleteCount} atletas</span>
                    </Badge>
                    <Badge variant="outline" className="font-mono">
                      {club.resultsCount} marcas
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
