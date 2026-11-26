/**
 * Apartado de Importación de Atletas mediante Documentos (ZIP o PDF)
 * Ubicación: src/components/imports/AthleteDocumentImporter.tsx
 *
 * Permite cargar documentos PDF (reportes de atletas, nóminas, psych sheets) o
 * archivos comprimidos ZIP (con plantillas Hy-Tek, PDFs o CSVs) e importarlos
 * directamente al club activo del entrenador.
 */

import { useState, useMemo } from "react";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import {
  UploadCloud,
  FileText,
  FileArchive,
  CheckCircle2,
  AlertCircle,
  Users,
  Building2,
  Loader2,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Check,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
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
  parseAthletesFromDocument,
  type ExtractedAthlete,
} from "@/lib/athlete-document-parser";
import { profileQuery } from "@/lib/profile";
import { normalizeTeamCode } from "@/data/fevedaClubs";
import { ageAtDec31, ageGroup } from "@/lib/swim";

interface AthleteDocumentImporterProps {
  mode?: "inline" | "dialog";
  buttonVariant?: "default" | "outline" | "secondary";
  buttonLabel?: string;
  onSuccess?: (count: number) => void;
  defaultClubId?: string;
  defaultClubCode?: string;
}

export function AthleteDocumentImporter({
  mode = "dialog",
  buttonVariant = "default",
  buttonLabel = "Importar Atletas (ZIP / PDF)",
  onSuccess,
  defaultClubId,
  defaultClubCode,
}: AthleteDocumentImporterProps) {
  const qc = useQueryClient();
  const { data: profile } = useQuery(profileQuery);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isReading, setIsReading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [sourceName, setSourceName] = useState<string>("");

  // Atletas parseados del archivo
  const [extractedAthletes, setExtractedAthletes] = useState<ExtractedAthlete[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // In-table quick edits
  const [genderOverrides, setGenderOverrides] = useState<Record<string, "M" | "F">>({});
  const [birthOverrides, setBirthOverrides] = useState<Record<string, string>>({});
  const [idOverrides, setIdOverrides] = useState<Record<string, string>>({});

  // Opciones de destino
  const [syncToClubMembers, setSyncToClubMembers] = useState(true);

  // Resumen de éxito
  const [importSummary, setImportSummary] = useState<{
    created: number;
    updated: number;
    total: number;
  } | null>(null);

  // Datos del club del usuario
  const myClubCode = useMemo(() => {
    const raw = defaultClubCode || profile?.club?.code || profile?.club?.team_code || "JSWIM";
    return normalizeTeamCode(raw).code;
  }, [profile?.club, defaultClubCode]);

  const myClubName = profile?.club?.name || profile?.club?.full_name || "Mi Club";
  const myClubId = defaultClubId || profile?.club?.id || null;

  // 1. CARGA Y ANÁLISIS DEL DOCUMENTO (ZIP o PDF)
  const handleFile = async (file: File) => {
    if (!file) return;
    setIsReading(true);
    setImportSummary(null);
    setSourceName(file.name);

    try {
      const result = await parseAthletesFromDocument(file, myClubCode);

      // Comprobar atletas existentes en la base de datos para marcar coincidencias
      const { data: existingAthletes } = await supabase
        .from("athletes")
        .select("id, first_name, last_name, birth_date, federation_id, tm_athlete_id");

      const existingList = (existingAthletes ?? []) as Array<{
        id: string;
        first_name: string;
        last_name: string;
        birth_date: string | null;
        federation_id: string | null;
        tm_athlete_id: string | null;
      }>;

      const annotated = result.athletes.map((a) => {
        const normFirst = a.firstName.trim().toLowerCase();
        const normLast = a.lastName.trim().toLowerCase();

        const match = existingList.find((e) => {
          if (a.federationId && e.federation_id && a.federationId === e.federation_id) return true;
          const eFirst = e.first_name.trim().toLowerCase();
          const eLast = e.last_name.trim().toLowerCase();
          return eFirst === normFirst && eLast === normLast && (!e.birth_date || !a.birthDate || e.birth_date === a.birthDate);
        });

        return {
          ...a,
          existingAthleteId: match ? match.id : null,
          status: match ? ("match" as const) : ("new" as const),
        };
      });

      setExtractedAthletes(annotated);
      // Preseleccionar todos los atletas detectados
      setSelectedIds(new Set(annotated.map((a) => a.id)));
      toast.success(`Documento analizado: ${annotated.length} atletas detectados.`);
    } catch (err: any) {
      toast.error(err?.message || "Error al leer el documento.");
      setExtractedAthletes([]);
    } finally {
      setIsReading(false);
    }
  };

  // 2. TOGGLE SELECCIÓN DE ATLETAS
  const handleToggleAthlete = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = (select: boolean) => {
    if (select) {
      setSelectedIds(new Set(extractedAthletes.map((a) => a.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  // 3. GUARDAR ATLETAS SELECCIONADOS EN SUPABASE
  const handleConfirmImport = async () => {
    const toImport = extractedAthletes.filter((a) => selectedIds.has(a.id));
    if (!toImport.length) {
      toast.error("Selecciona al menos un atleta para importar.");
      return;
    }

    setIsSaving(true);
    let created = 0;
    let updated = 0;

    try {
      const { data: auth } = await supabase.auth.getUser();
      const ownerId = auth?.user?.id ?? null;

      // Obtener o crear team_id para el código del club
      let targetTeamId: string | null = null;
      if (myClubCode) {
        const { data: teamRow } = await supabase
          .from("teams")
          .select("id")
          .eq("code", myClubCode)
          .maybeSingle();

        if (teamRow?.id) {
          targetTeamId = teamRow.id;
        } else {
          try {
            const { data: newTeam } = await supabase
              .from("teams")
              .insert({ code: myClubCode, name: myClubName, owner_id: ownerId })
              .select("id")
              .single();
            if (newTeam?.id) targetTeamId = newTeam.id;
          } catch {}
        }
      }

      for (const a of toImport) {
        const gender = genderOverrides[a.id] || a.gender || "M";
        const birthDate = birthOverrides[a.id] || a.birthDate || null;
        const fedId = idOverrides[a.id] || a.federationId || null;

        // Si ya existe, actualizar ficha con club_id y datos complementarios
        if (a.existingAthleteId) {
          const updatePayload: Record<string, any> = {
            club_id: myClubId,
            team_id: targetTeamId,
            is_active: true,
          };
          if (gender) updatePayload.gender = gender;
          if (birthDate) updatePayload.birth_date = birthDate;
          if (fedId) updatePayload.federation_id = fedId;

          const { error: updErr } = await supabase
            .from("athletes")
            .update(updatePayload as any)
            .eq("id", a.existingAthleteId);

          if (!updErr) updated++;
        } else {
          // Si es nuevo, insertar
          const insertPayload = {
            first_name: a.firstName.trim(),
            last_name: a.lastName.trim(),
            middle_initial: a.middleInitial || null,
            gender: gender,
            birth_date: birthDate,
            federation_id: fedId,
            club_id: myClubId,
            team_id: targetTeamId,
            is_active: true,
            is_federated: true,
            owner_id: ownerId,
          };

          const { error: insErr } = await supabase.from("athletes").insert(insertPayload);
          if (!insErr) created++;
        }

        // Si se seleccionó sincronizar en Mi Club (club_members)
        if (syncToClubMembers && myClubId) {
          try {
            await supabase.from("club_members").upsert(
              {
                club_id: myClubId,
                first_name: a.firstName.trim(),
                last_name: a.lastName.trim(),
                member_role: "nadador",
                birth_date: birthDate,
                active: true,
                updated_at: new Date().toISOString(),
              },
              { onConflict: "club_id,first_name,last_name" }
            );
          } catch {}
        }
      }

      setImportSummary({ created, updated, total: toImport.length });

      // Invalidar cachés
      await Promise.allSettled([
        qc.invalidateQueries({ queryKey: ["athletes"] }),
        qc.invalidateQueries({ queryKey: ["coach-data"] }),
        qc.invalidateQueries({ queryKey: ["club-register"] }),
        qc.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);

      toast.success(
        `¡Importación exitosa! ${created} atletas creados y ${updated} actualizados en tu club (${myClubCode}).`
      );
      if (onSuccess) onSuccess(toImport.length);
    } catch (err: any) {
      toast.error(err?.message || "Ocurrió un error al guardar los atletas.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setExtractedAthletes([]);
    setSelectedIds(new Set());
    setSourceName("");
    setImportSummary(null);
    setGenderOverrides({});
    setBirthOverrides({});
    setIdOverrides({});
  };

  // Contenido del importador
  const content = (
    <div className="space-y-5">
      {/* 1. ENCABEZADO Y REQUISITO DE EQUIPO */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-base text-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-primary" />
              Importar Atletas al Club: {myClubName}
            </span>
            <Badge variant="outline" className="border-primary/40 text-primary font-mono font-bold text-xs">
              {myClubCode}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Sube documentos <strong>PDF</strong> (reportes de atletas, psych sheets, nóminas) o archivos <strong>ZIP</strong> (con plantillas Hy-Tek, PDFs o CSV).
          </p>
        </div>

        <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 text-xs">
          🛡️ Modo Club Exclusivo
        </Badge>
      </div>

      {/* 2. ZONA DE SUBIDA (Si no hay atletas en revisión) */}
      {!extractedAthletes.length && !importSummary && (
        <div className="space-y-4">
          <label
            className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed bg-card/60 p-8 text-center transition-all hover:border-primary hover:bg-primary/5 border-muted-foreground/25"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-3">
              {isReading ? <Loader2 className="h-6 w-6 animate-spin" /> : <UploadCloud className="h-6 w-6" />}
            </div>
            <span className="font-bold text-base text-foreground">
              {isReading ? "Analizando documento y extrayendo atletas..." : "Arrastra o selecciona tu archivo ZIP o PDF"}
            </span>
            <p className="mt-1 text-xs text-muted-foreground max-w-md">
              Formatos aceptados: <span className="font-semibold text-foreground">.ZIP</span> (con archivos Hy-Tek .CL2/.HY3 o documentos),{" "}
              <span className="font-semibold text-foreground">.PDF</span> (reportes de atletas o nóminas) o <span className="font-semibold text-foreground">.CSV</span>.
            </p>
            <input
              type="file"
              accept=".pdf,.zip,.cl2,.hy3,.sd3,.csv,application/pdf,application/zip"
              disabled={isReading}
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) handleFile(f);
              }}
            />
          </label>
        </div>
      )}

      {/* 3. RESUMEN DE ÉXITO TRAS GUARDAR */}
      {importSummary && (
        <div className="rounded-xl border-2 border-emerald-500/40 bg-emerald-500/10 p-5 space-y-3">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0" />
            <div>
              <h3 className="font-bold text-base text-foreground">¡Atletas incorporados con éxito!</h3>
              <p className="text-xs text-muted-foreground">
                Se procesaron {importSummary.total} atletas para tu equipo <strong>{myClubCode}</strong>.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="rounded-lg bg-background p-2.5 border text-center">
              <span className="text-[11px] text-muted-foreground block">Nuevos Atletas Creados</span>
              <span className="font-mono text-xl font-bold text-emerald-600">{importSummary.created}</span>
            </div>
            <div className="rounded-lg bg-background p-2.5 border text-center">
              <span className="text-[11px] text-muted-foreground block">Atletas Existentes Actualizados</span>
              <span className="font-mono text-xl font-bold text-foreground">{importSummary.updated}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Button
              onClick={handleReset}
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Importar otro documento
            </Button>
            {mode === "dialog" && (
              <Button
                onClick={() => setDialogOpen(false)}
                size="sm"
                className="gap-1.5 text-xs bg-primary font-semibold"
              >
                <span>Ver lista de atletas</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 4. TABLA DE REVISIÓN Y CONFIRMACIÓN DE ATLETAS DETECTADOS */}
      {extractedAthletes.length > 0 && !importSummary && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5">
              <span className="font-bold text-sm text-foreground flex items-center gap-1.5">
                <Check className="h-4 w-4 text-emerald-600" />
                Atletas detectados en: <code className="text-xs font-semibold text-primary">{sourceName}</code>
              </span>
              <p className="text-xs text-muted-foreground">
                Revisa los datos, ajusta el sexo o fecha si faltan, y confirma para guardar en tu equipo.
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleReset}
              className="text-xs text-destructive gap-1 h-7"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Cancelar y cambiar archivo
            </Button>
          </div>

          {/* Opciones de Destino y Selector Rápido */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/20 p-2.5 rounded-lg border text-xs">
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSelectAll(true)}
                className="h-6 text-[11px]"
              >
                Seleccionar Todos
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleSelectAll(false)}
                className="h-6 text-[11px]"
              >
                Deseleccionar
              </Button>
              <Badge variant="secondary" className="font-semibold text-[11px]">
                {selectedIds.size} de {extractedAthletes.length} seleccionados
              </Badge>
            </div>

            <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
              <Checkbox
                checked={syncToClubMembers}
                onCheckedChange={(c) => setSyncToClubMembers(Boolean(c))}
              />
              <span>Registrar también en ficha de Mi Club</span>
            </label>
          </div>

          {/* Tabla de Atletas */}
          <div className="max-h-72 overflow-auto rounded-lg border bg-card">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-muted/90 text-muted-foreground backdrop-blur border-b">
                <tr>
                  <th className="p-2 w-8 text-center">
                    <Checkbox
                      checked={selectedIds.size === extractedAthletes.length && extractedAthletes.length > 0}
                      onCheckedChange={(c) => handleSelectAll(Boolean(c))}
                    />
                  </th>
                  <th className="p-2">Apellido y Nombre</th>
                  <th className="p-2 text-center">Sexo</th>
                  <th className="p-2 text-center">Nacimiento</th>
                  <th className="p-2 text-center">Edad</th>
                  <th className="p-2">Categoría</th>
                  <th className="p-2">Cédula / ID</th>
                  <th className="p-2">Origen</th>
                  <th className="p-2 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {extractedAthletes.map((a) => {
                  const isChecked = selectedIds.has(a.id);
                  const gender = genderOverrides[a.id] || a.gender || "";
                  const birth = birthOverrides[a.id] || a.birthDate || "";
                  const fedId = idOverrides[a.id] || a.federationId || "";
                  const age = birth ? ageAtDec31(birth, new Date().getFullYear()) : null;

                  return (
                    <tr
                      key={a.id}
                      className={`hover:bg-muted/40 transition-colors ${
                        isChecked ? "bg-primary/5" : "opacity-60"
                      }`}
                    >
                      <td className="p-2 text-center">
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() => handleToggleAthlete(a.id)}
                        />
                      </td>
                      <td className="p-2 font-semibold text-foreground">
                        {a.lastName}, {a.firstName}
                      </td>
                      <td className="p-2 text-center">
                        <select
                          value={gender}
                          onChange={(e) =>
                            setGenderOverrides((prev) => ({
                              ...prev,
                              [a.id]: e.target.value as "M" | "F",
                            }))
                          }
                          className="h-6 rounded border bg-background px-1 text-[11px] font-semibold"
                        >
                          <option value="M">M</option>
                          <option value="F">F</option>
                        </select>
                      </td>
                      <td className="p-2 text-center">
                        {birth ? (
                          <span className="font-mono text-[11px]">{birth}</span>
                        ) : (
                          <input
                            type="date"
                            className="h-6 rounded border bg-background px-1 text-[11px]"
                            onChange={(e) =>
                              setBirthOverrides((prev) => ({
                                ...prev,
                                [a.id]: e.target.value,
                              }))
                            }
                          />
                        )}
                      </td>
                      <td className="p-2 text-center font-mono">{age ?? "—"}</td>
                      <td className="p-2 text-muted-foreground">{age != null ? ageGroup(age) : "—"}</td>
                      <td className="p-2">
                        <input
                          type="text"
                          placeholder="Sin ID"
                          value={fedId}
                          onChange={(e) =>
                            setIdOverrides((prev) => ({
                              ...prev,
                              [a.id]: e.target.value,
                            }))
                          }
                          className="h-6 w-24 rounded border bg-background px-1 text-[11px] font-mono"
                        />
                      </td>
                      <td className="p-2 text-muted-foreground truncate max-w-[120px] text-[10px]">
                        {a.sourceFile}
                      </td>
                      <td className="p-2 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] py-0 px-1.5 ${
                            a.status === "match"
                              ? "border-sky-500/40 text-sky-600 bg-sky-500/10"
                              : "border-emerald-500/40 text-emerald-600 bg-emerald-500/10"
                          }`}
                        >
                          {a.status === "match" ? "Existente" : "Nuevo"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* BOTÓN DE ACCIÓN FINAL */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
            <div className="text-xs text-muted-foreground">
              Se guardarán exclusivamente en el club <strong className="text-foreground">{myClubName} ({myClubCode})</strong>.
            </div>
            <Button
              onClick={handleConfirmImport}
              disabled={isSaving || selectedIds.size === 0}
              className="gap-2 bg-primary font-bold text-xs shadow-md"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Guardando en base de datos...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Incorporar {selectedIds.size} atletas a mi club</span>
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  // Render en modo diálogo (botón emergente)
  if (mode === "dialog") {
    return (
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogTrigger asChild>
          <Button variant={buttonVariant} className="gap-2 font-semibold text-xs shadow-sm">
            <UploadCloud className="h-4 w-4 text-primary" />
            <span>{buttonLabel}</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[92dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold uppercase">
              <UploadCloud className="h-5 w-5 text-primary" />
              Importar Atletas mediante Documentos (ZIP o PDF)
            </DialogTitle>
            <DialogDescription>
              Incorpora a los nadadores de tu club subiendo documentos PDF o paquetes ZIP de Meet Manager sin escribirlos uno a uno.
            </DialogDescription>
          </DialogHeader>
          {content}
        </DialogContent>
      </Dialog>
    );
  }

  // Render en modo inline (tarjeta directa)
  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="text-xl font-bold flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-primary" />
              Importar Atletas mediante Documentos (ZIP o PDF)
            </CardTitle>
            <CardDescription>
              Carga documentos oficiales PDF o paquetes comprimidos ZIP para incorporar nadadores a tu equipo automáticamente.
            </CardDescription>
          </div>
          <Badge variant="outline" className="border-primary/40 font-mono text-primary font-bold text-xs">
            {myClubCode}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
