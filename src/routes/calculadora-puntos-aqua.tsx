import { createFileRoute, Link } from '@tanstack/react-router';
import { PublicShell } from '@/components/public-shell';
import { AquaCalculator } from '@/components/aqua-calculator';
import { publicHead } from '@/lib/public-seo';
import { SITE_URL } from '@/lib/marketing';
import { ArrowLeft, BookOpen, Waves } from 'lucide-react';

export const Route = createFileRoute('/calculadora-puntos-aqua')({
  staticData: { sitemap: true },
  head: () => ({
    ...publicHead(
      '/calculadora-puntos-aqua',
      'Calculadora de Puntos AQUA Natación (Oficial World Aquatics) — Swim Lane Coach',
      'Calcula puntos oficiales World Aquatics (AQUA Points) al instante para cualquier prueba, sexo y piscina de 25 m o 50 m. Conoce tiempos base y proyecta tiempos objetivos para nadadores.'
    ),
    scripts: [
      {
        type: 'application/ld+json',
        children: JSON.stringify({
          '@context': 'https://schema.org',
          '@type': 'WebApplication',
          name: 'Calculadora de Puntos AQUA — Swim Lane Coach',
          url: `${SITE_URL}/calculadora-puntos-aqua`,
          applicationCategory: 'SportsApplication',
          operatingSystem: 'All',
          description: 'Calculadora oficial interactiva de puntos World Aquatics para natación en piscinas de 25m y 50m.',
          author: {
            '@type': 'Organization',
            name: 'Swim Lane Coach',
            url: SITE_URL,
          },
        }),
      },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PublicShell>
      <div className="mx-auto max-w-4xl px-5 py-10 sm:px-8">
        <div className="mb-6 flex items-center justify-between">
          <Link
            to="/blog"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="size-3.5" />
            Volver a recursos
          </Link>
          <Link
            to="/blog/$slug"
            params={{ slug: 'puntos-aqua-natacion' }}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
          >
            <BookOpen className="size-3.5" />
            Guía completa sobre puntos AQUA
          </Link>
        </div>

        <div className="mb-8">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
            <Waves className="size-3.5" />
            Herramienta Gratuita de Natación
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight sm:text-4xl text-foreground">
            Calculadora de Puntos AQUA (World Aquatics)
          </h1>
          <p className="mt-3 text-base text-muted-foreground leading-relaxed">
            Convierte cualquier marca cronometrada en su puntuación oficial según las tablas vigentes de World Aquatics para piscinas de 50 metros y 25 metros.
          </p>
        </div>

        <AquaCalculator />
      </div>
    </PublicShell>
  );
}
