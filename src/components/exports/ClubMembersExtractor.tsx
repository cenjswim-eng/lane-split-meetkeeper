/**
 * Componente: Apartado de Extracción de Integrantes del Club (PDF y ZIP)
 * Ubicación: src/components/exports/ClubMembersExtractor.tsx
 *
 * Ofrece al entrenador y directiva del club la extracción completa de integrantes
 * en formato PDF oficial o en paquete ZIP (PDF, CSV para Excel, TXT y plantillas Meet Manager).
 */

import { useState, useMemo } from "react";
import {
  FileText,
  FileArchive,
  Download,
  Share2,
  CheckCircle2,
  Users,
  Filter,
  Search,
  Building2,
  ShieldCheck,
  FileSpreadsheet,
  Loader2,
  ArrowDownToLine,
} from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  unifyClubMembers,
  generateClubMembersPdf,
  generateClubMembersCsv,
  generateClubMembersZip,
  type ClubMemberItem,
} from "@/lib/club-members-extract";
import { downloadFile, canShareFile, shareFile } from "@/lib/file-delivery";

interface ClubMembersExtractorProps {
  club?: Tables<"clubs"> | null;
  members?: Tables<"club_members">[];
  athletes?: Tables<"athletes">[];
  mode?: "inline" | "dialog";
  buttonVariant?: "default" | "outline" | "secondary";
  buttonLabel?: string;
}

