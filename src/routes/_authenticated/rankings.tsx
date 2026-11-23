import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { coachQuery } from '@/lib/coach-data';
import { profileQuery } from '@/lib/profile';
import { LocalTeamRankingView } from '@/components/rankings/LocalTeamRankingView';
import { AquaRanking } from '@/components/aqua-ranking';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useWorkspaceFilters, matchesResult } from '@/lib/workspace-filters';
import { useSwimCategories } from '@/lib/categories';
import { Trophy, Users, Medal, Building2, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export const Route = createFileRoute('/_authenticated/rankings')({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Rankings del Club — Swim Lane Coach' },
      {
        name: 'description',
        content: 'Seguimiento de marcas personales, mejores tiempos y clasificación de los atletas del club.',
      },
      { property: 'og:title', content: 'Rankings del Club — Swim Lane Coach' },
      {
        property: 'og:description',
        content: 'Ranking interno de marcas, clasificación AQUA y progresión de los nadadores del club.',
      },
      { property: 'og:type', content: 'website' },
      { name: 'twitter:card', content: 'summary_large_image' },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(coachQuery),
  component: Rankings,
});

function Rankings() {
  const { data } = useSuspenseQuery(coachQuery);
  const { data: profileData } = useQuery(profileQuery);
  const search = Route.useSearch();
  const [activeTab, setActiveTab] = useState(search.tab || 'club');

  useEffect(() => {
    if (search.tab && (search.tab === 'club' || search.tab === 'aqua' || search.tab === 'teams')) {
      setActiveTab(search.tab);
    }
  }, [search.tab]);

  const { filters } = useWorkspaceFilters();
  const categories = useSwimCategories();
  const results = data.results.filter((r) => matchesResult(r, filters, categories));

  const myClubName = profileData?.club?.name || 'Mi Club';
  const myClubCode = profileData?.club?.code || 'JSWIM';

  return (
    <div className="space-y-6">
      {/* Encabezado Principal */}
      <div className="flex flex-wrap items-end justify-between gap-3 border-b pb-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rankings del Club</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Seguimiento de marcas individuales, mejores tiempos personales (PB) y clasificación de los nadadores de nuestro club.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1.5 border-primary/30 py-1 text-xs font-semibold text-primary">
            <Building2 className="h-3.5 w-3.5" />
            Club Activo: {myClubCode} ({myClubName})
          </Badge>
          <Link
            to="/adael-2026"
            className="inline-flex items-center gap-2 px-3 py-1 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Módulo ADAEL 2026
          </Link>
        </div>
      </div>

      {/* Tabs de Seguimiento del Club */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-lg bg-muted/80 p-1">
          <TabsTrigger
            value="club"
            className="flex items-center justify-center gap-2 font-bold text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Users className="h-4 w-4 text-primary" />
            Marcas del Club
          </TabsTrigger>
          <TabsTrigger
            value="aqua"
            className="flex items-center justify-center gap-2 font-bold text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Trophy className="h-4 w-4 text-amber-500" />
            Ranking AQUA
          </TabsTrigger>
          <TabsTrigger
            value="teams"
            className="flex items-center justify-center gap-2 font-bold text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Medal className="h-4 w-4 text-indigo-500" />
            Temporadas
          </TabsTrigger>
        </TabsList>

        {/* 1. RANKING INTERNO Y SEGUIMIENTO DEL EQUIPO LOCAL */}
        <TabsContent value="club" className="space-y-6 pt-1">
          <LocalTeamRankingView
            results={results}
            athletes={data.athletes}
            activeClub={profileData?.club}
          />
        </TabsContent>

        {/* 2. CLASIFICACIÓN AQUA (WORLD AQUATICS) */}
        <TabsContent value="aqua" className="space-y-6 pt-1">
          <AquaRanking results={results as any} clubId={profileData?.club?.id} />
        </TabsContent>

        {/* 3. EQUIPOS Y TEMPORADAS */}
        <TabsContent value="teams" className="space-y-4 pt-1">
          <section className="space-y-4">
            <h2 className="text-xl font-semibold">Equipos y temporadas</h2>
            <div className="overflow-x-auto border rounded-lg">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    {['Equipo registrado', 'Temporada', 'Nados con AQUA', 'Mejor AQUA'].map((h) => (
                      <th className="whitespace-nowrap border-b p-3 font-medium" key={h}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {[
                    ...new Set(
                      results.flatMap((r) => {
                        const a = data.athletes.find((a) => a.id === r.athlete_id);
                        return r.aqua_points != null
                          ? [`${a?.club_id ?? a?.teams?.code ?? 'sin-equipo'}|${r.meets?.start_date?.slice(0, 4) ?? '—'}`]
                          : [];
                      })
                    ),
                  ].map((key) => {
                    const [team, year] = key.split('|');
                    const swims = results.filter((r) => {
                      const a = data.athletes.find((a) => a.id === r.athlete_id);
                      return (
                        `${a?.club_id ?? a?.teams?.code ?? 'sin-equipo'}|${r.meets?.start_date?.slice(0, 4) ?? '—'}` ===
                          key &&
                        r.aqua_points != null &&
                        !r.is_dq
                      );
                    });
                    const a = data.athletes.find((a) => (a.club_id ?? a.teams?.code ?? 'sin-equipo') === team);
                    return (
                      <tr key={key} className="hover:bg-muted/30">
                        <td className="p-3 font-medium">
                          {a?.clubs?.full_name ?? a?.teams?.name ?? 'Sin equipo'}
                        </td>
                        <td className="p-3 font-mono">{year}</td>
                        <td className="p-3 font-mono">{swims.length}</td>
                        <td className="p-3 font-mono font-bold text-primary">
                          {Math.max(0, ...swims.map((r) => r.aqua_points ?? 0))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted-foreground">
              Solo registros de tu cuenta. El equipo es el registrado en la ficha actual; no acredita el club histórico
              de cada nado. El ranking conserva la vigencia de nueve meses.
            </p>
          </section>
        </TabsContent>
      </Tabs>
    </div>
  );
}
