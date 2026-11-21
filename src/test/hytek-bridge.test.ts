import { describe, it, expect } from 'vitest';
import {
  normalizeSwimTimeToMs,
  formatMsToTime,
  calculateAgeAtDate,
  normalizeIsoDate,
} from '@/lib/hytek-bridge/data-normalizer';
import {
  computeNameScore,
  evaluateAthleteMatch,
  levenshteinDistance,
} from '@/lib/hytek-bridge/athlete-dedup';
import {
  formatHy3Record,
  serializeHy3File,
} from '@/lib/hytek-bridge/hy3-writer';
import { parseHy3File } from '@/lib/hytek-bridge/hy3-parser';
import { runPreFlightValidation } from '@/lib/hytek-bridge/preflight-validator';
import { convertSwimTime } from '@/lib/team-hub/course-converter';
import {
  optimizeFreeRelay,
  optimizeMedleyRelay,
  type RelaySwimmerCandidate,
} from '@/lib/team-hub/smart-relay-builder';
import { getLanePriority, seedMeetEvent } from '@/lib/meet-engine/seeding';
import {
  calculateOfficialTime,
  verifyRecordsBroken,
  type MeetRecord,
} from '@/lib/meet-engine/technical-console';
import {
  transitionEventStatus,
  recordLiveScratch,
  recordLiveRelaySub,
  getLiveAuditLog,
  EVENT_STATUS_CONFIG,
} from '@/lib/meet-engine/live-lifecycle';
import {
  enqueueOfflineHeat,
  getOfflineTimingQueue,
  markOfflineHeatSynced,
  drainOfflineQueue,
  exportOfflineQueueBackupJson,
} from '@/lib/meet-engine/offline-pool-sync';

describe('Hito 1: Normalización de Datos y Deduplicación Fuzzy', () => {
  it('normalizes times with comma (,) or dot (.) decimal into exact integer milliseconds', () => {
    // Minutes + seconds with dot
    const res1 = normalizeSwimTimeToMs('1:02.34');
    expect(res1.status).toBe('OK');
    expect(res1.timeMs).toBe(62340);
    expect(res1.formatted).toBe('1:02.34');

    // Minutes + seconds with comma
    const res2 = normalizeSwimTimeToMs('1:02,34');
    expect(res2.status).toBe('OK');
    expect(res2.timeMs).toBe(62340);
    expect(res2.formatted).toBe('1:02.34');

    // Seconds with comma
    const res3 = normalizeSwimTimeToMs('28,50');
    expect(res3.status).toBe('OK');
    expect(res3.timeMs).toBe(28500);

    // Raw integer ms
    const res4 = normalizeSwimTimeToMs(59870);
    expect(res4.status).toBe('OK');
    expect(res4.timeMs).toBe(59870);

    // Status codes
    expect(normalizeSwimTimeToMs('NT').status).toBe('NT');
    expect(normalizeSwimTimeToMs('DQ').status).toBe('DQ');
    expect(normalizeSwimTimeToMs('NS').status).toBe('NS');
    expect(normalizeSwimTimeToMs('SCR').status).toBe('SCR');
    expect(normalizeSwimTimeToMs('DNF').status).toBe('DNF');
  });

  it('calculates exact competitive age at meet Age-Up Date', () => {
    // Born 2010-06-15, meet starts 2026-06-14 (1 day before 16th birthday => age 15)
    expect(calculateAgeAtDate('2010-06-15', '2026-06-14')).toBe(15);
    // On the exact 16th birthday => age 16
    expect(calculateAgeAtDate('2010-06-15', '2026-06-15')).toBe(16);
    // After 16th birthday => age 16
    expect(calculateAgeAtDate('2010-06-15', '2026-10-31')).toBe(16);
  });

  it('detects fuzzy duplicates by Levenshtein distance (> 85%) and alerts on identity conflicts', () => {
    // Levenshtein distance check
    expect(levenshteinDistance('Gonzalez', 'Gonzales')).toBe(1);

    // Name similarity with minor typo
    const score = computeNameScore('Alejandro', 'Gonzalez', 'Alejandro', 'Gonzales');
    expect(score).toBeGreaterThan(85);

    // Transposed name order (e.g. Spanish format "Perez Juan" vs "Juan Perez")
    const transposedScore = computeNameScore('Juan', 'Perez', 'Perez', 'Juan');
    expect(transposedScore).toBeGreaterThanOrEqual(85);

    // Duplicate detection with matching birth date
    const eval1 = evaluateAthleteMatch(
      { first_name: 'Alejandro', last_name: 'Gonzalez', birth_date: '2008-04-12', gender: 'M' },
      { first_name: 'Alejandro', last_name: 'Gonzales', birth_date: '2008-04-12', gender: 'M' }
    );
    expect(eval1.hasDuplicate).toBe(true);
    expect(eval1.suggestedAction).toBe('MERGE');

    // Conflict detection: different birth year
    const eval2 = evaluateAthleteMatch(
      { first_name: 'Carlos', last_name: 'Ramirez', birth_date: '2005-01-01', gender: 'M' },
      { first_name: 'Carlos', last_name: 'Ramirez', birth_date: '2012-01-01', gender: 'M' }
    );
    expect(eval2.conflict).not.toBeNull();
    expect(eval2.suggestedAction).toBe('CREATE_NEW');
  });
});

