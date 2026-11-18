import { z } from 'zod';
export const attendanceStatus = { present: 'Presente', absent: 'Ausente', late: 'Tarde', excused: 'Justificada' } as const;
export const trainingSessions = { morning: 'Mañana', afternoon: 'Tarde', evening: 'Noche' } as const;
export const attendanceRowSchema = z.object({ athlete_id: z.string().uuid(), status: z.enum(['present','absent','late','excused']), notes: z.string().max(500).default('') });
export const attendanceDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s => {const d=new Date(s+'T12:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;},'Fecha inválida');
export const attendanceSaveSchema = z.object({ date: attendanceDate, session: z.enum(['morning','afternoon','evening']), rows: z.array(attendanceRowSchema).min(1) }).refine(x=>new Set(x.rows.map(r=>r.athlete_id)).size===x.rows.length,'Atleta repetido');
export type AttendanceRow = z.infer<typeof attendanceRowSchema> & { training_date: string; session: keyof typeof trainingSessions };
export interface AttendanceReport { from: string; to: string; rows: readonly AttendanceRow[] }
export function attendanceSummary(rows: readonly AttendanceRow[]) {
 const counts={present:0,absent:0,late:0,excused:0};
 for(const row of rows)counts[row.status]++;
 const total=rows.length,attended=counts.present+counts.late;
 return {...counts,total,attended,percentage:total?Math.round(attended/total*100):null};
}
export function localAttendanceDate(now=new Date()) {return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;}
