import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { attendanceSaveSchema, attendanceDate, type AttendanceRow } from './attendance';
export const attendanceRosterQuery=queryOptions({queryKey:['attendance-roster'],queryFn:async()=>{
 const athletes=[];for(let page=0;;page++){const r=await supabase.from('athletes').select('id,first_name,last_name,club_id,is_active').order('last_name').order('id').range(page*1000,page*1000+999);if(r.error)throw r.error;athletes.push(...r.data);if(r.data.length<1000)break;}
 const clubs=await supabase.from('clubs').select('id,name').order('name');if(clubs.error)throw clubs.error;
 return {athletes,clubs:clubs.data};
}});
export async function loadAttendance(from:string,to:string,athleteId?:string):Promise<AttendanceRow[]> {
 attendanceDate.parse(from);attendanceDate.parse(to);if(from>to)throw Error('La fecha inicial debe ser anterior a la final.');
 const rows:AttendanceRow[]=[];
 for(let page=0;;page++) {let q=supabase.from('training_attendance').select('athlete_id,training_date,session,status,notes').gte('training_date',from).lte('training_date',to).order('training_date').order('id').range(page*1000,page*1000+999);if(athleteId)q=q.eq('athlete_id',athleteId);const r=await q;if(r.error)throw r.error;for(const row of r.data){rows.push({...row,status:row.status as AttendanceRow['status'],session:row.session as AttendanceRow['session']});}if(r.data.length<1000)break;}
 return rows;
}
export const attendanceDayQuery=(date:string)=>queryOptions({queryKey:['attendance',date],queryFn:()=>loadAttendance(date,date)});
export async function saveAttendance(input:unknown){const data=attendanceSaveSchema.parse(input);const r=await supabase.rpc('save_training_attendance',{p_date:data.date,p_session:data.session,p_rows:data.rows});if(r.error)throw r.error;return r.data;}
