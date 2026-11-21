/**
 * Smart Relay Builder & Lineup Optimizer
 * Enhances Team Manager by calculating optimal quartet assignments,
 * factoring flying start reaction advantages (-0.70s for legs 2-4),
 * identifying alternates, and projecting team points.
 */

import { formatMsToTime } from '@/lib/hytek-bridge/data-normalizer';

export interface RelaySwimmerCandidate {
  id: string;
  name: string;
  gender: 'M' | 'F';
  birthDate?: string | null;
  age?: number | null;
  /** Best flat start time in ms per stroke: 1=Free, 2=Back, 3=Breast, 4=Fly */
  bestTimes: Partial<Record<number, number>>;
  /** Optional flying start split if known */
  flyingSplits?: Partial<Record<number, number>>;
}

export interface RelayLegAssignment {
  legNumber: 1 | 2 | 3 | 4;
  stroke: number; // 1=Free, 2=Back, 3=Breast, 4=Fly
  swimmerId: string;
  name: string;
  gender: 'M' | 'F';
  flatTimeMs: number;
  projectedTimeMs: number; // Flat time for leg 1, flying time for legs 2-4
  isFlyingStart: boolean;
}

export interface OptimizedRelay {
  name: string; // e.g. "Relevo 4x100 Libre A"
  relayKind: 'free' | 'medley';
  isMixed: boolean;
  legs: RelayLegAssignment[];
  totalProjectedMs: number;
  totalFlatMs: number;
  formattedTotal: string;
  alternates: {
    swimmerId: string;
    name: string;
    stroke: number;
    timeMs: number;
  }[];
  projectedPoints: number;
}

/** Standard flying start advantage: taking off from a moving touch vs static block */
export const DEFAULT_FLYING_START_BENEFIT_MS = 700; // -0.70s

/**
 * Calculates effective projected time for a leg.
 * Leg 1 is always flat start (block reaction).
 * Legs 2, 3, 4 receive flying start advantage if no explicit flying split exists.
 */
export function getLegTime(
  candidate: RelaySwimmerCandidate,
  stroke: number,
  legNumber: 1 | 2 | 3 | 4,
  flyingBenefitMs = DEFAULT_FLYING_START_BENEFIT_MS
): { flatMs: number; projectedMs: number } {
  const flat = candidate.bestTimes[stroke] ?? Infinity;
  if (legNumber === 1) {
    return { flatMs: flat, projectedMs: flat };
  }
  const flying = candidate.flyingSplits?.[stroke];
  if (flying != null && flying > 0) {
    return { flatMs: flat, projectedMs: flying };
  }
  return { flatMs: flat, projectedMs: Math.max(0, flat - flyingBenefitMs) };
}

/**
 * Optimizes a 4-swimmer Freestyle Relay (all stroke 1).
 * Orders swimmers strategically:
 * Leg 1: Best lead-off swimmer (solid flat time).
 * Leg 2 & 3: Reliable relay swimmers.
 * Leg 4: Fastest anchor closer.
 */
