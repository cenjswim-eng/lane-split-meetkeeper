import { useState, useMemo } from "react";
import { Building2, CheckCheck, Save, Search, ShieldCheck, Sparkles } from "lucide-react";
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
import { type DetectedClub, normalizeAssociationName } from "@/lib/association-ranking";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const COMMON_ASSOCIATIONS = [
  "Lara (ADAEL)",
  "Miranda (ADAEM)",
  "Táchira (ADAET)",
  "Mérida (ASODAME)",
  "Distrito Capital (ASDAC)",
  "Carabobo (ASODENA)",
  "Aragua (ASODEA)",
  "Zulia (AZUDA)",
  "Bolívar (ADEABOL)",
  "Anzoátegui (ASOEDA)",
  "Nueva Esparta (ASODAN)",
];

export function ClubAssociationManager({
  clubs,
  triggerButton,
}: {
  clubs: DetectedClub[];
  triggerButton?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [associations, setAssociations] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const queryClient = useQueryClient();

  const handleOpen = () => {
    const initial: Record<string, string> = {};
    clubs.forEach((c) => {
      initial[c.id] = c.association === "Sin Asociación" ? "" : c.association;
    });
    setAssociations(initial);
    setOpen(true);
  };

  const handleSaveAssociation = async (club: DetectedClub) => {
    const rawVal = (associations[club.id] ?? "").trim();
    const newAssoc = normalizeAssociationName(rawVal);
    const lscValue = newAssoc === "Sin Asociación" ? null : newAssoc;
    setSavingId(club.id);

    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        throw new Error("Debes iniciar sesión para guardar.");
      }

      // 1. If it's a registered club in 'clubs' with a valid UUID
      if (club.isClub && UUID_REGEX.test(club.id)) {
        await supabase
          .from("clubs")
          .update({ region_lsc: lscValue })
          .eq("id", club.id);
      }

      // 2. Persist in 'teams' table by (owner_id, code) - matches all imported meet swimmers!
      const { error: teamError } = await supabase
        .from("teams")
        .upsert(
          {
            owner_id: auth.user.id,
            code: club.code,
            name: club.name || club.code,
            lsc: lscValue,
          },
          { onConflict: "owner_id,code" }
        );

      if (teamError) throw teamError;

      // Update local state to the normalized name
      setAssociations((prev) => ({
        ...prev,
        [club.id]: newAssoc === "Sin Asociación" ? "" : newAssoc,
      }));

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coach-data"] }),
        queryClient.invalidateQueries({ queryKey: ["club-management"] }),
      ]);

      toast.success(`Asociación asignada a ${club.name} (${club.code}): ${newAssoc}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar la asociación");
    } finally {
      setSavingId(null);
    }
  };

  const handleSaveAll = async () => {
    setSavingAll(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError || !auth.user) {
        throw new Error("Debes iniciar sesión para guardar.");
      }

      const changedClubs = clubs.filter((c) => {
        const currentRaw = (associations[c.id] ?? "").trim();
        const currentNorm = normalizeAssociationName(currentRaw);
        return currentNorm !== c.association;
      });

      if (changedClubs.length === 0) {
        toast.info("No hay cambios pendientes de asociación por guardar.");
        return;
      }

      for (const club of changedClubs) {
        const rawVal = (associations[club.id] ?? "").trim();
        const newAssoc = normalizeAssociationName(rawVal);
        const lscValue = newAssoc === "Sin Asociación" ? null : newAssoc;

        if (club.isClub && UUID_REGEX.test(club.id)) {
          await supabase.from("clubs").update({ region_lsc: lscValue }).eq("id", club.id);
        }

        await supabase.from("teams").upsert(
          {
            owner_id: auth.user.id,
            code: club.code,
            name: club.name || club.code,
            lsc: lscValue,
          },
          { onConflict: "owner_id,code" }
        );
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coach-data"] }),
        queryClient.invalidateQueries({ queryKey: ["club-management"] }),
      ]);

      toast.success(`${changedClubs.length} clubes actualizados con éxito.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al guardar los clubes.");
    } finally {
      setSavingAll(false);
    }
  };

  const handleAssignAllShown = (assocName: string) => {
    const updated = { ...associations };
    filteredClubs.forEach((c) => {
      updated[c.id] = assocName;
    });
    setAssociations(updated);
    toast.info(
      `Se asignó "${assocName}" a los ${filteredClubs.length} clubes filtrados. Pulsa «Guardar Todos los Cambios» para confirmar.`
    );
  };

  const filteredClubs = useMemo(() => {
    return clubs.filter(
      (c) =>
        c.code.toLowerCase().includes(search.toLowerCase()) ||
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.association.toLowerCase().includes(search.toLowerCase())
    );
  }, [clubs, search]);

  const pendingCount = useMemo(() => {
    return clubs.filter((c) => {
      const currentRaw = (associations[c.id] ?? "").trim();
      const currentNorm = normalizeAssociationName(currentRaw);
      return currentNorm !== c.association;
    }).length;
  }, [clubs, associations]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={handleOpen}>
        {triggerButton || (
          <Button variant="outline" className="gap-2">
            <Building2 className="size-4 text-primary" />
            Configurar Asociaciones de Clubes
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-h-[88dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <DialogTitle>Registro de Clubes y Asociaciones Afiliadas</DialogTitle>
          </div>
          <DialogDescription>
            Clasifica la asociación a la cual pertenece cada club detectado. Siglas oficiales: «ADAEL» (Lara), «ADAEM» (Miranda), «ADAET» (Táchira) y «ASODAME» (Mérida).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Quick batch assign actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-lg border bg-muted/40">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold flex items-center gap-1.5 text-foreground">
                <Sparkles className="size-3.5 text-primary" />
                Asignación rápida en lote:
              </span>
              <p className="text-[11px] text-muted-foreground">
                Asigna la asociación a los {filteredClubs.length} clubes mostrados con un clic
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-background"
                onClick={() => handleAssignAllShown("Lara (ADAEL)")}
              >
                + Lara (ADAEL)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-background"
                onClick={() => handleAssignAllShown("Miranda (ADAEM)")}
              >
                + Miranda (ADAEM)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-background"
                onClick={() => handleAssignAllShown("Táchira (ADAET)")}
              >
                + Táchira (ADAET)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-background"
                onClick={() => handleAssignAllShown("Mérida (ASODAME)")}
              >
                + Mérida (ASODAME)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-background"
                onClick={() => handleAssignAllShown("Distrito Capital (ASDAC)")}
              >
                + Dto. Capital (ASDAC)
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs bg-background"
                onClick={() => handleAssignAllShown("Carabobo (ASODENA)")}
              >
                + Carabobo (ASODENA)
              </Button>
            </div>
          </div>

          {/* Search bar and Save All button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar club por nombre, código o asociación..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>
            {pendingCount > 0 && (
              <Button
                size="sm"
                disabled={savingAll}
                onClick={handleSaveAll}
                className="gap-1.5 bg-primary font-semibold text-xs h-9 shrink-0"
              >
                <CheckCheck className="size-4" />
                Guardar Todos los Cambios ({pendingCount})
              </Button>
            )}
          </div>

          {/* Club list */}
          <div className="rounded-md border divide-y max-h-96 overflow-y-auto">
            {filteredClubs.length === 0 ? (
              <p className="p-4 text-sm text-center text-muted-foreground">
                No se encontraron clubes con el criterio de búsqueda.
              </p>
            ) : (
              filteredClubs.map((club) => {
                const currentVal = associations[club.id] ?? (club.association === "Sin Asociación" ? "" : club.association);
                const normalizedPreview = normalizeAssociationName(currentVal);
                const hasChanged = normalizedPreview !== club.association;

                return (
                  <div
                    key={club.id}
                    className="p-3 sm:p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono font-bold text-primary">
                          {club.code}
                        </Badge>
                        <span className="font-semibold text-sm truncate">{club.name}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{club.athleteCount} atletas</span>
                        <span>•</span>
                        <span>{club.resultsCount} marcas</span>
                        <span>•</span>
                        <span
                          className={
                            club.association === "Sin Asociación"
                              ? "text-amber-500 font-medium"
                              : "text-primary font-medium"
                          }
                        >
                          Actual: {club.association}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="flex-1 sm:w-64 space-y-1">
                        <Input
                          placeholder="Escribe la asociación (ej. ADAEL, ADAEM, ADAET)"
                          value={currentVal}
                          onChange={(e) =>
                            setAssociations((prev) => ({
                              ...prev,
                              [club.id]: e.target.value,
                            }))
                          }
                          className="h-9 text-xs"
                          list={`assoc-list-${club.id}`}
                        />
                        <datalist id={`assoc-list-${club.id}`}>
                          {COMMON_ASSOCIATIONS.map((assoc) => (
                            <option key={assoc} value={assoc} />
                          ))}
                        </datalist>
                        {hasChanged && normalizedPreview !== "Sin Asociación" && (
                          <p className="text-[10px] text-muted-foreground">
                            Se clasificará en: <strong className="text-primary">{normalizedPreview}</strong>
                          </p>
                        )}
                      </div>

                      <Button
                        size="sm"
                        disabled={savingId === club.id || !hasChanged}
                        onClick={() => handleSaveAssociation(club)}
                        className="h-9 px-3 gap-1 shrink-0"
                      >
                        <Save className="size-3.5" />
                        <span>Guardar</span>
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="rounded-lg bg-muted/60 p-3 text-xs text-muted-foreground leading-relaxed">
            <strong className="text-foreground">Consejo:</strong> «ADAEL» corresponde a Lara, «ADAEM» a Miranda, «ADAET» a Táchira y «ASODAME» a Mérida. Se unifican automáticamente con el nombre oficial del estado. También puedes pulsar los botones de asignación rápida para clasificar a los clubes mostrados y pulsar «Guardar Todos los Cambios».
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
