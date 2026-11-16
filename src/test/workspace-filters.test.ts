import { it,expect } from 'vitest';
import { matchesAthlete,matchesMeet,matchesResult,emptyFilters } from '@/lib/workspace-filters';
import { SWIM_CATEGORIES } from '@/lib/standard-rules';
it('preserves year pool gender and Dec31 category selection without converting times',()=>{
 const f={...emptyFilters,season:'2026',course:'LCM',gender:'F',category:'Juvenil A'};
 expect(matchesMeet({start_date:'2026-11-07',course:'LCM'},f)).toBe(true);
 expect(matchesMeet({start_date:'2025-11-07',course:'LCM'},f)).toBe(false);
 expect(matchesMeet({start_date:'2026-11-07',course:'SCM'},f)).toBe(false);
 expect(matchesAthlete({birth_date:'2011-12-31',gender:'F'},f,SWIM_CATEGORIES,2026)).toBe(true);
 expect(matchesAthlete({birth_date:'2011-12-31',gender:'M'},f,SWIM_CATEGORIES,2026)).toBe(false);
 expect(matchesResult({course:'LCM',meets:{start_date:'2026-11-07'},athletes:{birth_date:'2011-12-31',gender:'F'}},f,SWIM_CATEGORIES)).toBe(true);
});