export function optimizeFreeRelay(
  candidates: RelaySwimmerCandidate[],
  options: {
    isMixed?: boolean;
    flyingBenefitMs?: number;
    pointScale?: number[]; // [18, 14, 12, 10, 8, 6, 4, 2]
  } = {}
): OptimizedRelay | null {
  const benefit = options.flyingBenefitMs ?? DEFAULT_FLYING_START_BENEFIT_MS;
  const points = options.pointScale ?? [18, 14, 12, 10, 8, 6, 4, 2];

  let pool = candidates.filter((c) => c.bestTimes[1] != null && c.bestTimes[1]! > 0);

  if (options.isMixed) {
    const males = pool.filter((c) => c.gender === 'M').sort((a, b) => a.bestTimes[1]! - b.bestTimes[1]!);
    const females = pool.filter((c) => c.gender === 'F').sort((a, b) => a.bestTimes[1]! - b.bestTimes[1]!);
    if (males.length < 2 || females.length < 2) return null;
    pool = [...males.slice(0, 2), ...females.slice(0, 2)];
  } else {
    pool = pool.sort((a, b) => a.bestTimes[1]! - b.bestTimes[1]!);
    if (pool.length < 4) return null;
  }

  // Top 4 chosen
  const chosen = pool.slice(0, 4);

  // Strategic assignment: fastest flat start goes 1st (lead-off), fastest closer goes 4th (anchor)
  const sortedByFlat = [...chosen].sort((a, b) => a.bestTimes[1]! - b.bestTimes[1]!);
  const leadOff = sortedByFlat[0]!;
  const anchor = sortedByFlat[1]!;
  const remaining = sortedByFlat.slice(2);

  const legs: RelayLegAssignment[] = [
    {
      legNumber: 1,
      stroke: 1,
      swimmerId: leadOff.id,
      name: leadOff.name,
      gender: leadOff.gender,
      flatTimeMs: leadOff.bestTimes[1]!,
      projectedTimeMs: getLegTime(leadOff, 1, 1, benefit).projectedMs,
      isFlyingStart: false,
    },
    {
      legNumber: 2,
      stroke: 1,
      swimmerId: remaining[0]!.id,
      name: remaining[0]!.name,
      gender: remaining[0]!.gender,
      flatTimeMs: remaining[0]!.bestTimes[1]!,
      projectedTimeMs: getLegTime(remaining[0]!, 1, 2, benefit).projectedMs,
      isFlyingStart: true,
    },
    {
      legNumber: 3,
      stroke: 1,
      swimmerId: remaining[1]!.id,
      name: remaining[1]!.name,
      gender: remaining[1]!.gender,
      flatTimeMs: remaining[1]!.bestTimes[1]!,
      projectedTimeMs: getLegTime(remaining[1]!, 1, 3, benefit).projectedMs,
      isFlyingStart: true,
    },
    {
      legNumber: 4,
      stroke: 1,
      swimmerId: anchor.id,
      name: anchor.name,
      gender: anchor.gender,
      flatTimeMs: anchor.bestTimes[1]!,
      projectedTimeMs: getLegTime(anchor, 1, 4, benefit).projectedMs,
      isFlyingStart: true,
    },
  ];

  const totalFlatMs = legs.reduce((acc, l) => acc + l.flatTimeMs, 0);
  const totalProjectedMs = legs.reduce((acc, l) => acc + l.projectedTimeMs, 0);

  // Alternates (5th to 8th)
  const alternateCandidates = candidates
    .filter((c) => !legs.some((l) => l.swimmerId === c.id) && c.bestTimes[1] != null)
    .sort((a, b) => a.bestTimes[1]! - b.bestTimes[1]!)
    .slice(0, 4)
    .map((c) => ({
      swimmerId: c.id,
      name: c.name,
      stroke: 1,
      timeMs: c.bestTimes[1]!,
    }));

  return {
    name: `Relevo Libre${options.isMixed ? ' Mixto' : ''}`,
    relayKind: 'free',
    isMixed: Boolean(options.isMixed),
    legs,
    totalFlatMs,
    totalProjectedMs,
    formattedTotal: formatMsToTime(totalProjectedMs),
    alternates: alternateCandidates,
    projectedPoints: points[0] ?? 18,
  };
}

/**
 * Optimizes a Medley Relay (Order: 2=Back, 3=Breast, 4=Fly, 1=Free).
 * Searches combinations to find the quartet with minimal total projected time.
 */
