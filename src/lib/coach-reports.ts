import { exportFilename } from "@/lib/file-delivery";
import { eventLabel, formatTime } from "@/lib/swim";
import { internalRanking, aquaRanking } from "@/lib/entry-rules";
import type { DashboardResult } from "@/lib/dashboard-summary";
import { jsPDF } from "jspdf";
import { brandedTable as autoTable,setReportTableBrand } from './report-table-theme';
import type { ReportBrand } from './report-brand';

type Cell = string | number | null;
export async function workbookFile(name: string, sheets: { name: string; headers: string[]; rows: Cell[][] }[]) {
  const Excel = await import("exceljs");
  const book = new Excel.Workbook();
  book.creator = "Swim Lane Coach";
  for (const sheet of sheets) {
    const page = book.addWorksheet(sheet.name.slice(0, 31));
    page.columns = sheet.headers.map(header => ({ header, width: 24 }));
    for (const row of sheet.rows) page.addRow(row.map(value => value ?? "—"));
    page.views = [{ state: "frozen", ySplit: 1 }];
    page.autoFilter = { from: { row: 1, column: 1 }, to: { row: Math.max(1, sheet.rows.length + 1), column: sheet.headers.length } };
    page.getRow(1).font = { bold: true };
  }
  const bytes = await book.xlsx.writeBuffer();
  return new File([new Uint8Array(bytes)], exportFilename(name, ".xlsx"), { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
}

export function rankingRows(results: DashboardResult[]) {
  return internalRanking(results).map(r => [r.rank, `${r.athletes?.first_name ?? ""} ${r.athletes?.last_name ?? ""}`, r.athletes?.gender ?? "—", r.category, r.events ? eventLabel(r.events.distance, r.events.stroke) : "—", r.course ?? "—", formatTime(r.final_time_ms), r.meets?.name ?? "—", r.meets?.start_date ?? "—"]);
}
export const rankingHeaders = ["Puesto", "Atleta", "Sexo", "Categoría", "Prueba", "Piscina", "Tiempo", "Competencia", "Fecha"];
export const aquaRankingHeaders = ["Puesto", "Atleta", "AQUA", "Sexo", "Prueba", "Piscina", "Tiempo", "Competencia", "Fecha"];
export function aquaRankingRows(results: (DashboardResult & { aqua_points: number | null })[]) {
  return aquaRanking(results).map(r => [r.rank, `${r.athletes?.first_name ?? ""} ${r.athletes?.last_name ?? ""}`, r.aqua_points ?? 0, r.athletes?.gender ?? "—", r.events ? eventLabel(r.events.distance, r.events.stroke) : "—", r.course ?? "—", formatTime(r.final_time_ms), r.meets?.name ?? "—", r.meets?.start_date ?? "—"]);
}
export function aquaRankingPdf(results: (DashboardResult & { aqua_points: number | null })[],brand?:ReportBrand) {
  const doc = new jsPDF({ orientation: "landscape" });
  setReportTableBrand(doc,brand);
  doc.setProperties({ title: "Ranking interno AQUA", author: "Swim Lane Coach", creator: "Swim Lane Coach" });
  doc.setFontSize(17); doc.text("Ranking interno · Puntos AQUA", 14, 16);
  doc.setFontSize(10); doc.text("Últimos 9 meses · Mejor puntuación individual por atleta", 14, 23);
  autoTable(doc, { startY: 29, head: [aquaRankingHeaders], body: aquaRankingRows(results), styles: { fontSize: 8 } });
  for (let p = 1; p <= doc.getNumberOfPages(); p++) { doc.setPage(p); doc.setFontSize(8); doc.text("Swim Lane Coach · Compatible con Meet Manager y Team Manager", 14, doc.internal.pageSize.getHeight() - 6); }
  return new File([doc.output("blob")], "Swim Lane Coach_ranking_AQUA.pdf", { type: "application/pdf" });
}
export function rankingPdf(results: DashboardResult[],brand?:ReportBrand) {
  const doc = new jsPDF({ orientation: "landscape" });
  setReportTableBrand(doc,brand);
  doc.setProperties({ title: "Ranking interno del club", author: "Swim Lane Coach", creator: "Swim Lane Coach" });
  doc.setFontSize(17); doc.text("Ranking interno del club", 14, 16);
  doc.setFontSize(10); doc.text("Últimos 9 meses · Por prueba, piscina, sexo y categoría al 31/12", 14, 23);
  autoTable(doc, { startY: 29, head: [rankingHeaders], body: rankingRows(results), styles: { fontSize: 8 } });
  for (let p = 1; p <= doc.getNumberOfPages(); p++) { doc.setPage(p); doc.setFontSize(8); doc.text("Swim Lane Coach · Compatible con Meet Manager y Team Manager", 14, doc.internal.pageSize.getHeight() - 6); }
  return new File([doc.output("blob")], "Swim Lane Coach_ranking.pdf", { type: "application/pdf" });
}
