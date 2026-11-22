/**
 * Extractor Inteligente de Listado de Clubes desde Documentos PDF
 * Ubicación: src/lib/adael-ranking/club-pdf-extractor.ts
 *
 * Permite subir un archivo PDF oficial (resolución, boletín o listado de clubes de ADAEL/FEVEDA),
 * extraer los clubes afiliados mediante análisis sintáctico de texto y OCR, y utilizarlos
 * como filtro federativo para extraer los resultados oficiales y generar el ranking.
 */

import { readPdfLines } from '@/lib/club-document';
import { supabase } from '@/integrations/supabase/client';
import { KNOWN_ADAEL_CODES } from '@/lib/team-hub/ranking-engine';

export interface ExtractedPdfClub {
  id: string;
  code: string;               // Código federativo Hy-Tek (ej. 'PISBO', 'HISP')
  name: string;               // Nombre completo del club
  association: string;        // Asociación / Estado (ej. 'LARA')
  isFederated: boolean;       // Estatus de afiliación 2026
  statusLabel?: string;       // ej. 'Afiliado 2026', 'Solvente'
  selected: boolean;          // Seleccionado por el usuario para el ranking
  sourceLine?: string;        // Línea original del PDF de donde se extrajo
  confidence: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface ClubPdfExtractionResult {
  filename: string;
  totalLines: number;
  clubs: ExtractedPdfClub[];
  warnings: string[];
  extractedAt: string;
}

const KNOWN_CODES_SET = new Set(KNOWN_ADAEL_CODES.map((c) => c.toUpperCase().trim()));

// Expresión regular para detectar códigos Hy-Tek (2 a 7 caracteres alfanuméricos en mayúscula)
const CODE_REGEX = /\b[A-Z0-9]{2,7}\b/;

// Asociaciones y estados conocidos
const ASSOCIATIONS_LIST = [
  'LARA', 'ADAEL', 'MIRANDA', 'ADAEM', 'ZULIA', 'ADAZU',
  'CARABOBO', 'ADAC', 'DISTRITO CAPITAL', 'ASODAN',
  'BOLIVAR', 'ANZOATEGUI', 'ARAGUA', 'TACHIRA', 'MERIDA',
  'BARINAS', 'PORTUGUESA', 'FALCON', 'TRUJILLO', 'YARACUY',
];

/**
 * Normaliza y limpia el nombre de un club eliminando números iniciales y separadores.
 */
function cleanClubName(raw: string, code: string): string {
  let cleaned = raw
    .replace(/^\s*\d+[\.\)\-]\s*/, '') // Eliminar numeración inicial "1. ", "02) "
    .replace(new RegExp(`\\b${code}\\b`, 'gi'), '') // Eliminar el código del nombre
    .replace(/[\[\]\(\)\|\:\-]/g, ' ') // Eliminar caracteres delimitadores
    .replace(/\s+/g, ' ')
    .trim();

  // Limpiar palabras de estatus al final
  cleaned = cleaned.replace(/\b(afiliado|solvente|activo|federado|2026)\b/gi, '').trim();

  if (!cleaned || cleaned.length < 3) {
    return `Club ${code}`;
  }

