import { createFileRoute } from "@tanstack/react-router";
import { UnifiedResultsImportHub } from "@/components/imports/UnifiedResultsImportHub";
import { ResetData } from "@/components/reset-data";

export const Route = createFileRoute("/_authenticated/import")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Centro de Importación de Resultados — Swim Lane Coach" },
      {
        name: "description",
        content:
          "Sube archivos Hy-Tek (.hy3, .cl2, .sd3, .zip), reportes PDF de Meet Manager, Access (.mdb) o enlaces web ADAEL/FEVEDA y destínalos a tu club, al ranking estadal o al circuito oficial.",
      },
      { property: "og:title", content: "Centro de Importación de Resultados — Swim Lane Coach" },
      {
        property: "og:description",
        content:
          "Importación unificada de resultados y eventos con asignación a ranking estadal, club y circuito oficial.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ImportPage,
});

function ImportPage() {
  return (
    <div className="space-y-8">
      {/* Centro Unificado de Importación de Resultados */}
      <UnifiedResultsImportHub />

      {/* Sección de Administración y Limpieza de Datos */}
      <section className="border-t pt-6">
        <h2 className="mb-3 text-xl font-bold uppercase">Administración de datos</h2>
        <ResetData />
      </section>
    </div>
  );
}
