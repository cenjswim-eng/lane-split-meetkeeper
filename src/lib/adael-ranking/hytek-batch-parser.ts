/**
 * Comprehensive Hy-Tek Batch Parser for ADAEL 2026 Ranking
 * - Decodes using ISO-8859-1 (TextDecoder('iso-8859-1'))
 * - Extracts C1 (Clubs), D1 (Athletes), E2 (Individual Results)
 * - Extracts F3 + G1 (Valid Relay Lead-Off splits for official rankings)
 * - Computes World Aquatics (WA / AQUA) points
 * - Handles .hy3, .sd3, and compressed .zip packages
 */

import { unzipSync } from 'fflate';
import { normalizeSwimTimeToMs, normalizeCourse, normalizeIsoDate } from '@/lib/hytek-bridge/data-normalizer';
import { KNOWN_ADAEL_CODES } from '@/lib/team-hub/ranking-engine';
import { aquaPoints } from '@/lib/swim';
import { normalizeTeamCode } from '@/data/fevedaClubs';
import { extractAllSwimFilesFromZip } from '@/lib/swim-io/encodingAndTime';
import type {
  AdaelIngestPayload,
  CourseType2026,
  StrokeCode2026,
  ResultStatus2026,
  RoundCode2026,
} from './schema';

const HY3_STROKES: Record<string, StrokeCode2026> = {
  A: 'FREE',
  B: 'BACK',
  C: 'BREAST',
  D: 'FLY',
  E: 'IM',
};

const STROKE_TO_NUMBER: Record<StrokeCode2026, number> = {
  FREE: 1,
  BACK: 2,
  BREAST: 3,
  FLY: 4,
  IM: 5,
};

const col = (line: string, start: number, end: number): string => line.slice(start - 1, end).trim();

/**
 * Decodes binary buffers using ISO-8859-1.
 * Essential for Hy-Tek Spanish text: guarantees exactly 1 byte per char
 * preserving 'Ñ' and accented vowels without displacing fixed-width columns.
 */
export function decodeHytekIso8859(buffer: Uint8Array | ArrayBuffer): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return new TextDecoder('iso-8859-1').decode(bytes);
}

/**
 * Checks if a club is affiliated to ADAEL (Lara State).
 */
export function isAdaelAffiliatedClub(code: string, name?: string): boolean {
  const cleanCode = (code || '').toUpperCase().trim();
  if (KNOWN_ADAEL_CODES.includes(cleanCode)) return true;
  const cleanName = (name || '').toUpperCase().trim();
  if (cleanName.includes('LARA') || cleanName.includes('ADAEL') || cleanName.includes('BARQUISIMETO') || cleanName.includes('BOLIVARIANAS')) {
    return true;
  }
  return false;
}

export interface ParsedInternalAthlete {
  id: string;
  tmId: string;
  teamCode: string;
  lastName: string;
  firstName: string;
  middleInitial: string | null;
  gender: 'M' | 'F' | 'X';
  birthDate: string | null;
  federationId: string | null;
}

export interface ParsedInternalRelay {
  teamCode: string;
  relayLetter: string;
  gender: 'M' | 'F' | 'X';
  distance: number;
  strokeCode: string; // 'A' (Free) or 'E' (Medley)
  eventNumber: string | null;
  round: RoundCode2026;
  finalTimeMs: number | null;
  status: ResultStatus2026;
  swimmer1Ref: string | null; // From F3
  swimmer2Ref: string | null;
  swimmer3Ref: string | null;
  swimmer4Ref: string | null;
  splits: { distance: number; cumulativeMs: number }[];
}

/**
 * Parses a single HY3 string into an AdaelIngestPayload.
 */
