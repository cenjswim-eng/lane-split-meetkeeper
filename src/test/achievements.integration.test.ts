import { createClient } from '@supabase/supabase-js';
import { expect,it } from 'vitest';
import { mkdirSync,writeFileSync,unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { buildSd3 } from '@/lib/hytek/sdif';
const url=process.env['SUPABASE_URL'],key=process.env['SUPABASE_SERVICE_ROLE_KEY'],publicKey=process.env['SUPABASE_PUBLISHABLE_KEY'];
it.skipIf(!url||!key||!publicKey)('imports, reimports, corrects and deletes achievements privately across two real accounts',async()=>{
 if(!url||!key||!publicKey)return;
 const admin=createClient(url,key,{auth:{persistSession:false}}),users:string[]=[];
 const must=<R extends {data:unknown;error:unknown}>(r:R):R['data']=>{if(r.error)throw r.error;return r.data;};
 try {
  const clients=[];
  for(let i=0;i<2;i++){const email=`achievement-${crypto.randomUUID()}@example.com`,password=`${crypto.randomUUID()}Aa1!`;const u=must(await admin.auth.admin.createUser({email,password,email_confirm:true}));if(!u.user)throw Error('Missing user');users.push(u.user.id);must(await admin.from('user_roles').insert({user_id:u.user.id,role:'admin'}));const c=createClient(url,publicKey,{auth:{persistSession:false}});must(await c.auth.signInWithPassword({email,password}));clients.push(c);}
  const [a,b]=clients;if(!a||!b)throw Error('Missing client');
  const standard={name:'Test official',season_year:2026,age_group:'Juvenil A',age_min:14,age_max:15,gender:'F',distance:100,stroke:1,course:'LCM',qualifying_time_ms:65000};
  must(await a.rpc('import_standard_version',{p_document:'Test official 2026',p_year:2026,p_effective:'2026-01-01',p_standards:[standard],p_warnings:[]}));
  const payload={format:'HY3',fileName:'test.hy3',teams:[],meet:{name:'Logros Copa Inicial',startDate:'2026-01-12',endDate:'2026-01-12',course:'LCM',location:null},athletes:[{key:'a',firstName:'Ana',lastName:'Logros',birthDate:'2011-12-31',gender:'F',tmId:'LOGROS1',federationId:null,teamCode:null}],results:[{athleteKey:'a',eventNumber:'1',distance:100,stroke:1,gender:'F',minAge:14,maxAge:15,course:'LCM',finalMs:68000,seedMs:null,round:'F',status:'OK',isDq:false,place:1,splits:[]}]};
  must(await a.rpc('import_meet_payload',{p_payload:payload}));
  let log=must(await a.from('athlete_achievements').select());expect(log).toHaveLength(1);expect(log?.[0]?.kind).toBe('first');
  const second={...payload,meet:{...payload.meet,name:'Logros Copa Final',startDate:'2026-11-14',endDate:'2026-11-14'},results:[{...payload.results[0],finalMs:64000}]};
  const saved=must(await a.rpc('import_meet_payload',{p_payload:second})) as {meetId:string};
  log=must(await a.from('athlete_achievements').select());expect(log).toHaveLength(3);const pb=log?.find(r=>r.kind==='pb');expect(pb).toMatchObject({previous_ms:68000,time_ms:64000,improvement_ms:4000});expect(log?.filter(r=>r.kind==='minimum')).toHaveLength(1);
  const ids=log?.map(r=>r.id).sort();must(await a.rpc('import_meet_payload',{p_payload:{...second,fileName:'renamed.hy3'}}));expect(must(await a.from('athlete_achievements').select('id'))?.map(r=>r.id).sort()).toEqual(ids);
  expect(must(await b.from('athlete_achievements').select())).toEqual([]);
  expect((await b.from('athlete_achievements').insert({owner_id:users[0],athlete_id:pb?.athlete_id,result_id:pb?.result_id,meet_id:saved.meetId,kind:'pb',distance:100,stroke:1,course:'LCM',time_ms:1,achieved_on:'2026-11-14'})).error).not.toBeNull();
  await a.from('athlete_achievements').update({time_ms:1}).eq('id',pb?.id);
  expect(must(await a.from('athlete_achievements').select('time_ms').eq('id',pb?.id).single())).toEqual({time_ms:64000});
  const session=must(await a.auth.getSession()).session;if(!session)throw Error('Missing session');mkdirSync('/tmp/browser/achievements',{recursive:true});writeFileSync('/tmp/browser/achievements/session.json',JSON.stringify({session,athlete:pb?.athlete_id}),{mode:0o600});
  writeFileSync('/tmp/browser/achievements/results.sd3',buildSd3({name:'Logros Copa Final',location:null,start_date:'2026-11-14',end_date:'2026-11-14',course:'LCM'},[{athlete:{first_name:'Ana',last_name:'Logros',birth_date:'2011-12-31',gender:'F',federation_id:null,team_code:null},event:{event_number:'1',distance:100,stroke:1,gender:'F',min_age:14,max_age:15},final_time_ms:64000,seed_time_ms:null,is_dq:false,place:1,aqua_points:null,course:'LCM',round:'F',splits:[]}],[]));
  execFileSync('python3',['src/test/achievements.browser.py'],{stdio:'pipe',timeout:90000});
  must(await a.from('results').update({final_time_ms:67000}).eq('id',pb?.result_id));log=must(await a.from('athlete_achievements').select());expect(log).toHaveLength(2);expect(log?.find(r=>r.kind==='pb')).toMatchObject({improvement_ms:1000});
  must(await a.from('results').update({is_dq:true}).eq('id',pb?.result_id));expect(must(await a.from('athlete_achievements').select())).toHaveLength(1);
  must(await a.from('results').update({is_dq:false,final_time_ms:64000}).eq('id',pb?.result_id));expect(must(await a.from('athlete_achievements').select())).toHaveLength(3);
  must(await a.from('results').delete().eq('id',pb?.result_id));expect(must(await a.from('athlete_achievements').select())).toHaveLength(1);
  // A 25 m swim is a first mark, never a PB against the stored 50 m times.
  const short={...second,meet:{...second.meet,name:'Logros 25m',course:'SCM'},results:[{...second.results[0],course:'SCM',finalMs:60000}]};must(await a.rpc('import_meet_payload',{p_payload:short}));expect(must(await a.from('athlete_achievements').select().eq('course','SCM'))?.map(r=>r.kind)).toEqual(['first']);
  // A backdated import reassigns first mark and recomputes the later PB.
  const earlier={...payload,meet:{...payload.meet,name:'Logros Historial Anterior',startDate:'2025-10-01',endDate:'2025-10-01'},results:[{...payload.results[0],finalMs:70000}]};must(await a.rpc('import_meet_payload',{p_payload:earlier}));
  const long=must(await a.from('athlete_achievements').select().eq('course','LCM'));
  expect(long?.find(r=>r.achieved_on==='2025-10-01')).toMatchObject({kind:'first',time_ms:70000});
  expect(long?.find(r=>r.achieved_on==='2026-01-12')).toMatchObject({kind:'pb',previous_ms:70000,improvement_ms:2000});
  expect(long?.some(r=>r.kind==='minimum')).toBe(false);
 }finally {
  try{unlinkSync('/tmp/browser/achievements/session.json');}catch{}
  for(const id of users){for(const table of ['standard_versions','splits','results','meet_entries','events','athletes','meets','teams','import_logs']){const r=await admin.from(table).delete().eq('owner_id',id);if(r.error)throw r.error;}await admin.from('user_roles').delete().eq('user_id',id);await admin.auth.admin.deleteUser(id);}
 }
},150000);