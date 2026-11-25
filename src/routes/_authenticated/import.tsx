import { createFileRoute } from "@tanstack/react-router";
import { UnifiedResultsImportHub } from "@/components/imports/UnifiedResultsImportHub";
import { AthleteDocumentImporter } from "@/components/imports/AthleteDocumentImporter";
import { ResetData } from "@/components/reset-data";

export const Route = createFileRoute("/_authenticated/import")({
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Centro de Importación — Swim Lane Coach" },
      {
        name: "description",
        content:
          "Sube archivos Hy-Tek (.hy3, .cl2, .sd3, .zip), reportes PDF de Meet Manager, nóminas de atletas o enlaces web ADAEL/FEVEDA y destínalos a tu club.",
      },
      { property: "og:title", content: "Centro de Importación — Swim Lane Coach" },
      {
        property: "og:description",
        content:
          "Importación unificada de resultados, eventos y atletas mediante documentos ZIP o PDF para tu club.",
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
      {/* Importador de Atletas desde Documentos (ZIP o PDF) */}
      <section>
        <AthleteDocumentImporter mode="inline" />
      </section>

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
