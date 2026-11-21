/**
 * HY3 File Writer / Serializer
 * Generates exact 130-character fixed-width records terminated in standard 2-digit checksums.
 * Fully compatible with Hy-Tek Team Manager & Meet Manager.
 */

import { encodeWindows1252, calculateHy3Checksum } from '@/lib/swim-io/exporters';
import { formatMsToTime, normalizeIsoDate } from './data-normalizer';

export interface Hy3MeetInfo {
  name: string;
  location?: string | null;
  startDate: string; // ISO
  endDate?: string | null;
  course: 'LCM' | 'SCM' | 'SCY';
}

export interface Hy3TeamInfo {
  code: string;
  name: string;
  shortName?: string | null;
}

export interface Hy3Athlete {
  id: string | number;
  firstName: string;
  lastName: string;
  middleInitial?: string | null;
  gender: 'M' | 'F' | 'X';
  birthDate: string; // ISO
  federationId?: string | null;
  teamCode: string;
}

export interface Hy3IndividualEntry {
  athleteId: string | number;
  eventNumber: string;
  distance: number;
  stroke: number; // 1=Free, 2=Back, 3=Breast, 4=Fly, 5=IM
  course: 'LCM' | 'SCM' | 'SCY';
  minAge?: number | null;
  maxAge?: number | null;
  gender?: string | null;
  seedTimeMs?: number | null;
  finalTimeMs?: number | null;
  status?: 'OK' | 'DQ' | 'NS' | 'SCR' | 'DNF' | 'NT';
  place?: number | null;
  round?: 'P' | 'F' | 'S';
}

export interface Hy3RelayEntry {
  teamCode: string;
  relayLetter: string; // 'A', 'B', etc.
  eventNumber: string;
  distance: number;
  stroke: number; // 1=Free, 5=Medley
  gender: 'M' | 'F' | 'X';
  course: 'LCM' | 'SCM' | 'SCY';
  minAge?: number | null;
  maxAge?: number | null;
  seedTimeMs?: number | null;
  finalTimeMs?: number | null;
  status?: 'OK' | 'DQ' | 'NS' | 'SCR' | 'DNF' | 'NT';
  place?: number | null;
  round?: 'P' | 'F' | 'S';
  athletes?: (string | number)[]; // Up to 4 athlete ids
}

const ascii = (s: string | null | undefined): string =>
  (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7e]/g, ' ');

const dateToMdy = (iso: string | null | undefined): string => {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return '';
  return `${iso.slice(5, 7)}${iso.slice(8, 10)}${iso.slice(0, 4)}`;
};

const STROKE_CODES: Record<number, string> = { 1: 'A', 2: 'B', 3: 'C', 4: 'D', 5: 'E' };
const COURSE_CODES: Record<string, string> = { LCM: 'L', SCM: 'S', SCY: 'Y' };

/**
 * Creates a single 130-character HY3 line (128 data chars + 2 checksum chars).
 */
export function formatHy3Record(type: string, fields: [number, number, string][]): string {
  const line = Array<string>(128).fill(' ');
  line[0] = type[0] ?? ' ';
  line[1] = type[1] ?? ' ';

  for (const [start, width, raw] of fields) {
    const val = ascii(raw);
    const truncated = val.slice(0, width);
    const padded = truncated.padEnd(width);
    for (let i = 0; i < width; i++) {
      line[start - 1 + i] = padded[i] ?? ' ';
    }
  }

  const data128 = line.join('');
  const checksum = calculateHy3Checksum(data128);
  return data128 + checksum;
}

/**
 * Serializes complete meet entries and/or results to HY3 format.
 */
