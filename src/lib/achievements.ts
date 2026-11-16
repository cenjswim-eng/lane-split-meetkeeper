import type { Tables } from '@/integrations/supabase/types';
import { eventLabel, formatTime } from './swim';

export type Achievement = Tables<'athlete_achievements'> & {
  athletes: { first_name: string; last_name: string; club_id: string | null } | null;
  meets: { name: string } | null;
};
export const achievementLabels: Record<string, string> = { first: 'Primera marca', pb: 'Mejor marca personal', minimum: 'Mínima alcanzada' };
export function achievementSummary(rows: readonly { kind: string }[]) {
  const count = (kind: string) => rows.filter(r => r.kind === kind).length;
  return `${rows.length} logros nuevos: ${count('pb')} mejores marcas, ${count('minimum')} mínimas y ${count('first')} primeras marcas`;
}
export function achievementText(a: Achievement) {
  return ['Swim Lane Coach', `${a.athletes?.first_name ?? ''} ${a.athletes?.last_name ?? ''}`.trim(), achievementLabels[a.kind], `${eventLabel(a.distance,a.stroke)} · ${a.course === 'LCM' ? '50 m' : '25 m'}`, `Tiempo: ${formatTime(a.time_ms)}`, a.kind==='pb' && a.improvement_ms != null ? `Mejoró ${(a.improvement_ms/1000).toFixed(3)} s · Anterior: ${formatTime(a.previous_ms)}` : a.kind==='minimum' ? `Mínima: ${formatTime(a.minimum_ms)}` : '', `${a.meets?.name ?? ''} · ${a.achieved_on}`].filter(Boolean).join('\n');
}
export function latestMeetAchievements(rows: readonly Achievement[]) {
  const latest = [...rows].sort((a,b)=>b.achieved_on.localeCompare(a.achieved_on))[0];
  return latest ? rows.filter(r=>r.meet_id===latest.meet_id) : [];
}