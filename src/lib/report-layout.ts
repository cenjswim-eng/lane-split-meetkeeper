import type { jsPDF } from 'jspdf';
import { neutralBrand, type ReportBrand } from './report-brand';
/** Print roles are independent of the user's screen theme. */
export const reportPrint = { ink: '#182E39', muted: '#586873', rule: '#DCE3E7', surface: '#F3F6F8', paper: '#FFFFFF' };
export const nativeReportLayout = 'swim-lane-coach-editorial-v1';
export function reportHeading(doc: jsPDF, title: string, subtitle: string, brand?: ReportBrand) {
  const identity = brand ?? neutralBrand();
  doc.setProperties({ title, author: identity.name, creator: 'Swim Lane Coach', keywords: nativeReportLayout });
  doc.setFont('helvetica', 'bold'); doc.setTextColor(identity.primary); doc.setFontSize(9);
  doc.text(doc.splitTextToSize(identity.name.toUpperCase(), 215).slice(0, 2), 14, 12);
  doc.setTextColor(reportPrint.ink); doc.setFontSize(19);
  doc.text(doc.splitTextToSize(title, 220), 14, 25);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(reportPrint.muted);
  const lines = doc.splitTextToSize(subtitle, 250) as string[]; doc.text(lines, 14, 33);
  return 37 + lines.length * 4;
}
export function reportMetrics(doc: jsPDF, metrics: readonly {label: string; value: string}[], y: number, brand?: ReportBrand) {
  const width = (doc.internal.pageSize.getWidth() - 28) / metrics.length;
  metrics.forEach((metric, i) => {
    const x = 14 + i * width;
    doc.setFillColor(reportPrint.surface); doc.rect(x, y, width - 3, 20, 'F');
    doc.setFillColor(brand?.primary ?? neutralBrand().primary); doc.rect(x, y, 1, 20, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor(reportPrint.ink); doc.text(metric.value, x + 5, y + 9);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(reportPrint.muted); doc.text(metric.label, x + 5, y + 16);
  });
  return y + 27;
}
export function finishReport(doc: jsPDF, brand?: ReportBrand) {
  const identity = brand ?? neutralBrand();
  for (let page = 1; page <= doc.getNumberOfPages(); page++) {
    doc.setPage(page);
    const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight();
    doc.setFillColor(identity.primary); doc.rect(0, 0, width, 1.8, 'F');
    doc.setFillColor(identity.secondary); doc.rect(width - 48, 0, 48, 1.8, 'F');
    if (identity.logo) {
      try {
        const image = doc.getImageProperties(identity.logo); const scale = Math.min(32 / image.width, 19 / image.height);
        doc.addImage(identity.logo, 'PNG', width - 14 - image.width * scale, 6, image.width * scale, image.height * scale);
      } catch { /* Keep the report readable when a stored logo is invalid. */ }
    }
    doc.setDrawColor(reportPrint.rule); doc.setLineWidth(0.25); doc.line(14, height - 10, width - 14, height - 10);
    doc.setTextColor(reportPrint.muted); doc.setFont('helvetica', 'normal'); doc.setFontSize(7);
    doc.textWithLink('Swim Lane Coach', 14, height - 5, {url: 'https://swimlanecoach.app/?utm_source=report&utm_medium=referral&utm_campaign=pdf'});
    const context = [identity.contact, identity.location].filter(Boolean).join(' · ') || identity.name;
    doc.text(doc.splitTextToSize(context, width - 110).slice(0, 1), 55, height - 5);
    doc.text(`${page} / ${doc.getNumberOfPages()}`, width - 14, height - 5, {align: 'right'});
  }
}