describe('Hito 2: Módulo hytek-bridge (HY3 Writer, Parser & Pre-Flight Validator)', () => {
  it('generates exact 130-character records with verified 2-digit checksums', () => {
    const record = formatHy3Record('A1', [
      [3, 2, '01'],
      [5, 30, 'Swim Lane Coach'],
      [35, 10, '2.0'],
      [45, 8, '11212026'],
    ]);

    expect(record.length).toBe(130);
    // Last 2 characters are checksum digits
    expect(/^[0-9]{2}$/.test(record.slice(128, 130))).toBe(true);
  });

  it('serializes and parses back meet, teams, swimmers, entries, and relays without checksum errors', () => {
    const rawHy3 = serializeHy3File({
      meet: {
        name: 'Campeonato Nacional 2026',
        location: 'Caracas, Venezuela',
        startDate: '2026-11-20',
        endDate: '2026-11-23',
        course: 'LCM',
      },
      teams: [{ code: 'HSP', name: 'Hogar Hispano de Valencia' }],
      athletes: [
        {
          id: 'swimmer-1',
          firstName: 'Sebastian',
          lastName: 'Mendoza',
          gender: 'M',
          birthDate: '2008-05-10',
          federationId: 'VEN123456',
          teamCode: 'HSP',
        },
      ],
      entries: [
        {
          athleteId: 'swimmer-1',
          eventNumber: '101',
          distance: 100,
          stroke: 1, // Free
          course: 'LCM',
          seedTimeMs: 53450,
          finalTimeMs: 52980,
          place: 1,
          round: 'F',
        },
      ],
      relays: [
        {
          teamCode: 'HSP',
          relayLetter: 'A',
          eventNumber: '201',
          distance: 400,
          stroke: 1,
          gender: 'M',
          course: 'LCM',
          seedTimeMs: 220000,
        },
      ],
    });

    // Check all lines are 130 chars (excluding trailing CRLF)
    const lines = rawHy3.trim().split('\r\n');
    for (const l of lines) {
      expect(l.length).toBe(130);
    }

    // Parse the generated HY3
    const parsed = parseHy3File(rawHy3);
    expect(parsed.checksumErrors).toBe(0);
    expect(parsed.meet.name).toBe('Campeonato Nacional 2026');
    expect(parsed.meet.course).toBe('LCM');
    expect(parsed.teams.length).toBe(1);
    expect(parsed.teams[0]?.code).toBe('HSP');
    expect(parsed.athletes.length).toBe(1);
    expect(parsed.athletes[0]?.lastName).toBe('Mendoza');
    expect(parsed.athletes[0]?.firstName).toBe('Sebastian');
    expect(parsed.entries.length).toBe(1);
    expect(parsed.entries[0]?.seedTimeMs).toBe(53450);
    expect(parsed.entries[0]?.finalTimeMs).toBe(52980);
    expect(parsed.relays.length).toBe(1);
    expect(parsed.relays[0]?.teamCode).toBe('HSP');
    expect(parsed.relays[0]?.seedTimeMs).toBe(220000);
  });

  it('pre-flight validator blocks exceeding event limits and invalid ages', () => {
    const report = runPreFlightValidation(
      [
        {
          id: 'a1',
          firstName: 'Ana',
          lastName: 'Gomez',
          gender: 'F',
          birthDate: '2014-01-01', // Age 12 in 2026
          federationId: 'F123',
          teamCode: 'HSP',
        },
      ],
      [
        // Event for age 15-18 (swimmer is 12 => BLOCKER)
        {
          athleteId: 'a1',
          eventNumber: '1',
          distance: 50,
          stroke: 1,
          seedTimeMs: 31000,
          minAge: 15,
          maxAge: 18,
          gender: 'F',
        },
        // Extra event to test limit
        {
          athleteId: 'a1',
          eventNumber: '2',
          distance: 100,
          stroke: 1,
          seedTimeMs: 65000,
          minAge: 11,
          maxAge: 12,
          gender: 'F',
        },
      ],
      [],
      {
        maxIndividualEventsPerAthlete: 1, // Only 1 allowed, 2 entered => BLOCKER
        ageUpDate: '2026-11-20',
      }
    );

    expect(report.isValid).toBe(false);
    expect(report.blockers.some((b) => b.category === 'AGE_BRACKET')).toBe(true);
    expect(report.blockers.some((b) => b.category === 'EVENT_LIMIT')).toBe(true);
  });
});

