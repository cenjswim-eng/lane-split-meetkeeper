import { expect,it } from 'vitest';
import { demoAchievements } from '@/lib/demo-achievements';
import { achievementSummary,latestMeetAchievements } from '@/lib/achievements';
it('counts distinct PB, first and minimum achievements',()=>{
 expect(achievementSummary([{kind:'pb'},{kind:'pb'},{kind:'minimum'},{kind:'first'}])).toBe('4 logros nuevos: 2 mejores marcas, 1 mínimas y 1 primeras marcas');
});
it('demo compares full prior best, not the last slower swim',()=>{
 const ana=demoAchievements().filter(a=>a.athlete_id==='demo-ana');
 expect(ana.filter(a=>a.kind==='first')).toHaveLength(1);
 expect(ana.filter(a=>a.kind==='minimum')).toHaveLength(1);
 expect(ana.find(a=>a.kind==='pb'&&a.meet_id==='liga')).toMatchObject({previous_ms:65400,time_ms:64800,improvement_ms:600});
 expect(ana.some(a=>a.meet_id==='ciudad')).toBe(false);
});
it('PDF summary selects only the latest competition achievements',()=>{
 const rows=latestMeetAchievements(demoAchievements());
 expect(rows.length).toBeGreaterThan(0);expect(new Set(rows.map(a=>a.meet_id))).toEqual(new Set(['cierre']));
});