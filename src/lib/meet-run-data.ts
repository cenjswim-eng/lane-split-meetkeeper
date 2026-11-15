import { queryOptions } from '@tanstack/react-query';
import {supabase} from '@/integrations/supabase/client';
export const runResultsQuery=queryOptions({queryKey:['run-results'],refetchInterval:10000,queryFn:async()=>{
 const results=[];for(let o=0;;o+=1000){const p=await supabase.from('results').select('*, meets(start_date), events(distance,stroke), splits(*)').order('id').range(o,o+999);if(p.error)throw p.error;results.push(...p.data);if(p.data.length<1000)break;}return results;
}});