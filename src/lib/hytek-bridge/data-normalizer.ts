/**
 * Data Normalizer for SwimLaneCoach.app
 * Centralizes high-precision swimming time, date and course normalization.
 * Guarantees zero-defect handling of comma (,) vs dot (.) decimals,
 * integer millisecond storage (duration_ms), and exact ISO-8601 age calculations.
 */

export type CourseType = 'SCM' | 'LCM' | 'SCY';
export type TimeStatus = 'OK' | 'NT' | 'DQ' | 'NS' | 'SCR' | 'DNF' | 'INVALID';

export interface NormalizedTime {
  timeMs: number | null;
  status: TimeStatus;
  formatted: string;
  isConverted?: boolean;
  originalCourse?: CourseType;
}

/**
 * Normalizes any swimming time input into integer milliseconds (`duration_ms`).
 * Robustly parses:
 * - Format with minutes: "1:02.34", "1:02,34", "01:05.10"
 * - Seconds with decimals: "28.45", "28,45", "59.9"
 * - Raw integers / millisecond inputs: 62340
 * - Unseeded / Status codes: "NT", "DQ", "NS", "SCR", "DNF", "DESQ"
 */
export function normalizeSwimTimeToMs(raw: string | number | null | undefined): NormalizedTime {
  if (raw == null) {
    return { timeMs: null, status: 'NT', formatted: 'NT' };
  }

  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || raw <= 0) {
      return { timeMs: null, status: 'NT', formatted: 'NT' };
    }
    const ms = Math.round(raw);
    return { timeMs: ms, status: 'OK', formatted: formatMsToTime(ms) };
  }

  const trimmed = raw.trim().toUpperCase();
  if (!trimmed || trimmed === 'NT' || trimmed === 'N.T.' || trimmed === '—' || trimmed === '-') {
    return { timeMs: null, status: 'NT', formatted: 'NT' };
  }

  // Handle standard non-swum / disqualification codes
  if (['DQ', 'DSQ', 'DESQ', 'DESC'].includes(trimmed)) {
    return { timeMs: null, status: 'DQ', formatted: 'DQ' };
  }
  if (['NS', 'DNS', 'NO SHOW'].includes(trimmed)) {
    return { timeMs: null, status: 'NS', formatted: 'NS' };
  }
  if (['SCR', 'BAJA'].includes(trimmed)) {
    return { timeMs: null, status: 'SCR', formatted: 'SCR' };
  }
  if (['DNF', 'NO TERM', 'RET'].includes(trimmed)) {
    return { timeMs: null, status: 'DNF', formatted: 'DNF' };
  }

  // Remove any trailing course indicator (e.g. "1:02.34L", "28.50S", "55.10Y")
  const sanitized = trimmed.replace(/[LSY]$/i, '').replace(/,/g, '.');

  // Check format "MM:SS.CC" or "H:MM:SS.CC"
  if (sanitized.includes(':')) {
    const parts = sanitized.split(':');
    if (parts.length === 2) {
      const minutes = Number(parts[0]);
      const seconds = Number(parts[1]);
      if (Number.isFinite(minutes) && Number.isFinite(seconds) && minutes >= 0 && seconds >= 0 && seconds < 60) {
        const ms = Math.round(minutes * 60000 + seconds * 1000);
        return { timeMs: ms, status: 'OK', formatted: formatMsToTime(ms) };
      }
    } else if (parts.length === 3) {
      const hours = Number(parts[0]);
      const minutes = Number(parts[1]);
      const seconds = Number(parts[2]);
      if (Number.isFinite(hours) && Number.isFinite(minutes) && Number.isFinite(seconds) && minutes < 60 && seconds < 60) {
        const ms = Math.round(hours * 3600000 + minutes * 60000 + seconds * 1000);
        return { timeMs: ms, status: 'OK', formatted: formatMsToTime(ms) };
      }
    }
    return { timeMs: null, status: 'INVALID', formatted: 'NT' };
  }

  // Number with decimal point: "28.45"
  if (/^\d+\.?\d*$/.test(sanitized)) {
    const num = Number(sanitized);
    if (Number.isFinite(num) && num > 0) {
      // If integer > 10000 without decimal point, treat as milliseconds
      if (!sanitized.includes('.') && num >= 10000) {
        const ms = Math.round(num);
        return { timeMs: ms, status: 'OK', formatted: formatMsToTime(ms) };
      }
      // Otherwise treat as seconds
      const ms = Math.round(num * 1000);
      return { timeMs: ms, status: 'OK', formatted: formatMsToTime(ms) };
    }
  }

  return { timeMs: null, status: 'INVALID', formatted: 'NT' };
}

