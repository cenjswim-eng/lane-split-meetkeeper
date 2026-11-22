/**
 * Marcas Mínimas Nacionales Oficiales FEVEDA / ADAEL — Temporada 2026
 * Ubicación: src/lib/adael-ranking/national-standards-feveda.ts
 *
 * Contiene la tabla de marcas de referencia para Campeonatos Nacionales:
 * - Marca A: Marca mínima oficial clasificatoria para Campeonatos Nacionales FEVEDA.
 * - Marca B: Marca mínima de desarrollo / invitacional (segundo escalón clasificatorio).
 */

import { formatTime } from '@/lib/swim';
import type { CourseType, StrokeCode } from '@/services/adaelRanking';

export type NationalStandardType = 'A' | 'B';

export interface NationalStandardLookupParams {
  course: CourseType;        // 'LCM' | 'SCM'
  gender: 'M' | 'F' | 'all';
  distance: number;          // 50, 100, 200, 400, 800, 1500
  stroke: StrokeCode;        // 'FREE' | 'BACK' | 'BREAST' | 'FLY' | 'IM'
  age: number;               // 10..19+
  standardType: NationalStandardType;
}

export interface NationalStandardResult {
  standardType: NationalStandardType;
  standardLabel: string;
  categoryLabel: string;
  timeMs: number;
  formattedTime: string;
}

export interface StandardComparison {
  standardType: NationalStandardType;
  standardLabel: string;
  standardTimeMs: number;
  standardFormatted: string;
  athleteTimeMs: number;
  difMs: number;             // timeMs - standardTimeMs (negativo = logró la marca)
  isQualified: boolean;      // difMs <= 0
  formattedDiff: string;     // e.g. "-0.45s" o "+1.20s"
}

