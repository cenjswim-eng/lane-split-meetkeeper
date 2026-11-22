import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { coachQuery } from '@/lib/coach-data';
import { profileQuery } from '@/lib/profile';
import { AquaRanking } from '@/components/aqua-ranking';
import { AssociationRanking } from '@/components/association-ranking';
import { AdaelRankingView } from '@/components/adael/AdaelRankingView';
import { StateRankingView } from '@/components/StateRankingView';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useWorkspaceFilters, matchesResult } from '@/lib/workspace-filters';
import { useSwimCategories } from '@/lib/categories';
import { Trophy, ExternalLink, Medal } from 'lucide-react';

export const Route = createFileRoute('/_authenticated/rankings')({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Ranking Estadal y Clasificaciones — Swim Lane Coach' },
      { name: 'description', content: 'Ranking oficial estadal filtrado por asociación, cruces de edad y clasificación AQUA.' },
      { property: 'og:title', content: 'Ranking Estadal y Clasificaciones — Swim Lane Coach' },
      { property: 'og:description', content: 'Ranking oficial por estado según club activo, cruces de edad y puntos AQUA.' },
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
  const [activeTab, setActiveTab] = useState(search.tab || 'estadal');

  useEffect(() => {
    if (search.tab) {
      setActiveTab(search.tab);
    }
  }, [search.tab]);

  const { filters } = useWorkspaceFilters();
  const categories = useSwimCategories();
  const results = data.results.filter((r) => matchesResult(r, filters, categories));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-4xl font-bold">Rankings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ranking oficial estadal según el club activo, clasificaciones regionales y puntuación World Aquatics
          </p>
        </div>
        <Link
          to="/ranking-adael-2026"
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
        >
          <Trophy className="h-4 w-4" />
          Ranking Oficial ADAEL 2026
          <ExternalLink className="h-3 w-3 opacity-70" />
        </Link>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-5 max-w-3xl">
          <TabsTrigger value="estadal" className="flex items-center gap-1.5 font-bold">
            <Medal className="h-3.5 w-3.5 text-primary" />
            Ranking Estadal
          </TabsTrigger>
          <TabsTrigger value="association">Top 5 Asociación</TabsTrigger>
          <TabsTrigger value="adael">Ranking ADAEL 2026</TabsTrigger>
          <TabsTrigger value="aqua">Ranking AQUA</TabsTrigger>
          <TabsTrigger value="teams">Equipos y Temporadas</TabsTrigger>
        </TabsList>

        <TabsContent value="estadal" className="space-y-6 pt-1">
          <StateRankingView
            results={data.results}
            athletes={data.athletes}
            clubs={(data as any).clubs || []}
            teams={(data as any).teams || []}
            activeClub={profileData?.club}
          />
        </TabsContent>

        <TabsContent value="adael" className="space-y-6 pt-1">
          <AdaelRankingView />
        </TabsContent>

        <TabsContent value="association" className="space-y-6 pt-1">
          <AssociationRanking
            results={data.results}
            athletes={data.athletes}
            clubs={(data as any).clubs || []}
            teams={(data as any).teams || []}
            meets={data.meets || []}
          />
        </TabsContent>

        <TabsContent value="aqua" className="space-y-6 pt-1">
          <AquaRanking results={results as any} />
        </TabsContent>

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
