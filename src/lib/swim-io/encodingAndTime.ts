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
export function decodeSwimBytes(bytes: Uint8Array): { text: string; encoding: 'utf-8' | 'windows-1252' } {
 try { return { text: new TextDecoder('utf-8', { fatal: true }).decode(bytes), encoding: 'utf-8' }; }
 catch { return { text: new TextDecoder('windows-1252').decode(bytes), encoding: 'windows-1252' }; }
}
export async function readSwimFile(file: File) {
 if (!/\.(hy3|sd3|cl2|zip)$/i.test(file.name)) throw new Error('Selecciona HY3, SD3, CL2 o ZIP.');
 if (file.size > 25 * 1024 * 1024) throw new Error('El archivo supera 25 MB.');
 const buffer = await file.arrayBuffer();
 const hash = [...new Uint8Array(await crypto.subtle.digest('SHA-256', buffer))].map(b=>b.toString(16).padStart(2,'0')).join('');
 let bytes: Uint8Array = new Uint8Array(buffer), name = file.name;
 if (/\.zip$/i.test(name)) {
  // Inspect ZIP central directory sizes before allocating inflated data.
  const view = new DataView(buffer); let total = 0, count = 0;
  for (let i = 0; i + 46 <= view.byteLength; i++) if (view.getUint32(i,true) === 0x02014b50) { total += view.getUint32(i+24,true); count++; i += 45 + view.getUint16(i+28,true) + view.getUint16(i+30,true) + view.getUint16(i+32,true); }
  if (total > 50*1024*1024 || count > 100) throw new Error('El ZIP supera el límite de 50 MB o 100 archivos.');
  let archive: Record<string, Uint8Array>;
  try { archive = unzipSync(bytes, { filter: e => /\.(hy3|sd3|cl2)$/i.test(e.name) && e.originalSize <= 50*1024*1024 }); }
  catch { throw new Error('No se pudo abrir el ZIP. Revisa que no esté dañado ni protegido por contraseña.'); }
  const entry = Object.entries(archive)[0];
  if (!entry) throw new Error('El ZIP no contiene HY3, SD3 o CL2.');
  [name, bytes] = entry;
  if (bytes.byteLength > 50*1024*1024) throw new Error('El archivo descomprimido supera 50 MB.');
  return { name, hash, ...decodeSwimBytes(bytes), archiveNames: Object.keys(archive) };
 }
 return { name, hash, ...decodeSwimBytes(bytes), archiveNames: [name] };
}