export function parseAdaelHy3String(
  text: string,
  fileName = 'torneo.hy3',
  fileHash?: string | null
): AdaelIngestPayload {
  const meetNameFallback = fileName.replace(/\.[^.]+$/, '').trim() || 'Campeonato Estadal ADAEL 2026';
  let meetName = meetNameFallback;
  let meetLocation: string | null = null;
  let meetStartDate = '2026-03-01'; // Default 2026 season fallback
  let meetEndDate: string | null = null;
  let meetCourse: CourseType2026 = 'LCM';

  const clubsMap = new Map<string, { code: string; name: string; isFederated: boolean; association: string }>();
  const athletesMap = new Map<string, ParsedInternalAthlete>(); // key: athleteId
  const athletesByTeamAndName = new Map<string, ParsedInternalAthlete>(); // key: teamCode_lastName_firstName

  let currentTeamCode: string | null = null;
  let currentAthleteId: string | null = null;
  let currentEntry: {
    eventNum: string | null;
    distance: number;
    stroke: StrokeCode2026;
    gender: 'M' | 'F' | 'X';
  } | null = null;

  let currentRelay: ParsedInternalRelay | null = null;
  const completedRelays: ParsedInternalRelay[] = [];

  const individualResults: AdaelIngestPayload['results'] = [];

  const lines = text.split(/\r\n|\n|\r/);

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;
    const padded = rawLine.padEnd(132, ' ');
    const lineType = padded.slice(0, 2);

    switch (lineType) {
      case 'B1': {
        const parsedName = col(padded, 3, 47);
        if (parsedName) meetName = parsedName;
        meetLocation = col(padded, 48, 92) || meetLocation;
        const start = normalizeIsoDate(col(padded, 93, 100));
        if (start) meetStartDate = start;
        const end = normalizeIsoDate(col(padded, 101, 108));
        if (end) meetEndDate = end;
        break;
      }
      case 'B2': {
        const cCode = col(padded, 99, 99).toUpperCase();
        if (cCode === 'S') meetCourse = 'SCM';
        else meetCourse = 'LCM';
        break;
      }
      case 'C1': {
        currentAthleteId = null;
        currentEntry = null;
        currentRelay = null;
        const rawCode = col(padded, 3, 7).toUpperCase();
        const rawName = col(padded, 8, 37) || rawCode;
        const norm = normalizeTeamCode(rawCode, rawName);
        currentTeamCode = norm.code;
        const teamName = norm.name;
        if (!clubsMap.has(currentTeamCode)) {
          clubsMap.set(currentTeamCode, {
            code: currentTeamCode,
            name: teamName,
            isFederated: isAdaelAffiliatedClub(currentTeamCode, teamName),
            association: isAdaelAffiliatedClub(currentTeamCode, teamName) ? 'LARA' : norm.lsc,
          });
        }
        break;
      }
      case 'D1': {
        currentEntry = null;
        currentRelay = null;
        const gender = (col(padded, 3, 3).toUpperCase() || 'M') as 'M' | 'F' | 'X';
        const tmId = col(padded, 4, 8);
        const lastName = col(padded, 9, 28);
        const firstName = col(padded, 29, 48);
        const middleInitial = col(padded, 49, 49) || null;
        const fedId = col(padded, 70, 83) || null;
        const birthDate = normalizeIsoDate(col(padded, 89, 96));

        currentAthleteId = `${currentTeamCode || 'UN'}:${tmId || lastName}`;

        const athleteObj: ParsedInternalAthlete = {
          id: currentAthleteId,
          tmId,
          teamCode: currentTeamCode || 'UN',
          lastName,
          firstName,
          middleInitial,
          gender,
          birthDate,
          federationId: fedId,
        };

        athletesMap.set(currentAthleteId, athleteObj);

        const nameKey = `${currentTeamCode || 'UN'}_${lastName.toUpperCase()}_${firstName.toUpperCase()}`;
        athletesByTeamAndName.set(nameKey, athleteObj);
        break;
      }
      case 'E1': {
        if (!currentAthleteId) break;
        const athlete = athletesMap.get(currentAthleteId);
        if (!athlete) break;

        const distance = Number(col(padded, 16, 21)) || 50;
        const strokeLetter = col(padded, 22, 22).toUpperCase();
        const stroke = HY3_STROKES[strokeLetter] || 'FREE';
        const eventNum = col(padded, 39, 42) || null;

        currentEntry = {
          eventNum,
          distance,
          stroke,
          gender: athlete.gender,
        };
        break;
      }
      case 'E2': {
        if (!currentAthleteId || !currentEntry) break;
        const athlete = athletesMap.get(currentAthleteId);
        if (!athlete || !athlete.birthDate) break;

        const round = (col(padded, 3, 3).toUpperCase() || 'F') as RoundCode2026;
        const rawFinalTime = col(padded, 4, 11);
        const statusLetter = col(padded, 13, 15).toUpperCase();
        const normTime = normalizeSwimTimeToMs(rawFinalTime);

        let finalStatus: ResultStatus2026 = 'OK';
        if (statusLetter.includes('DQ') || normTime.status === 'DQ') finalStatus = 'DQ';
        else if (statusLetter.includes('NS') || normTime.status === 'NS') finalStatus = 'DNS';
        else if (statusLetter.includes('SCR') || normTime.status === 'SCR') finalStatus = 'SCR';
        else if (statusLetter.includes('DNF') || normTime.status === 'DNF') finalStatus = 'DNF';
        else if (normTime.timeMs == null) finalStatus = 'DNS';

        const strokeNum = STROKE_TO_NUMBER[currentEntry.stroke];
        const waPts = finalStatus === 'OK' && normTime.timeMs
          ? aquaPoints(normTime.timeMs, meetCourse, athlete.gender, currentEntry.distance, strokeNum)
          : null;

        individualResults.push({
          swimmerName: `${athlete.lastName}, ${athlete.firstName}`.trim(),
          federationId: athlete.federationId,
          birthDate: athlete.birthDate,
          gender: athlete.gender,
          clubCode: athlete.teamCode,
          distance: currentEntry.distance,
          stroke: currentEntry.stroke,
          timeMs: finalStatus === 'OK' ? normTime.timeMs : null,
          status: finalStatus,
          isRelayLeadOff: false,
          waPoints: waPts,
          round,
          eventNumber: currentEntry.eventNum,
        });
        break;
      }
      case 'F1': {
        // Relay declaration
        currentEntry = null;
        const teamCode = col(padded, 3, 7).toUpperCase() || currentTeamCode || 'UN';
        const relayLetter = col(padded, 8, 8) || 'A';
        const gender = (col(padded, 9, 9).toUpperCase() || 'M') as 'M' | 'F' | 'X';
        const distance = Number(col(padded, 10, 15)) || 200;
        const strokeCode = col(padded, 16, 16).toUpperCase(); // 'A' = Free, 'E' = Medley
        const eventNum = col(padded, 25, 28) || null;

        currentRelay = {
          teamCode,
          relayLetter,
          gender,
          distance,
          strokeCode,
          eventNumber: eventNum,
          round: 'F',
          finalTimeMs: null,
          status: 'OK',
          swimmer1Ref: null,
          swimmer2Ref: null,
          swimmer3Ref: null,
          swimmer4Ref: null,
          splits: [],
        };
        completedRelays.push(currentRelay);
        break;
      }
      case 'F2': {
        // Relay result
        if (!currentRelay) break;
        const round = (col(padded, 3, 3).toUpperCase() || 'F') as RoundCode2026;
        const rawFinal = col(padded, 4, 11);
        const statusLetter = col(padded, 13, 15).toUpperCase();
        const normTime = normalizeSwimTimeToMs(rawFinal);

        currentRelay.round = round;
        currentRelay.finalTimeMs = normTime.timeMs;

        if (statusLetter.includes('DQ') || normTime.status === 'DQ') currentRelay.status = 'DQ';
        else if (statusLetter.includes('NS') || normTime.status === 'NS') currentRelay.status = 'DNS';
        else if (statusLetter.includes('SCR') || normTime.status === 'SCR') currentRelay.status = 'SCR';
        else if (statusLetter.includes('DNF') || normTime.status === 'DNF') currentRelay.status = 'DNF';
        else currentRelay.status = 'OK';
        break;
      }
      case 'F3': {
        // Relay swimmers lineup: 4 slots
        if (!currentRelay) break;
        currentRelay.swimmer1Ref = col(padded, 3, 14) || null;
        currentRelay.swimmer2Ref = col(padded, 15, 26) || null;
        currentRelay.swimmer3Ref = col(padded, 27, 38) || null;
        currentRelay.swimmer4Ref = col(padded, 39, 50) || null;
        break;
      }
      case 'G1': {
        // Split times (cumulative)
        if (currentRelay) {
          const legInterval = currentRelay.distance === 800 ? 200 : currentRelay.distance === 400 ? 100 : 50;
          for (let i = 0; i < 10; i++) {
            const startCol = 3 + i * 11;
            const chunk = padded.slice(startCol - 1, startCol + 10);
            const num = Number(chunk.slice(1, 3));
            const normSplit = normalizeSwimTimeToMs(chunk.slice(3, 11));
            if (num > 0 && normSplit.timeMs != null) {
              const splitDist = num * (meetCourse === 'LCM' ? 50 : 25);
              if (splitDist <= currentRelay.distance && !currentRelay.splits.some((s) => s.distance === splitDist)) {
                currentRelay.splits.push({ distance: splitDist, cumulativeMs: normSplit.timeMs });
              }
            }
          }
        }
        break;
      }
    }
  }

  // Process Valid Relay Lead-Offs (F3 + G1 when relay is OK)
  const relayLeadOffResults: AdaelIngestPayload['results'] = [];

  for (const relay of completedRelays) {
    if (relay.status !== 'OK') continue; // DQ relays cannot yield official lead-off marks

    // Lead-off leg distance: 50m (in 4x50), 100m (in 4x100), 200m (in 4x200)
    const legDistance = relay.distance === 800 ? 200 : relay.distance === 400 ? 100 : 50;

    // Stroke: In Medley relay ('E'), 1st leg is ALWAYS Backstroke ('BACK'). In Free relay ('A'), it's Freestyle ('FREE').
    const leadOffStroke: StrokeCode2026 = relay.strokeCode === 'E' ? 'BACK' : 'FREE';

    // Find the cumulative split at legDistance
    const leadOffSplit = relay.splits.find((s) => s.distance === legDistance);
    if (!leadOffSplit || leadOffSplit.cumulativeMs <= 0) continue;

    // Resolve Swimmer 1 from F3
    let leadOffAthlete: ParsedInternalAthlete | null = null;
    if (relay.swimmer1Ref) {
      // 1. Try by TM ID: teamCode:id
      const directKey = `${relay.teamCode}:${relay.swimmer1Ref}`;
      if (athletesMap.has(directKey)) {
        leadOffAthlete = athletesMap.get(directKey)!;
      } else {
        // 2. Search athlete matching swimmer1Ref in this team
        for (const a of athletesMap.values()) {
          if (a.teamCode === relay.teamCode && (a.tmId === relay.swimmer1Ref || a.lastName.toUpperCase().includes(relay.swimmer1Ref.toUpperCase()))) {
            leadOffAthlete = a;
            break;
          }
        }
      }
    }

    if (!leadOffAthlete || !leadOffAthlete.birthDate) {
      // If F3 was anonymous but valid, generate an identifiable placeholder
      continue;
    }

    const strokeNum = STROKE_TO_NUMBER[leadOffStroke];
    const waPts = aquaPoints(leadOffSplit.cumulativeMs, meetCourse, leadOffAthlete.gender, legDistance, strokeNum);

    relayLeadOffResults.push({
      swimmerName: `${leadOffAthlete.lastName}, ${leadOffAthlete.firstName}`.trim(),
      federationId: leadOffAthlete.federationId,
      birthDate: leadOffAthlete.birthDate,
      gender: leadOffAthlete.gender,
      clubCode: relay.teamCode,
      distance: legDistance,
      stroke: leadOffStroke,
      timeMs: leadOffSplit.cumulativeMs,
      status: 'OK',
      isRelayLeadOff: true,
      waPoints: waPts,
      round: relay.round,
      eventNumber: relay.eventNumber,
    });
  }

  // Combine results with deduplication within the meet
  const uniqueResultsMap = new Map<string, AdaelIngestPayload['results'][0]>();

  // 1. Individual results
  for (const r of individualResults) {
    const key = `${r.swimmerName}_${r.birthDate}_${r.distance}_${r.stroke}_${r.round}_false`;
    const existing = uniqueResultsMap.get(key);
    if (!existing || (r.timeMs && (!existing.timeMs || r.timeMs < existing.timeMs))) {
      uniqueResultsMap.set(key, r);
    }
  }

  // 2. Relay lead-off results
  for (const r of relayLeadOffResults) {
    const key = `${r.swimmerName}_${r.birthDate}_${r.distance}_${r.stroke}_${r.round}_true`;
    uniqueResultsMap.set(key, r);
  }

  return {
    meet: {
      name: meetName,
      startDate: meetStartDate,
      endDate: meetEndDate,
      course: meetCourse,
      location: meetLocation,
      fileHash: fileHash ?? null,
      fileName,
    },
    clubs: Array.from(clubsMap.values()),
    results: Array.from(uniqueResultsMap.values()),
  };
}