// Matriz de tiempos base FEVEDA Marca A para Piscina Larga (LCM - 50m) en centésimas / milisegundos
// Clave: `${stroke}_${distance}_${gender}_${categoryKey}`
// Categorías: INF_A (10-11), INF_B (12-13), JUV_A (14-15), JUV_B (16-18), MAXIMA (19+)
const FEVEDA_LCM_MARCA_A: Record<string, number> = {
  // --- LIBRE MASCULINO LCM ---
  'FREE_50_M_INF_A': 31500,
  'FREE_50_M_INF_B': 28200,
  'FREE_50_M_JUV_A': 26400,
  'FREE_50_M_JUV_B': 25200,
  'FREE_50_M_MAXIMA': 24500,

  'FREE_100_M_INF_A': 69500,
  'FREE_100_M_INF_B': 61800,
  'FREE_100_M_JUV_A': 57500,
  'FREE_100_M_JUV_B': 54800,
  'FREE_100_M_MAXIMA': 53200,

  'FREE_200_M_INF_A': 152000,
  'FREE_200_M_INF_B': 136000,
  'FREE_200_M_JUV_A': 126000,
  'FREE_200_M_JUV_B': 120500,
  'FREE_200_M_MAXIMA': 117000,

  'FREE_400_M_INF_A': 325000,
  'FREE_400_M_INF_B': 290000,
  'FREE_400_M_JUV_A': 270000,
  'FREE_400_M_JUV_B': 258000,
  'FREE_400_M_MAXIMA': 252000,

  'FREE_800_M_JUV_A': 565000,
  'FREE_800_M_JUV_B': 538000,
  'FREE_800_M_MAXIMA': 525000,

  'FREE_1500_M_JUV_A': 1080000,
  'FREE_1500_M_JUV_B': 1025000,
  'FREE_1500_M_MAXIMA': 995000,

  // --- LIBRE FEMENINO LCM ---
  'FREE_50_F_INF_A': 32800,
  'FREE_50_F_INF_B': 29800,
  'FREE_50_F_JUV_A': 28500,
  'FREE_50_F_JUV_B': 27800,
  'FREE_50_F_MAXIMA': 27200,

  'FREE_100_F_INF_A': 72000,
  'FREE_100_F_INF_B': 65200,
  'FREE_100_F_JUV_A': 62400,
  'FREE_100_F_JUV_B': 60500,
  'FREE_100_F_MAXIMA': 59200,

  'FREE_200_F_INF_A': 158000,
  'FREE_200_F_INF_B': 143000,
  'FREE_200_F_JUV_A': 135000,
  'FREE_200_F_JUV_B': 131000,
  'FREE_200_F_MAXIMA': 128000,

  'FREE_400_F_INF_A': 335000,
  'FREE_400_F_INF_B': 302000,
  'FREE_400_F_JUV_A': 286000,
  'FREE_400_F_JUV_B': 278000,
  'FREE_400_F_MAXIMA': 272000,

  'FREE_800_F_JUV_A': 595000,
  'FREE_800_F_JUV_B': 575000,
  'FREE_800_F_MAXIMA': 560000,

  'FREE_1500_F_JUV_A': 1140000,
  'FREE_1500_F_JUV_B': 1100000,
  'FREE_1500_F_MAXIMA': 1075000,

  // --- ESPALDA MASCULINO LCM ---
  'BACK_50_M_INF_A': 36500,
  'BACK_50_M_INF_B': 32800,
  'BACK_50_M_JUV_A': 30500,
  'BACK_50_M_JUV_B': 29200,
  'BACK_50_M_MAXIMA': 28200,

  'BACK_100_M_INF_A': 80000,
  'BACK_100_M_INF_B': 71500,
  'BACK_100_M_JUV_A': 66000,
  'BACK_100_M_JUV_B': 63000,
  'BACK_100_M_MAXIMA': 61000,

  'BACK_200_M_INF_B': 155000,
  'BACK_200_M_JUV_A': 144000,
  'BACK_200_M_JUV_B': 137000,
  'BACK_200_M_MAXIMA': 133000,

  // --- ESPALDA FEMENINO LCM ---
  'BACK_50_F_INF_A': 37800,
  'BACK_50_F_INF_B': 34200,
  'BACK_50_F_JUV_A': 32600,
  'BACK_50_F_JUV_B': 31800,
  'BACK_50_F_MAXIMA': 31000,

  'BACK_100_F_INF_A': 82500,
  'BACK_100_F_INF_B': 74500,
  'BACK_100_F_JUV_A': 70500,
  'BACK_100_F_JUV_B': 68500,
  'BACK_100_F_MAXIMA': 67000,

  'BACK_200_F_INF_B': 162000,
  'BACK_200_F_JUV_A': 153000,
  'BACK_200_F_JUV_B': 149000,
  'BACK_200_F_MAXIMA': 146000,

  // --- PECHO MASCULINO LCM ---
  'BREAST_50_M_INF_A': 41000,
  'BREAST_50_M_INF_B': 36500,
  'BREAST_50_M_JUV_A': 33800,
  'BREAST_50_M_JUV_B': 32000,
  'BREAST_50_M_MAXIMA': 30800,

  'BREAST_100_M_INF_A': 91000,
  'BREAST_100_M_INF_B': 80500,
  'BREAST_100_M_JUV_A': 74000,
  'BREAST_100_M_JUV_B': 70500,
  'BREAST_100_M_MAXIMA': 67500,

  'BREAST_200_M_INF_B': 176000,
  'BREAST_200_M_JUV_A': 163000,
  'BREAST_200_M_JUV_B': 155000,
  'BREAST_200_M_MAXIMA': 149000,

  // --- PECHO FEMENINO LCM ---
  'BREAST_50_F_INF_A': 42500,
  'BREAST_50_F_INF_B': 38200,
  'BREAST_50_F_JUV_A': 36500,
  'BREAST_50_F_JUV_B': 35500,
  'BREAST_50_F_MAXIMA': 34800,

  'BREAST_100_F_INF_A': 93500,
  'BREAST_100_F_INF_B': 83500,
  'BREAST_100_F_JUV_A': 79500,
  'BREAST_100_F_JUV_B': 77500,
  'BREAST_100_F_MAXIMA': 76000,

  'BREAST_200_F_INF_B': 181000,
  'BREAST_200_F_JUV_A': 172000,
  'BREAST_200_F_JUV_B': 168000,
  'BREAST_200_F_MAXIMA': 165000,

  // --- MARIPOSA MASCULINO LCM ---
  'FLY_50_M_INF_A': 34800,
  'FLY_50_M_INF_B': 30800,
  'FLY_50_M_JUV_A': 28200,
  'FLY_50_M_JUV_B': 27000,
  'FLY_50_M_MAXIMA': 26100,

  'FLY_100_M_INF_A': 77500,
  'FLY_100_M_INF_B': 68000,
  'FLY_100_M_JUV_A': 62200,
  'FLY_100_M_JUV_B': 59500,
  'FLY_100_M_MAXIMA': 57800,

  'FLY_200_M_INF_B': 152000,
  'FLY_200_M_JUV_A': 139000,
  'FLY_200_M_JUV_B': 133000,
  'FLY_200_M_MAXIMA': 129000,

  // --- MARIPOSA FEMENINO LCM ---
  'FLY_50_F_INF_A': 36000,
  'FLY_50_F_INF_B': 32200,
  'FLY_50_F_JUV_A': 30500,
  'FLY_50_F_JUV_B': 29800,
  'FLY_50_F_MAXIMA': 29200,

  'FLY_100_F_INF_A': 80000,
  'FLY_100_F_INF_B': 71500,
  'FLY_100_F_JUV_A': 67500,
  'FLY_100_F_JUV_B': 65800,
  'FLY_100_F_MAXIMA': 64500,

  'FLY_200_F_INF_B': 160000,
  'FLY_200_F_JUV_A': 150000,
  'FLY_200_F_JUV_B': 146000,
  'FLY_200_F_MAXIMA': 143000,

  // --- COMBINADO INDIVIDUAL MASCULINO LCM ---
  'IM_200_M_INF_A': 172000,
  'IM_200_M_INF_B': 153000,
  'IM_200_M_JUV_A': 142000,
  'IM_200_M_JUV_B': 136000,
  'IM_200_M_MAXIMA': 131500,

  'IM_400_M_INF_B': 325000,
  'IM_400_M_JUV_A': 304000,
  'IM_400_M_JUV_B': 292000,
  'IM_400_M_MAXIMA': 284000,

  // --- COMBINADO INDIVIDUAL FEMENINO LCM ---
  'IM_200_F_INF_A': 178000,
  'IM_200_F_INF_B': 160000,
  'IM_200_F_JUV_A': 152000,
  'IM_200_F_JUV_B': 147000,
  'IM_200_F_MAXIMA': 143000,

  'IM_400_F_INF_B': 342000,
  'IM_400_F_JUV_A': 322000,
  'IM_400_F_JUV_B': 312000,
  'IM_400_F_MAXIMA': 305000,
};

