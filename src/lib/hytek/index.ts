import JSZip from "jszip";
import { parseHy3 } from "./hy3";
import { parseSdif } from "./sdif";
import type { ParsedFile } from "./types";

export type { ParsedFile } from "./types";

/** Legacy Hy-Tek exports use Windows-1252; decoding as UTF-8 can shift fixed-width fields. */
export function decodeHytek(bytes: Uint8Array): string {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
  catch { return new TextDecoder("windows-1252").decode(bytes); }
}

export function detectAndParse(name: string, text: string): ParsedFile | null {
  const lower = name.toLowerCase();
  const first = text.trimStart().slice(0, 2);
  if (lower.endsWith(".hy3") || (first === "A1" && !lower.match(/\.(cl2|sd3)$/))) return parseHy3(text);
  if (lower.endsWith(".cl2") || lower.endsWith(".sd3") || first === "A0") return parseSdif(text);
  return null;
}

/** Accepts .hy3, .cl2, .sd3 or .zip containing any of them. */
export async function readHytekFile(file: File): Promise<{ name: string; parsed: ParsedFile }[]> {
  const out: { name: string; parsed: ParsedFile }[] = [];
  if (file.name.toLowerCase().endsWith(".zip")) {
    const zip = await JSZip.loadAsync(await file.arrayBuffer());
    for (const entry of Object.values(zip.files)) {
      if (entry.dir || !/\.(hy3|cl2|sd3)$/i.test(entry.name)) continue;
      const text = decodeHytek(await entry.async("uint8array"));
      const parsed = detectAndParse(entry.name, text);
      if (parsed) out.push({ name: entry.name, parsed });
    }
  } else {
    const text = decodeHytek(new Uint8Array(await file.arrayBuffer()));
    const parsed = detectAndParse(file.name, text);
    if (parsed) out.push({ name: file.name, parsed });
  }
  return out;
}
