/**
 * Pre-Flight Validator for Hy-Tek and SDIF Exports
 * Verifies all meet entries, athlete ages against Age-Up Date,
 * session/meet entry limits, and relay team assignments before export.
 */

import { calculateAgeAtDate, normalizeIsoDate } from './data-normalizer';

export interface PreFlightIssue {
  severity: 'BLOCKER' | 'WARNING';
  category: 'AGE_BRACKET' | 'EVENT_LIMIT' | 'SEED_TIME' | 'IDENTITY' | 'RELAY_CONFLICT';
  athleteName: string;
  athleteId?: string;
  eventNumber?: string;
  message: string;
}

export interface PreFlightAthlete {
  id: string;
  firstName: string;
  lastName: string;
  gender: 'M' | 'F' | 'X';
  birthDate: string | null;
  federationId?: string | null;
  teamCode: string;
}

export interface PreFlightEntry {
  athleteId: string;
  eventNumber: string;
  distance: number;
  stroke: number;
  seedTimeMs: number | null;
  minAge?: number | null;
  maxAge?: number | null;
  gender?: string | null;
  session?: number | null;
}

export interface PreFlightRelay {
  id: string;
  teamCode: string;
  relayLetter: string;
  eventNumber: string;
  gender: 'M' | 'F' | 'X';
  minAge?: number | null;
  maxAge?: number | null;
  swimmerIds: string[];
}

export interface PreFlightRules {
  maxIndividualEventsPerAthlete?: number; // e.g. 5
  maxEventsPerSession?: number; // e.g. 3
  ageUpDate: string; // ISO date used to compute competitive age
  allowNoTime?: boolean; // Default true (warning), if false (blocker)
}

export interface PreFlightValidationReport {
  isValid: boolean; // True if blockers.length === 0
  blockers: PreFlightIssue[];
  warnings: PreFlightIssue[];
  stats: {
    totalAthletes: number;
    totalEntries: number;
    totalRelays: number;
    unseededCount: number;
  };
}

/**
 * Runs full pre-flight inspection on export data
 */
