import { useState, useMemo } from "react";
import { Building2, Check, CheckSquare, Filter, Layers, Plus, Save, Search, ShieldCheck, Sparkles, Trash2, Users, X } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FEDERATIONS } from "@/lib/federations";
import { normalizeAssociationName, type DetectedClub } from "@/lib/association-ranking";

export function CustomClubRankingSelectorModal({
  clubs,
  selectedClubCodes,
  onSelectionChange,
  triggerButton,
}: {
  clubs: DetectedClub[];
  selectedClubCodes: string[] | "all";
  onSelectionChange: (codes: string[] | "all") => void;
  triggerButton?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [assocFilter, setAssocFilter] = useState<string>("all");
  const [addClubOpen, setAddClubOpen] = useState(false);

  // New club manual entry state
  const [newCode, setNewCode] = useState("");
  const [newName, setNewName] = useState("");
  const [newAssoc, setNewAssoc] = useState("Lara (ADAEL)");
  const [savingNewClub, setSavingNewClub] = useState(false);

  // Local drafted selection
  const [draftSelected, setDraftSelected] = useState<string[]>(() => {
    return selectedClubCodes === "all" ? clubs.map((c) => c.code) : selectedClubCodes;
  });

  const queryClient = useQueryClient();

  const handleOpen = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraftSelected(selectedClubCodes === "all" ? clubs.map((c) => c.code) : selectedClubCodes);
      setAddClubOpen(false);
    }
    setOpen(nextOpen);
  };

  // Distinct associations among detected clubs
  const distinctAssociations = useMemo(() => {
    const set = new Set<string>();
    clubs.forEach((c) => {
      if (c.association && c.association !== "Sin Asociación") {
        set.add(c.association);
      }
    });
    return [...set].sort();
  }, [clubs]);

  // Filtered clubs by search & association
  const filteredClubs = useMemo(() => {
    const q = search.toLowerCase().trim();
    return clubs.filter((c) => {
      if (assocFilter !== "all" && c.association.toLowerCase() !== assocFilter.toLowerCase()) {
        return false;
      }
      if (!q) return true;
      return (
        c.code.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.association.toLowerCase().includes(q)
      );
    });
  }, [clubs, search, assocFilter]);

  const isAllSelected = draftSelected.length === clubs.length;

  const handleToggleClub = (code: string) => {
    const upper = code.toUpperCase().trim();
    if (draftSelected.includes(upper)) {
      setDraftSelected(draftSelected.filter((c) => c !== upper));
    } else {
      setDraftSelected([...draftSelected, upper]);
    }
  };

  const handleSelectAll = () => {
    setDraftSelected(clubs.map((c) => c.code.toUpperCase()));
  };

  const handleClearSelection = () => {
    setDraftSelected([]);
  };

  const handleSelectByAssoc = (assocName: string) => {
    const codesInAssoc = clubs
      .filter((c) => c.association.toLowerCase() === assocName.toLowerCase())
      .map((c) => c.code.toUpperCase());
    const union = new Set([...draftSelected, ...codesInAssoc]);
    setDraftSelected([...union]);
    toast.success(`Se seleccionaron ${codesInAssoc.length} clubes de ${assocName}.`);
  };

  const handleApply = () => {
    if (draftSelected.length === 0) {
      toast.warning("Debes seleccionar al menos un club para formar el ranking.");
      return;
    }
    if (draftSelected.length === clubs.length) {
      onSelectionChange("all");
      toast.success("Se restableció el ranking a todos los clubes.");
    } else {
      onSelectionChange(draftSelected);
      toast.success(`Ranking configurado con ${draftSelected.length} clubes seleccionados.`);
    }
    setOpen(false);
  };

  // Save manual new club into Supabase 'teams' table
  const handleSaveNewClub = async () => {
    const cleanCode = newCode.trim().toUpperCase();
    const cleanName = newName.trim();
    if (!cleanCode) {
      toast.error("El código del club es obligatorio (ej. PIS, CPMI, SVD).");
      return;
    }

    setSavingNewClub(true);
    try {
      const { data: auth, error: authErr } = await supabase.auth.getUser();
      if (authErr || !auth.user) {
        throw new Error("Debes iniciar sesión para registrar equipos.");
      }

      const lscValue = normalizeAssociationName(newAssoc);

      const { error: teamErr } = await supabase.from("teams").upsert(
        {
          owner_id: auth.user.id,
          code: cleanCode,
          name: cleanName || cleanCode,
          lsc: lscValue === "Sin Asociación" ? null : lscValue,
        },
        { onConflict: "owner_id,code" }
      );

      if (teamErr) throw teamErr;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coach-data"] }),
        queryClient.invalidateQueries({ queryKey: ["club-management"] }),
      ]);

      // Automatically add to draft selection
      if (!draftSelected.includes(cleanCode)) {
        setDraftSelected([...draftSelected, cleanCode]);
      }

      toast.success(`Club ${cleanCode} (${cleanName || cleanCode}) registrado correctamente.`);
      setNewCode("");
      setNewName("");
      setAddClubOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar club manual.");
    } finally {
      setSavingNewClub(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {triggerButton || (
          <Button variant="outline" className="gap-2">
            <Building2 className="size-4 text-primary" />
            <span>Clubes del Ranking</span>
            {selectedClubCodes !== "all" && (
              <Badge variant="secondary" className="text-[10px] bg-primary/20 text-primary font-mono ml-1">
                {selectedClubCodes.length}
              </Badge>
            )}
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Building2 className="size-5 text-primary" />
            <DialogTitle>Seleccionar y Añadir Clubes para el Ranking</DialogTitle>
          </div>
          <DialogDescription>
            Elige qué clubes formarán parte del ranking estadal o añade nuevos equipos manualmente.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Top Quick Actions Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-muted/40">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-foreground">
                Clubes Seleccionados:
              </span>
              <Badge variant={draftSelected.length > 0 ? "default" : "secondary"} className="font-mono text-xs">
                {draftSelected.length} de {clubs.length} clubes
              </Badge>
              {draftSelected.length < clubs.length && (
                <span className="text-[11px] text-primary font-medium">
                  (Ranking Personalizado)
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <Button size="sm" variant="ghost" onClick={handleSelectAll} className="h-7 text-xs">
                Seleccionar Todos
              </Button>
              <Button size="sm" variant="ghost" onClick={handleClearSelection} className="h-7 text-xs text-muted-foreground">
                Deseleccionar
              </Button>
              <Button
                size="sm"
                variant={addClubOpen ? "secondary" : "default"}
                onClick={() => setAddClubOpen(!addClubOpen)}
                className="h-7 text-xs gap-1"
              >
                <Plus className="size-3.5" />
                <span>Añadir Club Manual</span>
              </Button>
            </div>
          </div>

          {/* Form to manually add a new club */}
          {addClubOpen && (
            <div className="p-3.5 rounded-lg border border-primary/30 bg-primary/5 space-y-3 animate-in fade-in-50">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Plus className="size-4 text-primary" />
                  <span>Añadir Nuevo Equipo al Padrón de Ranking:</span>
                </span>
                <Button size="sm" variant="ghost" onClick={() => setAddClubOpen(false)} className="size-6 p-0">
                  <X className="size-4" />
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Código de Club *</label>
                  <Input
                    placeholder="Ej: PIS, CPMI, SVD"
                    value={newCode}
                    onChange={(e) => setNewCode(e.target.value.toUpperCase())}
                    className="h-8 text-xs font-mono uppercase"
                    maxLength={10}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Nombre del Club</label>
                  <Input
                    placeholder="Ej: Club Piscinas Bolivarianas"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground">Asociación / Estado</label>
                  <Select value={newAssoc} onValueChange={setNewAssoc}>
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-52">
                      {FEDERATIONS.flatMap((f) => f.associations).map((assoc) => (
                        <SelectItem key={assoc} value={assoc}>
                          {assoc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <Button size="sm" variant="outline" onClick={() => setAddClubOpen(false)} className="h-7 text-xs">
                  Cancelar
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveNewClub}
                  disabled={savingNewClub || !newCode.trim()}
                  className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
                >
                  <Save className="size-3.5" />
                  <span>Guardar y Añadir</span>
                </Button>
              </div>
            </div>
          )}

          {/* Search & Association Filter Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2 size-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar club por código, nombre o asociación..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>

            <div className="w-full sm:w-56 shrink-0">
              <Select value={assocFilter} onValueChange={setAssocFilter}>
                <SelectTrigger className="h-8 text-xs" aria-label="Filtrar por asociación">
                  <SelectValue placeholder="Todas las asociaciones" />
                </SelectTrigger>
                <SelectContent className="max-h-52">
                  <SelectItem value="all">Todas las asociaciones</SelectItem>
                  {distinctAssociations.map((assoc) => (
                    <SelectItem key={assoc} value={assoc}>
                      {assoc}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick Association Shortcut Pills */}
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="text-[11px] text-muted-foreground mr-1">Atajo rápido:</span>
            {distinctAssociations.slice(0, 5).map((assoc) => (
              <Badge
                key={assoc}
                variant="outline"
                onClick={() => handleSelectByAssoc(assoc)}
                className="cursor-pointer hover:bg-primary/10 hover:border-primary text-[10px] py-0.5"
                title={`Añadir todos los clubes de ${assoc}`}
              >
                + {assoc.split("(")[0].trim()}
              </Badge>
            ))}
          </div>

          {/* Clubs Selection Grid */}
          <div className="rounded-md border divide-y max-h-72 overflow-y-auto">
            {filteredClubs.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground space-y-2">
                <Building2 className="size-8 mx-auto text-muted-foreground/60" />
                <p className="font-semibold text-foreground">No se encontraron clubes</p>
                <p>Prueba con otro término de búsqueda o añade un nuevo club arriba.</p>
              </div>
            ) : (
              filteredClubs.map((club) => {
                const isChecked = draftSelected.includes(club.code.toUpperCase());
                return (
                  <div
                    key={club.id || club.code}
                    onClick={() => handleToggleClub(club.code)}
                    className={`p-2.5 flex items-center justify-between gap-3 cursor-pointer transition-colors text-xs ${
                      isChecked ? "bg-primary/5 hover:bg-primary/10" : "hover:bg-muted/30"
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="size-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                      />
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary">{club.code}</span>
                          <span className="font-semibold text-foreground truncate">{club.name}</span>
                          {club.association && (
                            <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                              {club.association}
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          {club.athleteCount} atletas · {club.resultsCount} marcas
                          {club.affiliationYears && club.affiliationYears.length > 0
                            ? ` · Temporadas: ${club.affiliationYears.join(", ")}`
                            : ""}
                        </p>
                      </div>
                    </div>

                    <Badge
                      variant={isChecked ? "default" : "secondary"}
                      className="text-[10px] font-mono shrink-0"
                    >
                      {isChecked ? "En Ranking" : "Excluido"}
                    </Badge>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t">
            <span className="text-xs text-muted-foreground">
              {draftSelected.length} {draftSelected.length === 1 ? "club seleccionado" : "clubes seleccionados"} para el ranking
            </span>

            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button size="sm" onClick={handleApply} className="bg-primary text-primary-foreground font-semibold">
                Aplicar Selección al Ranking
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
