import type { ParsedAthlete, ParsedFile, ParsedResult as LegacyResult } from '@/lib/hytek/types';
export type { ParseWarning } from '@/lib/hytek/types';
export type ParsedSplit = { distance: number; cumulativeMs: number; lapMs: number };
export type ParsedResult = LegacyResult;
export type ParsedSwimmer = ParsedAthlete & { normalizedSlug: string; linkedAthleteId?: string };
export type ParsedMeetMeta = ParsedFile['meet'];
export type ParseFileResult = { name: string; format: 'HY3' | 'SD3' | 'CL2'; encoding: string; hash: string; parsed: ParsedFile };
export type ExistingSwimmer = { id: string; first_name: string; last_name: string; birth_date: string | null; gender: string | null; federation_id: string | null; tm_athlete_id: string | null; club_id: string | null; normalized_slug?: string | null };
