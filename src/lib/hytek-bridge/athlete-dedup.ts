/**
 * Athlete Deduplication & Fuzzy Matching Engine
 * Employs normalized Levenshtein distance and token-based similarity (> 85%)
 * to identify duplicate swimmers across Hy-Tek, SDIF, and CSV imports.
 */

import { calculateAgeAtDate, normalizeIsoDate } from './data-normalizer';

export interface AthleteCandidate {
  id?: string;
  first_name: string;
  last_name: string;
  birth_date?: string | null;
  gender?: string | null;
  federation_id?: string | null;
  team_code?: string | null;
}

export interface DuplicateDetectionResult {
  hasDuplicate: boolean;
  matchScore: number; // 0 to 100%
  candidate: AthleteCandidate | null;
  reasons: string[];
  conflict: string | null;
  suggestedAction: 'MERGE' | 'CREATE_NEW' | 'REVIEW';
}

/**
 * Standard Levenshtein Distance
 */
export function levenshteinDistance(a: string, b: string): number {
  const d = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = d[0]!;
    d[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = d[j]!;
      d[j] = Math.min(d[j]! + 1, d[j - 1]! + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return d[b.length]!;
}

/**
 * Normalizes name tokens by stripping diacritics, lowercase and non-alphanumeric.
 */
export function tokenizeName(name: string): string[] {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0);
}

/**
 * Token-based string similarity (0 to 1) accounting for swapped names (e.g. "Perez Juan" vs "Juan Perez").
 */
export function stringSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (!a || !b) return 0.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return 1 - dist / maxLen;
}

/**
 * Comprehensive name similarity score (0 to 100)
 */
export function computeNameScore(
  first1: string,
  last1: string,
  first2: string,
  last2: string
): number {
  const full1 = `${first1} ${last1}`.trim();
  const full2 = `${first2} ${last2}`.trim();
  const directScore = stringSimilarity(
    full1.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase(),
    full2.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  );

  const tokens1 = tokenizeName(full1);
  const tokens2 = tokenizeName(full2);
  if (tokens1.length === 0 || tokens2.length === 0) return 0;

  // Best token matching
  let tokenMatchSum = 0;
  for (const t1 of tokens1) {
    let best = 0;
    for (const t2 of tokens2) {
      const s = stringSimilarity(t1, t2);
      if (s > best) best = s;
    }
    tokenMatchSum += best;
  }
  const tokenScore = tokenMatchSum / tokens1.length;

  return Math.round(Math.max(directScore, tokenScore) * 100);
}

/**
 * Clean alphanumeric ID comparison
 */
function cleanId(val: string | null | undefined): string {
  return (val || '').replace(/[^0-9A-Za-z]/g, '').toUpperCase();
}

/**
 * Evaluates duplicate match between an incoming athlete and an existing athlete profile.
 */
export function evaluateAthleteMatch(
  incoming: AthleteCandidate,
  existing: AthleteCandidate
): DuplicateDetectionResult {
  const reasons: string[] = [];
  let conflict: string | null = null;

  // 1. Check Federation ID / ID Card (Cédula)
  const idIn = cleanId(incoming.federation_id);
  const idEx = cleanId(existing.federation_id);
  const exactIdMatch = idIn && idEx && idIn === idEx;

  if (idIn && idEx && idIn !== idEx) {
    conflict = 'ID federativo o cédula distinta';
  }

  // 2. Gender check
  const gIn = (incoming.gender || '').toUpperCase();
  const gEx = (existing.gender || '').toUpperCase();
  if (gIn && gEx && gIn !== gEx && gIn !== 'X' && gEx !== 'X') {
    conflict = 'Sexo incompatible';
  }

  // 3. Birth date check
  const bIn = normalizeIsoDate(incoming.birth_date);
  const bEx = normalizeIsoDate(existing.birth_date);
  const exactBirthMatch = bIn && bEx && bIn === bEx;
  const birthYearIn = bIn ? bIn.slice(0, 4) : null;
  const birthYearEx = bEx ? bEx.slice(0, 4) : null;
  const sameBirthYear = birthYearIn && birthYearEx && birthYearIn === birthYearEx;

  if (birthYearIn && birthYearEx && birthYearIn !== birthYearEx) {
    const diff = Math.abs(Number(birthYearIn) - Number(birthYearEx));
    if (diff > 1) {
      conflict = `Año de nacimiento discordante (${birthYearIn} vs ${birthYearEx})`;
    }
  }

  // 4. Name similarity score
  const nameScore = computeNameScore(
    incoming.first_name,
    incoming.last_name,
    existing.first_name,
    existing.last_name
  );

  // Compute final weighted confidence score
  let totalScore = nameScore * 0.7; // Base weight 70%

  if (exactIdMatch) {
    totalScore += 30;
    reasons.push('Coincidencia exacta de ID federativo');
  }
  if (exactBirthMatch) {
    totalScore += 20;
    reasons.push('Fecha de nacimiento idéntica');
  } else if (sameBirthYear) {
    totalScore += 10;
    reasons.push('Mismo año de nacimiento');
  }
  if (gIn && gEx && gIn === gEx) {
    totalScore += 5;
  }

  const finalScore = Math.min(100, Math.round(totalScore));

  if (nameScore >= 85) {
    reasons.push(`Similitud de nombre alta (${nameScore}%)`);
  } else if (nameScore >= 70) {
    reasons.push(`Similitud de nombre moderada (${nameScore}%)`);
  }

  const isDuplicate = !conflict && (finalScore >= 85 || Boolean(exactIdMatch));

  let suggestedAction: 'MERGE' | 'CREATE_NEW' | 'REVIEW' = 'CREATE_NEW';
  if (conflict) {
    suggestedAction = 'CREATE_NEW';
  } else if (finalScore >= 88 || exactIdMatch) {
    suggestedAction = 'MERGE';
  } else if (finalScore >= 75) {
    suggestedAction = 'REVIEW';
  }

  return {
    hasDuplicate: isDuplicate,
    matchScore: finalScore,
    candidate: isDuplicate || finalScore >= 75 ? existing : null,
    reasons,
    conflict,
    suggestedAction,
  };
}

/**
 * Scans an incoming athlete against a pool of existing athletes, returning the top match.
 */
export function findBestAthleteMatch(
  incoming: AthleteCandidate,
  existingList: AthleteCandidate[]
): DuplicateDetectionResult {
  let topResult: DuplicateDetectionResult = {
    hasDuplicate: false,
    matchScore: 0,
    candidate: null,
    reasons: [],
    conflict: null,
    suggestedAction: 'CREATE_NEW',
  };

  for (const existing of existingList) {
    const res = evaluateAthleteMatch(incoming, existing);
    if (res.matchScore > topResult.matchScore) {
      topResult = res;
    }
  }

  return topResult;
}
