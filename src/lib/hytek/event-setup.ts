import { parseEv3, parseHyv } from "swimparse/setup";
import { mdyToIso, type ParsedFile } from "./types";

export interface SetupEvent {
  eventNumber: string;
  distance: number;
  stroke: number;
  gender: string;
  minAge: number | null;
  maxAge: number | null;
  course: string;
  qualifyingTimesMs: Record<string, number | null>;
  metadata: { session: { id: string; day: number | null; order: number | null; startTime: string | null } | null; entryFee: number | null; rawRecord: string };
}

const strokes: Record<string, number> = { Freestyle: 1, Backstroke: 2, Breaststroke: 3, Butterfly: 4, IM: 5 };
const courses = ["LCM", "SCM", "SCY"];

/** Strict envelope validation around the dedicated setup reader; never creates swimmers or results. */
export function parseEventSetup(name: string, text: string): ParsedFile {
  const ev3 = /\.ev3$/i.test(name);
  if (!/\.(ev3|hyv)$/i.test(name)) throw new Error("Elige un archivo EV3 o HYV de eventos.");
  if (!text.trim() || /[\x00-\x08\x0e-\x1f]/.test(text) || /^\s*</.test(text)) throw new Error("El archivo no contiene texto de eventos Hy-Tek válido.");
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/).filter(line => line.trim());
  if (lines.length < 2 || lines.length > 5001) throw new Error("El archivo está vacío, incompleto o contiene demasiadas pruebas.");
  const header = lines[0].replace(/\*>\s*$/, "").split(";").map(s => s.trim());
  const dateIndex = ev3 ? 2 : 1;
  const date = (s: string | undefined) => s && /^\d{2}\/\d{2}\/\d{4}$/.test(s) ? mdyToIso(s.replaceAll("/", "")) : null;
  const startDate = date(header[dateIndex]);
  const endDate = date(header[dateIndex + 1]);
  if (header.length < (ev3 ? 13 : 9) || !header[0] || !startDate || !endDate || endDate < startDate) throw new Error("El encabezado no tiene un nombre y fechas válidas (mes/día/año).");
  for (const [i, line] of lines.slice(1).entries()) {
    const f = line.replace(/\*>\s*$/, "").split(";").map(s => s.trim());
    const indexes = ev3 ? [0, 6, 7, 8] : [4, 5, 6];
    const type = f[ev3 ? 4 : 3];
    if (f.length < (ev3 ? 21 : 16) || !/^\d+[A-Za-z]?$/.test(f[ev3 ? 1 : 0] || f[0]) || !["I", "R"].includes(type) || indexes.some(j => !/^\d+$/.test(f[j] ?? ""))) throw new Error(`La prueba de la fila ${i + 2} está incompleta o usa un formato incompatible. No se guardó nada.`);
    const timeCols = ev3 ? [16, 18, 20] : [9, 13, 15];
    for (const j of timeCols) {
      const raw = f[j];
      if (raw && !/^(?:NT|0(?:\.0+)?|\d+(?::[0-5]\d)?(?:\.\d{1,2})?[LSY]?)$/i.test(raw)) throw new Error(`Tiempo límite inválido en la fila ${i + 2}: ${raw}.`);
    }
  }
  let setup;
  try { setup = ev3 ? parseEv3(lines.join("\n")) : parseHyv(lines.join("\n")); }
  catch { throw new Error("No se pudieron reconocer las pruebas o el género. Solicita una nueva exportación de eventos de Meet Manager."); }
  if (!setup.meet.course || !courses.includes(setup.meet.course)) throw new Error("No se pudo identificar la piscina del torneo. Revisa la configuración del archivo.");
  const warnings: string[] = [];
  const events: SetupEvent[] = setup.events.map((e, i) => {
    const stroke = e.type === "relay" ? e.stroke === "Freestyle" ? 6 : e.stroke === "Medley" ? 7 : 0 : strokes[e.stroke];
    if (!stroke || !e.distance || e.distance <= 0 || !e.course || !courses.includes(e.course) || e.ageGroup.lower > e.ageGroup.upper || e.ageGroup.lower < 0) throw new Error(`La prueba ${e.number} tiene estilo, distancia, edad o piscina incompatible.`);
    const qualifyingTimesMs = Object.fromEntries(courses.map(c => [c, e.qualifyingTimes[c] ? Math.round(e.qualifyingTimes[c].seconds * 1000) : null]));
    if (Object.values(qualifyingTimesMs).some(t => t != null && t <= 1000)) warnings.push(`Prueba ${e.number}: el documento incluye un límite de un segundo o menos; verifica si es un valor de relleno.`);
    return { eventNumber: e.number, distance: e.distance, stroke, gender: e.gender, minAge: e.ageGroup.lower || null, maxAge: e.ageGroup.upper >= 99 ? null : e.ageGroup.upper, course: e.course, qualifyingTimesMs, metadata: { session: e.session, entryFee: e.entryFee, rawRecord: lines[i + 1] } };
  });
  const identities = events.map(e => [e.eventNumber, e.gender, e.minAge, e.maxAge].join("|"));
  if (new Set(identities).size !== identities.length) throw new Error("El archivo contiene pruebas duplicadas. Revisa la exportación antes de importar.");
  return { format: ev3 ? "EV3" : "HYV", meet: { name: header[0], location: setup.meet.hostName ?? null, startDate, endDate, course: setup.meet.course }, teams: [], athletes: [], results: [], warnings, events };
}