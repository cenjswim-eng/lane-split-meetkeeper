/**
 * Vista de Directorio de Equipos y Atletas Representantes
 * Ubicación: src/components/clubs/TeamRosterDirectoryView.tsx
 *
 * Permite a cualquier entrenador o usuario consultar la base de datos de cada club,
 * saber qué atletas representan a cada equipo, sus categorías, edades y pruebas inscritas.
 */

import { useState, useMemo } from "react";
import { Link } from "@tanstack/react-router";
import {
  Building2,
  Users,
  Search,
  Filter,
  Trophy,
  Download,
  FileSpreadsheet,
  FileText,
  Sparkles,
  ArrowUpDown,
  ExternalLink,
  Layers,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { normalizeTeamCode } from "@/data/fevedaClubs";
import { getCategoryNameByAge } from "@/lib/state-ranking";
import { ageAtDec31, formatTime, eventLabel } from "@/lib/swim";
import type { Tables } from "@/integrations/supabase/types";

interface AthleteWithRelations extends Tables<"athletes"> {
  teams?: { id: string; code: string; name: string; lsc: string | null } | null;
  clubs?: { id: string; team_code: string | null; full_name: string | null; name: string; region_lsc: string | null } | null;
}

interface TeamRosterDirectoryViewProps {
  athletes: AthleteWithRelations[];
  clubs: Tables<"clubs">[];
  teams?: Tables<"teams">[];
  results?: Array<{
    id: string;
    athlete_id: string;
    origin_team: string | null;
    seed_time_ms: number | null;
    final_time_ms: number | null;
    meets?: { id: string; name: string; start_date: string | null } | null;
    events?: { distance: number; stroke: number } | null;
  }>;
  entries?: Tables<"meet_entries">[];
  events?: Tables<"events">[];
  activeClubCode?: string;
}

export function TeamRosterDirectoryView({
  athletes,
  clubs,
  teams = [],
  results = [],
  entries = [],
  events = [],
  activeClubCode,
}: TeamRosterDirectoryViewProps) {
  const [selectedClubFilter, setSelectedClubFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [genderFilter, setGenderFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const currentYear = new Date().getFullYear();

  // 1. Unificar y agrupar clubes con sus códigos normalizados
  const clubsCatalog = useMemo(() => {
    const map = new Map<
      string,
      {
        id: string;
        code: string;
        name: string;
        lsc: string;
        state: string;
        athleteCount: number;
        maleCount: number;
        femaleCount: number;
      }
    >();

    // Inicializar con clubes de la tabla `clubs`
    for (const c of clubs) {
      const norm = normalizeTeamCode(c.team_code || c.name, c.full_name || c.name);
      if (!map.has(norm.code)) {
        map.set(norm.code, {
          id: c.id,
          code: norm.code,
          name: norm.name,
          lsc: norm.lsc || c.region_lsc || "Lara",
          state: norm.state || "Lara",
          athleteCount: 0,
          maleCount: 0,
          femaleCount: 0,
        });
      }
    }

    // Inicializar con equipos de la tabla `teams` si no estaban
    for (const t of teams) {
      const norm = normalizeTeamCode(t.code, t.name);
      if (!map.has(norm.code)) {
        map.set(norm.code, {
          id: t.id,
          code: norm.code,
          name: norm.name,
          lsc: norm.lsc || "LARA",
          state: norm.state || "Lara",
          athleteCount: 0,
          maleCount: 0,
          femaleCount: 0,
        });
      }
    }

    // Contar atletas por club
    for (const a of athletes) {
      const codeRaw = a.clubs?.team_code || a.teams?.code || (a as any).origin_team || "UNAT";
      const norm = normalizeTeamCode(codeRaw);
      const target = map.get(norm.code);
      if (target) {
        target.athleteCount++;
        if (a.gender === "M") target.maleCount++;
        if (a.gender === "F") target.femaleCount++;
      } else {
        // Club detectado en atletas que aún no estaba en el mapa
        map.set(norm.code, {
          id: norm.code,
          code: norm.code,
          name: norm.name,
          lsc: norm.lsc || "LARA",
          state: norm.state || "Lara",
          athleteCount: 1,
          maleCount: a.gender === "M" ? 1 : 0,
          femaleCount: a.gender === "F" ? 1 : 0,
        });
      }
    }

    return Array.from(map.values()).sort((a, b) => {
      // Ordenar por cantidad de atletas descendente y luego alfabético
      if (b.athleteCount !== a.athleteCount) return b.athleteCount - a.athleteCount;
      return a.code.localeCompare(b.code);
    });
  }, [clubs, teams, athletes]);

  // Mapa rápido de eventos de atletas para entry lists
  const athleteEntriesMap = useMemo(() => {
    const map = new Map<string, string[]>();

    // 1. A partir de meet_entries
    const eventObjMap = new Map(events.map((e) => [e.id, e]));
    for (const entry of entries) {
      const ev = eventObjMap.get(entry.event_id);
      if (ev) {
        const list = map.get(entry.athlete_id) || [];
        const label = `${ev.distance}m ${eventLabel(ev.distance, ev.stroke)}${
          entry.seed_time_ms ? ` (${formatTime(entry.seed_time_ms)})` : ""
        }`;
        if (!list.includes(label)) list.push(label);
        map.set(entry.athlete_id, list);
      }
    }

    // 2. A partir de results
    for (const r of results) {
      if (r.events) {
        const list = map.get(r.athlete_id) || [];
        const label = `${r.events.distance}m ${eventLabel(r.events.distance, r.events.stroke)}${
          r.final_time_ms ? ` (${formatTime(r.final_time_ms)})` : r.seed_time_ms ? ` (${formatTime(r.seed_time_ms)})` : ""
        }`;
        if (!list.includes(label)) list.push(label);
        map.set(r.athlete_id, list);
      }
    }

    return map;
  }, [entries, events, results]);

  // Filas enriquecidas de atletas con su club y categoría
  const enrichedRows = useMemo(() => {
    return athletes.map((a) => {
      const codeRaw = a.clubs?.team_code || a.teams?.code || (a as any).origin_team || "UNAT";
      const norm = normalizeTeamCode(codeRaw, a.clubs?.name || a.teams?.name);
      const age = a.birth_date ? ageAtDec31(a.birth_date, currentYear) ?? 14 : 14;
      const category = getCategoryNameByAge(age);
      const entriesList = athleteEntriesMap.get(a.id) || [];

      return {
        id: a.id,
        firstName: a.first_name,
        lastName: a.last_name,
        fullName: `${a.last_name}, ${a.first_name}`,
        gender: a.gender || "M",
        birthDate: a.birth_date || "—",
        age,
        category,
        clubCode: norm.code,
        clubName: norm.name,
        lsc: norm.lsc || a.clubs?.region_lsc || "Lara",
        federationId: a.federation_id || "—",
        isActive: a.is_active,
        isFederated: a.is_federated,
        entriesCount: entriesList.length,
        entriesSample: entriesList.slice(0, 3).join(", "),
        allEntries: entriesList,
        isMyClub: activeClubCode ? norm.code === normalizeTeamCode(activeClubCode).code : false,
      };
    });
  }, [athletes, currentYear, athleteEntriesMap, activeClubCode]);

  // Filtrado reactivo de atletas
  const filteredAthletes = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();

    return enrichedRows.filter((row) => {
      // Filtro por Club
      if (selectedClubFilter !== "all" && row.clubCode !== selectedClubFilter) {
        return false;
      }
      // Filtro por Género
      if (genderFilter !== "all" && row.gender !== genderFilter) {
        return false;
      }
      // Filtro por Categoría
      if (categoryFilter !== "all" && row.category !== categoryFilter) {
        return false;
      }
      // Búsqueda por texto (nombre atleta, ID federación o club)
      if (q) {
        const matchesName = row.fullName.toLowerCase().includes(q);
        const matchesClub =
          row.clubCode.toLowerCase().includes(q) || row.clubName.toLowerCase().includes(q);
        const matchesFed = row.federationId.toLowerCase().includes(q);
        if (!matchesName && !matchesClub && !matchesFed) return false;
      }

      return true;
    });
  }, [enrichedRows, selectedClubFilter, genderFilter, categoryFilter, searchQuery]);

  // Club seleccionado para la ficha detallada
  const activeSelectedClub = useMemo(() => {
    if (selectedClubFilter === "all") return null;
    return clubsCatalog.find((c) => c.code === selectedClubFilter) || null;
  }, [selectedClubFilter, clubsCatalog]);

  // Exportar la lista filtrada a CSV
  const handleExportCsv = () => {
    if (!filteredAthletes.length) return;
    const headers = [
      "Club Código",
      "Club Nombre",
      "Asociación",
      "Atleta",
      "Sexo",
      "Nacimiento",
      "Edad al 31/12",
      "Categoría FEVEDA",
      "ID Federación",
      "Pruebas / Marcas",
    ];
    const rows = filteredAthletes.map((a) => [
      a.clubCode,
      `"${a.clubName}"`,
      `"${a.lsc}"`,
      `"${a.fullName}"`,
      a.gender,
      a.birthDate,
      a.age,
      `"${a.category}"`,
      a.federationId,
      `"${a.allEntries.join(" | ")}"`,
    ]);

    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `roster_equipos_${selectedClubFilter}_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  return (
    <div className="space-y-6">
      {/* 1. ENCABEZADO Y TARJETAS KPI GENERALES */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            Directorio de Equipos y Atletas por Club
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulta la base de datos de cada club para saber con exactitud qué atletas representan a cada equipo en las
            competencias y sus inscripciones.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="outline" size="sm" className="gap-1.5 text-xs h-8">
            <Link to="/import">
              <Layers className="h-3.5 w-3.5 text-primary" />
              Importar Entry Lists
            </Link>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={!filteredAthletes.length}
            className="gap-1.5 text-xs h-8"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            Exportar CSV
          </Button>
        </div>
      </div>

      {/* 2. BARRA DE FILTROS SUPERIOR */}
      <div className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-4">
        {/* Selector de Club */}
        <div className="space-y-1 sm:col-span-1">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Building2 className="h-3.5 w-3.5 text-primary" />
            Equipo / Club Representado
          </label>
          <Select value={selectedClubFilter} onValueChange={setSelectedClubFilter}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue placeholder="Todos los equipos" />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              <SelectItem value="all">
                🌐 Todos los Equipos ({athletes.length} atletas)
              </SelectItem>
              {clubsCatalog.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} · {c.name} ({c.athleteCount})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Buscador de Atleta */}
        <div className="space-y-1 sm:col-span-1">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Search className="h-3.5 w-3.5 text-primary" />
            Buscar Nadador / ID
          </label>
          <div className="relative">
            <Input
              placeholder="Ej. Perez, Carlos, V-1234..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="text-xs h-9"
            />
          </div>
        </div>

        {/* Filtro de Categoría FEVEDA */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            Categoría FEVEDA
          </label>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las Categorías</SelectItem>
              <SelectItem value="Pre-Infantil">Pre-Infantil (7-9 años)</SelectItem>
              <SelectItem value="Infantil A">Infantil A (10-11 años)</SelectItem>
              <SelectItem value="Infantil B">Infantil B (12-13 años)</SelectItem>
              <SelectItem value="Juvenil A">Juvenil A (14-15 años)</SelectItem>
              <SelectItem value="Juvenil B">Juvenil B (16-18 años)</SelectItem>
              <SelectItem value="Máxima">Máxima (19+ años)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Filtro de Género */}
        <div className="space-y-1">
          <label className="text-xs font-semibold text-muted-foreground">Género</label>
          <Select value={genderFilter} onValueChange={setGenderFilter}>
            <SelectTrigger className="text-xs h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los Géneros</SelectItem>
              <SelectItem value="M">Masculino (M)</SelectItem>
              <SelectItem value="F">Femenino (F)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 3. FICHA DETALLADA DEL CLUB SELECCIONADO (Si se eligió un club específico) */}
      {activeSelectedClub && (
        <Card className="border-2 border-primary/30 bg-primary/5 shadow-sm animate-in fade-in-50 duration-200">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-mono font-extrabold text-lg shadow-sm">
                  {activeSelectedClub.code}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-bold text-foreground">{activeSelectedClub.name}</h3>
                    <Badge variant="outline" className="border-primary/40 text-primary font-semibold text-xs">
                      {activeSelectedClub.lsc} · {activeSelectedClub.state}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Base de datos oficial del club · Representación en torneos estadales y nacionales FEVEDA
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="rounded-lg border bg-card px-3 py-1.5 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Total Atletas</span>
                  <p className="font-mono text-xl font-bold text-primary">{activeSelectedClub.athleteCount}</p>
                </div>
                <div className="rounded-lg border bg-card px-3 py-1.5 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Masculino</span>
                  <p className="font-mono text-xl font-bold text-sky-600 dark:text-sky-400">
                    {activeSelectedClub.maleCount}
                  </p>
                </div>
                <div className="rounded-lg border bg-card px-3 py-1.5 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase font-semibold">Femenino</span>
                  <p className="font-mono text-xl font-bold text-rose-600 dark:text-rose-400">
                    {activeSelectedClub.femaleCount}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. TABLA INTERACTIVA DE ATLETAS POR CLUB */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            Mostrando <strong className="text-foreground">{filteredAthletes.length}</strong> atletas
            {selectedClubFilter !== "all" && ` de ${selectedClubFilter}`}
          </span>
          {activeClubCode && (
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Filas con borde resaltado = Mi Club ({activeClubCode})
            </span>
          )}
        </div>

        <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
          <table className="w-full text-left text-xs">
            <thead className="border-b bg-muted/60 text-muted-foreground font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="px-3 py-3">Atleta</th>
                <th className="px-3 py-3">Club Representado</th>
                <th className="px-2 py-3 text-center">Sexo</th>
                <th className="px-3 py-3 text-center">Nacimiento</th>
                <th className="px-2 py-3 text-center">Edad 31/12</th>
                <th className="px-3 py-3">Categoría</th>
                <th className="px-3 py-3">Pruebas Inscritas / Entry List</th>
                <th className="px-3 py-3 text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredAthletes.length > 0 ? (
                filteredAthletes.map((ath) => (
                  <tr
                    key={ath.id}
                    className={`transition-colors hover:bg-muted/40 ${
                      ath.isMyClub ? "bg-primary/5 font-medium border-l-4 border-l-primary" : ""
                    }`}
                  >
                    {/* Atleta */}
                    <td className="px-3 py-2.5 font-medium text-foreground">
                      <Link
                        to="/athletes/$id"
                        params={{ id: ath.id }}
                        className="text-primary hover:underline font-semibold"
                      >
                        {ath.fullName}
                      </Link>
                      {ath.federationId !== "—" && (
                        <span className="block text-[10px] font-mono text-muted-foreground">
                          ID: {ath.federationId}
                        </span>
                      )}
                    </td>

                    {/* Club */}
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        <Badge
                          variant={ath.isMyClub ? "default" : "outline"}
                          className={`font-mono text-[10px] px-1.5 py-0 ${
                            ath.isMyClub ? "bg-primary text-primary-foreground font-bold" : ""
                          }`}
                        >
                          {ath.clubCode}
                        </Badge>
                        <span className="truncate max-w-[150px] text-muted-foreground text-[11px]">
                          {ath.clubName}
                        </span>
                      </div>
                    </td>

                    {/* Sexo */}
                    <td className="px-2 py-2.5 text-center">
                      <span
                        className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-bold ${
                          ath.gender === "M"
                            ? "bg-sky-500/10 text-sky-700 dark:text-sky-300"
                            : "bg-rose-500/10 text-rose-700 dark:text-rose-300"
                        }`}
                      >
                        {ath.gender}
                      </span>
                    </td>

                    {/* Fecha Nacimiento */}
                    <td className="px-3 py-2.5 text-center font-mono text-muted-foreground">
                      {ath.birthDate}
                    </td>

                    {/* Edad al 31/12 */}
                    <td className="px-2 py-2.5 text-center font-mono font-bold text-foreground">
                      {ath.age}
                    </td>

                    {/* Categoría */}
                    <td className="px-3 py-2.5">
                      <span className="rounded bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                        {ath.category}
                      </span>
                    </td>

                    {/* Pruebas / Entry List */}
                    <td className="px-3 py-2.5">
                      {ath.entriesCount > 0 ? (
                        <div className="space-y-0.5 max-w-[240px]">
                          <span className="text-[11px] text-foreground truncate block font-medium">
                            {ath.entriesSample}
                          </span>
                          {ath.entriesCount > 3 && (
                            <span className="text-[10px] text-primary font-semibold">
                              +{ath.entriesCount - 3} pruebas más
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-[11px]">Sin pruebas registradas</span>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-3 py-2.5 text-center">
                      <Badge
                        variant="secondary"
                        className={`text-[10px] py-0 ${
                          ath.isActive
                            ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {ath.isActive ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-muted-foreground">
                    No se encontraron atletas con los filtros seleccionados.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
