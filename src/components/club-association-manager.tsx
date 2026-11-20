import { useState } from "react";
import { Building2, Save, Search, ShieldCheck } from "lucide-react";
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
import type { DetectedClub } from "@/lib/association-ranking";

const COMMON_ASSOCIATIONS = [
  "Miranda (ADAEL)",
  "Distrito Capital (ASDAC)",
  "Carabobo (ASODENA)",
  "Aragua (ASODEA)",
  "Lara (ADAL)",
  "Zulia (AZUDA)",
  "Bolívar",
  "Anzoátegui",
  "Táchira",
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
    const newAssoc = (associations[club.id] ?? "").trim();
    setSavingId(club.id);

    try {
      if (club.isClub) {
        const { error } = await supabase
          .from("clubs")
          .update({ region_lsc: newAssoc || null })
          .eq("id", club.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("teams")
          .update({ lsc: newAssoc || null })
          .eq("id", club.id);
        if (error) throw error;
      }

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coach-data"] }),
        queryClient.invalidateQueries({ queryKey: ["club-management"] }),
      ]);

      toast.success(`Asociación actualizada para ${club.name} (${club.code})`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al actualizar la asociación");
    } finally {
      setSavingId(null);
    }
  };

  const filteredClubs = clubs.filter(
    (c) =>
      c.code.toLowerCase().includes(search.toLowerCase()) ||
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.association.toLowerCase().includes(search.toLowerCase())
  );

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

      <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <DialogTitle>Registro de Clubes y Asociaciones Afiliadas</DialogTitle>
          </div>
          <DialogDescription>
            Clasifica la asociación a la cual pertenece cada club detectado en los resultados importados. Esta asignación agrupa correctamente a los nadadores en el Ranking Oficial.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Buscar club por nombre, código o asociación..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <div className="rounded-md border divide-y max-h-96 overflow-y-auto">
            {filteredClubs.length === 0 ? (
              <p className="p-4 text-sm text-center text-muted-foreground">
                No se encontraron clubes con el criterio de búsqueda.
              </p>
            ) : (
              filteredClubs.map((club) => {
                const currentVal = associations[club.id] ?? (club.association === "Sin Asociación" ? "" : club.association);
                const hasChanged = currentVal.trim() !== (club.association === "Sin Asociación" ? "" : club.association).trim();

                return (
                  <div key={club.id} className="p-3 sm:p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-card hover:bg-muted/40 transition-colors">
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
                        <span className={club.association === "Sin Asociación" ? "text-amber-500 font-medium" : "text-primary"}>
                          {club.association}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="flex-1 sm:w-64 space-y-1">
                        <Input
                          placeholder="Escribe la asociación (ej. Miranda / ADAEL)"
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
            <strong className="text-foreground">Consejo:</strong> Si un club no tiene asociación asignada, puedes escribir el nombre de su asociación o seleccionar una de las sugerencias predefinidas. Al pulsar «Guardar», todas las marcas de sus atletas se clasificarán instantáneamente en el Ranking.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