export function serializeHy3File(options: {
  meet: Hy3MeetInfo;
  teams: Hy3TeamInfo[];
  athletes: Hy3Athlete[];
  entries: Hy3IndividualEntry[];
  relays?: Hy3RelayEntry[];
  softwareName?: string;
  fileDate?: Date;
}): string {
  const lines: string[] = [];
  const now = options.fileDate ?? new Date();
  const fileDateIso = now.toISOString().slice(0, 10);
  const courseCode = COURSE_CODES[options.meet.course] ?? 'L';

  // A1: Header
  lines.push(
    formatHy3Record('A1', [
      [3, 2, '01'],
      [5, 30, options.softwareName ?? 'Swim Lane Coach'],
      [35, 10, '2.0'],
      [45, 8, dateToMdy(fileDateIso)],
    ])
  );

  // B1: Meet
  lines.push(
    formatHy3Record('B1', [
      [3, 45, options.meet.name.slice(0, 45)],
      [48, 45, (options.meet.location ?? '').slice(0, 45)],
      [93, 8, dateToMdy(options.meet.startDate)],
      [101, 8, dateToMdy(options.meet.endDate ?? options.meet.startDate)],
    ])
  );

  // B2: Meet course
  lines.push(formatHy3Record('B2', [[99, 1, courseCode]]));

  // Teams & Athletes
  for (const team of options.teams) {
    const teamCode = team.code.trim().toUpperCase().slice(0, 5);
    lines.push(
      formatHy3Record('C1', [
        [3, 5, teamCode],
        [8, 30, team.name.slice(0, 30)],
        [38, 16, (team.shortName ?? team.name).slice(0, 16)],
      ])
    );

    const teamAthletes = options.athletes.filter((a) => a.teamCode === team.code);
    for (const [idx, athlete] of teamAthletes.entries()) {
      const athleteIdStr = String(idx + 1).padStart(5, '0');
      lines.push(
        formatHy3Record('D1', [
          [3, 1, athlete.gender],
          [4, 5, athleteIdStr],
          [9, 20, athlete.lastName.slice(0, 20)],
          [29, 20, athlete.firstName.slice(0, 20)],
          [49, 1, (athlete.middleInitial ?? '').slice(0, 1)],
          [70, 14, (athlete.federationId ?? '').slice(0, 14)],
          [89, 8, dateToMdy(athlete.birthDate)],
        ])
      );

      // Individual entries for this athlete
      const athleteEntries = options.entries.filter((e) => String(e.athleteId) === String(athlete.id));
      for (const entry of athleteEntries) {
        const strokeCode = STROKE_CODES[entry.stroke] ?? 'A';
        const entryCourseCode = COURSE_CODES[entry.course] ?? courseCode;
        const seedFormatted = entry.seedTimeMs != null ? formatMsToTime(entry.seedTimeMs).padStart(8, ' ') : '      NT';

        lines.push(
          formatHy3Record('E1', [
            [4, 5, athleteIdStr],
            [14, 1, entry.gender ?? athlete.gender],
            [16, 6, String(entry.distance).padStart(6, ' ')],
            [22, 1, strokeCode],
            [23, 3, String(entry.minAge ?? 0).padStart(3, ' ')],
            [26, 3, String(entry.maxAge ?? 0).padStart(3, ' ')],
            [39, 4, (entry.eventNumber || '').padStart(4, ' ')],
            [43, 8, seedFormatted],
            [51, 1, entryCourseCode],
          ])
        );

        // If there is a final result, append E2
        if (entry.finalTimeMs != null || entry.status === 'DQ' || entry.status === 'NS') {
          const finalFormatted = entry.finalTimeMs != null ? formatMsToTime(entry.finalTimeMs).padStart(8, ' ') : '      NT';
          lines.push(
            formatHy3Record('E2', [
              [3, 1, entry.round ?? 'F'],
              [4, 8, finalFormatted],
              [12, 1, entryCourseCode],
              [13, 3, entry.status === 'DQ' ? 'DQ ' : entry.status === 'NS' ? 'NS ' : '   '],
              [30, 4, entry.place ? String(entry.place).padStart(4, ' ') : '    '],
            ])
          );
        }
      }
    }

    // Team Relays (F1, F2, F3)
    const teamRelays = (options.relays ?? []).filter((r) => r.teamCode === team.code);
    for (const relay of teamRelays) {
      const relayStroke = relay.stroke === 5 ? 'E' : 'A';
      const relayCourseCode = COURSE_CODES[relay.course] ?? courseCode;
      const seedFormatted = relay.seedTimeMs != null ? formatMsToTime(relay.seedTimeMs).padStart(8, ' ') : '      NT';

      lines.push(
        formatHy3Record('F1', [
          [3, 5, teamCode],
          [8, 1, relay.relayLetter || 'A'],
          [9, 1, relay.gender],
          [10, 6, String(relay.distance).padStart(6, ' ')],
          [16, 1, relayStroke],
          [17, 3, String(relay.minAge ?? 0).padStart(3, ' ')],
          [20, 3, String(relay.maxAge ?? 0).padStart(3, ' ')],
          [25, 4, (relay.eventNumber || '').padStart(4, ' ')],
          [29, 8, seedFormatted],
          [37, 1, relayCourseCode],
        ])
      );

      if (relay.finalTimeMs != null || relay.status === 'DQ') {
        const finalFormatted = relay.finalTimeMs != null ? formatMsToTime(relay.finalTimeMs).padStart(8, ' ') : '      NT';
        lines.push(
          formatHy3Record('F2', [
            [3, 1, relay.round ?? 'F'],
            [4, 8, finalFormatted],
            [12, 1, relayCourseCode],
            [13, 3, relay.status === 'DQ' ? 'DQ ' : '   '],
            [30, 4, relay.place ? String(relay.place).padStart(4, ' ') : '    '],
          ])
        );
      }
    }
  }

  return lines.join('\r\n') + '\r\n';
}

/**
 * Creates a downloadable binary Blob for the HY3 file.
 */
export function createHy3Blob(content: string): Blob {
  return new Blob([encodeWindows1252(content)], { type: 'application/octet-stream' });
}
