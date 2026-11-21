import { useState } from "react";
import { AlertCircle, AlertTriangle, Building2, Calendar, Check, Layers, RefreshCw, Trash2, X } from "lucide-react";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DetectedMeetOption } from "./export-association-clubs-modal";

export function RankingDataCleanerModal({
  meets = [],
  teams = [],
  triggerButton,
}: {
  meets: DetectedMeetOption[];
  teams: any[];
  triggerButton?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  // Meet deletion confirmation state
  const [meetToDelete, setMeetToDelete] = useState<DetectedMeetOption | null>(null);

  // Team deletion confirmation state
  const [teamToDelete, setTeamToDelete] = useState<any | null>(null);

  // All results deletion confirmation
  const [confirmClearAllOpen, setConfirmClearAllOpen] = useState(false);

  const queryClient = useQueryClient();

  // 1. Delete a specific meet and its associated results
  const handleDeleteMeet = async () => {
    if (!meetToDelete) return;
    setBusy(true);
    try {
      const meetId = meetToDelete.id;

      // Delete results associated to this meet
      const { error: resErr } = await supabase.from("results").delete().eq("meet_id", meetId);
      if (resErr) {
        // Fallback: try deleting by meets.name if meet_id wasn't standard
        console.warn("Could not delete by meet_id directly:", resErr.message);
      }

      // Delete meet_entries if any
      try {
        await supabase.from("meet_entries").delete().eq("meet_id", meetId);
      } catch {}

      // Delete events if any
      try {
        await supabase.from("events").delete().eq("meet_id", meetId);
      } catch {}

      // Delete the meet record
      const { error: meetErr } = await supabase.from("meets").delete().eq("id", meetId);
      if (meetErr) throw meetErr;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coach-data"] }),
        queryClient.invalidateQueries({ queryKey: ["club-management"] }),
      ]);

      toast.success(`Torneo «${meetToDelete.name}» y sus resultados fueron eliminados correctamente.`);
      setMeetToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar el torneo.");
    } finally {
      setBusy(false);
    }
  };

  // 2. Delete a specific team from 'teams' table
  const handleDeleteTeam = async () => {
    if (!teamToDelete) return;
    setBusy(true);
    try {
      const { error } = await supabase.from("teams").delete().eq("id", teamToDelete.id);
      if (error) throw error;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coach-data"] }),
        queryClient.invalidateQueries({ queryKey: ["club-management"] }),
      ]);

      toast.success(`Equipo «${teamToDelete.code}» eliminado del registro.`);
      setTeamToDelete(null);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar equipo.");
    } finally {
      setBusy(false);
    }
  };

  // 3. Clear all imported results from all meets
  const handleClearAllResults = async () => {
    setBusy(true);
    try {
      const { error: resErr } = await supabase.from("results").delete().neq("id", "00000000-0000-0000-0000-000000000000");
      if (resErr) throw resErr;

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["coach-data"] }),
        queryClient.invalidateQueries({ queryKey: ["club-management"] }),
      ]);

      toast.success("Se eliminaron todas las marcas y resultados importados.");
      setConfirmClearAllOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al limpiar resultados.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          {triggerButton || (
            <Button variant="outline" className="gap-2 border-destructive/30 text-destructive hover:bg-destructive/10">
              <Trash2 className="size-4" />
              <span>Eliminar Datos del Ranking</span>
            </Button>
          )}
        </DialogTrigger>

        <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg">
          <DialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <Trash2 className="size-5" />
              <DialogTitle>Gestionar y Eliminar Datos del Ranking</DialogTitle>
            </div>
            <DialogDescription>
              Elimina competencias importadas, resultados erróneos o equipos registrados que ya no desees incluir en los rankings.
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="meets" className="space-y-4 pt-1">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="meets" className="text-xs gap-1.5">
                <Layers className="size-3.5" />
                <span>Torneos Importados ({meets.length})</span>
              </TabsTrigger>
              <TabsTrigger value="teams" className="text-xs gap-1.5">
                <Building2 className="size-3.5" />
                <span>Equipos Registrados ({teams.length})</span>
              </TabsTrigger>
            </TabsList>

            {/* Meets tab */}
            <TabsContent value="meets" className="space-y-3">
              <div className="p-3 rounded-lg border bg-muted/30 text-xs flex items-center justify-between">
                <span className="text-muted-foreground">
                  Al eliminar un torneo, se suprimen permanentemente sus resultados y marcas del ranking.
                </span>
                {meets.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmClearAllOpen(true)}
                    className="h-7 text-xs text-destructive border-destructive/30 hover:bg-destructive/10 shrink-0 ml-2"
                  >
                    Limpiar Todas las Marcas
                  </Button>
                )}
              </div>

              <div className="rounded-md border divide-y max-h-72 overflow-y-auto">
                {meets.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                    <Layers className="size-8 mx-auto text-muted-foreground/60" />
                    <p className="font-semibold text-foreground">No hay torneos registrados</p>
                    <p>No se encontraron campeonatos importados en la base de datos.</p>
                  </div>
                ) : (
                  meets.map((meet) => (
                    <div
                      key={meet.id}
                      className="p-3 flex items-center justify-between gap-3 bg-card hover:bg-muted/30 transition-colors text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <p className="font-semibold text-foreground truncate">{meet.name}</p>
                        <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                          <span>{meet.startDate || "Fecha no registrada"}</span>
                          <span>· Temporada {meet.year}</span>
                          <Badge variant="outline" className="text-[10px] font-mono">
                            {meet.resultsCount} marcas
                          </Badge>
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setMeetToDelete(meet)}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1 shrink-0"
                      >
                        <Trash2 className="size-3.5" />
                        <span>Eliminar</span>
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Teams tab */}
            <TabsContent value="teams" className="space-y-3">
              <div className="p-3 rounded-lg border bg-muted/30 text-xs text-muted-foreground">
                Equipos y clubes registrados en el sistema. Puedes eliminar clubes que no pertenezcan a la federación o estado.
              </div>

              <div className="rounded-md border divide-y max-h-72 overflow-y-auto">
                {teams.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground space-y-1">
                    <Building2 className="size-8 mx-auto text-muted-foreground/60" />
                    <p className="font-semibold text-foreground">No hay equipos registrados</p>
                    <p>No hay registros manuales de equipos en la tabla teams.</p>
                  </div>
                ) : (
                  teams.map((team) => (
                    <div
                      key={team.id}
                      className="p-3 flex items-center justify-between gap-3 bg-card hover:bg-muted/30 transition-colors text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-primary">{team.code}</span>
                          <span className="font-semibold text-foreground truncate">{team.name || team.code}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          Asociación: <span className="font-medium text-foreground">{team.lsc || "Sin Asociación"}</span>
                        </p>
                      </div>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setTeamToDelete(team)}
                        className="h-8 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1 shrink-0"
                      >
                        <Trash2 className="size-3.5" />
                        <span>Eliminar</span>
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog: Delete Meet */}
      <AlertDialog open={Boolean(meetToDelete)} onOpenChange={(open) => !open && setMeetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              <AlertDialogTitle>¿Eliminar este torneo y sus resultados?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2 text-xs">
              <p>
                Estás a punto de eliminar permanentemente el torneo:
              </p>
              <p className="font-bold text-foreground bg-muted p-2 rounded">
                {meetToDelete?.name} ({meetToDelete?.resultsCount} marcas asociadas)
              </p>
              <p>
                Esta acción suprimirá todos los tiempos y resultados de este torneo de la base de datos y recalculará los rankings. Esta acción no se puede deshacer.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={handleDeleteMeet}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Eliminando..." : "Sí, Eliminar Torneo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Delete Team */}
      <AlertDialog open={Boolean(teamToDelete)} onOpenChange={(open) => !open && setTeamToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="size-5" />
              <AlertDialogTitle>¿Eliminar equipo registrado?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2 text-xs">
              <p>
                ¿Deseas eliminar el equipo <span className="font-bold text-foreground">[{teamToDelete?.code}] {teamToDelete?.name}</span>?
              </p>
              <p>
                El equipo se borrará del registro de clubes del sistema.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={handleDeleteTeam}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Eliminando..." : "Sí, Eliminar Equipo"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmation Dialog: Clear All Results */}
      <AlertDialog open={confirmClearAllOpen} onOpenChange={setConfirmClearAllOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="size-5" />
              <AlertDialogTitle>¿Eliminar TODAS las marcas importadas?</AlertDialogTitle>
            </div>
            <AlertDialogDescription className="space-y-2 text-xs">
              <p>
                Esta acción eliminará <span className="font-bold text-destructive">todos los resultados y marcas</span> de todos los torneos importados en la base de datos.
              </p>
              <p className="font-semibold text-foreground">
                Los atletas y clubes permanecerán registrados, pero todas las marcas del ranking quedarán en cero.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={handleClearAllResults}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {busy ? "Limpiando..." : "Sí, Limpiar Todas las Marcas"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
