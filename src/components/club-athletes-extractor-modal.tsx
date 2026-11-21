import { useState, useMemo } from "react";
import { Building2, Calendar, Check, Copy, Download, FileSpreadsheet, FileText, Filter, Layers, Medal, Search, ShieldCheck, Trophy, Users } from "lucide-react";
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
  extractAthletesFromClubs,
  exportClubAthletesCsv,
  generateClubAthletesPdf,
  type ExtractedClubAthleteItem,
  type DetectedClub,
} from "@/lib/association-ranking";
import { downloadFile } from "@/lib/file-delivery";
import type { DashboardResult } from "@/lib/dashboard-summary";

export function ClubAthletesExtractorModal({
  results,
  athletes,
  targetClubCodes,
  detectedClubs = [],
  detectedMeets = [],
  seasonYear,
  triggerButton,
}: {
  results: DashboardResult[];
  athletes: any[];
  targetClubCodes: string[] | "all";
  detectedClubs?: DetectedClub[];
  detectedMeets?: { id: string; name: string; startDate: string | null; year: number }[];
  seasonYear?: number | "all";
  triggerButton?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedMeetId, setSelectedMeetId] = useState<string>("all");
  const [selectedClubCode, setSelectedClubCode] = useState<string>("all");
  const [exporting, setExporting] = useState<"csv" | "pdf" | null>(null);

  // Extract all athletes from the target clubs
  const extractedAthletes: ExtractedClubAthleteItem[] = useMemo(() => {
    return extractAthletesFromClubs(results, athletes, targetClubCodes, {
      detectedClubs,
      meetId: selectedMeetId,
      seasonYear,
      gender: selectedGender,
    });
  }, [results, athletes, targetClubCodes, detectedClubs, selectedMeetId, seasonYear, selectedGender]);

  // Distinct clubs present among the extracted athletes
  const distinctClubs = useMemo(() => {
    const map = new Map<string, string>();
    extractedAthletes.forEach((a) => {
      if (!map.has(a.clubCode)) map.set(a.clubCode, a.clubName);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [extractedAthletes]);

  // Distinct categories present
  const distinctCategories = useMemo(() => {
    const set = new Set<string>();
    extractedAthletes.forEach((a) => set.add(a.category));
    return [...set].sort();
  }, [extractedAthletes]);

  // Filtered athletes based on search, club, and category
  const filteredAthletes = useMemo(() => {
    const q = search.toLowerCase().trim();
    return extractedAthletes.filter((a) => {
      if (selectedClubCode !== "all" && a.clubCode.toUpperCase() !== selectedClubCode.toUpperCase()) {
        return false;
      }
      if (selectedCategory !== "all" && a.category !== selectedCategory) {
        return false;
      }
      if (!q) return true;
      return (
        a.fullName.toLowerCase().includes(q) ||
        a.clubCode.toLowerCase().includes(q) ||
        a.clubName.toLowerCase().includes(q) ||
        a.association.toLowerCase().includes(q)
      );
    });
  }, [extractedAthletes, search, selectedClubCode, selectedCategory]);

  // Statistics
  const totalMale = useMemo(
    () => extractedAthletes.filter((a) => a.gender === "M").length,
    [extractedAthletes]
  );
  const totalFemale = useMemo(
    () => extractedAthletes.filter((a) => a.gender === "F").length,
    [extractedAthletes]
  );
  const totalMarks = useMemo(
    () => extractedAthletes.reduce((acc, a) => acc + a.resultsCount, 0),
    [extractedAthletes]
  );

  // Export CSV
  const handleExportCsv = () => {
    if (extractedAthletes.length === 0) {
      toast.warning("No hay atletas extraídos para exportar.");
      return;
    }
    setExporting("csv");
    try {
      const activeMeetObj = detectedMeets.find((m) => m.id === selectedMeetId);
      const file = exportClubAthletesCsv(extractedAthletes, {
        clubsCount: distinctClubs.length,
        meetName: activeMeetObj?.name || (selectedMeetId === "all" ? "Todos los torneos" : selectedMeetId),
        seasonYear: seasonYear === "all" ? "Histórico" : String(seasonYear || new Date().getFullYear()),
        federationName: "FEVEDA",
      });
      downloadFile(file);
      toast.success(`Nómina de ${extractedAthletes.length} atletas exportada en CSV (Excel).`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al exportar atletas a CSV.");
    } finally {
      setExporting(null);
    }
  };

  // Export PDF
  const handleExportPdf = () => {
    if (extractedAthletes.length === 0) {
      toast.warning("No hay atletas extraídos para exportar.");
      return;
    }
    setExporting("pdf");
    try {
      const activeMeetObj = detectedMeets.find((m) => m.id === selectedMeetId);
      const file = generateClubAthletesPdf(extractedAthletes, {
        clubsCount: distinctClubs.length,
        meetName: activeMeetObj?.name || (selectedMeetId === "all" ? "Todos los torneos" : selectedMeetId),
        seasonYear: seasonYear === "all" ? "Histórico" : String(seasonYear || new Date().getFullYear()),
        federationName: "FEVEDA",
      });
      downloadFile(file);
      toast.success(`Nómina oficial de ${extractedAthletes.length} atletas generada en PDF.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar PDF de atletas.");
    } finally {
      setExporting(null);
    }
  };

  // Copy roster
  const handleCopyRoster = () => {
    if (extractedAthletes.length === 0) {
      toast.info("No hay atletas para copiar.");
      return;
    }
    const lines = [
      "NÓMINA DE ATLETAS EXTRAÍDOS POR CLUBES DEL RANKING",
      `Total: ${extractedAthletes.length} atletas (${totalMale} M, ${totalFemale} F) · ${distinctClubs.length} clubes`,
      "--------------------------------------------------------------------------------",
      ...extractedAthletes.map(
        (a, idx) =>
          `${idx + 1}. ${a.fullName} (${a.gender}, ${a.ageAtDec31} años · ${a.category}) — [${a.clubCode}] ${a.clubName} — ${a.resultsCount} marcas (${a.bestTimesSummary})`
      ),
      "--------------------------------------------------------------------------------",
      `Fecha de extracción: ${new Date().toLocaleDateString("es-VE")}`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Nómina de atletas copiada al portapapeles.");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" className="gap-2">
            <Users className="size-4 text-primary" />
            <span>Extraer Atletas de Clubes</span>
            <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary font-mono ml-1">
              {extractedAthletes.length}
            </Badge>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto rounded-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Users className="size-5 text-primary" />
            <DialogTitle>Atletas Integrantes de los Clubes del Ranking</DialogTitle>
          </div>
          <DialogDescription>
            Extrae de los resultados importados todos los atletas que integran los clubes seleccionados para el ranking, organizados por categoría, club y marcas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Total Atletas</span>
              <span className="text-xl font-bold font-mono text-primary">{extractedAthletes.length}</span>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Masculino</span>
              <span className="text-xl font-bold font-mono text-foreground">{totalMale}</span>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Femenino</span>
              <span className="text-xl font-bold font-mono text-foreground">{totalFemale}</span>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Clubes Activos</span>
              <span className="text-xl font-bold font-mono text-foreground">{distinctClubs.length}</span>
            </div>
            <div className="p-3 rounded-lg border bg-card">
              <span className="text-[11px] text-muted-foreground block">Marcas Registradas</span>
              <span className="text-xl font-bold font-mono text-foreground">{totalMarks}</span>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 p-3 rounded-lg border bg-muted/30">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por atleta o club..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            {/* Club Filter */}
            <Select value={selectedClubCode} onValueChange={setSelectedClubCode}>
              <SelectTrigger className="h-8 text-xs" aria-label="Filtrar por club">
                <SelectValue placeholder="Todos los clubes" />
              </SelectTrigger>
              <SelectContent className="max-h-52">
                <SelectItem value="all">Todos los clubes ({distinctClubs.length})</SelectItem>
                {distinctClubs.map(([code, name]) => (
                  <SelectItem key={code} value={code}>
                    {code} - {name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-8 text-xs" aria-label="Filtrar por categoría">
                <SelectValue placeholder="Todas las categorías" />
              </SelectTrigger>
              <SelectContent className="max-h-52">
                <SelectItem value="all">Todas las categorías</SelectItem>
                {distinctCategories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Gender Filter */}
            <Select value={selectedGender} onValueChange={setSelectedGender}>
              <SelectTrigger className="h-8 text-xs" aria-label="Filtrar por sexo">
                <SelectValue placeholder="Todos los sexos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los sexos (M y F)</SelectItem>
                <SelectItem value="M">Masculino (M)</SelectItem>
                <SelectItem value="F">Femenino (F)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Action buttons row */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              Mostrando {filteredAthletes.length} de {extractedAthletes.length} nadadores
            </span>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={handleCopyRoster}
                disabled={extractedAthletes.length === 0}
                className="h-8 text-xs gap-1.5"
              >
                <Copy className="size-3.5" />
                <span>Copiar Nómina</span>
              </Button>

              <Button
                size="sm"
                variant="outline"
                onClick={handleExportCsv}
                disabled={extractedAthletes.length === 0 || exporting === "csv"}
                className="h-8 text-xs gap-1.5 border-emerald-600/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
              >
                <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Descargar Excel (CSV)</span>
              </Button>

              <Button
                size="sm"
                onClick={handleExportPdf}
                disabled={extractedAthletes.length === 0 || exporting === "pdf"}
                className="h-8 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold shadow-xs"
              >
                <FileText className="size-3.5" />
                <span>Descargar PDF Oficial</span>
              </Button>
            </div>
          </div>

          {/* Athlete list */}
          <div className="rounded-md border divide-y max-h-80 overflow-y-auto">
            {filteredAthletes.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                <Users className="size-8 mx-auto text-muted-foreground/60" />
                <p className="font-semibold text-foreground">No se encontraron atletas</p>
                <p>
                  No se detectaron nadadores con marcas registradas para los clubes o filtros seleccionados.
                </p>
              </div>
            ) : (
              filteredAthletes.map((a, idx) => (
                <div
                  key={`${a.id}-${idx}`}
                  className="p-3 flex items-center justify-between gap-3 bg-card hover:bg-muted/30 transition-colors text-xs"
                >
                  <div className="space-y-0.5 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-foreground">{a.fullName}</span>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-mono py-0 px-1.5 ${
                          a.gender === "M" ? "bg-blue-500/10 text-blue-700 dark:text-blue-300" : "bg-pink-500/10 text-pink-700 dark:text-pink-300"
                        }`}
                      >
                        {a.gender}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] font-normal">
                        {a.category}
                      </Badge>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {a.ageAtDec31 > 0 ? `${a.ageAtDec31} años` : ""}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-semibold text-primary font-mono">[{a.clubCode}]</span>
                      <span>{a.clubName}</span>
                      <span>· {a.association}</span>
                    </div>

                    {a.bestTimesSummary && a.bestTimesSummary !== "—" && (
                      <p className="text-[11px] text-muted-foreground/90 truncate max-w-xl">
                        Mejores marcas: {a.bestTimesSummary}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="outline" className="font-mono text-[11px]">
                      {a.resultsCount} marcas
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
