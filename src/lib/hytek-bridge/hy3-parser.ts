/**
 * Comprehensive HY3 Parser
 * Parses Hy-Tek Meet Manager and Team Manager files (.HY3).
 * Validates 130-char fixed records, verifies 2-digit checksums,
 * and extracts individual and relay entries/results into normalized integer milliseconds.
 */

import { calculateHy3Checksum } from '@/lib/swim-io/exporters';
import { normalizeSwimTimeToMs, normalizeCourse, normalizeIsoDate, CourseType } from './data-normalizer';

export interface ParsedHy3Meet {
  name: string;
  location: string | null;
  startDate: string | null;
  endDate: string | null;
  course: CourseType;
}

export interface ParsedHy3Team {
  code: string;
  name: string;
  shortName: string | null;
}

export interface ParsedHy3Athlete {
  id: string;
  firstName: string;
  lastName: string;
  middleInitial: string | null;
  gender: 'M' | 'F' | 'X';
  birthDate: string | null;
  federationId: string | null;
  teamCode: string;
}

export interface ParsedHy3Split {
  distance: number;
  cumulativeMs: number;
}

export interface ParsedHy3Entry {
  athleteId: string;
  eventNumber: string | null;
  distance: number;
  stroke: number;
  course: CourseType;
  gender: string | null;
  minAge: number | null;
  maxAge: number | null;
  seedTimeMs: number | null;
  finalTimeMs: number | null;
  status: 'OK' | 'NT' | 'DQ' | 'NS' | 'SCR' | 'DNF';
  place: number | null;
  round: 'P' | 'F' | 'S';
  splits: ParsedHy3Split[];
}

export interface ParsedHy3Relay {
  teamCode: string;
  relayLetter: string;
  eventNumber: string | null;
  distance: number;
  stroke: number;
  gender: string | null;
  course: CourseType;
  minAge: number | null;
  maxAge: number | null;
  seedTimeMs: number | null;
  finalTimeMs: number | null;
  status: 'OK' | 'NT' | 'DQ' | 'NS' | 'SCR' | 'DNF';
  place: number | null;
  round: 'P' | 'F' | 'S';
  athletes: string[];
}

export interface Hy3Warning {
  line: number;
  code: string;
  message: string;
  raw: string;
}

export interface ParsedHy3Result {
  meet: ParsedHy3Meet;
  teams: ParsedHy3Team[];
  athletes: ParsedHy3Athlete[];
  entries: ParsedHy3Entry[];
  relays: ParsedHy3Relay[];
  warnings: Hy3Warning[];
  checksumErrors: number;
}

const col = (line: string, start: number, end: number): string => line.slice(start - 1, end).trim();

const HY3_STROKES: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };

/**
 * Decodes binary buffers for HY3 and SDIF files using ISO-8859-1.
 * Preserves Spanish accents and the letter 'Ñ' with strictly 1 byte per character,
 * preventing any fixed-width 130-column displacement.
 */
export function decodeHy3Bytes(input: Uint8Array | ArrayBuffer): string {
  return new TextDecoder('iso-8859-1').decode(input);
}

/**
 * Parses full HY3 file text or binary buffer
 */