/**
 * Expands a ZIP buffer into a list of enclosed HY3/SD3/CL2 files,
 * recursively unpacking any nested .zip archives.
 */
export function expandZipFiles(buffer: ArrayBuffer | Uint8Array): { fileName: string; bytes: Uint8Array }[] {
  return extractAllSwimFilesFromZip(buffer);
}

/**
 * High-level parser that takes raw File objects or binary buffers and returns
 * normalized AdaelIngestPayload records ready for batch ingestion.
 */
export async function parseAdaelFilesBatch(
  files: { name: string; buffer: ArrayBuffer | Uint8Array; hash?: string }[]
): Promise<{ payloads: AdaelIngestPayload[]; warnings: string[] }> {
  const payloads: AdaelIngestPayload[] = [];
  const warnings: string[] = [];

  for (const f of files) {
    try {
      const isZip = /\.zip$/i.test(f.name);

      if (isZip) {
        const nestedFiles = expandZipFiles(f.buffer);
        if (nestedFiles.length === 0) {
          warnings.push(`El archivo ZIP "${f.name}" no contiene archivos .hy3 o .sd3.`);
          continue;
        }

        for (const nested of nestedFiles) {
          const text = decodeHytekIso8859(nested.bytes);
          const payload = parseAdaelHy3String(text, nested.fileName, f.hash);
          payloads.push(payload);
        }
      } else {
        const text = decodeHytekIso8859(f.buffer);
        const payload = parseAdaelHy3String(text, f.name, f.hash);
        payloads.push(payload);
      }
    } catch (err) {
      warnings.push(`Error al procesar el archivo "${f.name}": ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { payloads, warnings };
}