describe('Hito 3: Módulo team-hub (Conversor de Cursos y Constructor Inteligente de Relevos)', () => {
  it('converts times strictly between courses and flags isConverted: true', () => {
    const conv = convertSwimTime(60000, 'LCM', 'SCM');
    expect(conv).not.toBeNull();
    expect(conv?.isConverted).toBe(true);
    expect(conv?.originalCourse).toBe('LCM');
    expect(conv?.course).toBe('SCM');
    // SCM is ~2% faster than LCM
    expect(conv?.durationMs).toBeLessThan(60000);
  });

  it('optimizes freestyle relay applying flying start benefit (-0.70s) to legs 2-4', () => {
    const candidates: RelaySwimmerCandidate[] = [
      { id: '1', name: 'Nadador A', gender: 'M', bestTimes: { 1: 52000 } },
      { id: '2', name: 'Nadador B', gender: 'M', bestTimes: { 1: 53000 } },
      { id: '3', name: 'Nadador C', gender: 'M', bestTimes: { 1: 54000 } },
      { id: '4', name: 'Nadador D', gender: 'M', bestTimes: { 1: 55000 } },
      { id: '5', name: 'Nadador E', gender: 'M', bestTimes: { 1: 56000 } },
    ];

    const relay = optimizeFreeRelay(candidates);
    expect(relay).not.toBeNull();
    expect(relay?.legs.length).toBe(4);

    // Leg 1 is lead-off flat start (no reaction deduction)
    expect(relay?.legs[0]?.isFlyingStart).toBe(false);
    expect(relay?.legs[0]?.projectedTimeMs).toBe(relay?.legs[0]?.flatTimeMs);

    // Legs 2, 3, 4 have flying start reaction benefit (53000 - 700 = 52300, etc.)
    expect(relay?.legs[1]?.isFlyingStart).toBe(true);
    expect(relay?.legs[1]?.projectedTimeMs).toBe(relay!.legs[1]!.flatTimeMs - 700);

    // Net advantage is exactly 3 * 700 = 2100 ms (-2.10s)
    expect(relay!.totalFlatMs - relay!.totalProjectedMs).toBe(2100);

    // Alternate identified
    expect(relay?.alternates.length).toBe(1);
    expect(relay?.alternates[0]?.name).toBe('Nadador E');
  });

  it('optimizes medley relay strictly assigning back, breast, fly, free', () => {
    const candidates: RelaySwimmerCandidate[] = [
      { id: '1', name: 'Espaldista', gender: 'M', bestTimes: { 2: 58000, 1: 54000 } },
      { id: '2', name: 'Pechista', gender: 'M', bestTimes: { 3: 65000, 1: 55000 } },
      { id: '3', name: 'Mariposista', gender: 'M', bestTimes: { 4: 56000, 1: 53000 } },
      { id: '4', name: 'Velocista Libre', gender: 'M', bestTimes: { 1: 49000 } },
    ];

    const medley = optimizeMedleyRelay(candidates);
    expect(medley).not.toBeNull();
    expect(medley?.legs[0]?.stroke).toBe(2); // Back
    expect(medley?.legs[1]?.stroke).toBe(3); // Breast
    expect(medley?.legs[2]?.stroke).toBe(4); // Fly
    expect(medley?.legs[3]?.stroke).toBe(1); // Free
  });
});

