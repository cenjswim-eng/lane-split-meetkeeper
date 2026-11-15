import { createClient } from '@supabase/supabase-js';
import { it,expect } from 'vitest';
const url=process.env['SUPABASE_URL'],key=process.env['SUPABASE_SERVICE_ROLE_KEY'],publicKey=process.env['SUPABASE_PUBLISHABLE_KEY'];
it.skipIf(!url||!key||!publicKey)('guards relays, limits and club merges across two real accounts',async()=>{
 if(!url||!key||!publicKey)return;
 const admin=createClient(url,key,{auth:{persistSession:false}});const users:string[]=[];
 try{
  const clients=[];
  for(let i=0;i<2;i++){const email=`tm-${crypto.randomUUID()}@example.com`,password=`${crypto.randomUUID()}Aa1!`;const u=await admin.auth.admin.createUser({email,password,email_confirm:true});if(u.error||!u.data.user)throw u.error??new Error('Missing user');users.push(u.data.user.id);const r=await admin.from('user_roles').insert({user_id:u.data.user.id,role:'admin'});if(r.error)throw r.error;const client=createClient(url,publicKey,{auth:{persistSession:false}});const sign=await client.auth.signInWithPassword({email,password});if(sign.error)throw sign.error;clients.push(client);}
  const [a,b]=clients;if(!a||!b)throw new Error('Missing clients');
  const source=await a.from('clubs').insert({name:'Source Demo',team_code:'SRC',full_name:'Source Demo',short_name:'Source'}).select().single();if(source.error)throw source.error;
  const target=await a.from('clubs').insert({name:'Target Demo',team_code:'TGT',full_name:'Target Demo',short_name:'Target'}).select().single();if(target.error)throw target.error;
  const other=await b.from('clubs').insert({name:'Other Demo'}).select().single();if(other.error)throw other.error;
  const meet=await a.from('meets').insert({name:'Team Manager Test',start_date:'2026-11-15',course:'LCM',max_ind_entries:2,max_ind_per_session:1}).select().single();if(meet.error)throw meet.error;
  const link=await a.from('club_meets').insert({club_id:source.data.id,meet_id:meet.data.id});if(link.error)throw link.error;
  const athletes=await a.from('athletes').insert(Array.from({length:8},(_,i)=>({first_name:`Demo${i}`,last_name:'Swimmer',birth_date:'2012-12-31',gender:'F',club_id:source.data.id}))).select();if(athletes.error)throw athletes.error;
  const events=await a.from('events').insert([{meet_id:meet.data.id,event_number:'1',distance:200,stroke:6,is_relay:true,gender:'F',min_age:14,max_age:15},{meet_id:meet.data.id,event_number:'2',distance:100,stroke:1,gender:'F',min_age:14,max_age:15},{meet_id:meet.data.id,event_number:'3',distance:50,stroke:1,gender:'F',min_age:14,max_age:15}]).select();if(events.error)throw events.error;
  const [relay,one,two]=events.data;const ids=athletes.data.map(v=>v.id);if(!relay||!one||!two||ids.length!==8)throw new Error('Missing fixtures');
  const row={meet_id:meet.data.id,event_id:relay.id,club_id:source.data.id,relay_letter:'A',seed_time_ms:240000,seed_course:'LCM',swimmer_1_id:ids[0],swimmer_2_id:ids[1],swimmer_3_id:ids[2],swimmer_4_id:ids[3]};
  expect((await a.from('relay_entries').insert({...row,swimmer_4_id:ids[0]})).error).not.toBeNull();
  const saved=await a.from('relay_entries').insert(row).select().single();if(saved.error)throw saved.error;
  expect(saved.data.seed_time_ms).toBe(240000);
  expect((await b.from('relay_entries').select().eq('id',saved.data.id)).data).toEqual([]);
  expect((await b.from('relay_entries').insert({...row,club_id:other.data.id})).error).not.toBeNull();
  expect((await a.from('relay_entries').insert({...row,relay_letter:'B'})).error).not.toBeNull();
  const entry={athlete_id:ids[0],meet_id:meet.data.id,event_id:one.id,seed_time_ms:62340};
  expect((await a.from('meet_entries').insert(entry)).error).toBeNull();
  expect((await a.from('meet_entries').insert({...entry,event_id:two.id})).error).not.toBeNull();
  expect((await b.rpc('merge_clubs',{p_source:source.data.id,p_target:other.data.id})).error).not.toBeNull();
  const merge=await a.rpc('merge_clubs',{p_source:source.data.id,p_target:target.data.id});if(merge.error)throw merge.error;
  expect((await a.from('athletes').select('club_id').eq('id',ids[0]).single()).data?.club_id).toBe(target.data.id);
  expect((await a.from('relay_entries').select('club_id,seed_time_ms').eq('id',saved.data.id).single()).data).toEqual({club_id:target.data.id,seed_time_ms:240000});
  expect((await a.from('meet_entries').select('seed_time_ms').eq('athlete_id',ids[0])).data).toEqual([{seed_time_ms:62340}]);
 }finally{for(const id of users){for(const table of ['relay_entries','splits','results','meet_entries','club_meets','events','athletes','meets','clubs']){const r=await admin.from(table).delete().eq('owner_id',id);if(r.error)throw r.error;}await admin.auth.admin.deleteUser(id);}}
},120000);