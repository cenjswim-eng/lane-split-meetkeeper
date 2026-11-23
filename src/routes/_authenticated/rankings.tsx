import { createFileRoute, Link } from '@tanstack/react-router';
import { useSuspenseQuery, useQuery } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { coachQuery } from '@/lib/coach-data';
import { profileQuery } from '@/lib/profile';
import { StateRankingView } from '@/components/StateRankingView';
import { LocalTeamRankingView } from '@/components/rankings/LocalTeamRankingView';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { useWorkspaceFilters, matchesResult } from '@/lib/workspace-filters';
import { useSwimCategories } from '@/lib/categories';
import { Trophy, Users, Medal, ExternalLink, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_authenticated/rankings')({
  staticData: { sitemap: false },
  validateSearch: (search: Record<string, unknown>): { tab?: string } => ({
    tab: typeof search.tab === 'string' ? search.tab : undefined,
  }),
  head: () => ({
    meta: [
      { title: 'Rankings — Equipo Local y Ranking Estadal — Swim Lane Coach' },
      {
        name: 'description',
        content: 'Consulta simplificada de rankings: marcas internas del equipo local y ranking oficial estadal con clubes rivales.',
      },
      { property: 'og:title', content: 'Rankings — Equipo Local y Ranking Estadal — Swim Lane Coach' },
      {
        property: 'og:description',
        content: 'Ranking de nadadores del equipo local y ranking oficial estadal de asociaciones acuáticas.',
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
  const [activeTab, setActiveTab] = useState(search.tab || 'local');

  useEffect(() => {
    if (search.tab && (search.tab === 'local' || search.tab === 'estadal')) {
      setActiveTab(search.tab);
    }
  }, [search.tab]);

  const { filters } = useWorkspaceFilters();
  const categories = useSwimCategories();
  const results = data.results.filter((r) => matchesResult(r, filters, categories));

  return (
    <div className="space-y-6">
      {/* Encabezado Principal Simplificado */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Rankings Oficiales</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Consulta simplificada en dos vistas: marcas de nuestro equipo local y el ranking general estadal.
          </p>
        </div>
        <Link
          to="/adael-2026"
          className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors border border-primary/20"
        >
          <ShieldCheck className="h-4 w-4" />
          Módulo Completo ADAEL 2026
        </Link>
      </div>

      {/* Tabs Simplificados: EXACTAMENTE DOS VISTAS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 max-w-md bg-muted/80 p-1">
          <TabsTrigger
            value="local"
            className="flex items-center justify-center gap-2 font-bold text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Users className="h-4 w-4 text-primary" />
            1. Equipo Local (Mi Club)
          </TabsTrigger>
          <TabsTrigger
            value="estadal"
            className="flex items-center justify-center gap-2 font-bold text-xs sm:text-sm data-[state=active]:bg-background data-[state=active]:shadow-sm"
          >
            <Trophy className="h-4 w-4 text-amber-500" />
            2. Ranking Estadal (Oficial)
          </TabsTrigger>
        </TabsList>

        {/* 1. RANKING DEL EQUIPO LOCAL (MI CLUB) */}
        <TabsContent value="local" className="space-y-6 pt-1">
          <LocalTeamRankingView
            results={results}
            athletes={data.athletes}
            activeClub={profileData?.club}
          />
        </TabsContent>

        {/* 2. RANKING ESTADAL GENERAL (TODOS LOS CLUBES) */}
        <TabsContent value="estadal" className="space-y-6 pt-1">
          <StateRankingView
            results={data.results}
            athletes={data.athletes}
            clubs={(data as any).clubs || []}
            teams={(data as any).teams || []}
            activeClub={profileData?.club}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