describe('Hito 4: Módulo meet-engine (Siembra en Cascada y Consola Mesa Técnica)', () => {
  it('assigns cascade lanes 4-5-3-6-2-7-1-8 for 8 lanes and 5-6-4-7-3-8-2-9-1-10 for 10 lanes', () => {
    expect(getLanePriority(8)).toEqual([4, 5, 3, 6, 2, 7, 1, 8]);
    expect(getLanePriority(10)).toEqual([5, 6, 4, 7, 3, 8, 2, 9, 1, 10]);
    expect(getLanePriority(6)).toEqual([3, 4, 2, 5, 1, 6]);
  });

  it('seeds event placing fastest swimmer in lane 4 (8-lane pool) of the final heat', () => {
    const swimmers = [
      { id: '1', name: 'Nadador Rápido', seedTimeMs: 50000, seedCourse: 'LCM' as const, gender: 'M' as const },
      { id: '2', name: 'Nadador Medio', seedTimeMs: 55000, seedCourse: 'LCM' as const, gender: 'M' as const },
      { id: '3', name: 'Nadador Lento', seedTimeMs: 60000, seedCourse: 'LCM' as const, gender: 'M' as const },
    ];

    const seeded = seedMeetEvent(swimmers, {
      poolLanes: 8,
      mode: 'timed_finals',
      targetCourse: 'LCM',
    });

    const fastest = seeded.find((s) => s.swimmerId === '1');
    expect(fastest?.laneNumber).toBe(4); // Center priority lane
  });

  it('calculates official time using median of 3 watches or average of 2 watches', () => {
    // 3 manual watches: [59.80s, 60.00s, 60.20s] => median is 60.00s (60000 ms)
    const res3 = calculateOfficialTime({
      watch1Ms: 60200,
      watch2Ms: 59800,
      watch3Ms: 60000,
    });
    expect(res3.timingMethod).toBe('3_WATCHES_MEDIAN');
    expect(res3.officialTimeMs).toBe(60000);

    // 2 manual watches: [59.80s, 60.00s] => average is 59.90s (59900 ms)
    const res2 = calculateOfficialTime({
      watch1Ms: 59800,
      watch2Ms: 60000,
    });
    expect(res2.timingMethod).toBe('2_WATCHES_AVERAGE');
    expect(res2.officialTimeMs).toBe(59900);

    // Touchpad electronic time takes absolute precedence
    const resTouch = calculateOfficialTime({
      touchpadMs: 59850,
      watch1Ms: 60000,
      watch2Ms: 60100,
      watch3Ms: 60200,
    });
    expect(resTouch.timingMethod).toBe('TOUCHPAD');
    expect(resTouch.officialTimeMs).toBe(59850);
  });

  it('detects when an official time breaks an existing meet or national record', () => {
    const records: MeetRecord[] = [
      {
        recordType: 'NR',
        recordName: 'Récord Nacional Absoluto',
        distance: 100,
        stroke: 1,
        gender: 'M',
        recordTimeMs: 49500, // 49.50s
        holderName: 'Albert Subirats',
      },
    ];

    // Swimmer does 49.20s (faster by 0.30s)
    const check = verifyRecordsBroken(49200, records);
    expect(check.isRecordBroken).toBe(true);
    expect(check.brokenRecords[0]?.recordType).toBe('NR');
    expect(check.brokenRecords[0]?.differenceMs).toBe(-300);
  });
});