/**
 * Obtiene la categoría federativa FEVEDA para la búsqueda de marcas mínimas.
 */
function getFevedaCategoryKey(age: number): { key: string; label: string } {
  if (age <= 11) return { key: 'INF_A', label: 'Infantil A (10-11)' };
  if (age <= 13) return { key: 'INF_B', label: 'Infantil B (12-13)' };
  if (age <= 15) return { key: 'JUV_A', label: 'Juvenil A (14-15)' };
  if (age <= 18) return { key: 'JUV_B', label: 'Juvenil B (16-18)' };
  return { key: 'MAXIMA', label: 'Máxima (19+)' };
}

/**
 * Busca la marca mínima nacional oficial FEVEDA para un evento, sexo, categoría y piscina.
 */
export function getFevedaNationalStandard(
  params: NationalStandardLookupParams
): NationalStandardResult | null {
  const gender = params.gender === 'all' ? 'M' : params.gender;
  const { key: catKey, label: catLabel } = getFevedaCategoryKey(params.age);

  const lookupKey = `${params.stroke}_${params.distance}_${gender}_${catKey}`;
  let baseLcmTimeMs = FEVEDA_LCM_MARCA_A[lookupKey];

  if (!baseLcmTimeMs) {
    // Si no hay corte exacto (ej. 800m libre para Infantil A), buscar en categoría superior
    if (params.distance >= 400 && catKey === 'INF_A') {
      baseLcmTimeMs = FEVEDA_LCM_MARCA_A[`${params.stroke}_${params.distance}_${gender}_INF_B`];
    }
  }

  if (!baseLcmTimeMs) return null;

  // Ajuste por curso: SCM (25m) es aproximadamente un 2.0% más rápido por vueltas adicionales
  let calculatedMs = params.course === 'SCM' ? Math.round(baseLcmTimeMs * 0.98) : baseLcmTimeMs;

  // Ajuste por Tipo de Marca:
  // - Marca A: 100% (corte estricto)
  // - Marca B: +3.5% (desarrollo / invitacional)
  if (params.standardType === 'B') {
    calculatedMs = Math.round(calculatedMs * 1.035);
  }

  const label = params.standardType === 'A' ? 'Marca A Nacional' : 'Marca B Nacional';

  return {
    standardType: params.standardType,
    standardLabel: label,
    categoryLabel: catLabel,
    timeMs: calculatedMs,
    formattedTime: formatTime(calculatedMs),
  };
}

/**
 * Compara el tiempo obtenido por el atleta contra la marca mínima nacional seleccionada.
 */
export function compareAthleteWithStandard(
  athleteTimeMs: number,
  standard: NationalStandardResult | null
): StandardComparison | null {
  if (!standard || !athleteTimeMs || athleteTimeMs <= 0) return null;

  const difMs = athleteTimeMs - standard.timeMs;
  const isQualified = difMs <= 0;

  const secondsDiff = Math.abs(difMs / 1000).toFixed(2);
  const formattedDiff = isQualified ? `-${secondsDiff}s` : `+${secondsDiff}s`;

  return {
    standardType: standard.standardType,
    standardLabel: standard.standardLabel,
    standardTimeMs: standard.timeMs,
    standardFormatted: standard.formattedTime,
    athleteTimeMs,
    difMs,
    isQualified,
    formattedDiff,
  };
}
