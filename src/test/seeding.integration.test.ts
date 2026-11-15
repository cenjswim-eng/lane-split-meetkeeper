import { createClient } from '@supabase/supabase-js';
import { it,expect } from 'vitest';
const url=process.env['SUPABASE_URL'],key=process.env['SUPABASE_SERVICE_ROLE_KEY'],pub=process.env['SUPABASE_PUBLISHABLE_KEY'];
it.skipIf(!url||!key||!pub)('saves all entries atomically, preserves times, isolates two accounts, and locks closed sessions',async()=>{
 if(!url||!key||!pub)return;
 const admin=createClient(url,key,{auth:{persistSession:false}}),ids:string[]=[],clients=[];
 const check=<T>(r:{data:T;error:unknown})=>{if(r.error)throw r.error;return r.data;};
 let mid:string|undefined;
 try{
 for(let i=0;i<2;i++){const email=`seed-${crypto.randomUUID()}@example.com`,password=`${crypto.randomUUID()}Aa1!`;const u=check(await admin.auth.admin.createUser({email,password,email_confirm:true})).user;if(!u)throw new Error('Missing user');ids.push(u.id);check(await admin.from('user_roles').insert({user_id:u.id,role:'admin'}));const c=createClient(url,pub,{auth:{persistSession:false}});check(await c.auth.signInWithPassword({email,password}));clients.push(c);}
 const [a,b]=clients;if(!a||!b)throw new Error('Missing clients');
 const meet=check(await a.from('meets').insert({name:'Seeding integration',course:'LCM',start_date:'2026-11-15'}).select().single());mid=meet.id;
 const ev=check(await a.from('events').insert({meet_id:mid,event_number:'1',distance:100,stroke:1,session_number:1}).select().single());
 const athletes=check(await a.from('athletes').insert(Array.from({length:9},(_,i)=>({first_name:`Seed${i}`,last_name:'Test',birth_date:'2012-01-01',gender:'F'}))).select());
 const entries=check(await a.from('meet_entries').insert(athletes.map((x,i)=>({athlete_id:x.id,meet_id:mid,event_id:ev.id,seed_time_ms:60000+i*1000,seed_course:'LCM'}))).select());
 const rows=entries.map((e,i)=>({kind:'individual',id:e.id,eventId:ev.id,heat:i<3?1:2,lane:i<3?i+1:i-2,status:'OK',timeMs:e.seed_time_ms}));
 const args={p_meet:mid,p_session:1,p_revision:0,p_lanes:8,p_mode:'timed',p_conversion:false,p_factor:1,p_rows:rows,p_close:false};
 expect(check(await a.rpc('save_meet_seeding',args))).toBe(1);
 const saved=check(await a.from('meet_entries').select('*').eq('meet_id',mid));expect(saved).toHaveLength(9);expect(saved[0].seed_time_ms).toBe(entries.find(e=>e.id===saved[0].id)?.seed_time_ms);expect(saved.every(e=>e.seeding_time_ms===e.seed_time_ms)).toBe(true);
 expect(check(await b.from('meet_seeding_sessions').select('*').eq('meet_id',mid))).toEqual([]);
 expect((await b.rpc('save_meet_seeding',{...args,p_revision:1})).error).not.toBeNull();
 expect((await a.rpc('save_meet_seeding',args)).error).not.toBeNull();
 const duplicate=rows.map((r,i)=>i===1?{...r,lane:rows[0].lane,heat:rows[0].heat}:r);
 expect((await a.rpc('save_meet_seeding',{...args,p_revision:1,p_rows:duplicate})).error).not.toBeNull();
 expect(check(await a.from('meet_seeding_sessions').select('revision').eq('meet_id',mid).single()).revision).toBe(1);
 check(await a.rpc('save_meet_seeding',{...args,p_revision:1,p_close:true}));
 expect((await a.from('meet_entries').update({lane:8}).eq('id',entries[0].id)).error).not.toBeNull();
 expect((await a.rpc('save_meet_seeding',{...args,p_revision:2})).error).not.toBeNull();
 check(await a.rpc('reopen_meet_seeding',{p_meet:mid,p_session:1,p_revision:2}));
 check(await a.rpc('save_meet_seeding',{...args,p_revision:3,p_rows:rows.map((r,i)=>i===0?{...r,status:'SCR',heat:null,lane:null}:r)}));
 expect(check(await a.from('meet_entries').select('status,heat,lane,seed_time_ms').eq('id',entries[0].id).single())).toMatchObject({status:'SCR',heat:null,lane:null,seed_time_ms:entries[0].seed_time_ms});
 }finally{
 if(mid){await admin.from('meet_seeding_sessions').delete().eq('meet_id',mid);await admin.from('meets').delete().eq('id',mid);}for(const id of ids){await admin.from('athletes').delete().eq('owner_id',id);await admin.auth.admin.deleteUser(id);}
 }
},60000);