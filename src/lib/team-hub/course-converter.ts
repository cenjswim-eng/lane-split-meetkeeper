/**
 * Course Converter for Team Manager & Meet Manager
 * Handles strict mathematical time conversions between SCM (25m), LCM (50m), and SCY (25y).
 * Marks converted times with `is_converted: true` while preserving original time and course.
 */

import { CourseType, formatMsToTime } from '@/lib/hytek-bridge/data-normalizer';

export interface ConvertedTimeResult {
  durationMs: number;
  course: CourseType;
  isConverted: boolean;
  originalCourse: CourseType;
  originalMs: number;
  formatted: string;
}

/**
 * Standard conversion coefficients based on World Aquatics / NCAA rules:
 * - LCM to SCM: SCM is ~2% faster due to extra turns (factor ~0.9804)
 * - SCM to LCM: LCM is ~2% slower (factor ~1.0200)
 * - SCM to SCY: SCY (25 yards = 22.86m) is shorter (factor ~0.9050)
 * - SCY to SCM: (factor ~1.1050)
 * - LCM to SCY: (factor ~0.8850)
 * - SCY to LCM: (factor ~1.1300)
 */
export const DEFAULT_CONVERSION_FACTORS: Record<string, number> = {
  'LCM->SCM': 0.9804,
  'SCM->LCM': 1.0200,
  'SCM->SCY': 0.9050,
  'SCY->SCM': 1.1050,
  'LCM->SCY': 0.8850,
  'SCY->LCM': 1.1300,
};

export function convertSwimTime(
  ms: number | null | undefined,
  fromCourse: CourseType,
  toCourse: CourseType,
  customFactors: Partial<Record<string, number>> = {}
): ConvertedTimeResult | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null;

  if (fromCourse === toCourse) {
    return {
      durationMs: ms,
      course: toCourse,
      isConverted: false,
      originalCourse: fromCourse,
      originalMs: ms,
      formatted: formatMsToTime(ms),
    };
  }

  const key = `${fromCourse}->${toCourse}`;
  const factor = customFactors[key] ?? DEFAULT_CONVERSION_FACTORS[key];
  if (!factor || factor <= 0) {
    throw new Error(`Conversión de piscina no admitida: de ${fromCourse} a ${toCourse}.`);
  }

  const convertedMs = Math.round(ms * factor);
  return {
    durationMs: convertedMs,
    course: toCourse,
    isConverted: true,
    originalCourse: fromCourse,
    originalMs: ms,
    formatted: formatMsToTime(convertedMs),
  };
}
