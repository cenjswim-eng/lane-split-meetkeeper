/**
 * Technical Desk Console & Official Timing Rules
 * Complies with World Aquatics (WA) official timing regulations:
 * - Touchpad primary electronic timing
 * - 3-watch backup rule: middle/median time is official
 * - 2-watch backup rule: arithmetic average rounded to hundredths
 * - Official World Aquatics DQ Codes Catalog
 * - Automatic Record Verification (NR, MR, CR)
 */

import { formatMsToTime } from '@/lib/hytek-bridge/data-normalizer';

export interface WatchTimeInput {
  watch1Ms?: number | null;
  watch2Ms?: number | null;
  watch3Ms?: number | null;
  touchpadMs?: number | null;
}

export interface OfficialTimeResult {
  officialTimeMs: number | null;
  timingMethod: 'TOUCHPAD' | '3_WATCHES_MEDIAN' | '2_WATCHES_AVERAGE' | 'SINGLE_WATCH' | 'NO_TIME';
  explanation: string;
  formatted: string;
}

export interface WorldAquaticsDqCode {
  code: string;
  rule: string;
  category: 'START' | 'BACKSTROKE' | 'BREASTSTROKE' | 'BUTTERFLY' | 'MEDLEY' | 'RELAY' | 'GENERAL';
  descriptionEs: string;
}

export interface MeetRecord {
  recordType: 'NR' | 'MR' | 'CR'; // National, Meet, Category
  recordName: string;
  distance: number;
  stroke: number;
  gender: string;
  recordTimeMs: number;
  holderName: string;
  achievedDate?: string;
}

export interface RecordCheckResult {
  isRecordBroken: boolean;
  brokenRecords: {
    recordType: 'NR' | 'MR' | 'CR';
    recordName: string;
    previousTimeMs: number;
    differenceMs: number; // Negative = faster than record
    formattedDifference: string;
  }[];
}

/**
 * Official World Aquatics (FINA) Disqualification Codes
 */
export const WORLD_AQUATICS_DQ_CODES: WorldAquaticsDqCode[] = [
  // Start
  {
    code: 'SW 4.4',
    rule: 'Salida',
    category: 'START',
    descriptionEs: 'Salida en falso: movimiento o partida antes de la señal del juez de salida.',
  },
  // Backstroke
  {
    code: 'SW 6.2',
    rule: 'Espalda',
    category: 'BACKSTROKE',
    descriptionEs: 'No permaneció sobre su espalda durante la carrera (excepto en la ejecución del viraje).',
  },
  {
    code: 'SW 6.3',
    rule: 'Espalda',
    category: 'BACKSTROKE',
    descriptionEs: 'Completamente sumergido por más de 15 m después de la salida o el viraje.',
  },
  {
    code: 'SW 6.4',
    rule: 'Espalda',
    category: 'BACKSTROKE',
    descriptionEs: 'No tocó la pared con ninguna parte del cuerpo al ejecutar el viraje.',
  },
  {
    code: 'SW 6.5',
    rule: 'Espalda',
    category: 'BACKSTROKE',
    descriptionEs: 'El cuerpo no estaba sobre la espalda en el momento de tocar la pared de llegada.',
  },
  // Breaststroke
  {
    code: 'SW 7.1',
    rule: 'Pecho',
    category: 'BREASTSTROKE',
    descriptionEs: 'Movimiento de brazos no simultáneo o no en el mismo plano horizontal.',
  },
  {
    code: 'SW 7.2',
    rule: 'Pecho',
    category: 'BREASTSTROKE',
    descriptionEs: 'Brazada llevada más atrás de la línea de las caderas (salvo primera brazada subacuática).',
  },
  {
    code: 'SW 7.4',
    rule: 'Pecho',
    category: 'BREASTSTROKE',
    descriptionEs: 'Patada de delfín (mariposa) no permitida durante el nado continuo de pecho.',
  },
  {
    code: 'SW 7.5',
    rule: 'Pecho',
    category: 'BREASTSTROKE',
    descriptionEs: 'No tocó con ambas manos de forma simultánea y separada en el viraje o llegada.',
  },
  {
    code: 'SW 7.6',
    rule: 'Pecho',
    category: 'BREASTSTROKE',
    descriptionEs: 'Codos fuera del agua por encima del nivel de la superficie (salvo brazada final).',
  },
  // Butterfly
  {
    code: 'SW 8.1',
    rule: 'Mariposa',
    category: 'BUTTERFLY',
    descriptionEs: 'Brazos no llevados hacia adelante juntos sobre la superficie del agua.',
  },
  {
    code: 'SW 8.3',
    rule: 'Mariposa',
    category: 'BUTTERFLY',
    descriptionEs: 'Movimientos de piernas alternados o patada de tijera/pecho.',
  },
  {
    code: 'SW 8.4',
    rule: 'Mariposa',
    category: 'BUTTERFLY',
    descriptionEs: 'No tocó con ambas manos de forma simultánea y separada en el viraje o llegada.',
  },
  {
    code: 'SW 8.5',
    rule: 'Mariposa',
    category: 'BUTTERFLY',
    descriptionEs: 'Completamente sumergido por más de 15 m después de la salida o viraje.',
  },
  // Medley
  {
    code: 'SW 9.1',
    rule: 'Combinado Individual',
    category: 'MEDLEY',
    descriptionEs: 'Orden incorrecto de estilos (debe ser: Mariposa, Espalda, Pecho, Libre).',
  },
  {
    code: 'SW 9.2',
    rule: 'Relevo Combinado',
    category: 'MEDLEY',
    descriptionEs: 'Orden incorrecto en relevo (debe ser: Espalda, Pecho, Mariposa, Libre).',
  },
  {
    code: 'SW 9.3',
    rule: 'Combinado',
    category: 'MEDLEY',
    descriptionEs: 'En la posta de Libre dentro del Combinado, nadó pecho, espalda o mariposa.',
  },
  // Relay & General
  {
    code: 'SW 10.11',
    rule: 'Relevos',
    category: 'RELAY',
    descriptionEs: 'Salida anticipada en relevo: despegue del bloque antes de que toque el nadador previo (diferencia <= -0.04s).',
  },
  {
    code: 'SW 10.7',
    rule: 'Conducta',
    category: 'GENERAL',
    descriptionEs: 'Obstrucción o interferencia voluntaria hacia otro nadador en su carril.',
  },
];

