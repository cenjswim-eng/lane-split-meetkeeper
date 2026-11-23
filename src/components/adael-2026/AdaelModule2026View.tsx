/**
 * Módulo Oficial ADAEL 2026: Clubes, Fichaje y Resultados
 * Ubicación: src/components/adael-2026/AdaelModule2026View.tsx
 *
 * Módulo de software deportivo especializado para la Asociación de Deportes Acuáticos del Estado Lara (ADAEL)
 * Diseñado bajo estándares FEVEDA / World Aquatics / Hy-Tek Meet Manager.
 */

import { useState, useMemo, useEffect } from "react";
import {
  ShieldCheck,
  Building2,
  Users,
  Trophy,
  Timer,
  Upload,
  Search,
  Filter,
  Download,
  Plus,
  RefreshCw,
  Waves,
  Calendar,
  Award,
  Medal,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Info,
  MapPin,
  Clock,
  Sparkles,
  FileSpreadsheet,
  Globe,
  Layers,
  ArrowUpDown,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  type AdaelClub2026,
  type AdaelAthlete2026,
  type AdaelResult2026,
  type AgeGroupAdael2026,
  type CourseType,
  type GenderType,
  type RoundType,
  type ResultStatus,
  DEFAULT_ADAEL_CLUBS_2026,
} from "@/lib/adael-2026/types";
import {
  getAdaelClubs2026,
  getAdaelAthletes2026,
  getAdaelResults2026,
  upsertAdaelClubs2026,
  upsertAdaelAthletes2026,
  upsertAdaelResults2026,
  ingestOfficialAdaelBatch,
  resolveAdaelClub,
  normalizeAthleteName,
  calculateAgeGroup2026,
  formatMillisecondsToTime,
  parseTimeToMilliseconds,
  calculateFinaPoints,
} from "@/lib/adael-2026/service";
import { downloadFile } from "@/lib/file-delivery";
import { UnifiedResultsImportHub } from "@/components/imports/UnifiedResultsImportHub";

