import { createFileRoute } from "@tanstack/react-router";
import { AdaelModule2026View } from "@/components/adael-2026/AdaelModule2026View";

export const Route = createFileRoute("/_authenticated/adael-2026")({
  staticData: { sitemap: false },
  validateSearch: (s: Record<string, unknown>): { tab?: string | undefined } => ({
    tab: typeof s["tab"] === "string" ? s["tab"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Módulo ADAEL 2026 (Clubes, Fichaje y Resultados) — Swim Lane Coach" },
      {
        name: "description",
        content:
          "Central oficial de resultados, clubes afiliados y padrón de atletas fichados por ADAEL para la temporada 2026 (Estadales Piscinas Bolivarianas y Copa Hocalar).",
      },
      {
        property: "og:title",
        content: "Módulo ADAEL 2026 (Clubes, Fichaje y Resultados) — Swim Lane Coach",
      },
      {
        property: "og:description",
        content:
          "Consulta clubes, padrón de atletas con edades calculadas al 31/12/2026 y rankings oficiales estadales.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdaelModuleRoute,
});

function AdaelModuleRoute() {
  return (
    <div className="container max-w-7xl mx-auto px-4 py-6">
      <AdaelModule2026View />
    </div>
  );
}
