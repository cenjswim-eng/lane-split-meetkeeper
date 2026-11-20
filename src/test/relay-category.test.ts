import {it,expect} from 'vitest';
import {relayCategoryEligible} from '@/lib/relay-category';
import {tournamentEligible} from '@/lib/tournament-rules';
it('open includes ages across categories',()=>{expect(relayCategoryEligible('2016-01-01',2026,null)).toBe(true);expect(relayCategoryEligible('2000-01-01',2026,null)).toBe(true);});
it('category uses December 31 and includes both age boundaries',()=>{const c={name:'Juvenil',age_min:14,age_max:15};expect(relayCategoryEligible('2012-12-31',2026,c)).toBe(true);expect(relayCategoryEligible('2011-01-01',2026,c)).toBe(true);expect(relayCategoryEligible('2010-12-31',2026,c)).toBe(false);expect(relayCategoryEligible(null,2026,c)).toBe(false);});
it('open does not override an official event age limit',()=>{const birth='2000-01-01';expect(relayCategoryEligible(birth,2026,null)).toBe(true);expect(tournamentEligible({birth_date:birth,gender:'M'},{gender:'M',min_age:14,max_age:15},2026)).toBe(false);});