describe('Hito 5: Sincronización Bidireccional Reactiva y Trazabilidad en Vivo', () => {
  it('transitions event states through the official live lifecycle with audit trail', () => {
    const meetId = 'meet_test_01';
    const eventId = 'ev_101';
    const eventNumber = '12';

    // Transition SCHEDULED -> CALL_ROOM
    const log1 = transitionEventStatus(meetId, eventId, eventNumber, 'CALL_ROOM', 'SCHEDULED', 'Juez de Cámara');
    expect(log1.action).toBe('STATUS_CHANGE');
    expect(log1.previousState).toBe('SCHEDULED');
    expect(log1.newState).toBe('CALL_ROOM');

    // Transition CALL_ROOM -> IN_WATER
    const log2 = transitionEventStatus(meetId, eventId, eventNumber, 'IN_WATER', 'CALL_ROOM', 'Juez de Salida');
    expect(log2.action).toBe('STATUS_CHANGE');
    expect(log2.newState).toBe('IN_WATER');

    // Transition IN_WATER -> UNDER_REVIEW
    const log3 = transitionEventStatus(meetId, eventId, eventNumber, 'UNDER_REVIEW', 'IN_WATER', 'Mesa Técnica');
    expect(log3.newState).toBe('UNDER_REVIEW');

    // Transition UNDER_REVIEW -> OFFICIAL
    const log4 = transitionEventStatus(meetId, eventId, eventNumber, 'OFFICIAL', 'UNDER_REVIEW', 'Juez Árbitro');
    expect(log4.newState).toBe('OFFICIAL');

    // Audit log should contain all transitions
    const history = getLiveAuditLog(meetId);
    expect(history.length).toBeGreaterThanOrEqual(4);
  });

  it('records last-minute scratches with audit details and reasons', () => {
    const meetId = 'meet_test_scratch';
    const entry = recordLiveScratch({
      meetId,
      eventId: 'ev_50free',
      swimmerName: 'Alejandro Gonzalez',
      heatNumber: 3,
      laneNumber: 4,
      reason: 'Lesión muscular previa a la prueba',
      performedBy: 'Entrenador / Juez Árbitro',
    });

    expect(entry.action).toBe('SCRATCH');
    expect(entry.previousState).toBe('ACTIVE');
    expect(entry.newState).toBe('SCRATCHED');
    expect(entry.details).toContain('Alejandro Gonzalez');
    expect(entry.details).toContain('Serie 3, Carril 4');
  });

  it('records last-minute relay leg substitutions with full traceability', () => {
    const meetId = 'meet_test_sub';
    const entry = recordLiveRelaySub({
      meetId,
      eventId: 'ev_relay_medley',
      relayId: 'relay_club_a',
      legNumber: 2, // Pecho
      outgoingSwimmerName: 'Carlos Ramirez',
      incomingSwimmerName: 'Manuel Torrealba',
      reason: 'Fiebre reportada en cámara de llamadas',
      performedBy: 'Mesa Técnica',
    });

    expect(entry.action).toBe('RELAY_SUB');
    expect(entry.previousState).toBe('Carlos Ramirez');
    expect(entry.newState).toBe('Manuel Torrealba');
    expect(entry.details).toContain('posta #2');
  });
});

describe('Hito 6: Resiliencia Offline-First para Piscina', () => {
  it('enqueues heat times, splits and DQs into local offline queue', () => {
    const item = enqueueOfflineHeat({
      meetId: 'meet_pool_offline',
      eventId: 'ev_200free',
      heatNumber: 2,
      round: 'F',
      capturedBy: 'Cronometrador Carril 3',
      rows: [
        { laneNumber: 3, timeMs: 122450, status: 'OK', splits: [{ distance: 50, timeMs: 28100 }] },
        { laneNumber: 4, timeMs: 119800, status: 'OK' },
        { laneNumber: 5, timeMs: null, status: 'DQ', dqCode: '1A' },
      ],
    });

    expect(item.queueId).toBeDefined();
    expect(item.synced).toBe(false);

    const queue = getOfflineTimingQueue();
    expect(queue.some(q => q.queueId === item.queueId)).toBe(true);
  });

  it('drains offline queue by syncing items and clearing them upon success', async () => {
    const syncedIds: string[] = [];
    const drainResult = await drainOfflineQueue(async (item) => {
      syncedIds.push(item.queueId);
      return true; // simulated remote cloud sync success
    });

    expect(drainResult.syncedCount).toBeGreaterThanOrEqual(1);
    expect(drainResult.remainingCount).toBe(0);
  });

  it('exports offline queue backup as a valid JSON string', () => {
    enqueueOfflineHeat({
      meetId: 'meet_backup_test',
      eventId: 'ev_100fly',
      heatNumber: 1,
      round: 'F',
      capturedBy: 'Juez Crono',
      rows: [{ laneNumber: 4, timeMs: 55400, status: 'OK' }],
    });

    const json = exportOfflineQueueBackupJson();
    const parsed = JSON.parse(json);
    expect(parsed.totalHeats).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(parsed.heats)).toBe(true);
  });
});
