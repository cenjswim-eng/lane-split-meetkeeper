import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { formatTime } from "./swim";

export interface ReportRow {
  athlete: string;
  club: string;
  gender: string | null;
  age: number | null;
  event: string;
  seedMs: number | null;
  finalMs: number | null;
  isDq: boolean;
  place: number | null;
  points: number | null;
}

function header(doc: jsPDF, title: string, subtitle: string) {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(title, 14, 16);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(90);
  doc.text(subtitle, 14, 23);
  doc.setTextColor(0);
}

function slug(s: string) {
  return s.replace(/[^\w]+/g, "_").replace(/^_+|_+$/g, "");
}

/** Official results sheet ("listado de marcas"). */
export function resultsPdf(meetName: string, meta: string, rows: ReportRow[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  header(doc, `Listado de marcas — ${meetName}`, meta);
  autoTable(doc, {
    startY: 28,
    head: [["#", "Atleta", "Club", "G", "Edad", "Prueba", "Sembrado", "Final", "Puesto", "AQUA"]],
    body: rows.map((r, i) => [
      i + 1,
      r.athlete,
      r.club,
      r.gender ?? "—",
      r.age ?? "—",
      r.event,
      formatTime(r.seedMs),
      r.isDq ? "DQ" : formatTime(r.finalMs),
      r.place ?? "—",
      r.points ?? "—",
    ]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [12, 74, 110] },
  });
  doc.save(`${slug(meetName)}_marcas.pdf`);
}

/** Pre-entry sheet ("pre-inscripciones") with seed times, ready to send. */
export function entriesPdf(meetName: string, meta: string, rows: ReportRow[]) {
  const doc = new jsPDF({ orientation: "landscape" });
  header(doc, `Pre-inscripción — ${meetName}`, meta);
  autoTable(doc, {
    startY: 28,
    head: [["#", "Atleta", "Club", "G", "Edad", "Prueba", "Tiempo de inscripción"]],
    body: rows.map((r, i) => [i + 1, r.athlete, r.club, r.gender ?? "—", r.age ?? "—", r.event, formatTime(r.seedMs)]),
    styles: { fontSize: 8 },
    headStyles: { fillColor: [12, 74, 110] },
  });
  doc.save(`${slug(meetName)}_preinscripcion.pdf`);
}
