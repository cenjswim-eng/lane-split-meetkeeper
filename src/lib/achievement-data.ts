import { queryOptions } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export async function loadAchievements(athleteId?: string) {
  const rows = [];
  for (let offset=0;;offset+=1000) {
    let q=supabase.from('athlete_achievements').select('*, athletes(first_name,last_name,club_id), meets(name)').order('achieved_on',{ascending:false}).order('id').range(offset,offset+999);
    if(athleteId) q=q.eq('athlete_id',athleteId);
    const response=await q;
    if(response.error) throw response.error;
    rows.push(...response.data);
    if(response.data.length<1000)break;
  }
  return rows;
}
export const achievementsQuery = queryOptions({queryKey:['achievements'],queryFn:()=>loadAchievements()});