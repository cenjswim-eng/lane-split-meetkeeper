import JSZip from "jszip";
import { parseHy3 } from "./hy3";
import { parseSdif } from "./sdif";
import type { ParsedFile } from "./types";
import { parseEventSetup } from "./event-setup";
import { extractAllSwimFilesFromZip } from "../swim-io/encodingAndTime";

export type { ParsedFile } from "./types";

/** Fixed-width Hy-Tek (.hy3) and SDIF (.sd3, .cl2) records require ISO-8859-1 decoding to guarantee 1 byte per char and avoid shifting columns on accents and Ñ. */
export function decodeHytek(bytes: Uint8Array): string {
  return new TextDecoder("iso-8859-1").decode(bytes);
}

export async function readSwimFileText(file: File): Promise<string> {
  return decodeHytek(new Uint8Array(await file.arrayBuffer()));
}

export function detectAndParse(name: string, text: string): ParsedFile | null {
  const lower = name.toLowerCase();
  if (/\.(ev3|hyv)$/.test(lower)) return parseEventSetup(name, text);
  const first = text.trimStart().slice(0, 2);
  if (lower.endsWith(".hy3") || (first === "A1" && !lower.match(/\.(cl2|sd3)$/))) return parseHy3(text);
  if (lower.endsWith(".cl2") || lower.endsWith(".sd3") || first === "A0") return parseSdif(text);
  return null;
}

/** Accepts result/entry files and EV3/HYV setups, directly or inside ZIPs (including nested ZIPs). */
export async function readHytekFile(file: File): Promise<{ name: string; parsed: ParsedFile }[]> {
  if (file.size > 25 * 1024 * 1024) throw new Error("El archivo supera 25 MB. Divide la exportación en archivos más pequeños.");
  const out: { name: string; parsed: ParsedFile }[] = [];

  if (file.name.toLowerCase().endsWith(".zip")) {
    const buffer = await file.arrayBuffer();
    const extracted = extractAllSwimFilesFromZip(new Uint8Array(buffer));
    if (!extracted.length) throw new Error("El ZIP no contiene archivos HY3, CL2, SD3, EV3 o HYV reconocibles.");

    for (const entry of extracted) {
      // MM exports the same setup twice; prefer the richer EV3 partner only.
      if (/\.hyv$/i.test(entry.fileName) && extracted.some(e => e.fileName.toLowerCase() === entry.fileName.replace(/\.hyv$/i, ".ev3").toLowerCase())) continue;
      const text = decodeHytek(entry.bytes);
      const parsed = detectAndParse(entry.fileName, text);
      if (parsed) out.push({ name: entry.fileName, parsed });
    }
  } else {
    const text = await readSwimFileText(file);
    const parsed = detectAndParse(file.name, text);
    if (parsed) out.push({ name: file.name, parsed });
  }

  if (!out.length && /\.zip$/i.test(file.name)) throw new Error("El ZIP no contiene archivos HY3, CL2, SD3, EV3 o HYV reconocibles.");
  return out;
}
