import { demoAthletes, demoSwims } from './demo-data';
import type { Achievement } from './achievements';

export function demoAchievements(): Achievement[] {
  return demoAthletes.flatMap(a=>{
    let best: number|null=null,qualified=false;
    return demoSwims(a).flatMap(s=>{
      const kinds=[];if(best===null)kinds.push('first');else if(s.time<best)kinds.push('pb');
      if(s.remaining<=0&&!qualified){kinds.push('minimum');qualified=true;}
      const previous=best;best=Math.min(best??Infinity,s.time);
      const [first,...last]=a.name.split(' ');
      return kinds.map(kind=>({id:`${a.id}:${s.meet.id}:${kind}`,owner_id:'demo',athlete_id:a.id,result_id:`${a.id}:${s.meet.id}`,meet_id:s.meet.id,kind,distance:100,stroke:1,course:'LCM',time_ms:s.time,previous_ms:previous,improvement_ms:previous===null?null:previous-s.time,achieved_on:s.meet.date,minimum_ms:kind==='minimum'?s.minimum:null,standard_version_id:null,standard_key:'',created_at:`${s.meet.date}T12:00:00Z`,athletes:{first_name:first??'',last_name:last.join(' '),club_id:null},meets:{name:s.meet.name}}));
    });
  }).sort((a,b)=>b.achieved_on.localeCompare(a.achieved_on));
}