/**
 * Formats milliseconds into standard swimming notation:
 * "M:SS.CC" or "SS.CC".
 */
export function formatMsToTime(
  ms: number | null | undefined,
  options: { includeCourse?: 'L' | 'S' | 'Y' } = {}
): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) {
    return 'NT';
  }

  const totalCentis = Math.round(ms / 10);
  const centis = totalCentis % 100;
  const totalSeconds = Math.floor(totalCentis / 100);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  const centisStr = String(centis).padStart(2, '0');
  const courseSuffix = options.includeCourse ?? '';

  if (minutes > 0) {
    const secondsStr = String(seconds).padStart(2, '0');
    return `${minutes}:${secondsStr}.${centisStr}${courseSuffix}`;
  }
  return `${seconds}.${centisStr}${courseSuffix}`;
}

/**
 * Normalizes any date string (YYYY-MM-DD, DD/MM/YYYY, MMDDYYYY, etc.) to strict ISO-8601 (YYYY-MM-DD).
 */
export function normalizeIsoDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Standard YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T00:00:00Z`);
    if (Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === trimmed) {
      return trimmed;
    }
  }

  // DD/MM/YYYY or DD-MM-YYYY
  const dmyMatch = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmyMatch) {
    const day = dmyMatch[1]!.padStart(2, '0');
    const month = dmyMatch[2]!.padStart(2, '0');
    const year = dmyMatch[3]!;
    const iso = `${year}-${month}-${day}`;
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isFinite(d.getTime())) return iso;
  }

  // Hy-Tek MMDDYYYY (8 digits)
  if (/^\d{8}$/.test(trimmed)) {
    const month = trimmed.slice(0, 2);
    const day = trimmed.slice(2, 4);
    const year = trimmed.slice(4, 8);
    const iso = `${year}-${month}-${day}`;
    const d = new Date(`${iso}T00:00:00Z`);
    if (Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === iso) {
      return iso;
    }
  }

  return null;
}

/**
 * Computes exact competitive age at a given cut-off date (Age-Up Date or Meet Date).
 * In international competitive swimming, age is determined relative to the tournament's
 * age-up date (commonly the first day of competition or Dec 31).
 */
export function calculateAgeAtDate(
  birthDate: string | null | undefined,
  referenceDate: string | null | undefined
): number | null {
  const birthIso = normalizeIsoDate(birthDate);
  const refIso = normalizeIsoDate(referenceDate) ?? new Date().toISOString().slice(0, 10);
  if (!birthIso || !refIso) return null;

  const bYear = Number(birthIso.slice(0, 4));
  const bMonth = Number(birthIso.slice(5, 7));
  const bDay = Number(birthIso.slice(8, 10));

  const rYear = Number(refIso.slice(0, 4));
  const rMonth = Number(refIso.slice(5, 7));
  const rDay = Number(refIso.slice(8, 10));

  let age = rYear - bYear;
  if (rMonth < bMonth || (rMonth === bMonth && rDay < bDay)) {
    age--;
  }
  return age >= 0 && age <= 120 ? age : null;
}

/**
 * Strict course normalization with validation.
 */
export function normalizeCourse(raw: string | null | undefined, fallback: CourseType = 'LCM'): CourseType {
  if (!raw) return fallback;
  const upper = raw.trim().toUpperCase();
  if (['LCM', 'L', '50M', '50'].includes(upper)) return 'LCM';
  if (['SCM', 'S', '25M', '25'].includes(upper)) return 'SCM';
  if (['SCY', 'Y', '25Y', 'YARDS'].includes(upper)) return 'SCY';
  return fallback;
}
