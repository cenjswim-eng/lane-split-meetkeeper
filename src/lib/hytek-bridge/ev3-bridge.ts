/**
 * EV3 File Bridge (Parser & Serializer)
 * Handles Hy-Tek Meet Manager .ev3 event setup files.
 * Manages event numbers, sessions, age brackets, strokes, distances and qualifying times.
 */

import { formatMsToTime, normalizeIsoDate, CourseType } from './data-normalizer';

export interface Ev3EventSetup {
  eventNumber: string;
  distance: number;
  stroke: number; // 1=Free, 2=Back, 3=Breast, 4=Fly, 5=IM, 6=Free Relay, 7=Medley Relay
  gender: 'M' | 'F' | 'X';
  isRelay: boolean;
  minAge: number | null;
  maxAge: number | null;
  course: CourseType;
  qualifyingTimesMs: Partial<Record<CourseType, number | null>>;
  sessionId?: number | null;
  entryFee?: number | null;
}

export interface Ev3MeetSetup {
  name: string;
  location: string | null;
  startDate: string;
  endDate: string;
  course: CourseType;
  events: Ev3EventSetup[];
}

const STROKE_MAP_EV3: Record<number, string> = {
  1: 'Freestyle',
  2: 'Backstroke',
  3: 'Breaststroke',
  4: 'Butterfly',
  5: 'Medley',
  6: 'Freestyle',
  7: 'Medley',
};

/**
 * Serializes meet setup into official .ev3 format
 */
export function serializeEv3Setup(meet: Ev3MeetSetup): string {
  const lines: string[] = [];

  const startFormatted = meet.startDate.replace(/-/g, '/');
  const endFormatted = meet.endDate.replace(/-/g, '/');

  // Header line
  lines.push(
    [
      meet.name.slice(0, 45),
      meet.course === 'LCM' ? 'L' : meet.course === 'SCY' ? 'Y' : 'S',
      startFormatted,
      endFormatted,
      '0',
      '0',
      '0',
      '0',
      '1',
      meet.location ? meet.location.slice(0, 30) : '',
      '',
      '',
      '',
    ].join(';') + '*>'
  );

  // Event lines
  meet.events.forEach((ev, idx) => {
    const strokeName = STROKE_MAP_EV3[ev.stroke] ?? 'Freestyle';
    const typeCode = ev.isRelay ? 'R' : 'I';
    const minAgeStr = ev.minAge != null ? String(ev.minAge) : '0';
    const maxAgeStr = ev.maxAge != null && ev.maxAge < 99 ? String(ev.maxAge) : '99';
    const feeStr = ev.entryFee != null ? ev.entryFee.toFixed(2) : '0.00';

    const lcmCut = ev.qualifyingTimesMs.LCM ? formatMsToTime(ev.qualifyingTimesMs.LCM) : '';
    const scmCut = ev.qualifyingTimesMs.SCM ? formatMsToTime(ev.qualifyingTimesMs.SCM) : '';
    const scyCut = ev.qualifyingTimesMs.SCY ? formatMsToTime(ev.qualifyingTimesMs.SCY) : '';

    // Standard EV3 field line
    const fields = [
      String(idx + 1),
      ev.eventNumber,
      ev.gender,
      strokeName,
      typeCode,
      String(ev.distance),
      minAgeStr,
      maxAgeStr,
      String(ev.sessionId ?? 1),
      feeStr,
      '0',
      '0',
      '0',
      '0',
      '0',
      '',
      lcmCut,
      '',
      scmCut,
      '',
      scyCut,
    ];

    lines.push(fields.join(';') + '*>');
  });

  return lines.join('\r\n') + '\r\n';
}
