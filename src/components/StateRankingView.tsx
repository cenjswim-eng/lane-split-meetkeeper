import { useState, useMemo } from "react";
import {
  Trophy,
  Medal,
  Timer,
  Building2,
  Users,
  Filter,
  Calendar,
  Sparkles,
  Download,
  Search,
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  ShieldAlert,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  generateStateRanking,
  STATE_EVENTS_LIST,
  QUICK_AGE_CATEGORIES,
  type StateRankingFilters,
  type StateRankingItem,
} from "@/lib/state-ranking";
import { downloadFile } from "@/lib/file-delivery";

export function StateRankingView({
  results = [],
  athletes = [],
  clubs = [],
  teams = [],
  activeClub = null,
}: {
  results: readonly any[];
  athletes: readonly any[];
  clubs?: readonly any[];
  teams?: readonly any[];
  activeClub?: any;
}) {
  // Filtros de estado
  const [selectedEventKey, setSelectedEventKey] = useState<string>("100-1"); // 100m Libre default
  const [selectedCourse, setSelectedCourse] = useState<"LCM" | "SCM">("LCM");
  const [selectedGender, setSelectedGender] = useState<"M" | "F">("M");
  const [minAge, setMinAge] = useState<string>("");
  const [maxAge, setMaxAge] = useState<string>("");
  const [selectedSeason, setSelectedSeason] = useState<string>("2026");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [stateOverride, setStateOverride] = useState<string>("auto");

  // Temporadas disponibles a partir de los torneos
  const availableSeasons = useMemo(() => {
    const years = new Set<string>();
    for (const r of results) {
      const d = r.meets?.start_date || r.meet_date;
      if (d) years.add(d.slice(0, 4));
    }
    years.add("2026");
    years.add("2025");
    return ["all", ...Array.from(years).sort((a, b) => b.localeCompare(a))];
  }, [results]);

  // Evento actual desglosado en distancia y estilo
  const [currentDistance, currentStroke] = useMemo(() => {
    const [d, s] = selectedEventKey.split("-").map(Number);
    return [d || 100, s || 1];
  }, [selectedEventKey]);

  // Lista de estados detectados para permitir alternar opcionalmente
  const detectedStates = useMemo(() => {
    const states = new Set<string>();
    for (const c of clubs) {
      if (c.region_lsc || c.region) states.add(c.region_lsc || c.region);
    }
    for (const t of teams) {
      if (t.lsc) states.add(t.lsc);
    }
    states.add("Lara (ADAEL)");
    states.add("Miranda (ADAEM)");
    states.add("Distrito Capital (ASDAC)");
    states.add("Carabobo (ASODENA)");
    states.add("Zulia (AZUDA)");
    return Array.from(states).sort();
  }, [clubs, teams]);

  // Filtros aplicados
  const filters: StateRankingFilters = useMemo(() => ({
    distance: currentDistance,
    stroke: currentStroke,
    course: selectedCourse,
    gender: selectedGender,
    minAge: minAge !== "" ? Number(minAge) : undefined,
    maxAge: maxAge !== "" ? Number(maxAge) : undefined,
    referenceYear: selectedSeason !== "all" ? Number(selectedSeason) : new Date().getFullYear(),
    season: selectedSeason,
    stateOverride: stateOverride === "auto" ? undefined : stateOverride,
  }), [currentDistance, currentStroke, selectedCourse, selectedGender, minAge, maxAge, selectedSeason, stateOverride]);

  // Ejecución del motor de ranking estadal
  const { rankedList, summary } = useMemo(() => {
    return generateStateRanking(results, athletes, clubs, teams, activeClub, filters);
  }, [results, athletes, clubs, teams, activeClub, filters]);

  // Filtrado reactivo por texto de búsqueda en la tabla
  const displayedList = useMemo(() => {
    if (!searchQuery.trim()) return rankedList;
    const q = searchQuery.toLowerCase().trim();
    return rankedList.filter(
      (r) =>
        r.athleteName.toLowerCase().includes(q) ||
        r.clubCode.toLowerCase().includes(q) ||
        r.clubName.toLowerCase().includes(q)
    );
  }, [rankedList, searchQuery]);

  // Manejo de botones rápidos de categorías de edad
  const handleCategoryPreset = (catMin: number, catMax: number) => {
    if (minAge === String(catMin) && maxAge === String(catMax)) {
      setMinAge("");
      setMaxAge("");
    } else {
      setMinAge(String(catMin));
      setMaxAge(String(catMax));
    }
  };

  const isPresetActive = (catMin: number, catMax: number) => {
    return minAge === String(catMin) && maxAge === String(catMax);
  };

  // Exportar ranking a CSV
  const handleExportCsv = () => {
    if (!rankedList.length) return;
    const headers = [
      "Pos",
      "Atleta",
      "Género",
      "Edad",
      "Código Club",
      "Club",
      "Es Mi Club",
      "Tiempo Oficial",
      "Diferencia vs #1",
      "Puntos AQUA",
      "Torneo",
      "Fecha",
    ];
    const rows = rankedList.map((r) => [
      r.rank,
      `"${r.athleteName}"`,
      r.gender,
      r.age,
      r.clubCode,
      `"${r.clubName}"`,
      r.isMyClub ? "SÍ" : "NO",
      r.formattedTime,
      r.diffVsLeader,
      r.aquaPoints ?? "—",
      `"${r.meetName}"`,
      r.meetDate ?? "—",
    ]);

    const csvContent = [headers.join(","), ...rows.map((row) => row.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const filename = `ranking_estadal_${summary.activeState.replace(/[^a-z0-9]/gi, "_")}_${selectedCourse}_${selectedGender}_${currentDistance}m.csv`;
    downloadFile(new File([blob], filename, { type: "text/csv" }));
  };

  return (
    <div className="space-y-6">
      {/* 1. ENCABEZADO Y RESUMEN INSTITUCIONAL */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Trophy className="h-6 w-6 text-primary" />
              Ranking Estadal Oficial
            </h2>
            <Badge variant="outline" className="border-primary/40 text-primary font-semibold text-xs">
              {summary.activeState}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Filtrado automático por el Estado configurado en el club activo ({summary.activeClubName} · {summary.activeClubCode}).
            Conserva únicamente la mejor marca personal de cada atleta sin duplicados.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Selector alternativo opcional de Estado */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Building2 className="h-3.5 w-3.5" />
            <span>Estado:</span>
            <Select value={stateOverride} onValueChange={setStateOverride}>
              <SelectTrigger className="h-8 text-xs w-[180px]">
                <SelectValue placeholder="Estado automático" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automático (Perfil Activo)</SelectItem>
                <SelectItem value="all">Nacional / Todas las Asoc.</SelectItem>
                {detectedStates.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button variant="outline" size="sm" onClick={handleExportCsv} disabled={!rankedList.length} className="gap-1.5 h-8 text-xs">
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* 2. TARJETAS DE RESUMEN KPI (ENFOQUE "MI CLUB VS ESTADO") */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* KPI 1: Atletas de mi club en Top 8 Estadal */}
        <Card className={`border shadow-sm transition-all ${summary.myClubTop8Count > 0 ? "border-primary/40 bg-primary/5" : ""}`}>
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>MI CLUB EN TOP 8 ESTADAL</span>
              <Users className="h-4 w-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground flex items-baseline gap-2">
              <span className="font-mono text-3xl font-extrabold text-primary">{summary.myClubTop8Count}</span>
              <span className="text-xs text-muted-foreground font-normal">atletas clasificados</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              {summary.myClubTop8Count > 0
                ? `${summary.myClubTop8Count} nadadores de ${summary.activeClubCode} entre los 8 mejores del estado.`
                : `Sin nadadores de ${summary.activeClubCode} en el Top 8 de esta prueba.`}
            </p>
          </CardContent>
        </Card>

        {/* KPI 2: Distancia en segundos respecto al 1° lugar */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>BRECHA VS. LÍDER ESTADAL</span>
              <Timer className="h-4 w-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground">
              {summary.myClubLeaderGapSeconds !== null ? (
                summary.myClubLeaderGapSeconds === 0 ? (
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono text-2xl font-extrabold">0.00s (Líder)</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400 font-mono text-2xl font-extrabold">
                    +{summary.myClubLeaderGapSeconds}s
                  </span>
                )
              ) : (
                <span className="text-muted-foreground text-xl">—</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground truncate" title={summary.myClubLeaderGapText}>
              {summary.myClubLeaderGapText}
            </p>
          </CardContent>
        </Card>

        {/* KPI 3: Mejor marca estadal de la prueba */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>LÍDER DE LA PRUEBA</span>
              <Medal className="h-4 w-4 text-amber-500" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {summary.leaderSwimmer ? summary.leaderSwimmer.formattedTime : "—"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground truncate">
              {summary.leaderSwimmer
                ? `${summary.leaderSwimmer.athleteName} (${summary.leaderSwimmer.clubCode})`
                : "Sin tiempos registrados con estos filtros"}
            </p>
          </CardContent>
        </Card>

        {/* KPI 4: Total de atletas en el ranking */}
        <Card className="border shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardDescription className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>TOTAL MARCAS REGISTRADAS</span>
              <Trophy className="h-4 w-4 text-primary" />
            </CardDescription>
            <CardTitle className="text-2xl font-bold tracking-tight text-foreground font-mono">
              {summary.totalSwimmers} <span className="text-xs text-muted-foreground font-normal">nadadores únicos</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-xs text-muted-foreground">
              {filters.course === "LCM" ? "Piscina Larga (50m)" : "Piscina Corta (25m)"} · {filters.gender === "M" ? "Masculino" : "Femenino"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. BARRA DE FILTROS SUPERIOR */}
      <Card className="border bg-card/60 shadow-sm">
        <CardHeader className="p-4 pb-3 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Filter className="h-4 w-4 text-primary" />
              Filtros de Prueba, Curso, Género y Edades
            </CardTitle>
            <span className="text-xs text-muted-foreground">Temporada {selectedSeason === "all" ? "Histórica" : selectedSeason}</span>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-4">
          {/* Fila 1: Prueba, Piscina, Género y Temporada */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {/* Prueba y Distancia */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Prueba y Distancia</label>
              <Select value={selectedEventKey} onValueChange={setSelectedEventKey}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecciona prueba" />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {STATE_EVENTS_LIST.map((ev) => (
                    <SelectItem key={`${ev.distance}-${ev.stroke}`} value={`${ev.distance}-${ev.stroke}`}>
                      {ev.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Tipo de Piscina */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Tipo de Piscina</label>
              <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-md">
                <Button
                  type="button"
                  variant={selectedCourse === "LCM" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedCourse("LCM")}
                  className="h-7 text-xs font-medium"
                >
                  50m LCM
                </Button>
                <Button
                  type="button"
                  variant={selectedCourse === "SCM" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedCourse("SCM")}
                  className="h-7 text-xs font-medium"
                >
                  25m SCM
                </Button>
              </div>
            </div>

            {/* Género */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Género</label>
              <div className="grid grid-cols-2 gap-1 bg-muted p-1 rounded-md">
                <Button
                  type="button"
                  variant={selectedGender === "M" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedGender("M")}
                  className="h-7 text-xs font-medium"
                >
                  Masculino (M)
                </Button>
                <Button
                  type="button"
                  variant={selectedGender === "F" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setSelectedGender("F")}
                  className="h-7 text-xs font-medium"
                >
                  Femenino (F)
                </Button>
              </div>
            </div>

            {/* Temporada */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Temporada / Año</label>
              <Select value={selectedSeason} onValueChange={setSelectedSeason}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Seleccionar temporada" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las temporadas</SelectItem>
                  {availableSeasons
                    .filter((s) => s !== "all")
                    .map((s) => (
                      <SelectItem key={s} value={s}>
                        Temporada {s}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fila 2: Filtro de Edad Flexible (Inputs Numéricos + Botones Rápidos de Categorías) */}
          <div className="border-t pt-3 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">Categorías Rápidas:</span>
              <Button
                type="button"
                variant={minAge === "" && maxAge === "" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  setMinAge("");
                  setMaxAge("");
                }}
                className="h-7 text-xs px-2.5"
              >
                Todas las edades
              </Button>
              {QUICK_AGE_CATEGORIES.map((cat) => {
                const active = isPresetActive(cat.min, cat.max);
                return (
                  <Button
                    key={cat.label}
                    type="button"
                    variant={active ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleCategoryPreset(cat.min, cat.max)}
                    className="h-7 text-xs px-2.5"
                  >
                    {cat.label}
                    <span className="ml-1 text-[10px] opacity-75 font-normal">({cat.name})</span>
                  </Button>
                );
              })}
            </div>

            {/* Inputs Numéricos Flexibles */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Edad desde:</span>
                <Input
                  type="number"
                  min="5"
                  max="99"
                  placeholder="Min"
                  value={minAge}
                  onChange={(e) => setMinAge(e.target.value)}
                  className="h-7 w-16 text-xs text-center"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-muted-foreground whitespace-nowrap">hasta:</span>
                <Input
                  type="number"
                  min="5"
                  max="99"
                  placeholder="Max"
                  value={maxAge}
                  onChange={(e) => setMaxAge(e.target.value)}
                  className="h-7 w-16 text-xs text-center"
                />
              </div>
              {(minAge !== "" || maxAge !== "") && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setMinAge("");
                    setMaxAge("");
                  }}
                  className="h-7 text-xs text-muted-foreground hover:text-foreground px-1.5"
                >
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 4. TABLA DE RESULTADOS DE RANKING */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-foreground">
              Ranking Oficial — {STATE_EVENTS_LIST.find((e) => e.distance === currentDistance && e.stroke === currentStroke)?.label || "Prueba"} ({selectedCourse})
            </h3>
            <Badge variant="secondary" className="font-mono text-xs">
              {displayedList.length} {displayedList.length === 1 ? "nadador" : "nadadores"}
            </Badge>
          </div>

          <div className="relative w-72">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Buscar por nadador o club..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 pl-8 text-xs"
            />
          </div>
        </div>

        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-muted/60 border-b text-muted-foreground">
                <th className="p-3 text-center w-14 font-semibold">Pos</th>
                <th className="p-3 font-semibold">Atleta / Nadador</th>
                <th className="p-3 text-center w-14 font-semibold">Edad</th>
                <th className="p-3 font-semibold">Club / Equipo</th>
                <th className="p-3 text-center font-semibold w-24">Tiempo</th>
                <th className="p-3 text-center font-semibold w-24">Dif. vs #1</th>
                <th className="p-3 text-center font-semibold w-20">AQUA</th>
                <th className="p-3 font-semibold">Torneo</th>
                <th className="p-3 text-center font-semibold w-24">Fecha</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {displayedList.map((item) => {
                const isPodium = item.rank <= 3;
                const isTop8 = item.rank <= 8;

                return (
                  <tr
                    key={`${item.swimmerId}-${item.timeMs}`}
                    className={`transition-colors hover:bg-muted/40 ${
                      item.isMyClub
                        ? "bg-primary/10 border-l-4 border-l-primary font-medium dark:bg-primary/15"
                        : ""
                    }`}
                  >
                    {/* Posición con medallas y distintivos */}
                    <td className="p-3 text-center">
                      {item.rank === 1 ? (
                        <Badge className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-1.5 py-0 text-xs shadow-sm">
                          #1 🥇
                        </Badge>
                      ) : item.rank === 2 ? (
                        <Badge className="bg-slate-400 hover:bg-slate-500 text-white font-bold px-1.5 py-0 text-xs shadow-sm">
                          #2 🥈
                        </Badge>
                      ) : item.rank === 3 ? (
                        <Badge className="bg-amber-700 hover:bg-amber-800 text-white font-bold px-1.5 py-0 text-xs shadow-sm">
                          #3 🥉
                        </Badge>
                      ) : isTop8 ? (
                        <span className="font-mono font-bold text-foreground bg-muted px-1.5 py-0.5 rounded text-[11px]">
                          #{item.rank}
                        </span>
                      ) : (
                        <span className="font-mono text-muted-foreground text-xs">#{item.rank}</span>
                      )}
                    </td>

                    {/* Atleta */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className={`font-semibold ${item.isMyClub ? "text-primary" : "text-foreground"}`}>
                          {item.athleteName}
                        </span>
                        {item.isMyClub && (
                          <Badge variant="default" className="text-[10px] bg-primary text-primary-foreground font-semibold px-1 py-0 h-4">
                            Mi Club
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Edad */}
                    <td className="p-3 text-center font-mono text-muted-foreground">{item.age}</td>

                    {/* Club */}
                    <td className="p-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono font-bold text-muted-foreground bg-muted/80 px-1 py-0.5 rounded text-[10px]">
                          {item.clubCode}
                        </span>
                        <span className="text-xs truncate max-w-[180px]" title={item.clubName}>
                          {item.clubName}
                        </span>
                      </div>
                    </td>

                    {/* Tiempo */}
                    <td className="p-3 text-center font-mono font-bold text-xs text-foreground bg-muted/20">
                      {item.formattedTime}
                    </td>

                    {/* Diferencia vs. #1 */}
                    <td className="p-3 text-center font-mono text-xs">
                      {item.rank === 1 ? (
                        <span className="text-emerald-600 dark:text-emerald-400 font-bold">+0.00s</span>
                      ) : (
                        <span className="text-muted-foreground">{item.diffVsLeader}</span>
                      )}
                    </td>

                    {/* Puntos AQUA */}
                    <td className="p-3 text-center font-mono text-xs text-primary font-bold">
                      {item.aquaPoints ?? "—"}
                    </td>

                    {/* Torneo */}
                    <td className="p-3 text-muted-foreground truncate max-w-[200px]" title={item.meetName}>
                      {item.meetName}
                    </td>

                    {/* Fecha */}
                    <td className="p-3 text-center font-mono text-muted-foreground whitespace-nowrap">
                      {item.meetDate ?? "—"}
                    </td>
                  </tr>
                );
              })}

              {!displayedList.length && (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-muted-foreground">
                    <AlertCircle className="mx-auto h-8 w-8 text-muted-foreground/60 mb-2" />
                    <p className="font-medium text-sm">No se encontraron marcas oficiales para los filtros seleccionados.</p>
                    <p className="text-xs mt-1">
                      Intenta cambiar de prueba, ampliar el rango de edades o seleccionar otra temporada.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Leyenda y notas técnicas */}
        <div className="flex flex-wrap items-center justify-between text-[11px] text-muted-foreground pt-1 px-1">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-primary" />
              Atletas de Mi Club ({summary.activeClubCode}) resaltados
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-amber-500" />
              Podio (#1 al #3)
            </span>
            <span className="flex items-center gap-1.5">
              <span className="size-2 rounded-full bg-muted-foreground" />
              Puestos 4 al 8 (Top 8 Estadal)
            </span>
          </div>
          <span>Deduplicación por mejor marca personal anual de cada nadador</span>
        </div>
      </div>
    </div>
  );
}
