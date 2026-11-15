import { describe,it,expect } from 'vitest';
import { lanePriority, seedEntries, moveSeed, rankEntries, type SeedEntry } from '@/utils/seedingEngine';
const entries=(n:number):SeedEntry[]=>Array.from({length:n},(_,i)=>({id:String(i),name:`Atleta ${i}`,seedTimeMs:60000+i*1000,course:'LCM'}));
const options={lanes:8 as const,mode:'timed' as const,course:'LCM'};
describe('Meet Manager seeding rules',()=>{
 it('assigns the exact eight-lane spiral',()=>expect(lanePriority(8)).toEqual([4,5,3,6,2,7,1,8]));
 it('assigns the exact six-lane spiral',()=>expect(lanePriority(6)).toEqual([3,4,2,5,1,6]));
 it('assigns the exact ten-lane spiral',()=>expect(lanePriority(10)).toEqual([5,6,4,7,3,8,2,9,1,10]));
 it('puts fastest timed-final swimmers in the last heat and center lanes',()=>{const seeded=seedEntries(entries(16),options);expect(seeded.find(e=>e.id==='0')).toMatchObject({heat:2,lane:4});expect(seeded.find(e=>e.id==='8')).toMatchObject({heat:1,lane:4});});
 it('puts NT last in ranking and in the slow first heat',()=>{const seeded=seedEntries([...entries(8),{id:'nt',name:'NT',course:'LCM',seedTimeMs:null}],options);expect(seeded.find(e=>e.id==='nt')?.heat).toBe(1);expect(rankEntries([...entries(8),{id:'nt',name:'NT',course:'LCM',seedTimeMs:null}],options).at(-1)?.id).toBe('nt');});
 it.each([9,10,17,18])('redistributes a one or two swimmer first heat for %i swimmers',n=>{const seeded=seedEntries(entries(n),options);expect(seeded.filter(e=>e.heat===1)).toHaveLength(3);expect(new Set(seeded.map(e=>e.id)).size).toBe(n);});
 it('allows fewer than three only when fewer than three are entered',()=>expect(seedEntries(entries(2),options)).toHaveLength(2));
 it('circles the three fastest into the last three heats',()=>{const seeded=seedEntries(entries(24),{...options,mode:'circle'});expect(['0','1','2','3','4','5'].map(id=>seeded.find(e=>e.id===id)?.heat)).toEqual([3,2,1,3,2,1]);expect(seeded.find(e=>e.id==='0')?.lane).toBe(4);});
 it('converts only with an explicit factor without changing original seed',()=>{const row={...entries(1)[0],id:'a',name:'Ana',course:'LCM',seedTimeMs:60000};expect(()=>rankEntries([row],{...options,course:'SCM'})).toThrow();expect(rankEntries([row],{...options,course:'SCM',conversion:{enabled:true,lcmToScm:0.97}})[0]).toMatchObject({seedTimeMs:60000,rankedTimeMs:58200,converted:true});});
 it('excludes scratched entries',()=>expect(seedEntries([{...entries(1)[0],id:'a',name:'Ana',seedTimeMs:60000,course:'LCM',status:'SCR'}],options)).toEqual([]));
 it('swaps occupied lanes without duplicating assignments',()=>{const seeded=seedEntries(entries(8),options);const moved=moveSeed(seeded,'0',1,5,8);expect(moved.find(e=>e.id==='0')?.lane).toBe(5);expect(moved.find(e=>e.id==='1')?.lane).toBe(4);expect(new Set(moved.map(e=>`${e.heat}-${e.lane}`)).size).toBe(8);});
 it('preserves every swimmer and lane for six/eight/ten across uneven fields',()=>{for(const lanes of [6,8,10] as const)for(let n=3;n<65;n++)for(const mode of ['timed','circle'] as const){const seeded=seedEntries(entries(n),{lanes,mode,course:'LCM'});expect(seeded).toHaveLength(n);expect(new Set(seeded.map(e=>`${e.heat}-${e.lane}`)).size).toBe(n);for(const heat of new Set(seeded.map(e=>e.heat))){const size=seeded.filter(e=>e.heat===heat).length;expect(size).toBeGreaterThanOrEqual(3);expect(size).toBeLessThanOrEqual(lanes);}}});
});