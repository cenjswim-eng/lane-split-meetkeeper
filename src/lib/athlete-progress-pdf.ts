import type { jsPDF } from "jspdf";
import { brandedTable as autoTable } from './report-table-theme';
import type { ReportBrand } from './report-brand';
import { athleteProgressSeries, athleteRecordWindow } from "./athlete-records";
import type { AthleteReportResult } from "./reports";
import { eventLabel, formatTime } from "./swim";

// Shared print roles, independent of the on-screen dark theme.
const print = { ink: "#182E39", muted: "#586873", grid: "#DCE3E7", line: "#0C4A6E", improvement: "#16765C" };
const dateLabel = (date: string | null | undefined) => date ? date.split("-").reverse().join("/") : "—";
// Seven labelled swims keep the chart and its swim table inside one landscape A4 page.
const SWIMS_PER_PAGE = 7;

/** Vector charts stay sharp when printed and need no browser canvas or screenshot. */
export function appendAthleteProgressCharts(doc: jsPDF, name: string, results: AthleteReportResult[], now = new Date(),brand?:ReportBrand) {
  const { from, to } = athleteRecordWindow(now);
  for (const group of athleteProgressSeries(results, now)) {
    const times = group.records.map((r) => r.final_time_ms ?? 0);
    const first = times[0];
    const last = times[times.length - 1];
    if (first == null || last == null) continue;
    const best = Math.min(...times);
    const worst = Math.max(...times);
    const padding = Math.max((worst - best) * 0.15, 500);
    const min = Math.max(0, best - padding), max = worst + padding;
    const improvement = first - last;
    const change = improvement === 0 ? "Sin cambio" : `${improvement > 0 ? "Mejora" : "Aumento"}: ${formatTime(Math.abs(improvement))} (${(Math.abs(improvement) / first * 100).toFixed(2)}%)`;

    for (let offset = 0; offset < group.records.length; offset += SWIMS_PER_PAGE) {
      const records = group.records.slice(offset, offset + SWIMS_PER_PAGE);
      doc.addPage();
      doc.setTextColor(brand?.primary??print.ink);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.text(doc.splitTextToSize(`Evolución · ${eventLabel(group.distance, group.stroke)} · ${group.course ?? "Piscina sin especificar"}`, 225), 14, 16);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(doc.splitTextToSize(`${name} | ${dateLabel(from)} – ${dateLabel(to)} | Nados ${offset + 1}–${offset + records.length} de ${group.records.length}`, 267), 14, 24);
      doc.setFontSize(9);
      doc.text(`Primero: ${formatTime(first)}     Último: ${formatTime(last)}     Mejor: ${formatTime(best)}     ${change}`, 14, 34);
      doc.setTextColor(print.muted);
      doc.setFontSize(8);
      doc.text("Tiempo final · más arriba = más rápido · orden cronológico", 14, 41);

      const left = 36, top = 51, width = 242, height = 65;
      doc.setLineWidth(0.2);
      for (let tick = 0; tick <= 4; tick++) {
        const y = top + tick * height / 4;
        doc.setDrawColor(brand?.secondary??print.grid);
        doc.line(left, y, left + width, y);
        doc.text(formatTime(min + (max - min) * tick / 4), left - 4, y + 1, { align: "right" });
      }
      const point = (i: number, time: number) => ({ x: records.length === 1 ? left + width / 2 : left + i * width / (records.length - 1), y: top + (time - min) / (max - min) * height });
      let previous: { x: number; y: number } | undefined;
      records.forEach((r, i) => {
        const time = r.final_time_ms;
        if (time == null) return;
        const p = point(i, time);
        doc.setDrawColor(brand?.primary??print.line);
        doc.setLineWidth(0.7);
        if (previous) doc.line(previous.x, previous.y, p.x, p.y);
        doc.setFillColor(time === best ? print.improvement : brand?.primary??print.line);
        doc.circle(p.x, p.y, 1.3, "F");
        doc.setTextColor(print.ink);
        doc.setFontSize(8);
        doc.text(formatTime(time), p.x, p.y - 3, { align: "center" });
        doc.setTextColor(print.muted);
        doc.setFontSize(7);
        doc.text(String(offset + i + 1), p.x, top + height + 5, { align: "center" });
        doc.text(dateLabel(r.meets?.start_date), p.x, top + height + 10, { align: "center" });
        previous = p;
      });
      doc.setTextColor(print.muted);
      doc.setFontSize(8);
      if (group.records.length === 1) doc.text("Una sola marca disponible; aún no hay comparación entre competencias.", 14, 135);
      else doc.text("Mejor marca resaltada. Variación calculada entre el primer y el último nado de esta prueba y piscina.", 14, 135);
      autoTable(doc, {
        startY: 140,
        head: [["Nado", "Fecha", "Competencia", "Ronda", "Tiempo final"]],
        body: records.map((r, i) => [offset + i + 1, dateLabel(r.meets?.start_date), r.meets?.name ?? "—", r.round === "P" ? "Eliminatoria" : r.round === "F" ? "Final" : r.round ?? "—", formatTime(r.final_time_ms)]),
        styles: { fontSize: 8, cellPadding: 1 },
        headStyles: { fillColor: print.line },
        columnStyles: { 0: { cellWidth: 18 }, 1: { cellWidth: 28 }, 3: { cellWidth: 28 }, 4: { cellWidth: 30 } },
        margin: { left: 14, right: 14, bottom: 25 },
      });
    }
  }
}