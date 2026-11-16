import { createClient } from '@supabase/supabase-js';
import { expect,it } from 'vitest';
import { tokenHash,neutralBrand } from '@/lib/report-brand';
import { mkdirSync,writeFileSync,unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const url=process.env['SUPABASE_URL'],key=process.env['SUPABASE_SERVICE_ROLE_KEY'],publicKey=process.env['SUPABASE_PUBLISHABLE_KEY'];
it.skipIf(!url||!key||!publicKey)('isolates brands and files and verifies public share privacy, download, counters and revocation',async()=>{
 if(!url||!key||!publicKey)return;
 const admin=createClient(url,key,{auth:{persistSession:false}}),users:string[]=[],clubs:string[]=[];
 const must=<R extends {data:unknown;error:unknown}>(r:R):R['data']=>{if(r.error)throw r.error;return r.data;};
 try{
  const clients=[];
  for(let i=0;i<2;i++){const email=`brand-${crypto.randomUUID()}@example.com`,password=`${crypto.randomUUID()}Aa1!`;const u=must(await admin.auth.admin.createUser({email,password,email_confirm:true}));if(!u.user)throw Error('User missing');users.push(u.user.id);must(await admin.from('user_roles').insert({user_id:u.user.id,role:'admin'}));const c=createClient(url,publicKey,{auth:{persistSession:false}});must(await c.auth.signInWithPassword({email,password}));clients.push(c);const club=must(await c.from('clubs').insert({name:`Club Marca ${i}`}).select().single());if(!club)throw Error('Club missing');clubs.push(club.id);}
  const [a,b]=clients;if(!a||!b||!clubs[0]||!clubs[1])throw Error('Clients missing');
  must(await a.from('club_brands').insert({club_id:clubs[0],official_name:'Club Marca Privada',contact:'test@example.com'}));
  expect(must(await b.from('club_brands').select())).toEqual([]);
  expect((await b.from('club_brands').insert({club_id:clubs[0],official_name:'Hijack'})).error).not.toBeNull();
  const athlete=must(await a.from('athletes').insert({first_name:'Ana',last_name:'ApellidoPrivado',birth_date:'2011-12-31',gender:'F',club_id:clubs[0]}).select().single());if(!athlete)throw Error('Athlete missing');
  const m=must(await a.from('meets').insert({name:'Copa Marca',start_date:'2026-11-14',course:'LCM'}).select().single());if(!m)throw Error('Meet missing');const ev=must(await a.from('events').insert({meet_id:m.id,distance:100,stroke:1,gender:'F',course:'LCM'}).select().single());if(!ev)throw Error('Event missing');
  must(await a.from('results').insert({athlete_id:athlete.id,meet_id:m.id,event_id:ev.id,final_time_ms:64000,aqua_points:999,course:'LCM'}));
  const session=must(await a.auth.getSession()).session;if(!session)throw Error('Session missing');mkdirSync('/tmp/browser/shared-reports',{recursive:true});writeFileSync('/tmp/browser/shared-reports/session.json',JSON.stringify({session,athlete:athlete.id}),{mode:0o600});
  execFileSync('python3',['src/test/shared-reports.browser.py'],{stdio:'pipe',timeout:120000});
  const publicText=execFileSync('pdftotext',['/tmp/browser/shared-reports/public.pdf','-'],{encoding:'utf8'});
  expect(publicText).not.toContain('ApellidoPrivado');expect(publicText).not.toContain('2011-12-31');expect(publicText).not.toContain('999');
  const rows=must(await a.from('shared_reports').select());expect(rows).toHaveLength(1);const row=rows?.[0];if(!row)throw Error('Share missing');
  expect(row.privacy).toEqual({fullSurname:false,birthDate:false,aqua:false});expect(row.opens).toBeGreaterThan(0);expect(row.revoked_at).not.toBeNull();
  expect(must(await b.from('shared_reports').select())).toEqual([]);expect((await b.storage.from('shared-reports').download(row.storage_path)).error).not.toBeNull();
  expect((await a.rpc('open_shared_report',{p_hash:row.token_hash,p_count:true})).error).not.toBeNull();
  expect(must(await admin.rpc('open_shared_report',{p_hash:row.token_hash,p_count:false}))).toEqual([]);
  const expired=crypto.randomUUID(),hash=await tokenHash('ab'.repeat(32));must(await a.from('shared_reports').insert({id:expired,club_id:clubs[0],token_hash:hash,title:'Expired',storage_path:`${users[0]}/${clubs[0]}/${expired}.pdf`,brand:neutralBrand(),privacy:{},expires_at:'2026-01-01T00:00:00Z'}));expect(must(await admin.rpc('open_shared_report',{p_hash:hash,p_count:true}))).toEqual([]);
 }finally{
  try{unlinkSync('/tmp/browser/shared-reports/session.json');}catch{}
  for(const id of users){const shares=await admin.from('shared_reports').select('storage_path').eq('owner_id',id);if(shares.data?.length)await admin.storage.from('shared-reports').remove(shares.data.map(s=>s.storage_path));for(const club of clubs){const files=await admin.storage.from('club-documents').list(club);if(files.data?.length)await admin.storage.from('club-documents').remove(files.data.map(f=>`${club}/${f.name}`));}for(const table of ['shared_reports','club_brands','splits','results','events','athletes','meets','clubs']){const r=await admin.from(table).delete().eq('owner_id',id);if(r.error)throw r.error;}await admin.from('user_roles').delete().eq('user_id',id);await admin.auth.admin.deleteUser(id);}
 }
},180000);