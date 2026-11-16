import { createClient } from '@supabase/supabase-js';
import { it,expect } from 'vitest';
import { mkdirSync,writeFileSync,unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const url=process.env['SUPABASE_URL'],key=process.env['SUPABASE_SERVICE_ROLE_KEY'],publicKey=process.env['SUPABASE_PUBLISHABLE_KEY'];
it.skipIf(!url||!key||!publicKey)('saves, resumes and exports assistant entries with real sessions and rejects another owner',async()=>{
 if(!url||!key||!publicKey)return;
 const admin=createClient(url,key,{auth:{persistSession:false}}),users:string[]=[];
 try{
 const clients=[];
 for(let i=0;i<2;i++){const email=`assistant-${crypto.randomUUID()}@example.com`,password=`${crypto.randomUUID()}Aa1!`;const u=await admin.auth.admin.createUser({email,password,email_confirm:true});if(u.error||!u.data.user)throw u.error??Error('User missing');users.push(u.data.user.id);const role=await admin.from('user_roles').insert({user_id:u.data.user.id,role:'admin'});if(role.error)throw role.error;const c=createClient(url,publicKey,{auth:{persistSession:false}});const s=await c.auth.signInWithPassword({email,password});if(s.error)throw s.error;clients.push(c);}
 const [a,b]=clients;if(!a||!b)throw Error('Clients missing');
 const m=await a.from('meets').insert({name:'Assistant verification',start_date:'2026-12-12',course:'LCM'}).select().single();if(m.error)throw m.error;
 const athlete=await a.from('athletes').insert({first_name:'Ana',last_name:'Assistant',birth_date:'2011-12-31',gender:'F',federation_id:'AASSF311211'}).select().single();if(athlete.error)throw athlete.error;
 const ev=await a.from('events').insert({meet_id:m.data.id,event_number:'1',distance:100,stroke:1,gender:'F',min_age:14,max_age:15,course:'LCM',qualifying_times_ms:{LCM:66000}}).select().single();if(ev.error)throw ev.error;
 const session=(await a.auth.getSession()).data.session;if(!session)throw Error('Session missing');
 mkdirSync('/tmp/browser/entry-assistant',{recursive:true});
 writeFileSync('/tmp/browser/entry-assistant/session.json',JSON.stringify({session,meet:m.data.id}),{mode:0o600});
 execFileSync('python3',['src/test/workspace-navigation.browser.py'],{stdio:'pipe',timeout:90000});
 const d=await a.from('entry_assistant_drafts').select().eq('meet_id',m.data.id).single();if(d.error)throw d.error;
 expect(d.data.rows).toHaveLength(1);
 expect((await b.from('entry_assistant_drafts').select().eq('id',d.data.id)).data).toEqual([]);
 expect((await b.rpc('commit_entry_assistant',{p_draft:d.data.id})).error).not.toBeNull();
 expect((await b.from('entry_assistant_drafts').insert({meet_id:m.data.id,rows:d.data.rows,rules:d.data.rules})).error).not.toBeNull();
 const saved=await a.from('meet_entries').select('seed_time_ms,entry_origin').eq('meet_id',m.data.id).single();if(saved.error)throw saved.error;
 expect(saved.data).toEqual({seed_time_ms:null,entry_origin:'suggested'});
 }finally{
 try{unlinkSync('/tmp/browser/entry-assistant/session.json');}catch{}
 for(const id of users){for(const table of ['entry_assistant_drafts','meet_entries','events','athletes','meets']){const r=await admin.from(table).delete().eq('owner_id',id);if(r.error)throw r.error;}await admin.auth.admin.deleteUser(id);}
 }
},150000);