/**
 * Computes official time according to World Aquatics standards.
 * 1. Touchpad is official primary time.
 * 2. If no touchpad:
 *    - 3 watches: take intermediate (median).
 *    - 2 watches: take arithmetic average rounded to hundredths (10 ms).
 *    - 1 watch: single watch time.
 */
export function calculateOfficialTime(input: WatchTimeInput): OfficialTimeResult {
  // 1. Electronic Touchpad
  if (input.touchpadMs != null && input.touchpadMs > 0) {
    return {
      officialTimeMs: input.touchpadMs,
      timingMethod: 'TOUCHPAD',
      explanation: 'Tiempo electrónico de placa de toque automático.',
      formatted: formatMsToTime(input.touchpadMs),
    };
  }

  // Collect manual watches
  const validWatches: number[] = [input.watch1Ms, input.watch2Ms, input.watch3Ms].filter(
    (w): w is number => w != null && Number.isFinite(w) && w > 0
  );

  // 2. Three manual watches: Take median
  if (validWatches.length === 3) {
    validWatches.sort((a, b) => a - b);
    const median = validWatches[1]!; // Middle time
    return {
      officialTimeMs: median,
      timingMethod: '3_WATCHES_MEDIAN',
      explanation: `Mediana oficial de 3 cronómetros manuales (${formatMsToTime(validWatches[0])}, ${formatMsToTime(median)}, ${formatMsToTime(validWatches[2])}).`,
      formatted: formatMsToTime(median),
    };
  }

  // 3. Two manual watches: Average rounded to hundredths
  if (validWatches.length === 2) {
    const avg = Math.round((validWatches[0]! + validWatches[1]!) / 20) * 10;
    return {
      officialTimeMs: avg,
      timingMethod: '2_WATCHES_AVERAGE',
      explanation: `Promedio oficial de 2 cronómetros redondeado a centésimas (${formatMsToTime(validWatches[0])} y ${formatMsToTime(validWatches[1])}).`,
      formatted: formatMsToTime(avg),
    };
  }

  // 4. Single manual watch
  if (validWatches.length === 1) {
    const single = validWatches[0]!;
    return {
      officialTimeMs: single,
      timingMethod: 'SINGLE_WATCH',
      explanation: 'Tiempo de cronómetro manual único.',
      formatted: formatMsToTime(single),
    };
  }

  return {
    officialTimeMs: null,
    timingMethod: 'NO_TIME',
    explanation: 'Sin registros de cronometraje disponibles.',
    formatted: 'NT',
  };
}

/**
 * Verifies if an official time beats any existing records.
 */
export function verifyRecordsBroken(
  finalMs: number | null | undefined,
  records: MeetRecord[]
): RecordCheckResult {
  if (finalMs == null || finalMs <= 0 || !records.length) {
    return { isRecordBroken: false, brokenRecords: [] };
  }

  const broken: RecordCheckResult['brokenRecords'] = [];

  for (const rec of records) {
    if (finalMs < rec.recordTimeMs) {
      const diff = finalMs - rec.recordTimeMs;
      broken.push({
        recordType: rec.recordType,
        recordName: rec.recordName,
        previousTimeMs: rec.recordTimeMs,
        differenceMs: diff,
        formattedDifference: `${(diff / 1000).toFixed(2)}s`,
      });
    }
  }

  return {
    isRecordBroken: broken.length > 0,
    brokenRecords: broken,
  };
}
