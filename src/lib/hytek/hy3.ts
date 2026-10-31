import { parseTime } from "../swim";
import { col, courseFromCode, mdyToIso, type ParsedFile, type ParsedResult } from "./types";

const HY3_STROKE: Record<string, number> = { A: 1, B: 2, C: 3, D: 4, E: 5 };

/**
 * Parser for Hy-Tek Meet Manager / Team Manager HY3 files (results and entries).
 * Fixed-width records; first two chars are the record type.
 */
export function parseHy3(text: string): ParsedFile {
  const out: ParsedFile = {
    format: "HY3",
    meet: { name: "Competencia sin nombre", location: null, startDate: null, endDate: null, course: "LCM" },
    teams: [],
    athletes: [],
    results: [],
    warnings: [],
  };
  let teamCode: string | null = null;
  let athleteKey: string | null = null;
  let current: ParsedResult | null = null;
  const athleteGender = new Map<string, string>();

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.padEnd(132, " ");
    const type = line.slice(0, 2);
    switch (type) {
      case "B1":
        out.meet.name = col(line, 3, 47) || out.meet.name;
        out.meet.location = col(line, 48, 92) || null;
        out.meet.startDate = mdyToIso(col(line, 93, 100));
        out.meet.endDate = mdyToIso(col(line, 101, 108));
        break;
      case "B2": {
        const c = col(line, 99, 99);
        if (c) out.meet.course = courseFromCode(c, out.meet.course);
        break;
      }
      case "C1":
        teamCode = col(line, 3, 7);
        out.teams.push({ code: teamCode, name: col(line, 8, 37) || teamCode });
        break;
      case "D1": {
        const id = col(line, 4, 8);
        const gender = col(line, 3, 3).toUpperCase() || null;
        athleteKey = `HY3:${teamCode ?? ""}:${id}`;
        athleteGender.set(athleteKey, gender ?? "");
        out.athletes.push({
          key: athleteKey,
          tmId: athleteKey,
          federationId: col(line, 70, 83) || null,
          lastName: col(line, 9, 28),
          firstName: col(line, 29, 48),
          birthDate: mdyToIso(col(line, 89, 96)),
          gender,
          teamCode,
        });
        break;
      }
      case "E1": {
        if (!athleteKey) break;
        const stroke = HY3_STROKE[col(line, 22, 22)] ?? 1;
        const minAge = Number(col(line, 23, 25)) || null;
        const maxAge = Number(col(line, 26, 28)) || null;
        current = {
          athleteKey,
          eventNumber: col(line, 39, 42) || null,
          distance: Number(col(line, 16, 21)) || 0,
          stroke,
          gender: col(line, 15, 15) || athleteGender.get(athleteKey) || null,
          minAge: minAge && minAge < 100 ? minAge : null,
          maxAge: maxAge && maxAge < 100 ? maxAge : null,
          seedMs: parseTime(col(line, 43, 50)),
          finalMs: null,
          course: courseFromCode(col(line, 51, 51), out.meet.course),
          place: null,
          isDq: false,
          round: "F",
          splits: [],
        };
        // Entry-only files: keep the seed as a result row
        out.results.push(current);
        break;
      }
      case "E2": {
        if (!current) break;
        const round = col(line, 3, 3) as "P" | "F" | "S";
        const timeRaw = col(line, 4, 11);
        const code = col(line, 13, 15).toUpperCase();
        let target = current;
        if (current.finalMs != null && round && round !== current.round) {
          target = { ...current, splits: [], finalMs: null, place: null, isDq: false };
          out.results.push(target);
        }
        target.round = round === "P" || round === "S" ? round : "F";
        target.finalMs = parseTime(timeRaw);
        target.course = courseFromCode(col(line, 12, 12), target.course ?? out.meet.course);
        target.isDq = code === "Q" || code.includes("DQ") || /DQ/i.test(timeRaw);
        const place = Number(col(line, 31, 33));
        target.place = place > 0 ? place : null;
        current = target;
        break;
      }
      case "G1": {
        if (!current) break;
        const interval = current.course === "SCM" || current.course === "SCY" ? 25 : 50;
        for (let i = 0; i < 10; i++) {
          const start = 3 + i * 11;
          const chunk = line.slice(start - 1, start + 10);
          const num = Number(chunk.slice(1, 3));
          const ms = parseTime(chunk.slice(3, 11));
          if (num > 0 && ms) current.splits.push({ distance: num * interval, cumulative_ms: ms });
        }
        break;
      }
    }
  }
  // Keep only 50 m multiples for SCM to match standard lap reporting
  for (const r of out.results) {
    r.splits.sort((a, b) => a.distance - b.distance);
    if (r.splits.length && r.course !== "LCM" && r.splits.length > r.distance / 50) {
      r.splits = r.splits.filter((s) => s.distance % 50 === 0);
    }
  }
  return out;
}
