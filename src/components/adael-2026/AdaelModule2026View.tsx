/**
 * Módulo Oficial ADAEL 2026: Clubes, Fichaje y Resultados
 * Ubicación: src/components/adael-2026/AdaelModule2026View.tsx
 *
 * Módulo de software deportivo especializado para la Asociación de Deportes Acuáticos del Estado Lara (ADAEL)
 * Diseñado bajo estándares FEVEDA / World Aquatics / Hy-Tek Meet Manager.
 *
 * Incluye:
 * - Motor de Importación Universal Drag & Drop (Zero-Skip Parser) para .hy3, .sd3, .cl2, .mdb, .pdf, .zip
 * - Consola de Auditoría Post-Importación
 * - Vista 1: Directorio de Equipos ADAEL con Medallero y Puntos Totales
 * - Vista 2: Padrón de Atletas Fichados 2026 con Edades al 31/12/2026 y Exportación Excel/CSV
 * - Vista 3: Buscador y Ranking de Resultados 2026 con Mejores Marcas (PB) y Evolución de Parciales (Splits)
 */

import { useState, useMemo, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
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
  FileText,
  TrendingUp,
  SlidersHorizontal,
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
import { Progress } from "@/components/ui/progress";
import {
  type AdaelClub2026,
  type AdaelAthlete2026,
  type AdaelResult2026,
  type AgeGroupAdael2026,
  type CourseType,
  type GenderType,
  type RoundType,
  type ResultStatus,
} from "@/lib/adael-2026/types";
import {
  getAdaelClubs2026,
  getAdaelAthletes2026,
  getAdaelResults2026,
  upsertAdaelAthletes2026,
  normalizeAthleteName,
  calculateAgeGroup2026,
  formatMillisecondsToTime,
} from "@/lib/adael-2026/service";
import {
  parseUniversalAdaelFiles,
  type UniversalParseReport,
} from "@/lib/adael-2026/universal-parser";
import { AuditConsoleModal } from "./AuditConsoleModal";
import { downloadFile } from "@/lib/file-delivery";

export function AdaelModule2026View() {
  const [activeTab, setActiveTab] = useState<string>("equipos");
  const [loading, setLoading] = useState(false);

  // Estados de datos principales
  const [clubs, setClubs] = useState<AdaelClub2026[]>([]);
  const [athletes, setAthletes] = useState<AdaelAthlete2026[]>([]);
  const [results, setResults] = useState<AdaelResult2026[]>([]);

  // Vista 1: Filtros Directorio Equipos
  const [searchClub, setSearchClub] = useState("");

  // Vista 2: Filtros Padrón de Atletas
  const [searchAthlete, setSearchAthlete] = useState("");
  const [filterClub, setFilterClub] = useState("all");
  const [filterAgeGroup, setFilterAgeGroup] = useState<string>("all");
  const [filterGender, setFilterGender] = useState<string>("all");
  const [filterFederated, setFilterFederated] = useState<string>("all");

  // Vista 3: Filtros Buscador y Ranking de Resultados
  const [filterMeet, setFilterMeet] = useState<string>("all");
  const [filterCourse, setFilterCourse] = useState<string>("all");
  const [filterStroke, setFilterStroke] = useState<string>("all");
  const [filterDistance, setFilterDistance] = useState<string>("all");
  const [filterResultAgeGroup, setFilterResultAgeGroup] = useState<string>("all");
  const [filterResultClub, setFilterResultClub] = useState<string>("all");
  const [filterOnlyPB, setFilterOnlyPB] = useState(true);

  // Estado Drag & Drop Universal Parser
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStage, setUploadStage] = useState("");
  const [auditReport, setAuditReport] = useState<UniversalParseReport | null>(null);
  const [auditModalOpen, setAuditModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Mapa de atletas para acceso rápido O(1)
  const athleteMap = useMemo(() => {
    const m = new Map<string, AdaelAthlete2026>();
    athletes.forEach((a) => m.set(a.id, a));
    return m;
  }, [athletes]);

  // =========================================================================
  // VISTA 1: DIRECTORIO DE EQUIPOS ADAEL CON MEDALLERO Y PUNTOS
  // =========================================================================
  const clubDirectoryStats = useMemo(() => {
    const FEVEDA_POINTS = [9, 7, 6, 5, 4, 3, 2, 1]; // Puntos para 1° al 8° puesto

    return clubs.map((club) => {
      const clubAthletes = athletes.filter((a) => a.club_id === club.id);
      const maleCount = clubAthletes.filter((a) => a.gender === "M").length;
      const femaleCount = clubAthletes.filter((a) => a.gender === "F").length;
      const federatedCount = clubAthletes.filter((a) => a.is_federated).length;

      const clubResults = results.filter((r) => r.club_id === club.id && r.status === "OK");

      let gold = 0;
      let silver = 0;
      let bronze = 0;
      let totalPoints = 0;

      for (const res of clubResults) {
        if (res.rank === 1) gold++;
        else if (res.rank === 2) silver++;
        else if (res.rank === 3) bronze++;

        if (res.rank && res.rank >= 1 && res.rank <= 8) {
          totalPoints += FEVEDA_POINTS[res.rank - 1] || 0;
        }
      }

      return {
        club,
        totalAthletes: clubAthletes.length,
        maleCount,
        femaleCount,
        federatedCount,
        totalResults: clubResults.length,
        gold,
        silver,
        bronze,
        totalMedals: gold + silver + bronze,
        totalPoints,
      };
    }).sort((a, b) => {
      // Ordenar por puntos totales descendente, luego por oro
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.gold !== a.gold) return b.gold - a.gold;
      return b.totalAthletes - a.totalAthletes;
    });
  }, [clubs, athletes, results]);

  const filteredClubDirectory = useMemo(() => {
    if (!searchClub.trim()) return clubDirectoryStats;
    const q = searchClub.trim().toUpperCase();
    return clubDirectoryStats.filter(
      (c) =>
        c.club.club_code.toUpperCase().includes(q) ||
        c.club.club_name.toUpperCase().includes(q) ||
        c.club.aliases?.some((a) => a.toUpperCase().includes(q))
    );
  }, [clubDirectoryStats, searchClub]);

  // =========================================================================
  // VISTA 2: PADRÓN DE ATLETAS FICHADOS 2026
  // =========================================================================
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

  // =========================================================================
  // VISTA 3: BUSCADOR Y RANKING DE RESULTADOS 2026 (PB & PARCIALES)
  // =========================================================================
  const availableMeets = useMemo(() => {
    const s = new Set<string>();
    results.forEach((r) => s.add(r.meet_name));
    return Array.from(s);
  }, [results]);

  const filteredResults = useMemo(() => {
    // 1. Filtrado básico
    let subset = results.filter((r) => {
      if (filterMeet !== "all" && r.meet_name !== filterMeet) return false;
      if (filterCourse !== "all" && r.pool_course !== filterCourse) return false;
      if (filterResultClub !== "all" && r.club_id !== filterResultClub) return false;

      // Filtro estilo
      if (filterStroke !== "all") {
        if (!r.event_code.toLowerCase().includes(filterStroke.toLowerCase())) return false;
      }
      // Filtro distancia
      if (filterDistance !== "all") {
        if (!r.event_code.startsWith(`${filterDistance}m`)) return false;
      }

      // Filtro categoría atleta
      if (filterResultAgeGroup !== "all") {
        const ath = athleteMap.get(r.athlete_id);
        if (!ath || ath.age_group_2026 !== filterResultAgeGroup) return false;
      }

      return true;
    });

    // 2. Si Solo PB está activo: Agrupar por atleta + event_code + pool_course y conservar menor tiempo
    if (filterOnlyPB) {
      const bestMap = new Map<string, AdaelResult2026>();
      for (const res of subset) {
        if (!res.final_time_ms || res.final_time_ms <= 0) continue;
        const key = `${res.athlete_id}_${res.event_code}_${res.pool_course}`;
        const existing = bestMap.get(key);
        if (!existing || res.final_time_ms < existing.final_time_ms) {
          bestMap.set(key, res);
        }
      }
      subset = Array.from(bestMap.values());
    }

    // Ordenar de menor a mayor tiempo
    return subset.sort((a, b) => (a.final_time_ms || 999999) - (b.final_time_ms || 999999));
  }, [results, filterMeet, filterCourse, filterResultClub, filterStroke, filterDistance, filterResultAgeGroup, filterOnlyPB, athleteMap]);

  // =========================================================================
  // GESTIÓN DRAG & DROP MULTI-ARCHIVO
  // =========================================================================
  const handleFiles = async (fileList: FileList | File[]) => {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    setIsUploading(true);
    setUploadProgress(10);
    setUploadStage("Preparando archivos...");

    try {
      const report = await parseUniversalAdaelFiles(files, {
        onProgress: (pct, stage) => {
          setUploadProgress(pct);
          setUploadStage(stage);
        },
      });

      setAuditReport(report);
      setAuditModalOpen(true);
      await loadAllData();
      toast.success(
        `Importación Universal completada: ${report.totalClubsDetected} clubes, ${report.totalAthletesEnrolled} atletas y ${report.totalResultsImported} marcas.`
      );
    } catch (err: any) {
      console.error("Error en importación universal:", err);
      toast.error(`Error procesando archivos: ${err?.message || "Fallo inesperado"}`);
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      setUploadStage("");
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  };

  // Exportar padrón a CSV
  const handleExportCSV = () => {
    if (filteredAthletes.length === 0) {
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
    downloadFile(new File([csvContent], "Padron_Oficial_ADAEL_2026.csv", { type: "text/csv;charset=utf-8;" }));
    toast.success("Padrón exportado en formato CSV exitosamente.");
  };

  // Exportar padrón a Excel (XML Spreadsheet)
  const handleExportExcel = () => {
    if (filteredAthletes.length === 0) {
      toast.info("No hay atletas en el padrón para exportar.");
      return;
    }

    const rowsXml = filteredAthletes
      .map((a) => {
        const club = clubMap.get(a.club_id);
        return `<Row>
          <Cell><Data ss:Type="String">${a.faveda_adael_id || ""}</Data></Cell>
          <Cell><Data ss:Type="String">${a.full_name}</Data></Cell>
          <Cell><Data ss:Type="String">${a.gender}</Data></Cell>
          <Cell><Data ss:Type="Number">${a.birth_year}</Data></Cell>
          <Cell><Data ss:Type="String">${a.age_group_2026}</Data></Cell>
          <Cell><Data ss:Type="String">${club?.club_code || ""}</Data></Cell>
          <Cell><Data ss:Type="String">${club?.club_name || ""}</Data></Cell>
          <Cell><Data ss:Type="String">${a.is_federated ? "Federado" : "Masificación"}</Data></Cell>
          <Cell><Data ss:Type="String">${a.status}</Data></Cell>
        </Row>`;
      })
      .join("\n");

    const xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
 <Worksheet ss:Name="Padrón ADAEL 2026">
  <Table>
   <Row>
    <Cell><Data ss:Type="String">ID FEVEDA / ADAEL</Data></Cell>
    <Cell><Data ss:Type="String">Nombre Oficial</Data></Cell>
    <Cell><Data ss:Type="String">Género</Data></Cell>
    <Cell><Data ss:Type="String">Año Nacimiento</Data></Cell>
    <Cell><Data ss:Type="String">Categoría al 31/12/2026</Data></Cell>
    <Cell><Data ss:Type="String">Código Club</Data></Cell>
    <Cell><Data ss:Type="String">Nombre Club</Data></Cell>
    <Cell><Data ss:Type="String">Condición</Data></Cell>
    <Cell><Data ss:Type="String">Estatus</Data></Cell>
   </Row>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

    downloadFile(new File([xml], "Padron_Oficial_ADAEL_2026.xls", { type: "application/vnd.ms-excel;charset=utf-8;" }));
    toast.success("Padrón exportado en formato Excel exitosamente.");
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

  return (
    <div className="space-y-6 pb-12">
      {/* Encabezado Principal */}
      <div className="rounded-xl border bg-gradient-to-r from-blue-950/40 via-sky-950/20 to-card p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow">
                <ShieldCheck className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  Módulo ADAEL 2026 (Clubes, Fichaje y Resultados)
                </h1>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                  <Badge variant="outline" className="border-primary/40 text-primary font-bold py-0">
                    Temporada Oficial 2026
                  </Badge>
                  <span>•</span>
                  <span>Complejo de Piscinas Bolivarianas & Copa Hocalar</span>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {auditReport && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAuditModalOpen(true)}
                className="gap-2 text-xs border-amber-500/30 text-amber-500 hover:bg-amber-500/10"
              >
                <AlertCircle className="h-3.5 w-3.5" />
                Auditoría ({auditReport.warnings.length})
              </Button>
            )}
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
            <Button
              size="sm"
              variant="outline"
              asChild
              className="gap-2 text-xs border-primary/40 text-primary hover:bg-primary/10 shadow"
            >
              <Link to="/import">
                <Globe className="h-3.5 w-3.5" />
                Importar Enlace Web
              </Link>
            </Button>
          </div>
        </div>

        {/* Zona Drag & Drop Universal (Zero-Skip Parser) */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-6 rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-all ${
            isDragging
              ? "border-primary bg-primary/10 scale-[1.01]"
              : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30"
          }`}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".hy3,.sd3,.cl2,.mdb,.pdf,.zip,.txt,.csv"
            onChange={(e) => e.target.files && handleFiles(e.target.files)}
            className="hidden"
          />

          {isUploading ? (
            <div className="space-y-2 py-2 max-w-md mx-auto">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>{uploadStage}</span>
                <span>{uploadProgress}%</span>
              </div>
              <Progress value={uploadProgress} className="h-2" />
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 py-1">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Upload className="h-4 w-4" />
              </div>
              <div className="text-left">
                <div className="text-xs font-semibold text-foreground">
                  Arrastra aquí múltiples archivos (.hy3, .sd3, .cl2, .mdb, .pdf, .zip) o haz clic para seleccionar
                </div>
                <div className="text-[11px] text-muted-foreground">
                  Motor Universal Zero-Skip con fallback de codificación para "Ñ" y tildes. Extrae todos los clubes, atletas y relevos.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Pestañas Principales */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
        <TabsList className="grid grid-cols-3 w-full max-w-xl bg-muted/60 p-1">
          <TabsTrigger value="equipos" className="text-xs flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5" />
            Vista 1: Equipos ADAEL
          </TabsTrigger>
          <TabsTrigger value="padron" className="text-xs flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Vista 2: Padrón de Atletas
          </TabsTrigger>
          <TabsTrigger value="resultados" className="text-xs flex items-center gap-1.5">
            <Timer className="h-3.5 w-3.5" />
            Vista 3: Buscador y Ranking
          </TabsTrigger>
        </TabsList>

        {/* ================================================================= */}
        {/* VISTA 1: DIRECTORIO DE EQUIPOS ADAEL CON MEDALLERO Y PUNTOS      */}
        {/* ================================================================= */}
        <TabsContent value="equipos" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Building2 className="h-4 w-4 text-primary" />
                    Directorio de Equipos ADAEL (Temporada 2026)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Padrón de clubes afiliados del estado Lara, nadadores fichados, medallero y tabla acumulada de puntos FEVEDA.
                  </CardDescription>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar club o alias..."
                    value={searchClub}
                    onChange={(e) => setSearchClub(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <div className="rounded-md border overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b font-medium text-muted-foreground uppercase text-[10px] tracking-wider">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Código</th>
                      <th className="py-2.5 px-3">Nombre Oficial del Club</th>
                      <th className="py-2.5 px-3">Aliases Reconocidos</th>
                      <th className="py-2.5 px-3 text-center">Atletas (M/F)</th>
                      <th className="py-2.5 px-3 text-center">🥇 Oro</th>
                      <th className="py-2.5 px-3 text-center">🥈 Plata</th>
                      <th className="py-2.5 px-3 text-center">🥉 Bronce</th>
                      <th className="py-2.5 px-3 text-center font-bold">Total Medallas</th>
                      <th className="py-2.5 px-3 text-right font-bold text-primary">Puntos FEVEDA</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredClubDirectory.map((item, idx) => (
                      <tr key={item.club.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-muted-foreground">{idx + 1}</td>
                        <td className="py-2.5 px-3 font-mono font-bold text-primary">
                          <Badge variant="secondary" className="font-mono text-[10px]">
                            {item.club.club_code}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-foreground">{item.club.club_name}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {item.club.aliases?.slice(0, 3).map((a, i) => (
                              <Badge key={i} variant="outline" className="text-[9px] py-0 px-1 font-mono">
                                {a}
                              </Badge>
                            ))}
                            {(item.club.aliases?.length || 0) > 3 && (
                              <span className="text-[9px] text-muted-foreground">
                                +{(item.club.aliases?.length || 0) - 3}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          <span className="font-bold">{item.totalAthletes}</span>
                          <span className="text-muted-foreground text-[10px] ml-1">
                            ({item.maleCount}M/{item.femaleCount}F)
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold text-amber-500">
                          {item.gold > 0 ? item.gold : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-400">
                          {item.silver > 0 ? item.silver : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-semibold text-amber-700">
                          {item.bronze > 0 ? item.bronze : "—"}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono font-bold">
                          {item.totalMedals > 0 ? (
                            <Badge variant="secondary" className="text-[10px] font-bold">
                              {item.totalMedals}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-sm text-primary">
                          {item.totalPoints > 0 ? `${item.totalPoints} pts` : "0 pts"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================= */}
        {/* VISTA 2: PADRÓN DE ATLETAS FICHADOS 2026 CON EXPORTACIÓN         */}
        {/* ================================================================= */}
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
                    Categorías calculadas estrictamente al 31 de diciembre de 2026 según normativas FEVEDA.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportExcel}
                    className="h-8 text-xs gap-1.5 border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/10"
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    Exportar Excel
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Download className="h-3.5 w-3.5" />
                    Exportar CSV
                  </Button>
                </div>
              </div>

              {/* Filtros */}
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
                    <SelectValue placeholder="Club" />
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
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b font-medium text-muted-foreground uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">ID FEVEDA</th>
                        <th className="py-2.5 px-3">Atleta Oficial</th>
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

        {/* ================================================================= */}
        {/* VISTA 3: BUSCADOR Y RANKING DE RESULTADOS CON PB Y SPLITS         */}
        {/* ================================================================= */}
        <TabsContent value="resultados" className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Timer className="h-4 w-4 text-emerald-500" />
                    Buscador y Ranking de Resultados Oficiales ADAEL 2026
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Marcas oficiales de Estadales en Complejo Piscinas Bolivarianas y Copa Hocalar con parciales cada 50m.
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant={filterOnlyPB ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilterOnlyPB(!filterOnlyPB)}
                    className="h-8 text-xs gap-1.5 font-semibold"
                  >
                    <TrendingUp className="h-3.5 w-3.5" />
                    {filterOnlyPB ? "Solo Mejores Marcas (PB)" : "Todas las Marcas"}
                  </Button>
                </div>
              </div>

              {/* Filtros de Resultados */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-3">
                <Select value={filterMeet} onValueChange={setFilterMeet}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Torneo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Torneos</SelectItem>
                    {availableMeets.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={filterCourse} onValueChange={setFilterCourse}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Curso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Cursos</SelectItem>
                    <SelectItem value="LCM">LCM (Piscina 50m)</SelectItem>
                    <SelectItem value="SCM">SCM (Piscina 25m)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterStroke} onValueChange={setFilterStroke}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Estilo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los Estilos</SelectItem>
                    <SelectItem value="Libre">Libre</SelectItem>
                    <SelectItem value="Espalda">Espalda</SelectItem>
                    <SelectItem value="Pecho">Pecho</SelectItem>
                    <SelectItem value="Mariposa">Mariposa</SelectItem>
                    <SelectItem value="C.I.">Combinado (C.I.)</SelectItem>
                    <SelectItem value="Relevo">Relevos</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterDistance} onValueChange={setFilterDistance}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Distancia" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    <SelectItem value="50">50m</SelectItem>
                    <SelectItem value="100">100m</SelectItem>
                    <SelectItem value="200">200m</SelectItem>
                    <SelectItem value="400">400m</SelectItem>
                    <SelectItem value="800">800m</SelectItem>
                    <SelectItem value="1500">1500m</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={filterResultAgeGroup} onValueChange={setFilterResultAgeGroup}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las Categorías</SelectItem>
                    <SelectItem value="Infantil A">Infantil A (10-11)</SelectItem>
                    <SelectItem value="Infantil B">Infantil B (12-13)</SelectItem>
                    <SelectItem value="Juvenil A">Juvenil A (14-15)</SelectItem>
                    <SelectItem value="Juvenil B">Juvenil B (16-18)</SelectItem>
                    <SelectItem value="Máxima">Máxima (19-24)</SelectItem>
                    <SelectItem value="Máster">Máster (≥25)</SelectItem>
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
                  <p className="text-sm font-medium">No hay marcas registradas con los filtros seleccionados.</p>
                </div>
              ) : (
                <div className="rounded-md border overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b font-medium text-muted-foreground uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">#</th>
                        <th className="py-2.5 px-3">Atleta Oficial</th>
                        <th className="py-2.5 px-3">Club</th>
                        <th className="py-2.5 px-3">Categoría</th>
                        <th className="py-2.5 px-3">Prueba</th>
                        <th className="py-2.5 px-3 text-center">Curso</th>
                        <th className="py-2.5 px-3 text-right">Siembra</th>
                        <th className="py-2.5 px-3 text-right font-bold">Tiempo Oficial</th>
                        <th className="py-2.5 px-3 text-center">Parciales 50m (Splits)</th>
                        <th className="py-2.5 px-3 text-center">Ptos FINA</th>
                        <th className="py-2.5 px-3">Torneo</th>
                        <th className="py-2.5 px-3 text-center">Estatus</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredResults.map((r, idx) => {
                        const ath = athleteMap.get(r.athlete_id);
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
                              <Badge variant="outline" className="text-[10px]">
                                {ath?.age_group_2026 || "—"}
                              </Badge>
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
                                <div className="flex flex-wrap items-center justify-center gap-1 max-w-xs mx-auto">
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
                            <td className="py-2.5 px-3 text-muted-foreground text-[11px]">
                              <div className="truncate max-w-[140px]">{r.meet_name}</div>
                              <div className="text-[10px] font-mono">{r.meet_date}</div>
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
      </Tabs>

      {/* MODAL: CONSOLA DE AUDITORÍA POST-IMPORTACIÓN */}
      <AuditConsoleModal
        open={auditModalOpen}
        onOpenChange={setAuditModalOpen}
        report={auditReport}
      />

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