export function ClubMembersExtractor({
  club,
  members = [],
  athletes = [],
  mode = "inline",
  buttonVariant = "default",
  buttonLabel = "Extraer Integrantes (PDF / ZIP)",
}: ClubMembersExtractorProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStage, setGenerationStage] = useState<string>("");

  // Filtros de extracción
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [onlyActive, setOnlyActive] = useState(true);
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Archivo generado listo para descargar o compartir
  const [readyFile, setReadyFile] = useState<File | null>(null);
  const [readyType, setReadyType] = useState<"pdf" | "zip" | "csv" | null>(null);

  // Unificar integrantes y atletas del club
  const allItems = useMemo(() => {
    return unifyClubMembers(club, members, athletes);
  }, [club, members, athletes]);

  // Filtrar según opciones elegidas
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (onlyActive && !item.active) return false;
      if (roleFilter !== "all") {
        if (roleFilter === "swimmers" && item.role !== "nadador") return false;
        if (roleFilter === "staff" && item.role === "nadador") return false;
        if (roleFilter !== "swimmers" && roleFilter !== "staff" && item.role !== roleFilter) return false;
      }
      if (genderFilter !== "all" && item.gender !== genderFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const full = `${item.firstName} ${item.lastName} ${item.roleLabel} ${item.federationId || ""} ${item.email || ""}`.toLowerCase();
        if (!full.includes(q)) return false;
      }
      return true;
    });
  }, [allItems, onlyActive, roleFilter, genderFilter, searchQuery]);

  // Métricas rápidas
  const clubName = club?.full_name || club?.name || "Club de Natación";
  const clubCode = club?.team_code || "JSWIM";
  const swimmersCount = allItems.filter((i) => i.role === "nadador").length;
  const staffCount = allItems.filter((i) => i.role !== "nadador").length;

  // 1. Extraer en PDF
  const handleExtractPdf = async () => {
    if (!filteredItems.length) {
      toast.warning("No hay integrantes con los filtros seleccionados.");
      return;
    }
    setIsGenerating(true);
    setGenerationStage("Generando documento PDF oficial...");
    setReadyFile(null);

    try {
      await new Promise((r) => setTimeout(r, 150));
      const pdf = generateClubMembersPdf(
        {
          name: clubName,
          team_code: clubCode,
          region_lsc: club?.region_lsc || null,
        },
        filteredItems
      );
      setReadyFile(pdf);
      setReadyType("pdf");
      downloadFile(pdf);
      toast.success(`PDF generado y descargado: ${pdf.name}`);
    } catch (err: any) {
      toast.error(err?.message || "Error al generar el PDF.");
    } finally {
      setIsGenerating(false);
      setGenerationStage("");
    }
  };

  // 2. Extraer en ZIP
  const handleExtractZip = async () => {
    if (!filteredItems.length) {
      toast.warning("No hay integrantes con los filtros seleccionados.");
      return;
    }
    setIsGenerating(true);
    setGenerationStage("Comprimiendo PDF, Excel CSV y plantillas Hy-Tek en ZIP...");
    setReadyFile(null);

    try {
      const zip = await generateClubMembersZip(
        {
          name: clubName,
          team_code: clubCode,
          short_name: club?.short_name || null,
          region_lsc: club?.region_lsc || null,
          head_coach: club?.head_coach || null,
        },
        filteredItems
      );
      setReadyFile(zip);
      setReadyType("zip");
      downloadFile(zip);
      toast.success(`Paquete ZIP generado y descargado: ${zip.name}`);
    } catch (err: any) {
      toast.error(err?.message || "Error al empaquetar el archivo ZIP.");
    } finally {
      setIsGenerating(false);
      setGenerationStage("");
    }
  };

  // 3. Extraer solo CSV para Excel
  const handleExtractCsv = () => {
    if (!filteredItems.length) {
      toast.warning("No hay integrantes para exportar.");
      return;
    }
    try {
      const csv = generateClubMembersCsv(
        { name: clubName, team_code: clubCode },
        filteredItems
      );
      setReadyFile(csv);
      setReadyType("csv");
      downloadFile(csv);
      toast.success(`Archivo CSV para Excel descargado: ${csv.name}`);
    } catch (err: any) {
      toast.error(err?.message || "Error al generar CSV.");
    }
  };

  // Contenido principal del apartado
  const content = (
    <div className="space-y-5">
      {/* Encabezado y Métricas */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-foreground flex items-center gap-1.5">
              <Building2 className="h-4 w-4 text-primary" />
              {clubName}
            </span>
            <Badge variant="outline" className="border-primary/40 font-mono text-primary font-bold text-xs">
              {clubCode}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Extrae la nómina oficial del club en PDF formal o en paquete ZIP listo para Excel y Meet Manager.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="rounded-md border bg-muted/30 px-2.5 py-1 text-center">
            <span className="text-[10px] text-muted-foreground block">Total</span>
            <span className="font-mono font-bold text-sm text-foreground">{allItems.length}</span>
          </div>
          <div className="rounded-md border bg-muted/30 px-2.5 py-1 text-center">
            <span className="text-[10px] text-muted-foreground block">Nadadores</span>
            <span className="font-mono font-bold text-sm text-primary">{swimmersCount}</span>
          </div>
          <div className="rounded-md border bg-muted/30 px-2.5 py-1 text-center">
            <span className="text-[10px] text-muted-foreground block">Staff/Directiva</span>
            <span className="font-mono font-bold text-sm text-emerald-600">{staffCount}</span>
          </div>
        </div>
      </div>

      {/* Controles de Filtro */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 bg-muted/20 p-3 rounded-lg border">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase">Tipo de integrante</label>
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos ({allItems.length})</SelectItem>
              <SelectItem value="swimmers">Solo Nadadores ({swimmersCount})</SelectItem>
              <SelectItem value="staff">Solo Staff y Directiva ({staffCount})</SelectItem>
              <SelectItem value="entrenador">Solo Entrenadores</SelectItem>
              <SelectItem value="directivo">Solo Directivos</SelectItem>
              <SelectItem value="delegado">Solo Delegados</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase">Sexo (Rama)</label>
          <Select value={genderFilter} onValueChange={setGenderFilter}>
            <SelectTrigger className="h-8 text-xs bg-background">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las ramas</SelectItem>
              <SelectItem value="M">Masculino (M)</SelectItem>
              <SelectItem value="F">Femenino (F)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase">Búsqueda rápida</label>
          <div className="relative">
            <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, cédula o rol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-8 text-xs pl-8 bg-background"
            />
          </div>
        </div>

        <div className="flex items-end pb-1.5">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium">
            <Checkbox
              checked={onlyActive}
              onCheckedChange={(c) => setOnlyActive(Boolean(c))}
            />
            <span>Solo integrantes activos</span>
          </label>
        </div>
      </div>

      {/* BOTONES PRINCIPALES DE EXTRACCIÓN (PDF / ZIP / CSV) */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {/* BOTÓN 1: EXTRAER EN PDF */}
        <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-4 flex flex-col justify-between space-y-3 hover:border-primary transition-all">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-primary flex items-center gap-1.5">
                <FileText className="h-4 w-4" />
                Reporte PDF Oficial
              </span>
              <Badge variant="outline" className="text-[10px] py-0 border-primary/40 text-primary">
                Listo para Imprimir
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Genera la nómina formal en PDF horizontal con membrete del club, datos de contacto, categorías al 31/12 y firma.
            </p>
          </div>
          <Button
            onClick={handleExtractPdf}
            disabled={isGenerating || !filteredItems.length}
            className="w-full gap-2 font-semibold text-xs bg-primary shadow-sm"
          >
            {isGenerating && generationStage.includes("PDF") ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generando PDF...</span>
              </>
            ) : (
              <>
                <ArrowDownToLine className="h-4 w-4" />
                <span>Extraer en PDF ({filteredItems.length})</span>
              </>
            )}
          </Button>
        </div>

        {/* BOTÓN 2: EXTRAER EN ZIP (PAQUETE COMPLETO) */}
        <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/5 p-4 flex flex-col justify-between space-y-3 hover:border-emerald-500 transition-all">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-emerald-700 dark:text-emerald-300 flex items-center gap-1.5">
                <FileArchive className="h-4 w-4" />
                Paquete Completo .ZIP
              </span>
              <Badge variant="outline" className="text-[10px] py-0 border-emerald-500/40 text-emerald-600">
                Todo en Uno
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Empaqueta en un archivo comprimido el <strong>PDF oficial</strong>, <strong>Excel CSV</strong>, resumen TXT y <strong>plantillas Meet Manager</strong> (.CL2 y .HY3).
            </p>
          </div>
          <Button
            onClick={handleExtractZip}
            disabled={isGenerating || !filteredItems.length}
            className="w-full gap-2 font-semibold text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
          >
            {isGenerating && generationStage.includes("ZIP") ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Empaquetando ZIP...</span>
              </>
            ) : (
              <>
                <FileArchive className="h-4 w-4" />
                <span>Extraer en ZIP (.zip)</span>
              </>
            )}
          </Button>
        </div>

        {/* BOTÓN 3: EXTRAER EN CSV (EXCEL) */}
        <div className="rounded-xl border border-muted bg-card p-4 flex flex-col justify-between space-y-3 hover:border-muted-foreground/40 transition-all">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                Hoja de Cálculo CSV
              </span>
              <Badge variant="outline" className="text-[10px] py-0">
                Excel / Sheets
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Descarga directa en CSV compatible con Microsoft Excel (UTF-8 con BOM) con todas las columnas organizadas.
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleExtractCsv}
            disabled={isGenerating || !filteredItems.length}
            className="w-full gap-2 font-semibold text-xs"
          >
            <Download className="h-4 w-4" />
            <span>Descargar CSV para Excel</span>
          </Button>
        </div>
      </div>

      {/* Tarjeta de Archivo Listo con Opción para Compartir */}
      {readyFile && (
        <div className="rounded-xl border-2 border-emerald-500/50 bg-emerald-500/10 p-4 space-y-3 animate-in fade-in">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
              <div>
                <p className="font-semibold text-sm text-foreground">
                  {readyType === "zip"
                    ? "Paquete ZIP de integrantes generado con éxito"
                    : readyType === "pdf"
                    ? "Reporte PDF oficial generado con éxito"
                    : "Archivo CSV generado con éxito"}
                </p>
                <p className="font-mono text-xs text-muted-foreground break-all">{readyFile.name}</p>
              </div>
            </div>
            <Badge variant="outline" className="font-mono uppercase text-xs border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
              {readyType} · {(readyFile.size / 1024).toFixed(1)} KB
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              size="sm"
              onClick={() => downloadFile(readyFile)}
              className="gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Descargar nuevamente</span>
            </Button>

            {canShareFile(readyFile) && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await shareFile(readyFile);
                  } catch (e: any) {
                    toast.error(e?.message || "No se pudo compartir.");
                  }
                }}
                className="gap-2 text-xs"
              >
                <Share2 className="h-3.5 w-3.5 text-primary" />
                <span>Compartir por WhatsApp / Móvil</span>
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Tabla Interactiva de Previsualización */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            Integrantes a incluir ({filteredItems.length} de {allItems.length}):
          </span>
          <span>Ordenados por rol y apellido</span>
        </div>

        <div className="max-h-64 overflow-auto rounded-lg border bg-card">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-muted/90 text-muted-foreground backdrop-blur border-b">
              <tr>
                <th className="p-2.5">#</th>
                <th className="p-2.5">Apellido y Nombre</th>
                <th className="p-2.5">Rol / Cargo</th>
                <th className="p-2.5 text-center">Sexo</th>
                <th className="p-2.5 text-center">Nacimiento</th>
                <th className="p-2.5 text-center">Edad</th>
                <th className="p-2.5">Categoría</th>
                <th className="p-2.5">Cédula / Ficha</th>
                <th className="p-2.5">Contacto</th>
                <th className="p-2.5 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredItems.map((item, idx) => (
                <tr key={item.id || idx} className="hover:bg-muted/40 transition-colors">
                  <td className="p-2.5 font-mono text-muted-foreground text-center">{idx + 1}</td>
                  <td className="p-2.5 font-semibold text-foreground">
                    {item.lastName}, {item.firstName}
                  </td>
                  <td className="p-2.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0 px-1.5 ${
                        item.role === "nadador"
                          ? "border-primary/40 text-primary bg-primary/5"
                          : item.role === "entrenador"
                          ? "border-amber-500/40 text-amber-700 bg-amber-500/10"
                          : "border-indigo-500/40 text-indigo-700 bg-indigo-500/10"
                      }`}
                    >
                      {item.roleLabel}
                    </Badge>
                  </td>
                  <td className="p-2.5 text-center font-semibold text-muted-foreground">{item.gender}</td>
                  <td className="p-2.5 text-center whitespace-nowrap text-muted-foreground">
                    {item.birthDate || "—"}
                  </td>
                  <td className="p-2.5 text-center font-mono">{item.age ?? "—"}</td>
                  <td className="p-2.5 text-muted-foreground">{item.category}</td>
                  <td className="p-2.5 font-mono text-muted-foreground">{item.federationId || "—"}</td>
                  <td className="p-2.5 text-muted-foreground truncate max-w-[150px]">
                    {item.email || item.phone || "—"}
                  </td>
                  <td className="p-2.5 text-center">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                        item.active
                          ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {item.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filteredItems.length && (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No hay integrantes registrados que coincidan con los filtros seleccionados.
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Si se invoca como modo diálogo (botón emergente)
  if (mode === "dialog") {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant={buttonVariant} className="gap-2 font-semibold text-xs shadow-sm">
            <FileArchive className="h-4 w-4 text-primary" />
            <span>{buttonLabel}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[92dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold uppercase">
              <Users className="h-5 w-5 text-primary" />
              Extracción de Integrantes del Club (PDF / ZIP)
            </DialogTitle>
            <DialogDescription>
              Descarga la nómina completa del club en documento PDF formal o en archivo ZIP con hojas de cálculo y plantillas Hy-Tek.
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  // Modo inline (tarjeta directa en la página de Mi Club)
  return (
    <Card className="border-2 border-primary/20 shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <FileArchive className="h-5 w-5 text-primary" />
              Apartado de Extracción de Integrantes (PDF y ZIP)
            </CardTitle>
            <CardDescription>
              Extrae la lista oficial de atletas, entrenadores y directivos de tu club en PDF o en paquete ZIP comprimido.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 text-xs">
            🛡️ Solo Tu Club ({clubCode})
          </Badge>
        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
