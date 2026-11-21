import { useState, useMemo } from "react";
import { Building2, CheckCheck, Copy, ExternalLink, HelpCircle, Layers, Plus, Save, Search, ShieldCheck, Sparkles, Trophy } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { extractAdaelClubs, isLikelyAdaelClub, type DetectedClub } from "@/lib/association-ranking";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function AdaelTeamExtractor({
  clubs,
  onSelectAdael,
  triggerButton,
}: {
  clubs: DetectedClub[];
  onSelectAdael?: () => void;
  triggerButton?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [selectedToAssign, setSelectedToAssign] = useState<string>("");

  const queryClient = useQueryClient();

  // Extract affiliated and candidates for ADAEL
  const { affiliated, candidates } = useMemo(() => {
    return extractAdaelClubs(clubs);
  }, [clubs]);

  // Filtered affiliated list
  const filteredAffiliated = useMemo(() => {
    return affiliated.filter(
      (c) =>
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase())
    );
  }, [affiliated, search]);

  // Unaffiliated clubs available to manually assign
  const nonAdaelClubs = useMemo(() => {
    return clubs.filter(
      (c) => c.association.toLowerCase() !== "lara (adael)"
    );
  }, [clubs]);

  // Assign a club to ADAEL
  const handleAssignToAdael = async (club: DetectedClub) => {
    setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        throw new Error("Debes iniciar sesión para guardar.");
      }

      if (club.isClub && UUID_REGEX.test(club.id)) {
        await supabase.from("clubs").update({ region_lsc: "Lara (ADAEL)" }).eq("id", club.id);
      }

      const { error: teamError } = await supabase.from("teams").upsert(
        {
          owner_id: auth.user.id,
          code: club.code,
          name: club.name || club.code,
          lsc: "Lara (ADAEL)",
        },
        { onConflict: "owner_id,code" }
      );

      if (teamError) throw teamError;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coach-data"] }),
        queryClient.invalidateQueries({ queryKey: ["club-management"] }),
      ]);

      toast.success(`Club ${club.code} (${club.name}) vinculado a ADAEL (Lara) con éxito.`);
      setSelectedToAssign("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al vincular el club a ADAEL.");
    } finally {
      setSaving(false);
    }
  };

  // Assign all candidates to ADAEL with 1 click
  const handleAssignAllCandidates = async () => {
    if (candidates.length === 0) return;
    setSaving(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        throw new Error("Debes iniciar sesión para guardar.");
      }

      for (const club of candidates) {
        if (club.isClub && UUID_REGEX.test(club.id)) {
          await supabase.from("clubs").update({ region_lsc: "Lara (ADAEL)" }).eq("id", club.id);
        }
        await supabase.from("teams").upsert(
          {
            owner_id: auth.user.id,
            code: club.code,
            name: club.name || club.code,
            lsc: "Lara (ADAEL)",
          },
          { onConflict: "owner_id,code" }
        );
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coach-data"] }),
        queryClient.invalidateQueries({ queryKey: ["club-management"] }),
      ]);

      toast.success(`${candidates.length} equipos vinculados a ADAEL (Lara) correctamente.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al vincular equipos.");
    } finally {
      setSaving(false);
    }
  };

  // Copy extracted ADAEL teams roster to clipboard
  const handleCopyRoster = () => {
    if (affiliated.length === 0) {
      toast.info("No hay equipos vinculados a ADAEL para copiar.");
      return;
    }
    const lines = [
      "EQUIPOS AFILIADOS A ADAEL (ASOCIACIÓN DE DEPORTES ACUÁTICOS DEL ESTADO LARA)",
      `Total de clubes extraídos: ${affiliated.length}`,
      "-----------------------------------------------------------------",
      ...affiliated.map(
        (c, idx) =>
          `${idx + 1}. [${c.code}] ${c.name} — ${c.athleteCount} atletas, ${c.resultsCount} marcas (Temporadas: ${
            c.affiliationYears?.join(", ") || "En curso"
          })`
      ),
      "-----------------------------------------------------------------",
      `Fecha de extracción: ${new Date().toLocaleDateString("es-VE")}`,
    ];
    navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Listado de clubes de ADAEL copiado al portapapeles.");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" className="gap-2 border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-foreground">
            <ShieldCheck className="size-4 text-amber-500" />
            <span>Extraer Equipos ADAEL</span>
            <Badge variant="secondary" className="text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300 font-mono">
              {affiliated.length}
            </Badge>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-amber-500" />
            <DialogTitle>Extracción y Clasificación de Equipos ADAEL (Lara)</DialogTitle>
          </div>
          <DialogDescription>
            Detecta, clasifica y gestiona todos los clubes pertenecientes a la Asociación de Deportes Acuáticos del Estado Lara (ADAEL) a partir de los resultados importados.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Quick Overview Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg border bg-card p-3 space-y-1">
              <span className="text-xs text-muted-foreground">Equipos extraídos en ADAEL</span>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 font-mono">
                {affiliated.length}
              </p>
              <span className="text-[11px] text-muted-foreground">Oficialmente clasificados</span>
            </div>

            <div className="rounded-lg border bg-card p-3 space-y-1">
              <span className="text-xs text-muted-foreground">Atletas de Lara detectados</span>
              <p className="text-2xl font-bold font-mono">
                {affiliated.reduce((acc, c) => acc + c.athleteCount, 0)}
              </p>
              <span className="text-[11px] text-muted-foreground">En clubes de ADAEL</span>
            </div>

            <div className="rounded-lg border bg-card p-3 space-y-1">
              <span className="text-xs text-muted-foreground">Marcas importadas</span>
              <p className="text-2xl font-bold font-mono">
                {affiliated.reduce((acc, c) => acc + c.resultsCount, 0)}
              </p>
              <span className="text-[11px] text-muted-foreground">Disponibles para el ranking</span>
            </div>
          </div>

          {/* Candidates detection banner */}
          {candidates.length > 0 && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3.5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-300">
                    <Sparkles className="size-4 text-amber-500 shrink-0" />
                    <span>Se detectaron {candidates.length} equipos con alta probabilidad de pertenecer a ADAEL</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Clubes detectados en los resultados importados con nombres o códigos correspondientes al Estado Lara (Piscinas Bolivarianas, Hogar Hispano, Centro Bicentenario, etc.):
                  </p>
                </div>
                <Button
                  size="sm"
                  disabled={saving}
                  onClick={handleAssignAllCandidates}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs h-8 shrink-0 gap-1.5 shadow-xs"
                >
                  <CheckCheck className="size-3.5" />
                  Vincular todos a ADAEL
                </Button>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                {candidates.map((c) => (
                  <Badge
                    key={c.id}
                    variant="outline"
                    className="bg-background text-xs py-1 px-2.5 flex items-center gap-1.5 border-amber-500/30"
                  >
                    <span className="font-mono font-bold text-amber-600">{c.code}</span>
                    <span>{c.name}</span>
                    <span className="text-[10px] text-muted-foreground">({c.athleteCount} atletas)</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={saving}
                      onClick={() => handleAssignToAdael(c)}
                      className="size-5 p-0 hover:bg-amber-500/20 rounded-full ml-1"
                      title="Vincular a ADAEL"
                    >
                      <Plus className="size-3 text-amber-600" />
                    </Button>
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Manual addition of another detected club */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 p-3 rounded-lg border bg-muted/30">
            <div className="flex-1 space-y-0.5">
              <label htmlFor="add-team-adael-select" className="text-xs font-semibold flex items-center gap-1.5">
                <Plus className="size-3.5 text-primary" />
                <span>¿Deseas agregar otro club a ADAEL?</span>
              </label>
              <p className="text-[11px] text-muted-foreground">
                Selecciona cualquier club detectado en los resultados para clasificarlo en ADAEL
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                id="add-team-adael-select"
                aria-label="Seleccionar club para asignar a ADAEL"
                value={selectedToAssign}
                onChange={(e) => setSelectedToAssign(e.target.value)}
                className="h-8 rounded border bg-background px-2 text-xs w-56 truncate"
              >
                <option value="">Seleccionar club...</option>
                {nonAdaelClubs.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} - {c.name} ({c.association})
                  </option>
                ))}
              </select>

              <Button
                size="sm"
                disabled={!selectedToAssign || saving}
                onClick={() => {
                  const target = clubs.find((c) => c.id === selectedToAssign);
                  if (target) handleAssignToAdael(target);
                }}
                className="h-8 text-xs shrink-0"
              >
                Asignar
              </Button>
            </div>
          </div>

          {/* List of currently extracted ADAEL teams */}
          <div className="space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar entre los clubes de ADAEL..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-xs"
                />
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="outline" onClick={handleCopyRoster} className="h-9 text-xs gap-1.5">
                  <Copy className="size-3.5" />
                  Copiar Listado
                </Button>

                {onSelectAdael && (
                  <Button
                    size="sm"
                    onClick={() => {
                      onSelectAdael();
                      setOpen(false);
                    }}
                    className="h-9 text-xs gap-1.5 bg-amber-600 hover:bg-amber-700 text-white font-medium"
                  >
                    <Trophy className="size-3.5" />
                    Ver Ranking de ADAEL
                  </Button>
                )}
              </div>
            </div>

            <div className="rounded-md border divide-y max-h-72 overflow-y-auto">
              {filteredAffiliated.length === 0 ? (
                <div className="p-6 text-center text-xs text-muted-foreground space-y-2">
                  <Building2 className="size-8 mx-auto text-muted-foreground/60" />
                  <p className="font-medium text-foreground">No se encontraron clubes asignados a ADAEL</p>
                  <p>
                    Importa resultados de torneos o selecciona clubes arriba para vincularlos a la asociación de Lara.
                  </p>
                </div>
              ) : (
                filteredAffiliated.map((club) => (
                  <div
                    key={club.id}
                    className="p-3 flex items-center justify-between gap-3 bg-card hover:bg-muted/30 transition-colors"
                  >
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono font-bold text-amber-600 text-xs">
                          {club.code}
                        </Badge>
                        <span className="font-semibold text-xs truncate">{club.name}</span>
                        <Badge variant="secondary" className="text-[10px] bg-amber-500/10 text-amber-700 dark:text-amber-300">
                          ADAEL Oficial
                        </Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{club.athleteCount} atletas</span>
                        <span>•</span>
                        <span>{club.resultsCount} marcas</span>
                        {club.affiliationYears && club.affiliationYears.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <span>Temporadas:</span>
                              {club.affiliationYears.map((yr) => (
                                <Badge key={yr} variant="outline" className="text-[9px] px-1 py-0 h-3.5 font-mono">
                                  {yr}
                                </Badge>
                              ))}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Badge variant="outline" className="text-[10px] text-success border-success/30 font-medium">
                        Afiliado Activo
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}