import { useEffect, useState, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { profileQuery } from './profile';
import { ageAtDec31 } from './swim';
import type { SwimCategory } from './standard-rules';
export interface WorkspaceFilters { season:string;category:string;gender:string;course:string }
export const emptyFilters:WorkspaceFilters={season:'all',category:'all',gender:'all',course:'all'};
const states=new Map<string,WorkspaceFilters>(),listeners=new Set<()=>void>();
const subscribe=(fn:()=>void)=>{listeners.add(fn);return ()=>{listeners.delete(fn);};};
export function useWorkspaceFilters(){
 const {data}=useQuery(profileQuery);const user=data?.userId??'';const [loaded,setLoaded]=useState('');
 const filters=useSyncExternalStore(subscribe,()=>states.get(user)??emptyFilters,()=>emptyFilters);
 useEffect(()=>{if(!user)return;try{const raw=JSON.parse(localStorage.getItem(`swim-filters:${user}`)??'null');if(!states.has(user)&&raw&&['season','category','gender','course'].every(k=>typeof raw[k]==='string'))states.set(user,raw);}catch{}setLoaded(user);listeners.forEach(fn=>fn());},[user]);
 function update(next:WorkspaceFilters){if(!user)return;states.set(user,next);listeners.forEach(fn=>fn());}
 function save(){if(user&&loaded===user)localStorage.setItem(`swim-filters:${user}`,JSON.stringify(filters));}
 return {filters,update,save};
}
export function matchesAthlete(a:{birth_date:string|null;gender:string|null},f:WorkspaceFilters,categories:readonly SwimCategory[],year=new Date().getFullYear()){
 if(f.gender!=='all'&&a.gender!==f.gender)return false;
 if(f.category==='all')return true;
 const c=categories.find(c=>c.name===f.category),age=ageAtDec31(a.birth_date,year);
 return !!c&&age!=null&&(c.age_min==null||age>=c.age_min)&&(c.age_max==null||age<=c.age_max);
}
export function matchesMeet(m:{start_date:string|null;course:string|null},f:WorkspaceFilters){return (f.season==='all'||m.start_date?.slice(0,4)===f.season)&&(f.course==='all'||m.course===f.course);}
export function matchesResult(r:{course:string|null;meets:{start_date:string|null}|null;athletes:{birth_date:string|null;gender:string|null}|null},f:WorkspaceFilters,categories:readonly SwimCategory[]){return matchesMeet({start_date:r.meets?.start_date??null,course:r.course},f)&&!!r.athletes&&matchesAthlete(r.athletes,f,categories,Number(r.meets?.start_date?.slice(0,4)??new Date().getFullYear()));}