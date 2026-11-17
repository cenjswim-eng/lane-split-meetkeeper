import { useState, useMemo } from "react";
import { Download, FileDown, Share2, AlertCircle, CheckCircle2, Users } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  exportClubRosterFile,
  validateRosterForExport,
  type ClubExportInfo,
  type RosterAthleteExport,
} from "@/lib/hytek/club-roster-export";
import { downloadFile, canShareFile, shareFile } from "@/lib/file-delivery";
import { ageAtDec31 } from "@/lib/swim";

export function ClubRosterExporter({
  club,
  athletes = [],
  members = [],
  variant = "default",
  buttonLabel = "Exportar plantilla (Meet / Team Manager)",
}: {
  club?: Tables<"clubs"> | null;
  athletes?: Tables<"athletes">[];
  members?: Tables<"club_members">[];
  variant?: "default" | "outline" | "secondary" | "ghost";
  buttonLabel?: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState(club?.team_code || "");
  const [name, setName] = useState(club?.full_name || club?.name || "");
  const [lsc, setLsc] = useState(club?.region_lsc || "");
  const [headCoach, setHeadCoach] = useState(club?.head_coach || "");
  const [city, setCity] = useState(club?.region || "");
  const [onlyActive, setOnlyActive] = useState(true);
  const [selectedSex, setSelectedSex] = useState<string>("ALL");
  const [file, setFile] = useState<File | null>(null);
  const [lastFormat, setLastFormat] = useState<string>("");

  // In-modal quick fixes for gender and birth date
  const [genderMap, setGenderMap] = useState<Record<string, string>>({});
  const [birthMap, setBirthMap] = useState<Record<string, string>>({});

  function onOpen() {
    setCode(club?.team_code || "");
    setName(club?.full_name || club?.name || "");
    setLsc(club?.region_lsc || "");
    setHeadCoach(club?.head_coach || "");
    setCity(club?.region || "");
    setFile(null);
    setGenderMap({});
    setBirthMap({});
    setOpen(true);
  }

  // Combine athletes and club_members (role = nadador) avoiding duplicate names
  const combinedAthletes: RosterAthleteExport[] = useMemo(() => {
    const list: RosterAthleteExport[] = [];
    const seenNames = new Set<string>();

    for (const a of athletes) {
      const key = `${a.last_name?.trim().toLowerCase()}|${a.first_name?.trim().toLowerCase()}`;
      seenNames.add(key);
      const gender = genderMap[a.id] || a.gender || null;
      const birthDate = birthMap[a.id] || a.birth_date || null;
      list.push({
        id: a.id,
        first_name: a.first_name,
        last_name: a.last_name,
        middle_initial: a.middle_initial,
        preferred_name: a.preferred_name,
        gender,
        birth_date: birthDate,
        federation_id: a.federation_id,
        team_code: code || club?.team_code || "UNAT",
        is_active: a.is_active,
      });
    }

    // Include members of type 'nadador' if not already in athletes
    for (const m of members) {
      if (m.member_role !== "nadador") continue;
      const key = `${m.last_name?.trim().toLowerCase()}|${m.first_name?.trim().toLowerCase()}`;
      if (seenNames.has(key)) continue;
      seenNames.add(key);
      const gender = genderMap[m.id] || "M"; // default to M if undefined
      const birthDate = birthMap[m.id] || m.birth_date || null;
      list.push({
        id: m.id,
        first_name: m.first_name,
        last_name: m.last_name,
        middle_initial: null,
        preferred_name: null,
        gender,
        birth_date: birthDate,
        federation_id: null,
        team_code: code || club?.team_code || "UNAT",
        is_active: m.active,
      });
    }

    return list;
  }, [athletes, members, genderMap, birthMap, code, club?.team_code]);

  // Filter athletes
  const eligibleAthletes = useMemo(() => {
    return combinedAthletes
      .filter((a) => (onlyActive ? a.is_active : true))
      .filter((a) => (selectedSex === "ALL" ? true : a.gender === selectedSex));
  }, [combinedAthletes, onlyActive, selectedSex]);

  const clubInfo: ClubExportInfo = {
    code: (code || club?.team_code || "UNAT").trim().toUpperCase(),
    name: (name || club?.name || "Club").trim(),
    short_name: club?.short_name || name.slice(0, 16),
    region_lsc: lsc || club?.region_lsc || null,
    head_coach: headCoach || club?.head_coach || null,
    city: city || club?.region || null,
    contact_phone: club?.contact_phone || null,
    contact_email: club?.contact_email || null,
  };

  const validation = validateRosterForExport(clubInfo, eligibleAthletes);

  async function handleExport(format: "cl2" | "sd3" | "hy3" | "zip") {
    if (!validation.valid) {
      toast.error(validation.errors[0] || "Por favor completa los campos requeridos antes de exportar.");
      return;
    }
    setBusy(true);
    try {
      const generatedFile = await exportClubRosterFile(clubInfo, eligibleAthletes, format);
      setFile(generatedFile);
      setLastFormat(format.toUpperCase());
      toast.success(`Archivo .${format.toUpperCase()} generado correctamente.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al exportar archivo.");
    } finally {
      setBusy(false);
    }
  }

  const currentYear = new Date().getFullYear();

  return (
    <>
      <Button variant={variant} onClick={onOpen} className="gap-2">
        <FileDown className="size-4" />
        <span>{buttonLabel}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92dvh] w-[calc(100%-2rem)] max-w-4xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold uppercase">
              <Users className="size-5 text-primary" />
              Exportar Plantilla a Meet Manager y Team Manager
            </DialogTitle>
            <DialogDescription>
              Genera los archivos oficiales (.CL2, .SD3, .HY3 y .ZIP) compatibles con Hy-Tek Meet Manager y Team Manager
              para importar todos los atletas del club sin escribir datos manualmente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Club metadata configuration */}
            <div className="rounded-lg border bg-muted/40 p-4 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Datos del Club para Hy-Tek</h3>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label htmlFor="roster-code">Código del Club (1-5 letras/números)*</Label>
                  <Input
                    id="roster-code"
                    maxLength={5}
                    placeholder="Ej: HSP"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value.toUpperCase());
                      setFile(null);
                    }}
                  />
                </div>
                <div className="space-y-1 sm:col-span-2">
                  <Label htmlFor="roster-name">Nombre Oficial del Club*</Label>
                  <Input
                    id="roster-name"
                    placeholder="Ej: Club Hispano Venezolano"
                    value={name}
                    onChange={(e) => {
                      setName(e.target.value);
                      setFile(null);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="roster-lsc">Asociación / LSC (ej. MIR, DC)</Label>
                  <Input
                    id="roster-lsc"
                    maxLength={3}
                    placeholder="Ej: MIR"
                    value={lsc}
                    onChange={(e) => {
                      setLsc(e.target.value.toUpperCase());
                      setFile(null);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="roster-coach">Entrenador en Jefe</Label>
                  <Input
                    id="roster-coach"
                    placeholder="Nombre del entrenador"
                    value={headCoach}
                    onChange={(e) => {
                      setHeadCoach(e.target.value);
                      setFile(null);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="roster-city">Ciudad / Sede</Label>
                  <Input
                    id="roster-city"
                    placeholder="Ciudad o sede"
                    value={city}
                    onChange={(e) => {
                      setCity(e.target.value);
                      setFile(null);
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Filters and count */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-y py-3">
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <label className="flex items-center gap-2 cursor-pointer font-medium">
                  <Checkbox
                    checked={onlyActive}
                    onCheckedChange={(v) => {
                      setOnlyActive(v === true);
                      setFile(null);
                    }}
                  />
                  <span>Solo atletas activos</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">Sexo:</span>
                  <select
                    className="h-8 rounded-md border bg-background px-2 text-xs"
                    value={selectedSex}
                    onChange={(e) => {
                      setSelectedSex(e.target.value);
                      setFile(null);
                    }}
                  >
                    <option value="ALL">Todos ({combinedAthletes.length})</option>
                    <option value="M">Masculino ({combinedAthletes.filter((a) => a.gender === "M").length})</option>
                    <option value="F">Femenino ({combinedAthletes.filter((a) => a.gender === "F").length})</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={eligibleAthletes.length > 0 ? "secondary" : "destructive"}>
                  {eligibleAthletes.length} atletas seleccionados
                </Badge>
              </div>
            </div>

            {/* Validation alerts */}
            {validation.errors.length > 0 && (
              <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive space-y-1">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="size-4 shrink-0" />
                  <span>Requiere atención para exportar a Meet Manager:</span>
                </div>
                <ul className="list-inside list-disc text-xs space-y-0.5">
                  {validation.errors.slice(0, 6).map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                  {validation.errors.length > 6 && <li>... y {validation.errors.length - 6} observaciones más.</li>}
                </ul>
              </div>
            )}

            {validation.warnings.length > 0 && validation.errors.length === 0 && (
              <div className="rounded-md border border-accent/40 bg-accent/10 p-3 text-xs text-accent-foreground space-y-1">
                <p className="font-semibold">Recomendaciones (opcional):</p>
                <p>{validation.warnings.length} atletas no tienen cédula o ID FINA. Meet Manager los importará sin problema, pero se recomienda completar sus fichas.</p>
              </div>
            )}

            {/* Athlete preview table with inline correction */}
            <div className="max-h-56 overflow-auto rounded border">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0 bg-muted/80 text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="p-2">#</th>
                    <th className="p-2">Apellido y Nombre</th>
                    <th className="p-2">Sexo (M/F)</th>
                    <th className="p-2">Nacimiento</th>
                    <th className="p-2">Edad (31/12)</th>
                    <th className="p-2">ID / Cédula</th>
                    <th className="p-2">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {eligibleAthletes.map((a, i) => {
                    const age = a.birth_date ? ageAtDec31(a.birth_date, currentYear) : null;
                    const idKey = a.id || `temp-${i}`;
                    const hasValidGender = a.gender === "M" || a.gender === "F";
                    const hasValidBirth = !!a.birth_date;

                    return (
                      <tr key={idKey} className={!hasValidGender || !hasValidBirth ? "bg-destructive/10" : "hover:bg-muted/40"}>
                        <td className="p-2 font-mono text-muted-foreground">{i + 1}</td>
                        <td className="p-2 font-medium">
                          {a.last_name}, {a.first_name} {a.middle_initial ? `${a.middle_initial}.` : ""}
                        </td>
                        <td className="p-2">
                          <select
                            className={`h-7 rounded border px-1.5 text-xs font-semibold ${a.gender === "M" ? "text-primary" : a.gender === "F" ? "text-pink-600" : "border-destructive text-destructive"}`}
                            value={a.gender || ""}
                            onChange={(e) => {
                              const val = e.target.value;
                              setGenderMap((prev) => ({ ...prev, [idKey]: val }));
                              setFile(null);
                            }}
                          >
                            <option value="">Elegir</option>
                            <option value="M">M (Masc)</option>
                            <option value="F">F (Fem)</option>
                          </select>
                        </td>
                        <td className="p-2 whitespace-nowrap">
                          {a.birth_date ? (
                            <span>{a.birth_date}</span>
                          ) : (
                            <input
                              type="date"
                              className="h-7 rounded border border-destructive px-1 text-xs"
                              onChange={(e) => {
                                const val = e.target.value;
                                if (val) {
                                  setBirthMap((prev) => ({ ...prev, [idKey]: val }));
                                  setFile(null);
                                }
                              }}
                            />
                          )}
                        </td>
                        <td className="p-2">{age ?? "—"}</td>
                        <td className="p-2 font-mono">{a.federation_id || <span className="text-muted-foreground">Sin ID</span>}</td>
                        <td className="p-2">
                          <span className={a.is_active ? "text-success font-medium" : "text-muted-foreground"}>
                            {a.is_active ? "Activo" : "Inactivo"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {!eligibleAthletes.length && (
                <p className="py-6 text-center text-sm text-muted-foreground">No hay atletas que coincidan con estos filtros.</p>
              )}
            </div>

            {/* Export buttons */}
            <div className="space-y-3">
              <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Selecciona el formato a exportar</h4>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <Button
                  variant="outline"
                  disabled={busy || !eligibleAthletes.length || !validation.valid}
                  onClick={() => handleExport("cl2")}
                  className="flex flex-col items-start gap-1 h-auto p-3 text-left border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex items-center gap-1.5 font-bold text-sm text-primary">
                    <Download className="size-4" />
                    <span>Formato .CL2</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    Estándar Team Manager y Meet Manager (Roster SDIF)
                  </span>
                </Button>

                <Button
                  variant="outline"
                  disabled={busy || !eligibleAthletes.length || !validation.valid}
                  onClick={() => handleExport("hy3")}
                  className="flex flex-col items-start gap-1 h-auto p-3 text-left border-primary/40 hover:bg-primary/5"
                >
                  <div className="flex items-center gap-1.5 font-bold text-sm text-primary">
                    <Download className="size-4" />
                    <span>Formato .HY3</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    Archivo nativo Hy-Tek con checksum ponderado
                  </span>
                </Button>

                <Button
                  variant="outline"
                  disabled={busy || !eligibleAthletes.length || !validation.valid}
                  onClick={() => handleExport("sd3")}
                  className="flex flex-col items-start gap-1 h-auto p-3 text-left hover:bg-secondary/20"
                >
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <Download className="size-4" />
                    <span>Formato .SD3</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    Variante SDIF v3 estándar USA Swimming
                  </span>
                </Button>

                <Button
                  variant="outline"
                  disabled={busy || !eligibleAthletes.length || !validation.valid}
                  onClick={() => handleExport("zip")}
                  className="flex flex-col items-start gap-1 h-auto p-3 text-left hover:bg-secondary/20"
                >
                  <div className="flex items-center gap-1.5 font-bold text-sm">
                    <Download className="size-4" />
                    <span>Archivo .ZIP</span>
                  </div>
                  <span className="text-[11px] text-muted-foreground leading-tight">
                    Comprimido listo para cargar en Meet Manager
                  </span>
                </Button>
              </div>
            </div>

            {/* Download and Share ready card */}
            {file && (
              <div className="rounded-lg border-2 border-primary/50 bg-card p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-5 text-success" />
                    <div>
                      <p className="font-semibold text-sm">Archivo listo para Meet Manager y Team Manager</p>
                      <p className="font-mono text-xs text-muted-foreground break-all">{file.name}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="font-mono">{lastFormat}</Badge>
                </div>

                <div className="flex flex-wrap gap-2 pt-1">
                  <Button onClick={() => downloadFile(file)} className="gap-2">
                    <Download className="size-4" />
                    <span>Descargar archivo</span>
                  </Button>

                  {canShareFile(file) && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          await shareFile(file);
                        } catch (e) {
                          toast.error(e instanceof Error ? e.message : "No se pudo compartir.");
                        }
                      }}
                      className="gap-2"
                    >
                      <Share2 className="size-4" />
                      <span>Compartir por WhatsApp / Móvil</span>
                    </Button>
                  )}
                </div>

                <div className="rounded bg-muted/60 p-2.5 text-xs text-muted-foreground space-y-1">
                  <p className="font-semibold text-foreground">¿Cómo cargarlo en Meet Manager o Team Manager?</p>
                  <p>1. Abre <strong>Meet Manager</strong> o <strong>Team Manager</strong>.</p>
                  <p>2. Ve al menú superior: <strong>File (Archivo) &rarr; Import (Importar) &rarr; Athletes / Teams / Rosters</strong>.</p>
                  <p>3. Selecciona el archivo descargado (<code>{file.name}</code>). El programa incorporará automáticamente a todos los atletas con sus fechas de nacimiento, sexo e ID de federación.</p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