export function runPreFlightValidation(
  athletes: PreFlightAthlete[],
  entries: PreFlightEntry[],
  relays: PreFlightRelay[],
  rules: PreFlightRules
): PreFlightValidationReport {
  const blockers: PreFlightIssue[] = [];
  const warnings: PreFlightIssue[] = [];
  let unseededCount = 0;

  const athleteMap = new Map(athletes.map((a) => [a.id, a]));
  const entriesByAthlete = new Map<string, PreFlightEntry[]>();

  for (const entry of entries) {
    const list = entriesByAthlete.get(entry.athleteId) ?? [];
    list.push(entry);
    entriesByAthlete.set(entry.athleteId, list);
  }

  // 1. Validate Athletes Identity & Age
  for (const athlete of athletes) {
    const name = `${athlete.lastName}, ${athlete.firstName}`.trim();

    if (!athlete.firstName?.trim() || !athlete.lastName?.trim()) {
      blockers.push({
        severity: 'BLOCKER',
        category: 'IDENTITY',
        athleteName: name || 'Sin nombre',
        athleteId: athlete.id,
        message: 'Nombre o apellido incompleto.',
      });
    }

    if (!athlete.birthDate || !normalizeIsoDate(athlete.birthDate)) {
      blockers.push({
        severity: 'BLOCKER',
        category: 'IDENTITY',
        athleteName: name,
        athleteId: athlete.id,
        message: 'Fecha de nacimiento ausente o inválida; no se puede calcular la categoría.',
      });
    }

    if (!['M', 'F', 'X'].includes(athlete.gender)) {
      blockers.push({
        severity: 'BLOCKER',
        category: 'IDENTITY',
        athleteName: name,
        athleteId: athlete.id,
        message: 'Sexo no definido (debe ser M o F para Hy-Tek).',
      });
    }

    if (!athlete.federationId?.trim()) {
      warnings.push({
        severity: 'WARNING',
        category: 'IDENTITY',
        athleteName: name,
        athleteId: athlete.id,
        message: 'Atleta sin ID federativo o cédula registrada.',
      });
    }

    // 2. Validate Individual Entries for this athlete
    const athleteEntries = entriesByAthlete.get(athlete.id) ?? [];
    const age = calculateAgeAtDate(athlete.birthDate, rules.ageUpDate);

    // Max events check
    if (rules.maxIndividualEventsPerAthlete && athleteEntries.length > rules.maxIndividualEventsPerAthlete) {
      blockers.push({
        severity: 'BLOCKER',
        category: 'EVENT_LIMIT',
        athleteName: name,
        athleteId: athlete.id,
        message: `Supera el límite de pruebas individuales permitidas (${athleteEntries.length} de ${rules.maxIndividualEventsPerAthlete}).`,
      });
    }

    // Session limits
    if (rules.maxEventsPerSession) {
      const bySession = new Map<number, number>();
      for (const e of athleteEntries) {
        if (e.session != null) {
          bySession.set(e.session, (bySession.get(e.session) ?? 0) + 1);
        }
      }
      for (const [sess, count] of bySession) {
        if (count > rules.maxEventsPerSession) {
          blockers.push({
            severity: 'BLOCKER',
            category: 'EVENT_LIMIT',
            athleteName: name,
            athleteId: athlete.id,
            message: `Supera el límite de pruebas en la sesión ${sess} (${count} de ${rules.maxEventsPerSession}).`,
          });
        }
      }
    }

    // Age bracket and seed time
    for (const entry of athleteEntries) {
      // Age bracket check
      if (age != null) {
        if (entry.minAge != null && age < entry.minAge) {
          blockers.push({
            severity: 'BLOCKER',
            category: 'AGE_BRACKET',
            athleteName: name,
            athleteId: athlete.id,
            eventNumber: entry.eventNumber,
            message: `Edad menor al rango de la prueba ${entry.eventNumber} (Edad: ${age}, Mín: ${entry.minAge}).`,
          });
        }
        if (entry.maxAge != null && entry.maxAge < 99 && age > entry.maxAge) {
          blockers.push({
            severity: 'BLOCKER',
            category: 'AGE_BRACKET',
            athleteName: name,
            athleteId: athlete.id,
            eventNumber: entry.eventNumber,
            message: `Edad mayor al rango de la prueba ${entry.eventNumber} (Edad: ${age}, Máx: ${entry.maxAge}).`,
          });
        }
      }

      // Gender check
      if (entry.gender && entry.gender !== 'X' && entry.gender !== athlete.gender) {
        blockers.push({
          severity: 'BLOCKER',
          category: 'IDENTITY',
          athleteName: name,
          athleteId: athlete.id,
          eventNumber: entry.eventNumber,
          message: `El sexo del atleta no coincide con la prueba ${entry.eventNumber} (${athlete.gender} vs ${entry.gender}).`,
        });
      }

      // Seed time
      if (entry.seedTimeMs == null || entry.seedTimeMs <= 0) {
        unseededCount++;
        if (rules.allowNoTime === false) {
          blockers.push({
            severity: 'BLOCKER',
            category: 'SEED_TIME',
            athleteName: name,
            athleteId: athlete.id,
            eventNumber: entry.eventNumber,
            message: `Prueba ${entry.eventNumber} sin marca de inscripción (NT no permitido en este torneo).`,
          });
        } else {
          warnings.push({
            severity: 'WARNING',
            category: 'SEED_TIME',
            athleteName: name,
            athleteId: athlete.id,
            eventNumber: entry.eventNumber,
            message: `Prueba ${entry.eventNumber} inscrita con Sin Tiempo (NT). Se sembrará en primeras series.`,
          });
        }
      }
    }
  }

  // 3. Validate Relays
  for (const relay of relays) {
    if (relay.swimmerIds.length !== 4) {
      warnings.push({
        severity: 'WARNING',
        category: 'RELAY_CONFLICT',
        athleteName: `Relevo ${relay.teamCode} ${relay.relayLetter}`,
        eventNumber: relay.eventNumber,
        message: `El relevo cuenta con ${relay.swimmerIds.length} integrantes (se requieren 4 para competir).`,
      });
    }

    // Check duplicate swimmer in same relay
    const uniqueSwimmers = new Set(relay.swimmerIds);
    if (uniqueSwimmers.size < relay.swimmerIds.length) {
      blockers.push({
        severity: 'BLOCKER',
        category: 'RELAY_CONFLICT',
        athleteName: `Relevo ${relay.teamCode} ${relay.relayLetter}`,
        eventNumber: relay.eventNumber,
        message: 'Hay nadadores repetidos en la misma cuarteta de relevo.',
      });
    }

    // Gender check for relay swimmers
    for (const swimmerId of relay.swimmerIds) {
      const sw = athleteMap.get(swimmerId);
      if (sw && relay.gender !== 'X' && sw.gender !== relay.gender) {
        blockers.push({
          severity: 'BLOCKER',
          category: 'RELAY_CONFLICT',
          athleteName: `${sw.lastName}, ${sw.firstName}`,
          athleteId: sw.id,
          eventNumber: relay.eventNumber,
          message: `Nadador asignado a un relevo que no corresponde con su sexo (${sw.gender} en relevo ${relay.gender}).`,
        });
      }
    }
  }

  return {
    isValid: blockers.length === 0,
    blockers,
    warnings,
    stats: {
      totalAthletes: athletes.length,
      totalEntries: entries.length,
      totalRelays: relays.length,
      unseededCount,
    },
  };
}
