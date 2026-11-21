import { useState, useMemo } from "react";
import { Building2, CheckCheck, FileText, Globe, Layers, Save, Search, ShieldCheck, Sparkles, Upload } from "lucide-react";
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
import { Textarea } from "@/components/ui/textarea";
import { type DetectedClub, normalizeAssociationName } from "@/lib/association-ranking";
import { FEDERATIONS, getFederation, findKnownClubAssociation } from "@/lib/federations";

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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
  const [selectedFederationCode, setSelectedFederationCode] = useState<string>(() => {
    return localStorage.getItem("slc_preferred_federation") || "VEN";
  });
  const [batchAssocChoice, setBatchAssocChoice] = useState<string>("");
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState("");

  const queryClient = useQueryClient();
  const currentFederation = useMemo(() => getFederation(selectedFederationCode), [selectedFederationCode]);

  const handleOpen = () => {
    const initial: Record<string, string> = {};
    clubs.forEach((c) => {
      initial[c.id] = c.association === "Sin Asociación" ? "" : c.association;
    });
    setAssociations(initial);
    setOpen(true);
  };

  const handleAutoClassify = () => {
    let updatedCount = 0;
    const updated = { ...associations };

    for (const c of clubs) {
      const current = (associations[c.id] ?? (c.association === "Sin Asociación" ? "" : c.association)).trim();
      if (!current) {
        const match = findKnownClubAssociation(c.code, c.name, selectedFederationCode);
        if (match) {
          updated[c.id] = match;
          updatedCount += 1;
        }
      }
    }

    if (updatedCount > 0) {
      setAssociations(updated);
      toast.success(
        `${updatedCount} clubes clasificados automáticamente según el padrón de ${currentFederation.shortName}. Pulsa «Guardar Todos los Cambios» para confirmar.`
      );
    } else {
      toast.info(
        `No se encontraron nuevos clubes pendientes que coincidan con el padrón oficial de ${currentFederation.shortName}.`
      );
    }
  };

  const handleParsePastedRoster = () => {
    if (!pasteText.trim()) return;
    const lines = pasteText.split("\n");
    let matchedCount = 0;
    const updated = { ...associations };

    for (const line of lines) {
      const clean = line.trim();
      if (!clean) continue;

      const parts = clean.includes("\t")
        ? clean.split("\t")
        : clean.includes("|")
        ? clean.split("|")
        : clean.split(",");

      if (parts.length >= 2) {
        const rawCode = parts[0].trim().toUpperCase();
        const rawAssoc = normalizeAssociationName(parts[parts.length - 1].trim());

        const targetClub = clubs.find(
          (c) => c.code.toUpperCase() === rawCode || c.name.toLowerCase().includes(parts[0].trim().toLowerCase())
        );

        if (targetClub && rawAssoc !== "Sin Asociación") {
          updated[targetClub.id] = rawAssoc;
          matchedCount += 1;
        }
      }
    }

    if (matchedCount > 0) {
      setAssociations(updated);
      setPasteOpen(false);
      setPasteText("");
      toast.success(
        `${matchedCount} clubes vinculados desde el texto pegado. Pulsa «Guardar Todos los Cambios» para guardar.`
      );
    } else {
      toast.warning(
        "No se encontraron coincidencias de clubes en el texto ingresado. Formato sugerido: Código, Nombre del Club, Asociación."
      );
    }
  };

  const handleFederationChange = (code: string) => {
    setSelectedFederationCode(code);
    localStorage.setItem("slc_preferred_federation", code);
    const fed = getFederation(code);
    setBatchAssocChoice(fed.associations[0] || "");
    toast.info(`Catálogo de asociaciones de ${fed.country} (${fed.shortName}) cargado.`);
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

      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto rounded-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ShieldCheck className="size-5 text-primary" />
            <DialogTitle>Registro de Clubes y Asociaciones Afiliadas</DialogTitle>
          </div>
          <DialogDescription>
            Carga y clasifica las asociaciones según la federación nacional de cada país (Venezuela FEVEDA, Colombia FECNA, España RFEN, México FMN, USA Swimming, etc.).
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Country / Federation Selector Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-lg border bg-muted/40 shadow-xs">
            <div className="space-y-0.5">
              <label htmlFor="fed-country-select" className="text-xs font-bold flex items-center gap-1.5 text-foreground">
                <Globe className="size-4 text-primary" />
                <span>Federación Nacional / País:</span>
              </label>
              <p className="text-[11px] text-muted-foreground">
                Carga el catálogo oficial de {currentFederation.associationLabel.toLowerCase()}
              </p>
            </div>
            <div className="w-full sm:w-72">
              <Select value={selectedFederationCode} onValueChange={handleFederationChange}>
                <SelectTrigger id="fed-country-select" aria-label="Seleccionar federación y país">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEDERATIONS.map((f) => (
                    <SelectItem key={f.code} value={f.code}>
                      <span className="mr-1.5">{f.flag}</span>
                      <span className="font-medium">{f.country}</span>
                      <span className="text-muted-foreground ml-1">({f.shortName})</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Quick batch assign actions based on the active federation */}
          <div className="p-3 rounded-lg border bg-card space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                <Sparkles className="size-3.5 text-primary" />
                <span>Atajos rápidos · {currentFederation.associationLabel}:</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleAutoClassify}
                  className="h-7 text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
                >
                  <Sparkles className="size-3.5" />
                  Auto-clasificar por Padrón {currentFederation.shortName}
                </Button>

                <Dialog open={pasteOpen} onOpenChange={setPasteOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 bg-background">
                      <Upload className="size-3.5 text-primary" />
                      Pegar Padrón (Texto / Web)
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-xl">
                    <DialogHeader>
                      <DialogTitle>Importar Padrón de Clubes por Texto o Web</DialogTitle>
                      <DialogDescription>
                        Pega aquí el listado de clubes y asociaciones copiado de la página oficial de {currentFederation.shortName} ({currentFederation.country}) o de un archivo Excel.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 pt-2">
                      <p className="text-xs text-muted-foreground">
                        Formato admitido: <code>Código, Nombre del Club, Asociación</code> (separado por comas, tabulaciones o plecas |).
                      </p>
                      <Textarea
                        placeholder={`Ejemplo:\nPIS, Piscinas Bolivarianas, Lara (ADAEL)\nCPMI, Centro Portugués, Miranda (ADAEM)\nCIV, Centro Ítalo, Distrito Capital (ASDAC)`}
                        rows={7}
                        value={pasteText}
                        onChange={(e) => setPasteText(e.target.value)}
                        className="text-xs font-mono"
                      />
                      <div className="flex justify-end gap-2 pt-2">
                        <Button variant="outline" size="sm" onClick={() => setPasteOpen(false)}>
                          Cancelar
                        </Button>
                        <Button size="sm" disabled={!pasteText.trim()} onClick={handleParsePastedRoster}>
                          Vincular Clubes
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
            </div>

            {/* Quick buttons */}
            <div className="flex flex-wrap items-center gap-1.5">
              {currentFederation.associations.slice(0, 6).map((assoc) => (
                <Button
                  key={assoc}
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs bg-background"
                  onClick={() => handleAssignAllShown(assoc)}
                >
                  + {assoc.split("(")[0].trim() || assoc}
                </Button>
              ))}
            </div>

            {/* Batch assign from full federation list */}
            {currentFederation.associations.length > 6 && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1 border-t">
                <span className="text-xs text-muted-foreground shrink-0">Otras asociaciones de {currentFederation.shortName}:</span>
                <select
                  aria-label="Seleccionar asociación para asignar en lote"
                  value={batchAssocChoice}
                  onChange={(e) => setBatchAssocChoice(e.target.value)}
                  className="h-8 rounded border bg-background px-2 text-xs flex-1"
                >
                  <option value="">Seleccionar del catálogo de {currentFederation.country}...</option>
                  {currentFederation.associations.map((assoc) => (
                    <option key={assoc} value={assoc}>
                      {assoc}
                    </option>
                  ))}
                </select>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={!batchAssocChoice}
                  onClick={() => {
                    if (batchAssocChoice) handleAssignAllShown(batchAssocChoice);
                  }}
                  className="h-8 text-xs shrink-0"
                >
                  Asignar a los mostrados
                </Button>
              </div>
            )}
          </div>

          {/* Search bar and Save All button */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar club por nombre, código o asociación asignada..."
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
                className="gap-1.5 bg-primary font-semibold text-xs h-9 shrink-0 shadow-xs"
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
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
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
                        {club.affiliationYears && club.affiliationYears.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="text-muted-foreground flex items-center gap-1">
                              <span>Temporadas:</span>
                              {club.affiliationYears.slice(0, 3).map((yr) => (
                                <Badge key={yr} variant="outline" className="text-[10px] px-1 py-0 h-4 font-mono">
                                  {yr}
                                </Badge>
                              ))}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="flex-1 sm:w-64 space-y-1">
                        <Input
                          placeholder={`Escribe o selecciona (${currentFederation.shortName})`}
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
                          {currentFederation.associations.map((assoc) => (
                            <option key={assoc} value={assoc} />
                          ))}
                        </datalist>
                        {hasChanged && normalizedPreview !== "Sin Asociación" && (
                          <p className="text-[10px] text-muted-foreground">
                            Se guardará como: <strong className="text-primary">{normalizedPreview}</strong>
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
            <strong className="text-foreground">Consejo multisede:</strong> Cada club puede cambiar de federación nacional en el selector superior para desplegar automáticamente las asociaciones oficiales de su país ({FEDERATIONS.map((f) => f.country).slice(0, 5).join(", ")}, etc.).
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
