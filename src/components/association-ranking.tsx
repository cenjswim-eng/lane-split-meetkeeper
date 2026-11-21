import { useState, useMemo } from "react";
import { Building2, Calendar, Download, FileText, Filter, Layers, Medal, Settings2, Sparkles, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  extractDetectedClubs,
  calculateAssociationRankings,
  generateAssociationRankingPdf,
  type AssociationRankingFilters,
} from "@/lib/association-ranking";
import { ClubAssociationManager } from "./club-association-manager";
import { downloadFile } from "@/lib/file-delivery";
import type { DashboardResult } from "@/lib/dashboard-summary";

export function AssociationRanking({
  results,
  athletes,
  clubs = [],
  teams = [],
}: {
  results: DashboardResult[];
  athletes: any[];
  clubs?: any[];
  teams?: any[];
}) {
  // 1. Extract all detected clubs
  const detectedClubs = useMemo(() => {
    return extractDetectedClubs(athletes, results, clubs, teams);
  }, [athletes, results, clubs, teams]);

  // Distinct annual federation affiliation seasons derived from imported results
  const availableAffiliationYears = useMemo(() => {
    const years = new Set<number>();
    for (const r of results) {
      if (r.meets?.start_date) {
        const y = Number(r.meets.start_date.slice(0, 4));
        if (y > 2000 && y < 2100) years.add(y);
      }
    }
    years.add(new Date().getFullYear());
    return [...years].sort((a, b) => b - a);
  }, [results]);

  // Distinct associations
  const associationOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of detectedClubs) {
      const assoc = c.association || "Sin Asociación";
      counts.set(assoc, (counts.get(assoc) || 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [detectedClubs]);

  // Filters State
  const [selectedAffiliationYear, setSelectedAffiliationYear] = useState<string>(() => {
    return String(new Date().getFullYear());
  });
  const [selectedAssociation, setSelectedAssociation] = useState<string>("all");
  const [selectedClub, setSelectedClub] = useState<string>("all");
  const [selectedCourse, setSelectedCourse] = useState<string>("LCM");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [ageMode, setAgeMode] = useState<AssociationRankingFilters["ageMode"]>("libre");
  const [customMinAge, setCustomMinAge] = useState<number>(13);
  const [customMaxAge, setCustomMaxAge] = useState<number>(14);
  const [selectedStroke, setSelectedStroke] = useState<number>(0); // 0 = all
  const [topLimit, setTopLimit] = useState<number>(5);

  // Available clubs for current association
  const availableClubsForAssoc = useMemo(() => {
    if (selectedAssociation === "all") return detectedClubs;
    return detectedClubs.filter(
      (c) => c.association.toLowerCase() === selectedAssociation.toLowerCase()
    );
  }, [detectedClubs, selectedAssociation]);

  // Total imported swims for current affiliation year
  const totalSwimsInYearCount = useMemo(() => {
    if (selectedAffiliationYear === "all") return results.length;
    const y = Number(selectedAffiliationYear);
    return results.filter((r) => r.meets?.start_date && Number(r.meets.start_date.slice(0, 4)) === y).length;
  }, [results, selectedAffiliationYear]);

  // Calculate rankings
  const { rankings, participatingClubs } = useMemo(() => {
    return calculateAssociationRankings(results, athletes, detectedClubs, {
      association: selectedAssociation,
      clubFilter: selectedClub,
      course: selectedCourse,
      gender: selectedGender,
      ageMode,
      customMinAge,
      customMaxAge,
      strokeFilter: selectedStroke,
      topN: topLimit,
      affiliationYear: selectedAffiliationYear === "all" ? "all" : Number(selectedAffiliationYear),
    });
  }, [
    results,
    athletes,
    detectedClubs,
    selectedAssociation,
    selectedClub,
    selectedCourse,
    selectedGender,
    ageMode,
    customMinAge,
    customMaxAge,
    selectedStroke,
    topLimit,
    selectedAffiliationYear,
  ]);

  // Total unique swimmers in the top 5
  const uniqueSwimmersCount = useMemo(() => {
    const ids = new Set<string>();
    rankings.forEach((e) => e.top5.forEach((item) => ids.add(item.athleteId)));
    return ids.size;
  }, [rankings]);

  // PDF Export
  const handleExportPdf = () => {
    try {
      if (rankings.length === 0) {
        toast.warning("No hay resultados para exportar con los filtros seleccionados.");
        return;
      }

      const assocName = selectedAssociation === "all" ? "Todas las Asociaciones" : selectedAssociation;
      const ageLabel =
        ageMode === "libre"
          ? "Categoría Libre (Absoluto)"
          : ageMode === "13-14"
          ? "Cruce de Edades: 13 - 14 años"
          : ageMode === "11-12"
          ? "Cruce de Edades: 11 - 12 años"
          : ageMode === "15-16"
          ? "Cruce de Edades: 15 - 16 años"
          : ageMode === "17+"
          ? "Categoría: 17 y más años"
          : `Rango Personalizado: ${customMinAge} a ${customMaxAge} años`;

      const courseLabel = selectedCourse === "LCM" ? "50 m (LCM)" : selectedCourse === "SCM" ? "25 m (SCM)" : "Todas las piscinas";
      const genderLabel = selectedGender === "M" ? "Masculino" : selectedGender === "F" ? "Femenino" : "Masculino y Femenino";

      const seasonLabel =
        selectedAffiliationYear === "all"
          ? "Histórico (Todas las temporadas)"
          : `Temporada de Afiliación Anual ${selectedAffiliationYear}`;

      const file = generateAssociationRankingPdf(rankings, {
        associationName: assocName,
        ageModeLabel: ageLabel,
        courseLabel,
        genderLabel,
        affiliationYearLabel: seasonLabel,
        participatingClubs,
      });

      downloadFile(file);
      toast.success("PDF del Ranking Top 5 generado con éxito.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al generar el PDF del ranking.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header and Controls */}
      <Card className="border-primary/20 shadow-xs">
        <CardHeader className="pb-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Trophy className="size-5 text-primary" />
                <CardTitle className="text-xl font-bold">Ranking Oficial por Asociación (Top 5)</CardTitle>
              </div>
              <CardDescription>
                Extrae las 5 mejores marcas por prueba y categoría de los clubes afiliados a cada asociación según el año de afiliación federativa anual. Regla oficial: 1 mejor tiempo por atleta y edad calculada al 31 de diciembre.
              </CardDescription>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <ClubAssociationManager clubs={detectedClubs} />
              <Button onClick={handleExportPdf} className="gap-2 shrink-0">
                <FileText className="size-4" />
                Exportar PDF (Top 5)
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          {/* Filter Bar */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 border-t pt-4">
            {/* Temporada de Afiliación Anual */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <Calendar className="size-3.5 text-primary" />
                  <span>Afiliación Anual</span>
                </span>
                <span className="text-[10px] text-primary">
                  {selectedAffiliationYear === "all" ? "Histórico" : `Año ${selectedAffiliationYear}`}
                </span>
              </label>
              <Select value={selectedAffiliationYear} onValueChange={setSelectedAffiliationYear}>
                <SelectTrigger aria-label="Filtrar por temporada de afiliación anual">
                  <SelectValue placeholder="Seleccionar temporada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las temporadas (Histórico)</SelectItem>
                  {availableAffiliationYears.map((yr) => (
                    <SelectItem key={yr} value={String(yr)}>
                      Temporada {yr} {yr === new Date().getFullYear() ? "· (Actual)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Asociación */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Asociación Regional</span>
                <span className="text-[10px] text-primary">{detectedClubs.length} clubes</span>
              </label>
              <Select
                value={selectedAssociation}
                onValueChange={(val) => {
                  setSelectedAssociation(val);
                  setSelectedClub("all");
                }}
              >
                <SelectTrigger aria-label="Filtrar por asociación">
                  <SelectValue placeholder="Seleccionar Asociación" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las asociaciones</SelectItem>
                  {associationOptions.map(([assoc, count]) => (
                    <SelectItem key={assoc} value={assoc}>
                      {assoc} ({count} {count === 1 ? "club" : "clubes"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Club dentro de la asociación */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground flex items-center justify-between">
                <span>Club (Filtro opcional)</span>
                <span className="text-[10px] text-primary">{availableClubsForAssoc.length} disp.</span>
              </label>
              <Select value={selectedClub} onValueChange={setSelectedClub}>
                <SelectTrigger aria-label="Filtrar por club">
                  <SelectValue placeholder="Todos los clubes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {selectedAssociation === "all"
                      ? "Todos los clubes del estado (Completo)"
                      : `Todos los clubes de ${selectedAssociation}`}
                  </SelectItem>
                  {availableClubsForAssoc.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} {c.name && c.name !== c.code ? `- ${c.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Modalidad de Edad */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Modalidad de Edad</label>
              <Select
                value={ageMode}
                onValueChange={(val: any) => setAgeMode(val)}
              >
                <SelectTrigger aria-label="Modalidad de edad">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="libre">Ranking Libre (Absoluto / Todas)</SelectItem>
                  <SelectItem value="13-14">Cruce 13 - 14 años (Infantil B)</SelectItem>
                  <SelectItem value="11-12">Cruce 11 - 12 años (Infantil A)</SelectItem>
                  <SelectItem value="15-16">Cruce 15 - 16 años (Juvenil A)</SelectItem>
                  <SelectItem value="17+">17 y más años (Máxima)</SelectItem>
                  <SelectItem value="custom">Rango Personalizado...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Piscina */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Piscina</label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse}>
                <SelectTrigger aria-label="Piscina">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las piscinas</SelectItem>
                  <SelectItem value="LCM">50 m (Larga / LCM)</SelectItem>
                  <SelectItem value="SCM">25 m (Corta / SCM)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sexo */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Sexo</label>
              <Select value={selectedGender} onValueChange={setSelectedGender}>
                <SelectTrigger aria-label="Sexo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Ambos sexos (M y F)</SelectItem>
                  <SelectItem value="M">Masculino</SelectItem>
                  <SelectItem value="F">Femenino</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Participating affiliated clubs banner */}
          <div className="rounded-lg border bg-muted/30 p-3 text-xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-foreground">
                <Building2 className="size-4 text-primary" />
                <span>
                  {selectedAssociation === "all"
                    ? "Clubes clasificados de todas las asociaciones:"
                    : `Clubes afiliados participantes en ${selectedAssociation}:`}
                </span>
                <Badge variant="outline" className="text-[11px] font-mono">
                  {participatingClubs.length} {participatingClubs.length === 1 ? "club clasificado" : "clubes clasificados"}
                </Badge>
              </div>
              <span className="text-[11px] text-muted-foreground">
                Ranking estadal oficial · Incluye a todos los nadadores de los clubes afiliados
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {participatingClubs.length === 0 ? (
                <span className="text-muted-foreground italic">No se detectaron clubes con tiempos para estos filtros.</span>
              ) : (
                participatingClubs.map((code) => {
                  const clubObj = detectedClubs.find((c) => c.code.toUpperCase() === code.toUpperCase());
                  return (
                    <Badge key={code} variant="secondary" className="text-[11px] font-normal py-0.5 px-2">
                      <span className="font-bold font-mono text-primary mr-1">{code}</span>
                      {clubObj?.name && clubObj.name !== code ? (
                        <span className="text-muted-foreground truncate max-w-44">({clubObj.name})</span>
                      ) : null}
                    </Badge>
                  );
                })
              )}
            </div>
          </div>

          {/* Custom Age Range inputs when 'custom' is active */}
          {ageMode === "custom" && (
            <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg border bg-muted/40">
              <span className="text-xs font-semibold">Seleccionar cruce de edades personalizado:</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Desde:</span>
                <Input
                  type="number"
                  min={6}
                  max={99}
                  value={customMinAge}
                  onChange={(e) => setCustomMinAge(Math.max(1, Number(e.target.value)))}
                  className="w-20 h-8 text-xs"
                />
                <span className="text-xs">años</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Hasta:</span>
                <Input
                  type="number"
                  min={6}
                  max={99}
                  value={customMaxAge}
                  onChange={(e) => setCustomMaxAge(Math.max(1, Number(e.target.value)))}
                  className="w-20 h-8 text-xs"
                />
                <span className="text-xs">años</span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                (Edades al 31 de diciembre del año de competencia)
              </span>
            </div>
          )}

          {/* Quick Stats Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-xs text-muted-foreground">
            <div className="flex flex-wrap items-center gap-3">
              <span className="flex items-center gap-1 font-medium text-foreground">
                <Calendar className="size-3.5 text-primary" />
                <span>Temporada:</span>
                <Badge variant={selectedAffiliationYear === "all" ? "outline" : "secondary"} className="ml-0.5 text-primary text-[11px]">
                  {selectedAffiliationYear === "all" ? "Todas (Histórico)" : `Afiliación Anual ${selectedAffiliationYear}`}
                </Badge>
              </span>
              <span>•</span>
              <span>
                Marcas extraídas: <strong className="text-foreground">{totalSwimsInYearCount}</strong>
              </span>
              <span>•</span>
              <span>
                Pruebas con registros: <strong className="text-foreground">{rankings.length}</strong>
              </span>
              <span>•</span>
              <span>
                Atletas clasificados en Top 5: <strong className="text-foreground">{uniqueSwimmersCount}</strong>
              </span>
              <span>•</span>
              <span>
                Asociación activa:{" "}
                <Badge variant="outline" className="text-primary font-medium ml-1">
                  {selectedAssociation === "all" ? "Todas" : selectedAssociation}
                </Badge>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="top-limit-select" className="text-[11px]">Profundidad:</label>
              <select
                id="top-limit-select"
                aria-label="Profundidad de puestos"
                value={topLimit}
                onChange={(e) => setTopLimit(Number(e.target.value))}
                className="h-7 rounded border bg-background px-2 text-xs"
              >
                <option value={3}>Top 3 (Podio)</option>
                <option value={5}>Top 5 Oficial</option>
                <option value={10}>Top 10</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results View */}
      {rankings.length === 0 ? (
        <div className="rounded-lg border border-dashed p-12 text-center space-y-3">
          <Trophy className="size-10 text-muted-foreground mx-auto" />
          <h3 className="font-semibold text-base">No hay marcas para los filtros seleccionados</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Verifica que los clubes de los resultados tengan su asociación configurada pulsando en «Configurar Asociaciones de Clubes», o cambia la piscina o el cruce de edades.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {rankings.map((event) => (
            <div key={`${event.distance}-${event.stroke}-${event.course}-${event.gender}`} className="rounded-lg border bg-card overflow-hidden shadow-xs">
              <div className="bg-muted/70 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 border-b">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-foreground">{event.eventLabel}</span>
                  <Badge variant="secondary" className="text-[10px]">
                    Top {event.top5.length}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {ageMode === "libre" ? "Absoluto" : ageMode === "13-14" ? "13-14 años" : ageMode === "11-12" ? "11-12 años" : ageMode === "15-16" ? "15-16 años" : ageMode === "17+" ? "17+ años" : `${customMinAge}-${customMaxAge} años`}
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b bg-muted/20 text-muted-foreground font-semibold">
                      <th className="p-2.5 text-center w-12">Pto.</th>
                      <th className="p-2.5">Atleta</th>
                      <th className="p-2.5">Club</th>
                      <th className="p-2.5">Asociación</th>
                      <th className="p-2.5 text-center">Edad (31/12)</th>
                      <th className="p-2.5 text-right">Tiempo</th>
                      <th className="p-2.5">Competencia</th>
                      <th className="p-2.5 text-center">Fecha</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {event.top5.map((item) => (
                      <tr key={item.athleteId} className="hover:bg-muted/30 transition-colors">
                        <td className="p-2.5 text-center">
                          <span
                            className={`inline-flex items-center justify-center size-5 rounded-full text-[11px] font-bold ${
                              item.rank === 1
                                ? "bg-amber-400 text-amber-950 font-black shadow-xs"
                                : item.rank === 2
                                ? "bg-slate-300 text-slate-900"
                                : item.rank === 3
                                ? "bg-amber-600/30 text-amber-700"
                                : "text-muted-foreground"
                            }`}
                          >
                            {item.rank}
                          </span>
                        </td>
                        <td className="p-2.5 font-semibold text-foreground">
                          {item.athleteName}
                        </td>
                        <td className="p-2.5">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-[10px] text-primary">{item.clubCode}</span>
                            <span className="text-muted-foreground truncate max-w-44">{item.clubName}</span>
                          </div>
                        </td>
                        <td className="p-2.5 text-muted-foreground">
                          {item.association}
                        </td>
                        <td className="p-2.5 text-center font-mono">
                          {item.ageAtDec31 > 0 ? item.ageAtDec31 : "—"}
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-sm text-primary">
                          {item.formattedTime}
                        </td>
                        <td className="p-2.5 text-muted-foreground truncate max-w-48">
                          <div className="flex flex-col">
                            <span className="text-foreground truncate">{item.meetName}</span>
                            <span className="text-[10px] text-muted-foreground">
                              Temporada {item.affiliationYear}
                            </span>
                          </div>
                        </td>
                        <td className="p-2.5 text-center text-muted-foreground font-mono">
                          {item.meetDate || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
