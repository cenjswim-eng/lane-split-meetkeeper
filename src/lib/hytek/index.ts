import JSZip from "jszip";
import { parseHy3 } from "./hy3";
import { parseSdif } from "./sdif";
import type { ParsedFile } from "./types";
import { parseEventSetup } from "./event-setup";

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

/** Accepts result/entry files and EV3/HYV setups, directly or inside ZIPs. */
export async function readHytekFile(file: File): Promise<{ name: string; parsed: ParsedFile }[]> {
  if (file.size > 25 * 1024 * 1024) throw new Error("El archivo supera 25 MB. Divide la exportación en archivos más pequeños.");
  const out: { name: string; parsed: ParsedFile }[] = [];
  if (file.name.toLowerCase().endsWith(".zip")) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    const entries = Object.values(zip.files).filter(e => !e.dir && /\.(hy3|cl2|sd3|ev3|hyv)$/i.test(e.name));
    if (entries.length > 100) throw new Error("El ZIP contiene demasiados archivos de natación.");
    let totalBytes = 0;
    for (const entry of entries) {
      // MM exports the same setup twice; prefer the richer EV3 partner only.
      if (/\.hyv$/i.test(entry.name) && entries.some(e => e.name.toLowerCase() === entry.name.replace(/\.hyv$/i, ".ev3").toLowerCase())) continue;
      const chunks: Uint8Array[] = [];
      const bytes = await new Promise<Uint8Array>((resolve, reject) => {
        // JSZip's browser API provides internalStream but omits it from its public typings.
        type ZipStream = { on: (event: string, callback: (...args: any[]) => void) => ZipStream; pause: () => void; resume: () => void };
        const stream = (entry as typeof entry & { internalStream: (type: string) => ZipStream }).internalStream("uint8array");
        stream.on("data", (chunk: Uint8Array) => {
          totalBytes += chunk.length;
          if (totalBytes > 50 * 1024 * 1024) { stream.pause(); reject(new Error("El ZIP descomprimido supera 50 MB.")); return; }
          chunks.push(chunk);
        }).on("error", reject).on("end", () => {
          const size = chunks.reduce((n, c) => n + c.length, 0);
          const result = new Uint8Array(size); let offset = 0;
          chunks.forEach(c => { result.set(c, offset); offset += c.length; }); resolve(result);
        }).resume();
      });
      const text = decodeHytek(bytes);
      const parsed = detectAndParse(entry.name, text);
      if (parsed) out.push({ name: entry.name, parsed });
    }
  } else {
    const text = await readSwimFileText(file);
    const parsed = detectAndParse(file.name, text);
    if (parsed) out.push({ name: file.name, parsed });
  }
  if (!out.length && /\.zip$/i.test(file.name)) throw new Error("El ZIP no contiene archivos HY3, CL2, SD3, EV3 o HYV reconocibles.");
  return out;
}