export function parseHy3File(input: string | Uint8Array | ArrayBuffer): ParsedHy3Result {
  const text = typeof input === 'string' ? input : decodeHy3Bytes(input);
  const result: ParsedHy3Result = {
    meet: {
      name: 'Torneo sin nombre',
      location: null,
      startDate: null,
      endDate: null,
      course: 'LCM',
    },
    teams: [],
    athletes: [],
    entries: [],
    relays: [],
    warnings: [],
    checksumErrors: 0,
  };

  let currentTeamCode: string | null = null;
  let currentAthleteId: string | null = null;
  let currentEntry: ParsedHy3Entry | null = null;
  let currentRelay: ParsedHy3Relay | null = null;

  const lines = text.split(/\r\n|\n|\r/);

  lines.forEach((rawLine, idx) => {
    if (!rawLine.trim()) return;
    const lineNum = idx + 1;

    // Fixed width padding to 130 characters
    const padded = rawLine.padEnd(130, ' ');
    const lineType = padded.slice(0, 2);

    // Validate 130-char length and checksum if line length is standard
    if (padded.length >= 130) {
      const data128 = padded.slice(0, 128);
      const expectedChecksum = padded.slice(128, 130);
      try {
        const computedChecksum = calculateHy3Checksum(data128);
        if (expectedChecksum.trim() && computedChecksum !== expectedChecksum) {
          result.checksumErrors++;
          result.warnings.push({
            line: lineNum,
            code: lineType,
            message: `Checksum inválido: esperado ${expectedChecksum}, calculado ${computedChecksum}`,
            raw: rawLine,
          });
        }
      } catch {
        // Line may not have valid CP1252 characters
      }
    }

    switch (lineType) {
      case 'B1': {
        result.meet.name = col(padded, 3, 47) || result.meet.name;
        result.meet.location = col(padded, 48, 92) || null;
        result.meet.startDate = normalizeIsoDate(col(padded, 93, 100));
        result.meet.endDate = normalizeIsoDate(col(padded, 101, 108));
        break;
      }
      case 'B2': {
        const c = col(padded, 99, 99);
        result.meet.course = normalizeCourse(c, result.meet.course);
        break;
      }
      case 'C1': {
        currentAthleteId = null;
        currentEntry = null;
        currentRelay = null;
        currentTeamCode = col(padded, 3, 7).toUpperCase();
        const teamName = col(padded, 8, 37) || currentTeamCode;
        const shortName = col(padded, 38, 53) || null;
        if (!result.teams.some((t) => t.code === currentTeamCode)) {
          result.teams.push({ code: currentTeamCode, name: teamName, shortName });
        }
        break;
      }
      case 'D1': {
        currentEntry = null;
        currentRelay = null;
        const idInLine = col(padded, 4, 8);
        const gender = (col(padded, 3, 3).toUpperCase() || 'X') as 'M' | 'F' | 'X';
        const lastName = col(padded, 9, 28);
        const firstName = col(padded, 29, 48);
        const middleInitial = col(padded, 49, 49) || null;
        const fedId = col(padded, 70, 83) || null;
        const birthDate = normalizeIsoDate(col(padded, 89, 96));

        currentAthleteId = `${currentTeamCode || 'UN'}:${idInLine || lastName}`;

        result.athletes.push({
          id: currentAthleteId,
          firstName,
          lastName,
          middleInitial,
          gender,
          birthDate,
          federationId: fedId,
          teamCode: currentTeamCode || 'UN',
        });
        break;
      }
      case 'E1': {
        if (!currentAthleteId) {
          result.warnings.push({
            line: lineNum,
            code: 'E1',
            message: 'Registro de prueba E1 sin atleta previo D1.',
            raw: rawLine,
          });
          break;
        }

        const distance = Number(col(padded, 16, 21));
        const strokeCode = col(padded, 22, 22);
        const stroke = HY3_STROKES[strokeCode] || 1;
        const minAge = Number(col(padded, 23, 25)) || null;
        const maxAge = Number(col(padded, 26, 28)) || null;
        const eventNum = col(padded, 39, 42) || null;
        const rawSeed = col(padded, 43, 50);
        const seedNorm = normalizeSwimTimeToMs(rawSeed);
        const course = normalizeCourse(col(padded, 51, 51), result.meet.course);

        currentEntry = {
          athleteId: currentAthleteId,
          eventNumber: eventNum,
          distance,
          stroke,
          course,
          gender: col(padded, 14, 14) || null,
          minAge,
          maxAge,
          seedTimeMs: seedNorm.timeMs,
          finalTimeMs: null,
          status: seedNorm.status === 'OK' ? 'OK' : 'NT',
          place: null,
          round: 'F',
          splits: [],
        };

        result.entries.push(currentEntry);
        break;
      }
      case 'E2': {
        if (!currentEntry) break;
        const round = (col(padded, 3, 3) || 'F') as 'P' | 'F' | 'S';
        const rawTime = col(padded, 4, 11);
        const statusLetter = col(padded, 13, 15).toUpperCase();
        const normFinal = normalizeSwimTimeToMs(rawTime);
        const place = Number(col(padded, 30, 33)) || null;

        currentEntry.round = round;
        currentEntry.finalTimeMs = normFinal.timeMs;
        currentEntry.place = place;

        if (statusLetter.includes('DQ') || normFinal.status === 'DQ') {
          currentEntry.status = 'DQ';
          currentEntry.finalTimeMs = null;
        } else if (statusLetter.includes('NS') || normFinal.status === 'NS') {
          currentEntry.status = 'NS';
        } else if (normFinal.timeMs != null) {
          currentEntry.status = 'OK';
        }
        break;
      }
      case 'F1': {
        // Relay entry
        currentEntry = null;
        const teamCode = col(padded, 3, 7).toUpperCase() || currentTeamCode || 'UN';
        const relayLetter = col(padded, 8, 8) || 'A';
        const gender = col(padded, 9, 9).toUpperCase();
        const distance = Number(col(padded, 10, 15)) || 400;
        const strokeCode = col(padded, 16, 16);
        const stroke = strokeCode === 'E' ? 5 : 1;
        const minAge = Number(col(padded, 17, 19)) || null;
        const maxAge = Number(col(padded, 20, 22)) || null;
        const eventNum = col(padded, 25, 28) || null;
        const rawSeed = col(padded, 29, 36);
        const seedNorm = normalizeSwimTimeToMs(rawSeed);
        const course = normalizeCourse(col(padded, 37, 37), result.meet.course);

        currentRelay = {
          teamCode,
          relayLetter,
          eventNumber: eventNum,
          distance,
          stroke,
          gender: gender || null,
          course,
          minAge,
          maxAge,
          seedTimeMs: seedNorm.timeMs,
          finalTimeMs: null,
          status: seedNorm.status === 'OK' ? 'OK' : 'NT',
          place: null,
          round: 'F',
          athletes: [],
        };
        result.relays.push(currentRelay);
        break;
      }
      case 'F2': {
        if (!currentRelay) break;
        const round = (col(padded, 3, 3) || 'F') as 'P' | 'F' | 'S';
        const rawFinal = col(padded, 4, 11);
        const statusLetter = col(padded, 13, 15).toUpperCase();
        const normFinal = normalizeSwimTimeToMs(rawFinal);
        const place = Number(col(padded, 30, 33)) || null;

        currentRelay.round = round;
        currentRelay.finalTimeMs = normFinal.timeMs;
        currentRelay.place = place;
        if (statusLetter.includes('DQ') || normFinal.status === 'DQ') {
          currentRelay.status = 'DQ';
        } else if (normFinal.timeMs != null) {
          currentRelay.status = 'OK';
        }
        break;
      }
      case 'G1': {
        if (!currentEntry) break;
        const interval = currentEntry.course === 'SCM' || currentEntry.course === 'SCY' ? 25 : 50;
        for (let i = 0; i < 10; i++) {
          const start = 3 + i * 11;
          const chunk = padded.slice(start - 1, start + 10);
          const num = Number(chunk.slice(1, 3));
          const normSplit = normalizeSwimTimeToMs(chunk.slice(3, 11));
          if (num > 0 && normSplit.timeMs != null) {
            const splitDist = num * interval;
            if (splitDist <= currentEntry.distance && !currentEntry.splits.some((s) => s.distance === splitDist)) {
              currentEntry.splits.push({ distance: splitDist, cumulativeMs: normSplit.timeMs });
            }
          }
        }
        break;
      }
    }
  });

  return result;
}