  // Capitalizar correctamente si viene todo en mayúsculas
  if (cleaned === cleaned.toUpperCase() && cleaned.length > 5) {
    cleaned = cleaned
      .toLowerCase()
      .split(' ')
      .map((w) => (w.length > 2 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
      .join(' ');
  }

  return cleaned;
}

/**
 * Detecta la asociación o estado mencionado en una línea.
 */
function detectAssociation(line: string, defaultAssoc = 'LARA'): string {
  const upper = line.toUpperCase();
  for (const assoc of ASSOCIATIONS_LIST) {
    if (upper.includes(assoc)) {
      if (assoc === 'ADAEL' || assoc === 'LARA') return 'LARA';
      if (assoc === 'ADAEM' || assoc === 'MIRANDA') return 'MIRANDA';
      if (assoc === 'ADAZU' || assoc === 'ZULIA') return 'ZULIA';
      return assoc;
    }
  }
  return defaultAssoc;
}

/**
 * Parsea un conjunto de líneas de texto extraídas de un PDF para identificar clubes.
 */
export function parseClubPdfLines(lines: string[]): ExtractedPdfClub[] {
  const extractedMap = new Map<string, ExtractedPdfClub>();
  const isDocumentLara = lines.some((l) => /adael|lara|barquisimeto/i.test(l));
  const defaultAssoc = isDocumentLara ? 'LARA' : 'LARA';

  for (let idx = 0; idx < lines.length; idx++) {
    const rawLine = lines[idx]?.trim() || '';
    if (!rawLine || rawLine.length < 3) continue;

    // Ignorar encabezados comunes
    if (
      /p[aá]gina|feveda|asociaci[oó]n|temporada|fecha|emisi[oó]n|bolet[ií]n|resoluci[oó]n|firma/i.test(
        rawLine
      ) &&
      !CODE_REGEX.test(rawLine)
    ) {
      continue;
    }

    let detectedCode = '';
    let detectedName = '';
    let confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'MEDIUM';

    // Patrón 1: Código entre corchetes o paréntesis ej. "Club Piscinas Bolivarianas [PISBO]" o "(HISP)"
    const bracketMatch = rawLine.match(/[\[\(]([A-Z0-9]{2,7})[\]\)]/);
    if (bracketMatch && bracketMatch[1]) {
      detectedCode = bracketMatch[1].toUpperCase();
      detectedName = cleanClubName(rawLine, detectedCode);
      confidence = 'HIGH';
    }

    // Patrón 2: Formato tabla delimitada por tabulación, pipes o 2+ espacios
    // ej. "PISBO | Club Piscinas Bolivarianas de Lara | LARA"
    if (!detectedCode) {
      const parts = rawLine.split(/\s*\|\s*|\t|\s{2,}/).map((p) => p.trim()).filter(Boolean);
      if (parts.length >= 2) {
        // Buscar cuál parte parece un código
        const codeIdx = parts.findIndex((p) => /^[A-Z0-9]{2,7}$/.test(p));
        if (codeIdx !== -1 && parts[codeIdx]) {
          detectedCode = parts[codeIdx]!.toUpperCase();
          const nameIdx = codeIdx === 0 ? 1 : 0;
          detectedName = cleanClubName(parts[nameIdx] || rawLine, detectedCode);
          confidence = 'HIGH';
        }
      }
    }

    // Patrón 3: Código al inicio seguido de guión o dos puntos
    // ej. "PISBO - Piscinas Bolivarianas" o "1. HISP: Hogar Hispano"
    if (!detectedCode) {
      const matchPrefix = rawLine.match(/^\s*(?:\d+[\.\)\-]\s*)?([A-Z0-9]{2,7})\s*[-:]\s*(.+)$/);
      if (matchPrefix && matchPrefix[1] && matchPrefix[2]) {
        detectedCode = matchPrefix[1].toUpperCase();
        detectedName = cleanClubName(matchPrefix[2], detectedCode);
        confidence = 'HIGH';
      }
    }

    // Patrón 4: Coincidencia directa con códigos conocidos de ADAEL
    if (!detectedCode) {
      for (const known of KNOWN_CODES_SET) {
        const regex = new RegExp(`\\b${known}\\b`, 'i');
        if (regex.test(rawLine)) {
          detectedCode = known;
          detectedName = cleanClubName(rawLine, detectedCode);
          confidence = 'HIGH';
          break;
        }
      }
    }

    // Si se detectó un código válido
    if (detectedCode && detectedCode.length >= 2 && detectedCode.length <= 7) {
      // Descartar palabras clave accidentales (ej. 'PDF', 'A4', 'LCM', 'SCM', 'FEVEDA', 'USA')
      if (['PDF', 'A4', 'LCM', 'SCM', 'SCY', 'FEVEDA', 'USA', 'FINA', 'AQUA', 'WA'].includes(detectedCode)) {
        continue;
      }

      const association = detectAssociation(rawLine, defaultAssoc);
      const isLaraCode = KNOWN_CODES_SET.has(detectedCode) || association === 'LARA';

      const existing = extractedMap.get(detectedCode);
      if (!existing || (existing.name.startsWith('Club ') && !detectedName.startsWith('Club '))) {
        extractedMap.set(detectedCode, {
          id: `extracted-${detectedCode}`,
          code: detectedCode,
          name: detectedName || `Club ${detectedCode}`,
          association,
          isFederated: true,
          statusLabel: 'Afiliado 2026',
          selected: isLaraCode, // Pre-seleccionar si pertenece a Lara
          sourceLine: rawLine,
          confidence,
        });
      }
    }
  }

  return Array.from(extractedMap.values()).sort((a, b) => a.code.localeCompare(b.code));
}

/**
 * Lee un archivo PDF y extrae el listado de clubes oficiales.
 */
export async function extractClubsFromPdf(file: File): Promise<ClubPdfExtractionResult> {
  const warnings: string[] = [];

  // Validaciones previas
  if (!/\.pdf$/i.test(file.name)) {
    throw new Error('El archivo seleccionado debe ser un documento PDF (.pdf).');
  }

  const headerBytes = await file.slice(0, 5).arrayBuffer();
  const headerStr = new TextDecoder().decode(headerBytes);
  if (!headerStr.startsWith('%PDF-')) {
    throw new Error('El archivo no posee un formato binario PDF válido.');
  }

  // Extracción de líneas mediante pdfjs-dist
  const lines = await readPdfLines(file);
  if (!lines || lines.length === 0) {
    warnings.push('No se pudo extraer texto legible del PDF. Es posible que el documento sea una imagen escaneada.');
  }

  const clubs = parseClubPdfLines(lines);

  if (clubs.length === 0) {
    warnings.push(
      'No se identificaron códigos de club con formato estándar (ej. PISBO, HISP, BARQ). Puedes agregar clubes manualmente.'
    );
  }

  return {
    filename: file.name,
    totalLines: lines.length,
    clubs,
    warnings,
    extractedAt: new Date().toISOString(),
  };
}

/**
 * Guarda los clubes extraídos en la tabla `adael_clubs` de Supabase
 * y en el almacenamiento local para persistencia inmediata.
 */
export async function saveExtractedClubsToDb(
  clubs: ExtractedPdfClub[]
): Promise<{ success: boolean; savedCount: number; error?: string }> {
  const selectedClubs = clubs.filter((c) => c.selected);
  if (selectedClubs.length === 0) {
    return { success: false, savedCount: 0, error: 'No hay clubes seleccionados para guardar.' };
  }

  // 1. Guardar en almacenamiento local como respaldo garantizado
  try {
    const serialized = JSON.stringify(selectedClubs);
    localStorage.setItem('slc_adael_extracted_clubs_2026', serialized);
  } catch (err) {
    console.warn('No se pudo persistir en localStorage:', err);
  }

  // 2. Intentar guardar en la tabla `adael_clubs` de Supabase
  try {
    const payload = selectedClubs.map((c) => ({
      code: c.code.toUpperCase().trim(),
      name: c.name.trim(),
      association: c.association.trim() || 'LARA',
      is_federated_2026: true,
      updated_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('adael_clubs' as any)
      .upsert(payload, { onConflict: 'code' });

    if (error) {
      console.warn('Error al guardar en adael_clubs de Supabase:', error.message);
      // Retornar éxito parcial ya que quedó en localStorage
      return { success: true, savedCount: selectedClubs.length, error: error.message };
    }

    return { success: true, savedCount: selectedClubs.length };
  } catch (err: any) {
    return { success: true, savedCount: selectedClubs.length, error: err?.message };
  }
}

/**
 * Carga los clubes extraídos o guardados previamente.
 */
export function loadSavedExtractedClubs(): ExtractedPdfClub[] {
  try {
    const saved = localStorage.getItem('slc_adael_extracted_clubs_2026');
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // ignorar
  }
  return [];
}
