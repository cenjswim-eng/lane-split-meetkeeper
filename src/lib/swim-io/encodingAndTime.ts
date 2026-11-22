import { unzipSync } from 'fflate';
import { formatTime, parseSwimTime } from '@/lib/swim';

export const parseSwimTimeToMs = (raw: string) => parseSwimTime(raw).timeMs;

export function formatMsToSwimTime(ms: number | null, includeCourse?: 'L' | 'S' | 'Y') {
  if (ms != null && (!Number.isInteger(ms) || ms <= 0)) throw new Error('Tiempo inválido: usa milisegundos enteros positivos.');
  return ms == null ? 'NT' : `${formatTime(ms)}${includeCourse ?? ''}`;
}

export function normalizeSwimmerSlug(first: string, last: string, birth?: string | null) {
  return `${last}_${first}_${birth ?? ''}`.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_]/g,'').toLowerCase();
}

export function decodeSwimBytes(bytes: Uint8Array, fileName?: string): { text: string; encoding: string } {
  // Para archivos .hy3, .sd3 y .cl2 de natación, la especificación de ancho fijo
  // exige TextDecoder('iso-8859-1') para preservar 1 byte por carácter (acentos y letra Ñ)
  // sin desplazar columnas fijas (130 columnas en HY3, 160 en SD3).
  if (!fileName || /\.(hy3|sd3|cl2)$/i.test(fileName)) {
    return { text: new TextDecoder('iso-8859-1').decode(bytes), encoding: 'iso-8859-1' };
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' };
  } catch {
    return { text: new TextDecoder('iso-8859-1').decode(bytes), encoding: 'iso-8859-1' };
  }
}

export function decodeHytekFileBytes(bytes: Uint8Array | ArrayBuffer): string {
  return new TextDecoder('iso-8859-1').decode(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
}

export interface ExtractedSwimFile {
  fileName: string;
  bytes: Uint8Array;
}

/**
 * Descompresor recursivo de archivos ZIP:
 * - Inspecciona y extrae archivos .hy3, .cl2, .sd3, .ev3 y .hyv
 * - Desempaqueta automáticamente archivos .zip anidados dentro de otro .zip (hasta 3 niveles)
 * - Aplica límites de seguridad: máximo 50 MB de datos descomprimidos y 100 archivos
 */
export function extractAllSwimFilesFromZip(
  buffer: ArrayBuffer | Uint8Array,
  maxDepth = 3
): ExtractedSwimFile[] {
  const results: ExtractedSwimFile[] = [];
  let totalBytes = 0;
  const maxBytes = 50 * 1024 * 1024;
  const maxFiles = 100;

  function recurse(currentBytes: Uint8Array, currentDepth: number, parentPath = '') {
    if (currentDepth > maxDepth || results.length >= maxFiles) return;

    let unzipped: Record<string, Uint8Array>;
    try {
      unzipped = unzipSync(currentBytes, {
        filter: (e) =>
          /\.(hy3|sd3|cl2|ev3|hyv|zip)$/i.test(e.name) &&
          e.originalSize <= maxBytes,
      });
    } catch {
      return;
    }

    for (const [entryName, entryBytes] of Object.entries(unzipped)) {
      if (results.length >= maxFiles) break;
      const cleanEntryName = entryName.split('/').pop() || entryName;
      const fullPath = parentPath ? `${parentPath}/${cleanEntryName}` : cleanEntryName;

      if (/\.zip$/i.test(cleanEntryName)) {
        recurse(entryBytes, currentDepth + 1, fullPath);
      } else if (/\.(hy3|sd3|cl2|ev3|hyv)$/i.test(cleanEntryName)) {
        totalBytes += entryBytes.byteLength;
        if (totalBytes > maxBytes) {
          throw new Error('El archivo ZIP descomprimido supera el límite de seguridad de 50 MB.');
        }
        results.push({ fileName: cleanEntryName, bytes: entryBytes });
      }
    }
  }

  const initialBytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  recurse(initialBytes, 0);

  return results;
}

export async function readSwimFile(file: File) {
  if (!/\.(hy3|sd3|cl2|zip)$/i.test(file.name)) throw new Error('Selecciona HY3, SD3, CL2 o ZIP.');
  if (file.size > 25 * 1024 * 1024) throw new Error('El archivo supera 25 MB.');
  const buffer = await file.arrayBuffer();
  const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(b=>b.toString(16).padStart(2,'0')).join('');
  let bytes: Uint8Array = new Uint8Array(buffer), name = file.name;

  if (/\.zip$/i.test(name)) {
    const extracted = extractAllSwimFilesFromZip(bytes);
    if (!extracted.length) throw new Error('El ZIP no contiene archivos HY3, SD3 o CL2.');

    const primary = extracted[0];
    name = primary.fileName;
    bytes = primary.bytes;

    return {
      name,
      hash,
      ...decodeSwimBytes(bytes, name),
      archiveNames: extracted.map(e => e.fileName),
      extractedFiles: extracted.map(e => ({
        name: e.fileName,
        bytes: e.bytes,
        ...decodeSwimBytes(e.bytes, e.fileName),
      })),
    };
  }

  return {
    name,
    hash,
    ...decodeSwimBytes(bytes, name),
    archiveNames: [name],
    extractedFiles: [{
      name,
      bytes,
      ...decodeSwimBytes(bytes, name),
    }],
  };
}
