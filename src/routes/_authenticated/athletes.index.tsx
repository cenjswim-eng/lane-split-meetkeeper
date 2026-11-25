import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ageAt, ageAtDec31, ageGroup } from "@/lib/swim";
import { NewAthlete } from "@/components/new-athlete";
import { DeleteAthlete } from "@/components/delete-athlete";
import { HistoryTransfer } from "@/components/history-transfer";
import { ClubMembersExtractor } from "@/components/exports/ClubMembersExtractor";
import { AthleteDocumentImporter } from "@/components/imports/AthleteDocumentImporter";
import { useWorkspaceFilters, matchesAthlete } from '@/lib/workspace-filters';
import { useSwimCategories } from '@/lib/categories';
import { profileQuery } from "@/lib/profile";
import { normalizeTeamCode } from "@/data/fevedaClubs";
import { ShieldCheck, Trash2, AlertTriangle, Building2, Sparkles } from "lucide-react";
import { toast } from "sonner";

const athletesQuery = queryOptions({
  queryKey: ["athletes"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("athletes")
      .select("id, first_name, last_name, birth_date, gender, federation_id, active_status, club_id, teams(code, name)")
      .order("last_name")
      .limit(1000);
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/_authenticated/athletes/")({
  staticData: { sitemap: false },
  head: () => ({ meta: [{ title: "Atletas — Swim Lane Coach" }, { name: "description", content: "Listado de nadadores del club." }, { property: "og:title", content: "Atletas — Swim Lane Coach" }, { name: "twitter:title", content: "Atletas — Swim Lane Coach" }, { property: "og:description", content: "Listado de nadadores del club." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(athletesQuery),
  component: AthletesPage,
});

function AthletesPage() {
  const { data } = useSuspenseQuery(athletesQuery);
  const { data: profileData } = useQuery(profileQuery);
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [isPurging, setIsPurging] = useState(false);
  const { filters } = useWorkspaceFilters();
  const categories = useSwimCategories();

  const myClubCode = (profileData?.club?.code || profileData?.club?.team_code || profileData?.club?.short_name || "JSWIM").toUpperCase().trim();
  const myClubId = profileData?.club?.id;
  const myClubName = profileData?.club?.name || profileData?.club?.full_name || "Mi Club";

  // Separar nadadores de mi club vs nadadores de otros clubes guardados por torneos previos
  const { clubAthletes, rivalAthletes } = useMemo(() => {
    const targetNorm = myClubCode ? normalizeTeamCode(myClubCode).code : "JSWIM";
    const clubList: typeof data = [];
    const rivalList: typeof data = [];

    data.forEach((a) => {
      const aClubId = a.club_id;
      const aTeamCode = a.teams?.code || "";
      const isMyClub =
        (myClubId && aClubId === myClubId) ||
        (aTeamCode && normalizeTeamCode(aTeamCode).code === targetNorm) ||
        (!aClubId && !aTeamCode); // Atletas agregados directamente sin código externo

      if (isMyClub) {
        clubList.push(a);
      } else {
        rivalList.push(a);
      }
    });

    return { clubAthletes: clubList, rivalAthletes: rivalList };
  }, [data, myClubId, myClubCode]);

  // Lista visible: EXCLUSIVAMENTE nadadores de nuestro club
  const list = useMemo(() => {
    return clubAthletes.filter((a) =>
      matchesAthlete(a, filters, categories, filters.season === "all" ? new Date().getFullYear() : Number(filters.season)) &&
      `${a.first_name} ${a.last_name} ${a.federation_id ?? ""}`.toLowerCase().includes(q.toLowerCase())
    );
  }, [clubAthletes, filters, categories, q]);

  // Acción para depurar de la base de datos a los nadadores de otros equipos
  const handlePurgeRivalAthletes = async () => {
    if (!rivalAthletes.length || isPurging) return;
    const ok = window.confirm(
      `¿Deseas depurar tu base de datos y eliminar permanentemente a los ${rivalAthletes.length} nadadores de otros equipos guardados en importaciones anteriores? Tu cuenta quedará exclusivamente con los nadadores de tu club (${myClubCode}).`
    );
    if (!ok) return;

    setIsPurging(true);
    try {
      const rivalIds = rivalAthletes.map((a) => a.id);
      // 1. Eliminar resultados de nadadores rivales
      await supabase.from("results").delete().in("athlete_id", rivalIds);
      // 2. Eliminar logros asociados
      await supabase.from("athlete_achievements").delete().in("athlete_id", rivalIds);
      // 3. Eliminar nadadores rivales
      const { error: deleteError } = await supabase.from("athletes").delete().in("id", rivalIds);
      if (deleteError) throw deleteError;

      // 4. Depurar clubes dummy creados como rivales si existen
      if (myClubId) {
        const { data: rivalClubs } = await supabase
          .from("clubs")
          .select("id, team_code")
          .neq("id", myClubId);
        if (rivalClubs && rivalClubs.length > 0) {
          const rivalClubIds = rivalClubs
            .filter((c) => c.team_code && normalizeTeamCode(c.team_code).code !== normalizeTeamCode(myClubCode).code)
            .map((c) => c.id);
          if (rivalClubIds.length > 0) {
            await supabase.from("clubs").delete().in("id", rivalClubIds);
          }
        }
      }

      await qc.invalidateQueries({ queryKey: ["athletes"] });
      await qc.invalidateQueries({ queryKey: ["coach-data"] });
      await qc.invalidateQueries({ queryKey: ["dashboard"] });
      await qc.invalidateQueries({ queryKey: ["club-management"] });
      await qc.invalidateQueries({ queryKey: ["club-register"] });

      toast.success(
        `¡Base de datos depurada! Se eliminaron ${rivalIds.length} nadadores de otros equipos. Tu programa ahora contiene exclusivamente los atletas de ${myClubCode}.`
      );
    } catch (err: any) {
      toast.error(err?.message || "No se pudo completar la depuración.");
    } finally {
      setIsPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Encabezado y Control de Club */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-4xl font-bold uppercase">Atletas</h1>
            <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary text-xs font-semibold gap-1">
              <Building2 className="h-3 w-3" />
              {myClubCode} ({myClubName})
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {clubAthletes.length} nadadores registrados exclusivamente en tu equipo
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <NewAthlete />
          <AthleteDocumentImporter
            mode="dialog"
            buttonVariant="outline"
            buttonLabel="Importar Atletas (ZIP / PDF)"
          />
          <ClubMembersExtractor
            club={profileData?.club}
            athletes={clubAthletes}
            mode="dialog"
            buttonVariant="outline"
            buttonLabel="Extraer Integrantes (PDF / ZIP)"
          />
          <HistoryTransfer label="Buscar historial de atletas" />
          <Input
            placeholder="Buscar por nombre o ID"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="w-full sm:w-64"
          />
        </div>
      </div>

      {/* BANNER DE DEPURACIÓN (Si existen atletas de otros clubes en la base de datos) */}
      {rivalAthletes.length > 0 && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 transition-all">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2 font-semibold text-sm text-amber-800 dark:text-amber-300">
                <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                <span>Se detectaron {rivalAthletes.length} atletas de otros equipos en tu base de datos</span>
              </div>
              <p className="text-xs text-muted-foreground max-w-2xl">
                Estos nadadores fueron guardados durante importaciones anteriores de torneos completos. Para que el programa trabaje <strong>exclusivamente con tu equipo</strong>, puedes depurarlos con un solo clic.
              </p>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={handlePurgeRivalAthletes}
              disabled={isPurging}
              className="gap-2 shrink-0 font-semibold text-xs shadow-sm"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {isPurging ? "Depurando..." : `Eliminar ${rivalAthletes.length} nadadores de otros clubes`}
            </Button>
          </div>
        </div>
      )}

      {/* Lista de Atletas del Club */}
      {clubAthletes.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-10 text-center text-muted-foreground space-y-4 max-w-xl mx-auto">
          <div className="space-y-1">
            <p className="font-semibold text-foreground text-lg">Aún no hay nadadores registrados para tu equipo ({myClubCode}).</p>
            <p className="text-sm">
              Puedes agregar nadadores manualmente, <Link to="/import" className="text-primary underline font-medium">importar resultados/entry lists</Link> o cargar tu nómina oficial en PDF o ZIP.
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <AthleteDocumentImporter
              mode="dialog"
              buttonVariant="default"
              buttonLabel="Importar Atletas (ZIP / PDF)"
            />
          </div>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => (
            <div key={a.id} className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary shadow-sm">
              <Link to="/athletes/$id" params={{ id: a.id }}>
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-display text-xl font-semibold uppercase group-hover:text-primary">
                      {a.last_name}, {a.first_name}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
                      <span className="font-semibold text-primary">{myClubCode}</span>
                      <span>·</span>
                      <span>{a.teams?.name ?? myClubName}</span>
                    </div>
                  </div>
                  <span className="time rounded bg-secondary px-2 py-0.5 text-xs font-medium">
                    {a.gender ?? "-"} · {ageAt(a.birth_date) ?? "?"} · {ageGroup(ageAtDec31(a.birth_date, new Date().getFullYear()))}
                  </span>
                </div>
              </Link>
              <div className="mt-3 flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
                <span>{a.federation_id ? `Ficha: ${a.federation_id}` : "Sin ficha oficial"}</span>
                <DeleteAthlete id={a.id} name={`${a.first_name} ${a.last_name}`} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
