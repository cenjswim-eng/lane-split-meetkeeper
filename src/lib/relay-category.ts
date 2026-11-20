import { ageAtDec31 } from './swim';
export interface RelayAgeCategory { name:string; age_min:number|null; age_max:number|null }
export function relayCategoryEligible(birth:string|null,year:number,category:RelayAgeCategory|null){
 if(!category)return true;
 const age=ageAtDec31(birth,year);
 return age!=null&&age>=0&&(category.age_min==null||age>=category.age_min)&&(category.age_max==null||age<=category.age_max);
}
