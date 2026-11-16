import { aquaRankingHeaders, aquaRankingRows, aquaRankingPdf, workbookFile } from "@/lib/coach-reports";
import type { DashboardResult } from "@/lib/dashboard-summary";
import { PdfExport } from "@/components/pdf-export";
import { ShareSummary } from "@/components/share-summary";

export function AquaRanking({ results,clubId }: { results: (DashboardResult & { aqua_points: number | null })[];clubId?:string|undefined }) {
  const rows = aquaRankingRows(results);
  return <section className="space-y-4 border-b pb-6">
    <h3 className="text-xl font-semibold">Clasificación por puntos AQUA</h3>
    <p className="text-sm text-muted-foreground">Mejor puntuación por atleta · Últimos 9 meses</p>
    <div className="flex flex-wrap gap-2">
      <PdfExport title="Ranking AQUA" clubId={clubId} label="PDF de ranking AQUA" prepare={() => aquaRankingPdf(results)} />
      <PdfExport title="Ranking AQUA · Excel" label="Excel de ranking AQUA" prepare={() => workbookFile("Swim Lane Coach_ranking_AQUA", [{ name: "Ranking AQUA", headers: aquaRankingHeaders, rows }])} />
      <ShareSummary text={`Swim Lane Coach\nRanking interno · AQUA\nMejor puntuación individual · Últimos 9 meses\n${rows.slice(0,10).map(r => `${r[0]}. ${r[1]} · ${r[2]} puntos · ${r[4]} ${r[5]} · ${r[6]}`).join("\n")}`} />
    </div>
    <div className="overflow-x-auto border-y">
      <table aria-label="Ranking por puntos AQUA" className="w-full text-left text-sm">
        <thead><tr>{aquaRankingHeaders.map(h => <th key={h} className="whitespace-nowrap border-b p-3 font-medium text-muted-foreground">{h}</th>)}</tr></thead>
        <tbody>{rows.map((r,i) => <tr key={i}>{r.map((cell,j) => <td key={j} className={`whitespace-nowrap border-b p-3 ${j === 2 ? "font-semibold text-primary" : ""}`}>{cell}</td>)}</tr>)}</tbody>
      </table>
      {!rows.length && <p className="py-6 text-sm text-muted-foreground">Sin resultados individuales con puntos AQUA vigentes.</p>}
    </div>
  </section>;
}