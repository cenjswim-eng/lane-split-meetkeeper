import type { jsPDF } from "jspdf";
import { brandedTable as autoTable } from './report-table-theme';
import type { ReportBrand } from './report-brand';
import { athleteProgressSeries, athleteRecordWindow } from "./athlete-records";
import type { AthleteReportResult } from "./reports";
import { eventLabel, formatTime } from "./swim";

// Shared print roles, independent of the on-screen dark theme.
const print = { ink: "#182E39", muted: "#586873", grid: "#DCE3E7", line: "#0C4A6E", improvement: "#059669", accent: "#F59E0B" };
const dateLabel = (date: string | null | undefined) => date ? date.split("-").reverse().join("/") : "—";
// Seven labelled swims keep the chart and its swim table inside one landscape A4 page.
const SWIMS_PER_PAGE = 7;

/** Vector charts stay sharp when printed and need no browser canvas or screenshot. */
export function appendAthleteProgressCharts(doc: jsPDF, name: string, results: AthleteReportResult[], now = new Date(), brand?: ReportBrand) {
  const { from, to } = athleteRecordWindow(now);
  const primaryColor = brand?.primary ?? print.line;
  const secondaryColor = brand?.secondary ?? "#38BDF8";

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
    const change = improvement === 0
      ? "Sin cambio"
      : `${improvement > 0 ? "Mejora" : "Aumento"}: ${formatTime(Math.abs(improvement))} (${(Math.abs(improvement) / first * 100).toFixed(2)}%)`;

    for (let offset = 0; offset < group.records.length; offset += SWIMS_PER_PAGE) {
      const records = group.records.slice(offset, offset + SWIMS_PER_PAGE);
      doc.addPage();

      // Top creative badge pill
      doc.setFillColor(primaryColor);
      if (typeof doc.roundedRect === 'function') {
        doc.roundedRect(14, 10, 68, 5, 1.2, 1.2, 'F');
      } else {
        doc.rect(14, 10, 68, 5, 'F');
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7);
      doc.setTextColor(255, 255, 255);
      doc.text("CURVA DE EVOLUCIÓN TÉCNICA", 17, 13.5);

      // Section Title
      doc.setTextColor(primaryColor);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(15);
      doc.text(doc.splitTextToSize(`Evolución · ${eventLabel(group.distance, group.stroke)} · ${group.course ?? "Piscina sin especificar"}`, 225), 14, 21);

      // Subtitle
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(print.muted);
      doc.text(doc.splitTextToSize(`${name} | ${dateLabel(from)} – ${dateLabel(to)} | Nados ${offset + 1}–${offset + records.length} de ${group.records.length}`, 267), 14, 28);

      // Stat indicators bar
      doc.setFillColor("#F8FAFC");
      doc.setDrawColor(print.grid);
      doc.setLineWidth(0.2);
      if (typeof doc.roundedRect === 'function') {
        doc.roundedRect(14, 32, 269, 9, 1.5, 1.5, 'FD');
      } else {
        doc.rect(14, 32, 269, 9, 'FD');
      }

      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(print.ink);
      doc.text(`Primer nado: ${formatTime(first)}   |   Último: ${formatTime(last)}   |   Mejor: ${formatTime(best)}`, 18, 38);

      // Improvement Badge on right
      doc.setFont("helvetica", "bold");
      if (improvement > 0) {
        doc.setTextColor(16, 120, 70); // green
      } else if (improvement < 0) {
        doc.setTextColor(180, 40, 30); // red
      } else {
        doc.setTextColor(print.muted);
      }
      doc.text(change, 280, 38, { align: "right" });

      // Chart plotting area
      const left = 36, top = 49, width = 242, height = 66;

      // Subtle background canvas for the chart
      doc.setFillColor("#FBFDFE");
      doc.setDrawColor("#E2E8F0");
      doc.setLineWidth(0.2);
      if (typeof doc.roundedRect === 'function') {
        doc.roundedRect(left - 2, top - 3, width + 4, height + 6, 2, 2, 'FD');
      } else {
        doc.rect(left - 2, top - 3, width + 4, height + 6, 'FD');
      }

      // Horizontal grid lines
      doc.setLineWidth(0.15);
      for (let tick = 0; tick <= 4; tick++) {
        const y = top + tick * height / 4;
        doc.setDrawColor("#E2E8F0");
        doc.line(left, y, left + width, y);
        doc.setTextColor(print.muted);
        doc.setFontSize(7.5);
        doc.setFont("helvetica", "normal");
        doc.text(formatTime(min + (max - min) * tick / 4), left - 4, y + 1, { align: "right" });
      }

      const point = (i: number, time: number) => ({
        x: records.length === 1 ? left + width / 2 : left + i * width / (records.length - 1),
        y: top + (time - min) / (max - min) * height,
      });

      // Calculate all points
      const points = records.map((r, i) => {
        const time = r.final_time_ms;
        if (time == null) return null;
        return { ...point(i, time), time, record: r, index: i };
      }).filter(Boolean) as { x: number; y: number; time: number; record: AthleteReportResult; index: number }[];

      // Draw soft gradient/shaded area below the curve
      if (points.length > 1) {
        doc.setFillColor("#EBF5FB"); // Very soft brand tint
        for (let i = 0; i < points.length - 1; i++) {
          const p1 = points[i];
          const p2 = points[i + 1];
          const baseY = top + height;
          // Shaded trapezoid under each segment
          if (typeof (doc as any).triangle === 'function') {
            doc.triangle(p1.x, p1.y, p2.x, p2.y, p1.x, baseY, 'F');
            doc.triangle(p2.x, p2.y, p1.x, baseY, p2.x, baseY, 'F');
          }
        }
      }

      // Draw bold connecting curve line
      doc.setDrawColor(primaryColor);
      doc.setLineWidth(0.8);
      for (let i = 0; i < points.length - 1; i++) {
        doc.line(points[i].x, points[i].y, points[i + 1].x, points[i + 1].y);
      }

      // Draw point markers
      points.forEach((p) => {
        const isBest = p.time === best;

        if (isBest) {
          // Highlight halo for best time
          doc.setFillColor(print.accent); // gold/amber halo
          doc.circle(p.x, p.y, 2.2, "F");
          doc.setFillColor(print.improvement); // emerald center
          doc.circle(p.x, p.y, 1.4, "F");

          // Text above best time
          doc.setFont("helvetica", "bold");
          doc.setFontSize(8);
          doc.setTextColor(8, 115, 60);
          doc.text(`★ ${formatTime(p.time)}`, p.x, p.y - 4, { align: "center" });
        } else {
          doc.setFillColor(primaryColor);
          doc.circle(p.x, p.y, 1.3, "F");
          doc.setTextColor(print.ink);
          doc.setFont("helvetica", "normal");
          doc.setFontSize(7.5);
          doc.text(formatTime(p.time), p.x, p.y - 3, { align: "center" });
        }

        // Timeline labels below X axis
        doc.setTextColor(print.muted);
        doc.setFontSize(7);
        doc.text(String(offset + p.index + 1), p.x, top + height + 5, { align: "center" });
        doc.text(dateLabel(p.record.meets?.start_date), p.x, top + height + 10, { align: "center" });
      });

      // Chart footnote explanation
      doc.setTextColor(print.muted);
      doc.setFontSize(7.5);
      doc.setFont("helvetica", "normal");
      if (group.records.length === 1) {
        doc.text("Una sola marca disponible; aún no hay comparación entre competencias.", 14, 134);
      } else {
        doc.text("★ Mejor marca resaltada. Variación calculada entre el primer y el último nado de esta prueba y piscina.", 14, 134);
      }

      // Accompanying swim table
      autoTable(doc, {
        startY: 138,
        head: [["Nado", "Fecha", "Competencia / Torneo", "Ronda", "Tiempo final"]],
        body: records.map((r, i) => [
          `#${offset + i + 1}`,
          dateLabel(r.meets?.start_date),
          r.meets?.name ?? "—",
          r.round === "P" ? "Eliminatoria" : r.round === "F" ? "Final" : r.round ?? "—",
          formatTime(r.final_time_ms),
        ]),
        styles: { fontSize: 8, cellPadding: 1.8 },
        headStyles: { fillColor: primaryColor as any, fontStyle: "bold" },
        columnStyles: {
          0: { cellWidth: 18, halign: "center", fontStyle: "bold" },
          1: { cellWidth: 28, halign: "center" },
          2: { cellWidth: "auto" },
          3: { cellWidth: 28, halign: "center" },
          4: { cellWidth: 30, halign: "right", fontStyle: "bold" },
        },
        margin: { left: 14, right: 14, bottom: 25 },
      });
    }
  }
}