export function optimizeMedleyRelay(
  candidates: RelaySwimmerCandidate[],
  options: {
    isMixed?: boolean;
    flyingBenefitMs?: number;
    pointScale?: number[];
  } = {}
): OptimizedRelay | null {
  const benefit = options.flyingBenefitMs ?? DEFAULT_FLYING_START_BENEFIT_MS;
  const points = options.pointScale ?? [18, 14, 12, 10, 8, 6, 4, 2];

  // Strokes: Back=2, Breast=3, Fly=4, Free=1
  const STROKES_MEDLEY = [2, 3, 4, 1] as const;

  // Filter pool to swimmers who have at least one valid medley stroke
  const pool = candidates.filter((c) => STROKES_MEDLEY.some((s) => c.bestTimes[s] != null && c.bestTimes[s]! > 0));

  let bestQuartet: {
    back: RelaySwimmerCandidate;
    breast: RelaySwimmerCandidate;
    fly: RelaySwimmerCandidate;
    free: RelaySwimmerCandidate;
    totalMs: number;
  } | null = null;

  // Search permutations
  for (const back of pool) {
    if (!back.bestTimes[2]) continue;
    for (const breast of pool) {
      if (breast.id === back.id || !breast.bestTimes[3]) continue;
      for (const fly of pool) {
        if (fly.id === back.id || fly.id === breast.id || !fly.bestTimes[4]) continue;
        for (const free of pool) {
          if (free.id === back.id || free.id === breast.id || free.id === fly.id || !free.bestTimes[1]) continue;

          // Check mixed constraint (exactly 2 M and 2 F)
          if (options.isMixed) {
            const mCount = [back, breast, fly, free].filter((x) => x.gender === 'M').length;
            if (mCount !== 2) continue;
          }

          const tBack = getLegTime(back, 2, 1, benefit).projectedMs;
          const tBreast = getLegTime(breast, 3, 2, benefit).projectedMs;
          const tFly = getLegTime(fly, 4, 3, benefit).projectedMs;
          const tFree = getLegTime(free, 1, 4, benefit).projectedMs;
          const total = tBack + tBreast + tFly + tFree;

          if (!bestQuartet || total < bestQuartet.totalMs) {
            bestQuartet = { back, breast, fly, free, totalMs: total };
          }
        }
      }
    }
  }

  if (!bestQuartet) return null;

  const legs: RelayLegAssignment[] = [
    {
      legNumber: 1,
      stroke: 2, // Backstroke
      swimmerId: bestQuartet.back.id,
      name: bestQuartet.back.name,
      gender: bestQuartet.back.gender,
      flatTimeMs: bestQuartet.back.bestTimes[2]!,
      projectedTimeMs: getLegTime(bestQuartet.back, 2, 1, benefit).projectedMs,
      isFlyingStart: false,
    },
    {
      legNumber: 2,
      stroke: 3, // Breaststroke
      swimmerId: bestQuartet.breast.id,
      name: bestQuartet.breast.name,
      gender: bestQuartet.breast.gender,
      flatTimeMs: bestQuartet.breast.bestTimes[3]!,
      projectedTimeMs: getLegTime(bestQuartet.breast, 3, 2, benefit).projectedMs,
      isFlyingStart: true,
    },
    {
      legNumber: 3,
      stroke: 4, // Butterfly
      swimmerId: bestQuartet.fly.id,
      name: bestQuartet.fly.name,
      gender: bestQuartet.fly.gender,
      flatTimeMs: bestQuartet.fly.bestTimes[4]!,
      projectedTimeMs: getLegTime(bestQuartet.fly, 4, 3, benefit).projectedMs,
      isFlyingStart: true,
    },
    {
      legNumber: 4,
      stroke: 1, // Freestyle
      swimmerId: bestQuartet.free.id,
      name: bestQuartet.free.name,
      gender: bestQuartet.free.gender,
      flatTimeMs: bestQuartet.free.bestTimes[1]!,
      projectedTimeMs: getLegTime(bestQuartet.free, 1, 4, benefit).projectedMs,
      isFlyingStart: true,
    },
  ];

  const totalFlatMs = legs.reduce((acc, l) => acc + l.flatTimeMs, 0);
  const totalProjectedMs = legs.reduce((acc, l) => acc + l.projectedTimeMs, 0);

  // Find alternates
  const assignedIds = new Set(legs.map((l) => l.swimmerId));
  const alternates: { swimmerId: string; name: string; stroke: number; timeMs: number }[] = [];

  for (const s of STROKES_MEDLEY) {
    const cand = candidates
      .filter((c) => !assignedIds.has(c.id) && c.bestTimes[s] != null)
      .sort((a, b) => a.bestTimes[s]! - b.bestTimes[s]!)[0];
    if (cand) {
      alternates.push({
        swimmerId: cand.id,
        name: cand.name,
        stroke: s,
        timeMs: cand.bestTimes[s]!,
      });
    }
  }

  return {
    name: `Relevo Combinado${options.isMixed ? ' Mixto' : ''}`,
    relayKind: 'medley',
    isMixed: Boolean(options.isMixed),
    legs,
    totalFlatMs,
    totalProjectedMs,
    formattedTotal: formatMsToTime(totalProjectedMs),
    alternates,
    projectedPoints: points[0] ?? 18,
  };
}
