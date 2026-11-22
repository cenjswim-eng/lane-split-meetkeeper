import { createFileRoute } from '@tanstack/react-router';
import { PublicShell } from '@/components/public-shell';
import { AdaelRankingView } from '@/components/adael/AdaelRankingView';
import { publicHead } from '@/lib/public-seo';
import { SITE_URL } from '@/lib/marketing';

export const Route = createFileRoute('/ranking-adael-2026')({
  staticData: { sitemap: true },
  head: () => ({
    ...publicHead(
      '/ranking-adael-2026',
      'Ranking Oficial Natación Federada — ADAEL 2026 (FEVEDA / World Aquatics)',
      'Consulta el ranking oficial de la temporada 2026 de la Asociación de Deportes Acuáticos del Estado Lara (ADAEL). Marcas mínimas nacionales FEVEDA, parciales de relevo reglamentarios, puntos World Aquatics y exportación a PDF y Excel.'
    ),
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'SportsOrganization',
          name: 'Asociación de Deportes Acuáticos del Estado Lara (ADAEL)',
          url: `${SITE_URL}/ranking-adael-2026`,
          sport: 'Swimming',
          description: 'Ranking oficial de natación federada del Estado Lara, temporada 2026.',
        }),
      },
    ],
  }),
  component: RankingAdaelPage,
});

function RankingAdaelPage() {
  return (
    <PublicShell>
      <AdaelRankingView />
    </PublicShell>
  );
}
