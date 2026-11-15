import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { CompactResult } from "./compact-meet-report";

export const compactReportQuery = queryOptions({queryKey:["compact-report-data"],queryFn:async()=>{
  const results:CompactResult[]=[];
  // Paginate all historical results, never truncate PB candidates at the API row limit.
  for(let offset=0;;offset+=1000){
    const page=await supabase.from("results").select("id,athlete_id,meet_id,event_id,final_time_ms,is_dq,status,course,meets(id,name,start_date),events(distance,stroke,is_relay)").order("id").range(offset,offset+999);
    if(page.error)throw page.error;results.push(...page.data);if(page.data.length<1000)break;
  }
  const clubs=await supabase.from("clubs").select("id,name,full_name,head_coach,logo_path").order("name");
  if(clubs.error)throw clubs.error;
  return {results,clubs:clubs.data};
}});