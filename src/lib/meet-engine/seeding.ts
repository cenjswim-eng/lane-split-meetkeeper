/**
 * Meet Engine Seeding System
 * Implements World Aquatics official lane assignments:
 * - 8 lanes: [4, 5, 3, 6, 2, 7, 1, 8]
 * - 10 lanes: [5, 6, 4, 7, 3, 8, 2, 9, 1, 10]
 * - 6 lanes: [3, 4, 2, 5, 1, 6]
 * Supports Timed Finals, Circle Seeding for preliminary heats,
 * and heat density balancing (minimum 3 swimmers per heat).
 */

import { CourseType } from '@/lib/hytek-bridge/data-normalizer';
import { convertSwimTime } from '@/lib/team-hub/course-converter';

export type SeedingMode = 'timed_finals' | 'circle_seeding';

export interface SeedingSwimmer {
  id: string;
  name: string;
  clubCode?: string;
  seedTimeMs: number | null;
  seedCourse: CourseType;
  gender: 'M' | 'F' | 'X';
  age?: number | null;
  status?: 'OK' | 'SCR' | 'EXH';
}

export interface SeededHeatLane {
  swimmerId: string;
  name: string;
  clubCode?: string;
  heatNumber: number;
  laneNumber: number;
  seedTimeMs: number | null;
  rankedTimeMs: number | null;
  isConverted: boolean;
  status: 'OK' | 'SCR' | 'EXH';
}

export interface SeedingOptions {
  poolLanes: 6 | 8 | 10;
  mode: SeedingMode;
  targetCourse: CourseType;
  allowCourseConversion?: boolean;
}

/**
 * World Aquatics cascade lane priority order:
 * Center lanes first, cascading outwards towards the walls.
 */
export function getLanePriority(lanes: 6 | 8 | 10): number[] {
  if (lanes === 8) {
    return [4, 5, 3, 6, 2, 7, 1, 8];
  }
  if (lanes === 10) {
    return [5, 6, 4, 7, 3, 8, 2, 9, 1, 10];
  }
  return [3, 4, 2, 5, 1, 6];
}

/**
 * Normalizes and sorts swimmers by competitive entry time.
 * Swimmers with valid times come first (fastest to slowest).
 * Unseeded swimmers (NT) come last (alphabetically sorted).
 */
export function rankSeedingEntries(
  swimmers: readonly SeedingSwimmer[],
  options: SeedingOptions
): { swimmer: SeedingSwimmer; rankedTimeMs: number | null; isConverted: boolean }[] {
  const active = swimmers.filter((s) => s.status !== 'SCR');

  return active
    .map((s) => {
      if (s.seedTimeMs == null || s.seedTimeMs <= 0) {
        return { swimmer: s, rankedTimeMs: null, isConverted: false };
      }

      if (s.seedCourse === options.targetCourse) {
        return { swimmer: s, rankedTimeMs: s.seedTimeMs, isConverted: false };
      }

      if (options.allowCourseConversion) {
        const converted = convertSwimTime(s.seedTimeMs, s.seedCourse, options.targetCourse);
        return {
          swimmer: s,
          rankedTimeMs: converted?.durationMs ?? s.seedTimeMs,
          isConverted: true,
        };
      }

      return { swimmer: s, rankedTimeMs: s.seedTimeMs, isConverted: false };
    })
    .sort((a, b) => {
      // Valid times before NT
      if (a.rankedTimeMs != null && b.rankedTimeMs != null) {
        return a.rankedTimeMs - b.rankedTimeMs;
      }
      if (a.rankedTimeMs != null) return -1;
      if (b.rankedTimeMs != null) return 1;
      return a.swimmer.name.localeCompare(b.swimmer.name);
    });
}

/**
 * Seeds an event into heats and lanes according to World Aquatics rules.
 */
export function seedMeetEvent(
  swimmers: readonly SeedingSwimmer[],
  options: SeedingOptions
): SeededHeatLane[] {
  const ranked = rankSeedingEntries(swimmers, options);
  const total = ranked.length;
  if (total === 0) return [];

  const lanesCount = options.poolLanes;
  const lanePriority = getLanePriority(lanesCount);
  const heatCount = Math.ceil(total / lanesCount);

  // Compute swimmer count per heat with minimum-3 density rule
  const heatSizes = Array<number>(heatCount).fill(lanesCount);
  heatSizes[0] = total - (heatCount - 1) * lanesCount;

  // If heat 1 has fewer than 3 swimmers and there are multiple heats, balance from heat 2
  if (heatCount > 1 && heatSizes[0]! < 3) {
    const needed = 3 - heatSizes[0]!;
    heatSizes[0] = 3;
    heatSizes[1] = Math.max(3, (heatSizes[1] ?? lanesCount) - needed);
  }

  const heats: (typeof ranked)[] = Array.from({ length: heatCount }, () => []);
  let cursor = 0;

  if (options.mode === 'circle_seeding' && heatCount >= 2) {
    // Circle seed top 3 heats (or top 2 if total heats === 2)
    const circleHeatsCount = Math.min(3, heatCount);
    const circleStartIndex = heatCount - circleHeatsCount;

    // Distribute top swimmers across the circle heats in round-robin fashion
    while (heats.slice(circleStartIndex).some((h, i) => h.length < (heatSizes[circleStartIndex + i] ?? 0))) {
      for (let h = heatCount - 1; h >= circleStartIndex; h--) {
        if ((heats[h]?.length ?? 0) >= (heatSizes[h] ?? 0)) continue;
        const entry = ranked[cursor++];
        if (entry) heats[h]?.push(entry);
      }
    }

    // Earlier heats seeded normally (fastest to slowest)
    for (let h = circleStartIndex - 1; h >= 0; h--) {
      const size = heatSizes[h] ?? lanesCount;
      heats[h] = ranked.slice(cursor, cursor + size);
      cursor += size;
    }
  } else {
    // Standard Timed Finals: heats run slowest to fastest, so fastest heat is the final heat
    for (let h = heatCount - 1; h >= 0; h--) {
      const size = heatSizes[h] ?? lanesCount;
      heats[h] = ranked.slice(cursor, cursor + size);
      cursor += size;
    }
  }

  // Assign lane numbers according to lanePriority within each heat
  const result: SeededHeatLane[] = [];
  heats.forEach((heatSwimmers, heatIdx) => {
    const heatNum = heatIdx + 1;
    heatSwimmers.forEach((item, swimmerIdx) => {
      const lane = lanePriority[swimmerIdx] ?? (swimmerIdx + 1);
      result.push({
        swimmerId: item.swimmer.id,
        name: item.swimmer.name,
        ...(item.swimmer.clubCode !== undefined ? { clubCode: item.swimmer.clubCode } : {}),
        heatNumber: heatNum,
        laneNumber: lane,
        seedTimeMs: item.swimmer.seedTimeMs,
        rankedTimeMs: item.rankedTimeMs,
        isConverted: item.isConverted,
        status: item.swimmer.status ?? 'OK',
      });
    });
  });

  return result.sort((a, b) => a.heatNumber - b.heatNumber || a.laneNumber - b.laneNumber);
}