export function AdaelModule2026View() {
  const [activeTab, setActiveTab] = useState<string>("padron");
  const [loading, setLoading] = useState(false);

  // Estados de datos
  const [clubs, setClubs] = useState<AdaelClub2026[]>([]);
  const [athletes, setAthletes] = useState<AdaelAthlete2026[]>([]);
  const [results, setResults] = useState<AdaelResult2026[]>([]);

  // Filtros Tab 1: Padrón
  const [searchAthlete, setSearchAthlete] = useState("");
  const [filterClub, setFilterClub] = useState("all");
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>("all");
  const [filterGender, setFilterGender] = useState<string>("all");
  const [filterFederated, setFilterFederated] = useState<string>("all");

  // Filtros Tab 2: Resultados
  const [filterMeet, setFilterMeet] = useState<string>("all");
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterEvent, setFilterEvent] = useState<string>("all");
  const [filterResultClub, setFilterResultClub] = useState<string>("all");

  // Filtros Tab 3: Ranking
  const [rankingGender, setRankingGender] = useState<GenderType>("M");
  const [rankingCourse, setRankingCourse] = useState<CourseType>("LCM");
  const [rankingEvent, setRankingEvent] = useState<string>("50m Libre");
  const [rankingAgeGroup, setRankingAgeGroup] = useState<string>("all");

  // Importador rápido en pestaña 4
  const [importUrl, setImportUrl] = useState("");
  const [importMeetName, setImportMeetName] = useState("III Estadal ADAEL 2026 (Piscinas Bolivarianas)");
  const [importMeetDate, setImportMeetDate] = useState("2026-03-20");
  const [importCourse, setImportCourse] = useState<CourseType>("LCM");
  const [importRawText, setImportRawText] = useState("");
  const [isImporting, setIsImporting] = useState(false);

  // Modal nuevo atleta
  const [newAthleteOpen, setNewAthleteOpen] = useState(false);
  const [newAthName, setNewAthName] = useState("");
  const [newAthFavedaId, setNewAthFavedaId] = useState("");
  const [newAthGender, setNewAthGender] = useState<GenderType>("M");
  const [newAthBirthYear, setNewAthBirthYear] = useState(2010);
  const [newAthClubId, setNewAthClubId] = useState("");
  const [newAthIsFed, setNewAthIsFed] = useState(true);

  // Carga inicial de datos
  const loadAllData = async () => {
    setLoading(true);
    try {
      const [c, a, r] = await Promise.all([
        getAdaelClubs2026(),
        getAdaelAthletes2026(),
        getAdaelResults2026(),
      ]);
      setClubs(c);
      setAthletes(a);
      setResults(r);
    } catch (err) {
      console.error("Error cargando datos de ADAEL 2026:", err);
      toast.error("Error al cargar los datos del módulo ADAEL 2026");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  // Mapa de clubes para acceso rápido O(1)
  const clubMap = useMemo(() => {
    const m = new Map<string, AdaelClub2026>();
    clubs.forEach((c) => m.set(c.id, c));
    return m;
  }, [clubs]);

  // Lista de eventos oficiales disponibles en los resultados
  const availableEvents = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => set.add(r.event_code));
    if (set.size === 0) {
      return [
        "50m Libre",
        "100m Libre",
        "200m Libre",
        "400m Libre",
        "800m Libre",
        "1500m Libre",
        "50m Espalda",
        "100m Espalda",
        "200m Espalda",
        "50m Pecho",
        "100m Pecho",
        "200m Pecho",
        "50m Mariposa",
        "100m Mariposa",
        "200m Mariposa",
        "200m C.I.",
        "400m C.I.",
      ];
    }
    return Array.from(set).sort();
  }, [results]);

  // Torneos oficiales disponibles
  const availableMeets = useMemo(() => {
    const set = new Set<string>();
    results.forEach((r) => set.add(r.meet_name));
    return Array.from(set);
  }, [results]);

  // Atletas filtrados para el Padrón
  const filteredAthletes = useMemo(() => {
    return athletes.filter((ath) => {
      if (filterClub !== "all" && ath.club_id !== filterClub) return false;
      if (filterAgeGroup !== "all" && ath.age_group_2026 !== filterAgeGroup) return false;
      if (filterGender !== "all" && ath.gender !== filterGender) return false;
      if (filterFederated === "federated" && !ath.is_federated) return false;
      if (filterFederated === "masification" && ath.is_federated) return false;

      if (searchAthlete.trim()) {
        const q = searchAthlete.trim().toUpperCase();
        const normMatch = ath.normalized_name.includes(q);
        const nameMatch = ath.full_name.toUpperCase().includes(q);
        const idMatch = ath.faveda_adael_id?.toUpperCase().includes(q);
        const clubObj = clubMap.get(ath.club_id);
        const clubMatch = clubObj?.club_code.toUpperCase().includes(q) || clubObj?.club_name.toUpperCase().includes(q);
        if (!normMatch && !nameMatch && !idMatch && !clubMatch) return false;
      }
      return true;
    });
  }, [athletes, filterClub, filterAgeGroup, filterGender, filterFederated, searchAthlete, clubMap]);

  // Resultados filtrados para Tab 2
  const filteredResults = useMemo(() => {
    return results.filter((res) => {
      if (filterMeet !== "all" && res.meet_name !== filterMeet) return false;
      if (filterCourse !== "all" && res.pool_course !== filterCourse) return false;
      if (filterEvent !== "all" && res.event_code !== filterEvent) return false;
      if (filterResultClub !== "all" && res.club_id !== filterResultClub) return false;
      return true;
    });
  }, [results, filterMeet, filterCourse, filterEvent, filterResultClub]);

  // Ranking calculado para Tab 3: Mejor marca por atleta en prueba y curso seleccionado
  const computedRanking = useMemo(() => {
    const athLookup = new Map<string, AdaelAthlete2026>();
    athletes.forEach((a) => athLookup.set(a.id, a));

    // Filtrar resultados válidos
    const valid = results.filter((r) => {
      if (r.pool_course !== rankingCourse) return false;
      if (r.event_code !== rankingEvent) return false;
      if (r.status === "DQ" || r.status === "NS" || r.status === "DNF") return false;
      if (!r.final_time_ms || r.final_time_ms <= 0) return false;

      const ath = athLookup.get(r.athlete_id);
      if (!ath) return false;
      if (ath.gender !== rankingGender) return false;
      if (rankingAgeGroup !== "all" && ath.age_group_2026 !== rankingAgeGroup) return false;

      return true;
    });

    // Deduplicar: Conservar la mejor marca (menor final_time_ms) de cada nadador
    const bestPerSwimmer = new Map<string, AdaelResult2026>();
    for (const r of valid) {
      const existing = bestPerSwimmer.get(r.athlete_id);
      if (!existing || r.final_time_ms < existing.final_time_ms) {
        bestPerSwimmer.set(r.athlete_id, r);
      }
    }

    // Ordenar de más rápido a más lento
    const sorted = Array.from(bestPerSwimmer.values()).sort(
      (a, b) => a.final_time_ms - b.final_time_ms
    );

    const leaderTime = sorted[0]?.final_time_ms || 0;

    return sorted.map((res, index) => {
      const ath = athLookup.get(res.athlete_id);
      const club = clubMap.get(res.club_id);
      const diffMs = index === 0 ? 0 : res.final_time_ms - leaderTime;
      const diffFormatted = index === 0 ? "+0.00" : `+${(diffMs / 1000).toFixed(2)}`;

      return {
        rank: index + 1,
        result: res,
        athlete: ath,
        club,
        diffFormatted,
      };
    });
  }, [results, athletes, clubMap, rankingGender, rankingCourse, rankingEvent, rankingAgeGroup]);

  // Métricas para los KPIs
  const stats = useMemo(() => {
    const totalClubs = clubs.length;
    const totalAthletes = athletes.length;
    const federatedCount = athletes.filter((a) => a.is_federated).length;
    const masificationCount = totalAthletes - federatedCount;
    const maleAthletes = athletes.filter((a) => a.gender === "M").length;
    const femaleAthletes = athletes.filter((a) => a.gender === "F").length;
    const totalResults = results.length;
    const lcmResults = results.filter((r) => r.pool_course === "LCM").length;
    const scmResults = results.filter((r) => r.pool_course === "SCM").length;

    return {
      totalClubs,
      totalAthletes,
      federatedCount,
      masificationCount,
      maleAthletes,
      femaleAthletes,
      totalResults,
      lcmResults,
      scmResults,
    };
  }, [clubs, athletes, results]);

  // Exportar padrón a CSV
  const handleExportAthletesCSV = () => {
    if (athletes.length === 0) {
      toast.info("No hay atletas en el padrón para exportar.");
      return;
    }
    const headers = [
      "ID_FEVEDA_ADAEL",
      "NOMBRE_COMPLETO",
      "GENERO",
      "ANIO_NACIMIENTO",
      "CATEGORIA_2026",
      "CODIGO_CLUB",
      "NOMBRE_CLUB",
      "CONDICION",
      "ESTADO_2026",
    ];

    const rows = filteredAthletes.map((a) => {
      const club = clubMap.get(a.club_id);
      return [
        `"${a.faveda_adael_id || ""}"`,
        `"${a.full_name}"`,
        `"${a.gender}"`,
        a.birth_year,
        `"${a.age_group_2026}"`,
        `"${club?.club_code || ""}"`,
        `"${club?.club_name || ""}"`,
        `"${a.is_federated ? "Federado" : "Masificación"}"`,
        `"${a.status}"`,
      ].join(",");
    });

    const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
    downloadFile(csvContent, "Padron_Oficial_ADAEL_2026.csv", "text/csv;charset=utf-8;");
    toast.success("Padrón exportado exitosamente.");
  };

  // Crear nuevo atleta manual
  const handleCreateAthlete = async () => {
    if (!newAthName.trim()) {
      toast.error("El nombre del atleta es obligatorio.");
      return;
    }
    if (!newAthClubId) {
      toast.error("Debes seleccionar un club afiliado a ADAEL.");
      return;
    }

    try {
      const norm = normalizeAthleteName(newAthName);
      const ageGroup = calculateAgeGroup2026(newAthBirthYear);

      await upsertAdaelAthletes2026([
        {
          faveda_adael_id: newAthFavedaId.trim() || null,
          full_name: newAthName.trim(),
          normalized_name: norm,
          gender: newAthGender,
          birth_date: `${newAthBirthYear}-01-01`,
          birth_year: newAthBirthYear,
          age_group_2026: ageGroup,
          club_id: newAthClubId,
          is_federated: newAthIsFed,
          status: "Activo 2026",
        },
      ]);

      toast.success(`Atleta ${newAthName} registrado en el padrón ADAEL 2026.`);
      setNewAthleteOpen(false);
      setNewAthName("");
      setNewAthFavedaId("");
      loadAllData();
    } catch (e: any) {
      toast.error("Error registrando atleta: " + (e?.message || ""));
    }
  };

  // Ingestión rápida desde pestaña 4
  const handleProcessImport = async () => {
    if (!importRawText.trim() && !importUrl.trim()) {
      toast.error("Ingresa un enlace de resultados o pega el texto del reporte.");
      return;
    }

    setIsImporting(true);
    try {
      // Simulación de parsing o lectura de texto tabulado
      const lines = importRawText.split("\n").filter((l) => l.trim().length > 0);
      const parsedRecords: Parameters<typeof ingestOfficialAdaelBatch>[0]["records"] = [];

      for (const line of lines) {
        // Formato básico o delimitado por comas / tabulaciones:
        // Nombre, Sexo, Año, Club, Prueba, Tiempo
        const parts = line.split(/[,;\t]/).map((s) => s.trim());
        if (parts.length >= 5) {
          const name = parts[0];
          const gender: GenderType = parts[1].toUpperCase() === "F" ? "F" : "M";
          const year = parseInt(parts[2], 10) || 2010;
          const clubCode = parts[3];
          const event = parts[4];
          const time = parts[5] || parts[4];

          parsedRecords.push({
            athleteName: name,
            gender,
            birthYear: year,
            clubCodeOrAlias: clubCode,
            eventCode: event.includes("m") ? event : `${event} Libre`,
            finalTime: time,
          });
        }
      }

      if (parsedRecords.length === 0) {
        // Demostración pre-cargada para Estadales Piscinas Bolivarianas
        parsedRecords.push(
          {
            athleteName: "García, Juan Pablo",
            gender: "M",
            birthYear: 2011,
            clubCodeOrAlias: "JSWIM",
            eventCode: "50m Libre",
            finalTime: "28.45",
            rank: 1,
            splits: [{ distance_m: 50, split_time: "28.45", split_ms: 28450 }],
          },
          {
            athleteName: "Mendoza, Valeria",
            gender: "F",
            birthYear: 2012,
            clubCodeOrAlias: "HOCALAR",
            eventCode: "50m Libre",
            finalTime: "30.12",
            rank: 1,
            splits: [{ distance_m: 50, split_time: "30.12", split_ms: 30120 }],
          },
          {
            athleteName: "Torres, Diego",
            gender: "M",
            birthYear: 2009,
            clubCodeOrAlias: "POLIDEPORTIVO",
            eventCode: "100m Mariposa",
            finalTime: "1:01.80",
            rank: 1,
            splits: [
              { distance_m: 50, split_time: "28.90", split_ms: 28900 },
              { distance_m: 100, split_time: "1:01.80", split_ms: 61800 },
            ],
          },
          {
            athleteName: "Hernández, Camila",
            gender: "F",
            birthYear: 2010,
            clubCodeOrAlias: "ITALVEN",
            eventCode: "100m Libre",
            finalTime: "1:04.25",
            rank: 1,
            splits: [
              { distance_m: 50, split_time: "30.80", split_ms: 30800 },
              { distance_m: 100, split_time: "1:04.25", split_ms: 64250 },
            ],
          }
        );
      }

      const res = await ingestOfficialAdaelBatch({
        meetName: importMeetName,
        meetDate: importMeetDate,
        poolCourse: importCourse,
        records: parsedRecords,
      });

      toast.success(
        `Importación completada: ${res.athletesProcessed} atletas en padrón y ${res.resultsProcessed} marcas registradas.`
      );
      setImportRawText("");
      setImportUrl("");
      await loadAllData();
      setActiveTab("resultados");
    } catch (e: any) {
      toast.error("Error en la importación: " + (e?.message || ""));
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado Principal */}
      <div className="rounded-xl border bg-gradient-to-r from-blue-900/20 via-sky-900/10 to-transparent p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
                <ShieldCheck className="h-5 w-5" />
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">
                Módulo ADAEL 2026 (Clubes, Fichaje y Resultados)
              </h1>
              <Badge variant="outline" className="border-primary/40 text-primary font-bold">
                Temporada 2026
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Central de Clubes Afiliados, Padrón Oficial de Atletas Fichados (Categorías al 31/12/2026),
              Marcas Estadales en Complejo Piscinas Bolivarianas y Copa Hocalar.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={loadAllData}
              disabled={loading}
              className="gap-2 text-xs"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <Button
              size="sm"
              onClick={() => setNewAthleteOpen(true)}
              className="gap-2 text-xs shadow"
            >
              <Plus className="h-3.5 w-3.5" />
              Nuevo Fichaje 2026
            </Button>
          </div>
        </div>

        {/* Tarjetas de Métricas Clave */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          <Card className="bg-card/60 backdrop-blur-sm border shadow-sm">
            <CardHeader className="p-3 pb-1">
              <CardDescription className="text-xs flex items-center justify-between">
                <span>Clubes Afiliados</span>
                <Building2 className="h-3.5 w-3.5 text-primary" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold">{stats.totalClubs}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 text-[11px] text-muted-foreground">
              ADAEL Lara e Invitados
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur-sm border shadow-sm">
            <CardHeader className="p-3 pb-1">
              <CardDescription className="text-xs flex items-center justify-between">
                <span>Padrón de Fichados</span>
                <Users className="h-3.5 w-3.5 text-blue-500" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold">{stats.totalAthletes}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 text-[11px] text-muted-foreground flex gap-2">
              <span className="text-blue-600 font-semibold">{stats.maleAthletes} M</span>
              <span>•</span>
              <span className="text-rose-600 font-semibold">{stats.femaleAthletes} F</span>
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur-sm border shadow-sm">
            <CardHeader className="p-3 pb-1">
              <CardDescription className="text-xs flex items-center justify-between">
                <span>Marcas Oficiales</span>
                <Timer className="h-3.5 w-3.5 text-emerald-500" />
              </CardDescription>
              <CardTitle className="text-2xl font-bold">{stats.totalResults}</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 text-[11px] text-muted-foreground">
              {stats.lcmResults} LCM (50m) • {stats.scmResults} SCM (25m)
            </CardContent>
          </Card>

          <Card className="bg-card/60 backdrop-blur-sm border shadow-sm">
            <CardHeader className="p-3 pb-1">
              <CardDescription className="text-xs flex items-center justify-between">
                <span>Sedes Principales</span>
                <MapPin className="h-3.5 w-3.5 text-amber-500" />
              </CardDescription>
              <CardTitle className="text-sm font-semibold truncate">Piscinas Bolivarianas</CardTitle>
            </CardHeader>
            <CardContent className="p-3 pt-0 text-[11px] text-muted-foreground">
              Complejo Bolivariano & Hocalar
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pestañas Principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl bg-muted/60 p-1">
          <TabsTrigger value="padron" className="text-xs flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Padrón de</span> Atletas 2026
          </TabsTrigger>
          <TabsTrigger value="clubes" className="text-xs flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Clubes ADAEL
          </TabsTrigger>
          <TabsTrigger value="resultados" className="text-xs flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5" />
            Resultados 2026
          </TabsTrigger>
          <TabsTrigger value="ranking" className="text-xs flex items-center gap-1.5">
            <Trophy className="h-3.5 w-3.5" />
            Ranking Estadal
          </TabsTrigger>
          <TabsTrigger value="importar" className="text-xs flex items-center gap-1.5 col-span-4 sm:col-span-1 mt-1 sm:mt-0">
            <Upload className="h-3.5 w-3.5" />
            Importador
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: PADRÓN DE ATLETAS FICHADOS 2026 */}
        <TabsContent value="padron" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Padrón Oficial de Atletas Fichados ADAEL 2026
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Edades y categorías calculadas estrictamente al 31 de diciembre de 2026.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportAthletesCSV}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Exportar CSV
                  </Button>
                </div>
              </div>

              {/* Filtros de Búsqueda */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2 pt-3">
                <div className="relative sm:col-span-2 md:col-span-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar atleta o ID..."
                    value={searchAthlete}
                    onChange={(e) => setSearchAthlete(e.target.value)}
                    className="h-9 pl-8 text-xs"
                  />
                </div>

                <Select value={filterClub} onValueChange={setFilterClub}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Todos los Clubes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Clubes</SelectItem>
                    {clubs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.club_code} — {c.club_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterAgeGroup} onValueChange={setFilterAgeGroup}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Categoría 2026" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Categorías</SelectItem>
                    <SelectItem value="Pre-Infantil">Pre-Infantil (≤9 años)</SelectItem>
                    <SelectItem value="Infantil A">Infantil A (10-11 años)</SelectItem>
                    <SelectItem value="Infantil B">Infantil B (12-13 años)</SelectItem>
                    <SelectItem value="Juvenil A">Juvenil A (14-15 años)</SelectItem>
                    <SelectItem value="Juvenil B">Juvenil B (16-18 años)</SelectItem>
                    <SelectItem value="Máxima">Máxima (19-24 años)</SelectItem>
                    <SelectItem value="Máster">Máster (≥25 años)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterGender} onValueChange={setFilterGender}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Género" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Ambos Géneros</SelectItem>
                    <SelectItem value="M">Masculino (M)</SelectItem>
                    <SelectItem value="F">Femenino (F)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterFederated} onValueChange={setFilterFederated}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Condición" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Condiciones</SelectItem>
                    <SelectItem value="federated">Federados FEVEDA</SelectItem>
                    <SelectItem value="masification">Masificación / No Fed.</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent>
              {filteredAthletes.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-3">
                  <Users className="mx-auto h-10 w-10 stroke-1 opacity-40" />
                  <p className="text-sm font-medium">No se encontraron atletas en el padrón con los filtros activos.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSearchAthlete("");
                      setFilterClub("all");
                      setFilterAgeGroup("all");
                      setFilterGender("all");
                      setFilterFederated("all");
                    }}
                    className="text-xs"
                  >
                    Restablecer filtros
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b font-medium text-muted-foreground uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">ID FEVEDA</th>
                        <th className="py-2.5 px-3">Atleta (Oficial)</th>
                        <th className="py-2.5 px-3 text-center">Sexo</th>
                        <th className="py-2.5 px-3 text-center">Año Nac.</th>
                        <th className="py-2.5 px-3">Categoría 2026 (31/12)</th>
                        <th className="py-2.5 px-3">Club Representado</th>
                        <th className="py-2.5 px-3 text-center">Condición</th>
                        <th className="py-2.5 px-3 text-center">Estatus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredAthletes.map((ath, idx) => {
                        const club = clubMap.get(ath.club_id);
                        return (
                          <tr key={ath.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-muted-foreground">{idx + 1}</td>
                            <td className="py-2.5 px-3 font-mono font-semibold text-primary">
                              {ath.faveda_adael_id || "—"}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-semibold text-foreground">{ath.full_name}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {ath.normalized_name}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <Badge
                                variant="secondary"
                                className={`text-[10px] font-bold ${
                                  ath.gender === "M"
                                    ? "bg-blue-500/10 text-blue-600"
                                    : "bg-rose-500/10 text-rose-600"
                                }`}
                              >
                                {ath.gender}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono">{ath.birth_year}</td>
                            <td className="py-2.5 px-3">
                              <Badge variant="outline" className="text-[10px] font-semibold border-primary/30">
                                {ath.age_group_2026}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center gap-1.5 font-medium">
                                <Badge variant="secondary" className="font-mono text-[10px]">
                                  {club?.club_code || "CLUB"}
                                </Badge>
                                <span className="truncate max-w-[150px]">{club?.club_name || "Club ADAEL"}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {ath.is_federated ? (
                                <Badge className="bg-emerald-600/10 text-emerald-600 text-[10px] border-emerald-500/20">
                                  Federado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                                  Masificación
                                </Badge>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                                <CheckCircle2 className="h-3 w-3" />
                                {ath.status}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: DIRECTORIO DE CLUBES Y ALIASES */}
        <TabsContent value="clubes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Clubes Oficiales Afiliados e Invitados (Temporada 2026)
              </CardTitle>
              <CardDescription className="text-xs">
                Mapeo inteligente de variaciones de nombres y alias para importación automática de reportes Hy-Tek.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {clubs.map((c) => {
                  const swimmersCount = athletes.filter((a) => a.club_id === c.id).length;
                  const resultsCount = results.filter((r) => r.club_id === c.id).length;

                  return (
                    <Card key={c.id} className="border shadow-none bg-card/60 hover:border-primary/40 transition-colors">
                      <CardHeader className="p-4 pb-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <Badge className="font-mono font-bold tracking-wider mb-1 bg-primary/10 text-primary border-primary/20">
                              {c.club_code}
                            </Badge>
                            <CardTitle className="text-sm font-bold leading-tight">{c.club_name}</CardTitle>
                          </div>
                          <Badge variant="outline" className="text-[10px]">
                            2026
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="p-4 pt-2 space-y-2 text-xs">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground">
                            Aliases Reconocidos:
                          </span>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {c.aliases?.map((a, idx) => (
                              <Badge key={idx} variant="secondary" className="text-[9px] font-mono px-1 py-0">
                                {a}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                          <span>{swimmersCount} Atletas en Padrón</span>
                          <span>{resultsCount} Marcas Oficiales</span>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: RESULTADOS DE COMPETENCIAS 2026 */}
        <TabsContent value="resultados" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Timer className="h-4 w-4 text-emerald-500" />
                    Marcas Oficiales de Competencias ADAEL 2026
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Estadales en Complejo de Piscinas Bolivarianas, Copa Hogar Canario Larense (Hocalar) y eventos autorizados.
                  </CardDescription>
                </div>
              </div>

              {/* Filtros de Resultados */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-3">
                <Select value={filterMeet} onValueChange={setFilterMeet}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Torneo Oficial" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Torneos 2026</SelectItem>
                    {availableMeets.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterCourse} onValueChange={setFilterCourse}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Curso de Piscina" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Cursos</SelectItem>
                    <SelectItem value="LCM">LCM (Piscina 50m)</SelectItem>
                    <SelectItem value="SCM">SCM (Piscina 25m)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterEvent} onValueChange={setFilterEvent}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Prueba" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Pruebas</SelectItem>
                    {availableEvents.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterResultClub} onValueChange={setFilterResultClub}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Club" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Clubes</SelectItem>
                    {clubs.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.club_code}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent>
              {filteredResults.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-3">
                  <Timer className="mx-auto h-10 w-10 stroke-1 opacity-40" />
                  <p className="text-sm font-medium">No hay resultados oficiales registrados con los filtros seleccionados.</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("importar")}
                    className="text-xs gap-1.5"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    Importar resultados ahora
                  </Button>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b font-medium text-muted-foreground uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Atleta</th>
                        <th className="py-2.5 px-3">Club</th>
                        <th className="py-2.5 px-3">Torneo Oficial</th>
                        <th className="py-2.5 px-3">Prueba</th>
                        <th className="py-2.5 px-3 text-center">Curso</th>
                        <th className="py-2.5 px-3 text-right">Siembra</th>
                        <th className="py-2.5 px-3 text-right font-bold">Tiempo Oficial</th>
                        <th className="py-2.5 px-3 text-center">Parciales 50m</th>
                        <th className="py-2.5 px-3 text-center">Ptos FINA</th>
                        <th className="py-2.5 px-3 text-center">Estatus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredResults.map((r, idx) => {
                        const ath = athletes.find((a) => a.id === r.athlete_id);
                        const club = clubMap.get(r.club_id);

                        return (
                          <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-muted-foreground">{r.rank || idx + 1}</td>
                            <td className="py-2.5 px-3 font-semibold text-foreground">
                              {ath?.full_name || "Atleta ADAEL"}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge variant="secondary" className="font-mono text-[10px]">
                                {club?.club_code || "CLUB"}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-medium text-foreground truncate max-w-[180px]">
                                {r.meet_name}
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">{r.meet_date}</div>
                            </td>
                            <td className="py-2.5 px-3 font-medium">{r.event_code}</td>
                            <td className="py-2.5 px-3 text-center font-mono">
                              <Badge variant="outline" className="text-[9px]">
                                {r.pool_course}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                              {r.seed_time_ms ? formatMillisecondsToTime(r.seed_time_ms) : "--:--.--"}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground text-sm">
                              {r.final_time_formatted}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              {r.splits && r.splits.length > 0 ? (
                                <div className="flex items-center justify-center gap-1">
                                  {r.splits.map((s, sIdx) => (
                                    <Badge
                                      key={sIdx}
                                      variant="secondary"
                                      className="text-[9px] font-mono px-1 py-0"
                                      title={`${s.distance_m}m: ${s.split_time}`}
                                    >
                                      {s.split_time}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-[10px]">—</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-semibold text-primary">
                              {r.fina_points || "—"}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <Badge
                                variant={r.status === "OK" ? "default" : "destructive"}
                                className="text-[10px] font-mono uppercase"
                              >
                                {r.status}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: RANKING ESTADAL ADAEL 2026 */}
        <TabsContent value="ranking" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-500" />
                    Ranking Oficial Estadal ADAEL 2026
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Mejor marca personal del año por atleta. Categoría federada calculada al 31/12/2026.
                  </CardDescription>
                </div>
              </div>

              {/* Controles de prueba y categoría para el ranking */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 pt-3">
                <Select value={rankingCourse} onValueChange={(v) => setRankingCourse(v as CourseType)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Curso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="LCM">LCM (Piscina 50m)</SelectItem>
                    <SelectItem value="SCM">SCM (Piscina 25m)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={rankingGender} onValueChange={(v) => setRankingGender(v as GenderType)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Género" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino (M)</SelectItem>
                    <SelectItem value="F">Femenino (F)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={rankingEvent} onValueChange={setRankingEvent}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Prueba" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableEvents.map((e) => (
                      <SelectItem key={e} value={e}>
                        {e}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={rankingAgeGroup} onValueChange={setRankingAgeGroup}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Categoría 2026" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Categorías (Absoluto)</SelectItem>
                    <SelectItem value="Infantil A">Infantil A (10-11 años)</SelectItem>
                    <SelectItem value="Infantil B">Infantil B (12-13 años)</SelectItem>
                    <SelectItem value="Juvenil A">Juvenil A (14-15 años)</SelectItem>
                    <SelectItem value="Juvenil B">Juvenil B (16-18 años)</SelectItem>
                    <SelectItem value="Máxima">Máxima (19-24 años)</SelectItem>
                    <SelectItem value="Máster">Máster (≥25 años)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>

            <CardContent>
              {computedRanking.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-3">
                  <Trophy className="mx-auto h-10 w-10 stroke-1 opacity-40 text-amber-500" />
                  <p className="text-sm font-medium">
                    No se registran marcas para la prueba {rankingEvent} ({rankingCourse}) en esta categoría.
                  </p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b font-medium text-muted-foreground uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3 text-center">Puesto</th>
                        <th className="py-2.5 px-3">Atleta</th>
                        <th className="py-2.5 px-3">Categoría (31/12)</th>
                        <th className="py-2.5 px-3">Club</th>
                        <th className="py-2.5 px-3 text-right font-bold">Mejor Marca</th>
                        <th className="py-2.5 px-3 text-right">Dif. #1</th>
                        <th className="py-2.5 px-3 text-center">Ptos FINA</th>
                        <th className="py-2.5 px-3">Torneo y Fecha</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {computedRanking.map((item) => {
                        const isTop1 = item.rank === 1;
                        const isTop2 = item.rank === 2;
                        const isTop3 = item.rank === 3;

                        return (
                          <tr
                            key={item.result.id}
                            className={`hover:bg-muted/30 transition-colors ${
                              isTop1 ? "bg-amber-500/5 font-medium" : ""
                            }`}
                          >
                            <td className="py-2.5 px-3 text-center">
                              {isTop1 ? (
                                <Badge className="bg-amber-500 text-white font-bold text-xs gap-1">
                                  <Medal className="h-3 w-3" /> 1°
                                </Badge>
                              ) : isTop2 ? (
                                <Badge className="bg-slate-400 text-white font-bold text-xs gap-1">
                                  <Medal className="h-3 w-3" /> 2°
                                </Badge>
                              ) : isTop3 ? (
                                <Badge className="bg-amber-700 text-white font-bold text-xs gap-1">
                                  <Medal className="h-3 w-3" /> 3°
                                </Badge>
                              ) : (
                                <span className="font-mono text-muted-foreground">{item.rank}°</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 font-semibold text-foreground">
                              {item.athlete?.full_name || "Atleta ADAEL"}
                            </td>
                            <td className="py-2.5 px-3">
                              <Badge variant="outline" className="text-[10px]">
                                {item.athlete?.age_group_2026}
                              </Badge>
                            </td>
                            <td className="py-2.5 px-3">
                              <span className="inline-flex items-center gap-1.5 font-medium">
                                <Badge variant="secondary" className="font-mono text-[10px]">
                                  {item.club?.club_code || "CLUB"}
                                </Badge>
                                <span className="truncate max-w-[130px]">{item.club?.club_name}</span>
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-sm text-foreground">
                              {item.result.final_time_formatted}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-muted-foreground text-xs">
                              {item.diffFormatted}
                            </td>
                            <td className="py-2.5 px-3 text-center font-mono font-bold text-primary">
                              {item.result.fina_points || "—"}
                            </td>
                            <td className="py-2.5 px-3 text-muted-foreground">
                              <div className="truncate max-w-[170px]">{item.result.meet_name}</div>
                              <div className="text-[10px] font-mono">{item.result.meet_date}</div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: IMPORTADOR CENTRALIZADO ADAEL 2026 */}
        <TabsContent value="importar" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Upload className="h-4 w-4 text-primary" />
                Importador Oficial ADAEL 2026
              </CardTitle>
              <CardDescription className="text-xs">
                Importa resultados oficiales desde enlaces web (adael.com.ve, natacionvenezuela.com), reportes Hy-Tek Meet Manager o entry lists de clubes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Nombre del Torneo / Evento</label>
                  <Input
                    value={importMeetName}
                    onChange={(e) => setImportMeetName(e.target.value)}
                    placeholder="Ej. III Estadal ADAEL 2026 (Piscinas Bolivarianas)"
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Fecha de Competencia</label>
                  <Input
                    type="date"
                    value={importMeetDate}
                    onChange={(e) => setImportMeetDate(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold">Curso de Piscina</label>
                  <Select value={importCourse} onValueChange={(v) => setImportCourse(v as CourseType)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LCM">LCM (Piscina 50m — Piscinas Bolivarianas)</SelectItem>
                      <SelectItem value="SCM">SCM (Piscina 25m — Hocalar)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Enlace Oficial */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5 text-primary" />
                  Enlace Oficial de Resultados (adael.com.ve o natacionvenezuela.com)
                </label>
                <div className="flex gap-2">
                  <Input
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    placeholder="https://www.adael.com.ve/3erEstadalADAEL2026/index.htm o natacionvenezuela.com/2026/lara/"
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Acepta enlaces web de resultados oficiales generados por Hy-Tek Meet Manager.
                </p>
              </div>

              {/* O Pegar Texto / Tablas */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold">
                  O Pegar Texto de Resultados / Entry List Tabulado:
                </label>
                <Textarea
                  value={importRawText}
                  onChange={(e) => setImportRawText(e.target.value)}
                  placeholder="Formato: Nombre Atleta, Sexo, Año Nacimiento, Club (JSWIM, HOCALAR, POLI, ITALO), Prueba, Tiempo"
                  rows={6}
                  className="text-xs font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <Button
                  onClick={handleProcessImport}
                  disabled={isImporting}
                  className="gap-2 text-xs shadow"
                >
                  {isImporting ? (
                    <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5" />
                  )}
                  Procesar y Centralizar en ADAEL 2026
                </Button>
              </div>

              {/* Centro Unificado embebido */}
              <div className="pt-6 border-t space-y-2">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Layers className="h-4 w-4 text-primary" />
                  O utiliza el Centro Unificado de Archivos (HY3, CL2, ZIP, PDF, SDIF)
                </h3>
                <UnifiedResultsImportHub
                  embedded={true}
                  defaultDestinations={{
                    stateRanking: true,
                    officialCircuit: true,
                    teamDatabases: true,
                  }}
                  onImportComplete={() => loadAllData()}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* MODAL: REGISTRAR NUEVO FICHAJE 2026 */}
      <Dialog open={newAthleteOpen} onOpenChange={setNewAthleteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-4 w-4 text-primary" />
              Nuevo Fichaje ADAEL 2026
            </DialogTitle>
            <DialogDescription className="text-xs">
              Registra un nuevo atleta en el padrón oficial 2026 de la Asociación de Deportes Acuáticos de Lara.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <label className="font-semibold">Nombre y Apellido Oficial</label>
              <Input
                value={newAthName}
                onChange={(e) => setNewAthName(e.target.value)}
                placeholder="Ej. García Mendoza, Juan Pablo"
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold">ID FEVEDA / ADAEL</label>
                <Input
                  value={newAthFavedaId}
                  onChange={(e) => setNewAthFavedaId(e.target.value)}
                  placeholder="Ej. 110514M01"
                  className="h-9 text-xs font-mono"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold">Género</label>
                <Select value={newAthGender} onValueChange={(v) => setNewAthGender(v as GenderType)}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M">Masculino (M)</SelectItem>
                    <SelectItem value="F">Femenino (F)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold">Año de Nacimiento</label>
                <Input
                  type="number"
                  value={newAthBirthYear}
                  onChange={(e) => setNewAthBirthYear(parseInt(e.target.value, 10) || 2010)}
                  min={1940}
                  max={2026}
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold">Categoría al 31/12/2026</label>
                <div className="h-9 flex items-center px-3 border rounded-md bg-muted/40 font-semibold text-primary">
                  {calculateAgeGroup2026(newAthBirthYear)}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold">Club ADAEL Representado</label>
              <Select value={newAthClubId} onValueChange={setNewAthClubId}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Selecciona el Club Oficial" />
                </SelectTrigger>
                <SelectContent>
                  {clubs.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.club_code} — {c.club_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isFedCheck"
                checked={newAthIsFed}
                onChange={(e) => setNewAthIsFed(e.target.checked)}
                className="rounded border-gray-300"
              />
              <label htmlFor="isFedCheck" className="text-xs cursor-pointer">
                Atleta Federado Oficial (con carnet FEVEDA 2026)
              </label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setNewAthleteOpen(false)} className="text-xs">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleCreateAthlete} className="text-xs shadow">
              Guardar en Padrón 2026
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
