import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { expect, it } from 'vitest';

const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const publicKey = process.env['SUPABASE_PUBLISHABLE_KEY'];
const tables = ['meet_entries','splits','results','events','athletes','meets','teams','groups','time_standards','import_logs','club_members','club_documents','clubs'];

it.skipIf(!url || !key || !publicKey)('approved accounts have isolated records, import identities, files and resets', async () => {
  if (!url || !key || !publicKey) return;
  const admin = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'isolation-service' } });
  const users: string[] = [];
  const clients: SupabaseClient[] = [];
  const files: string[] = [];
  async function insert(client: SupabaseClient, table: string, row: object) {
    const r = await client.from(table).insert(row).select().single();
    if (r.error) throw r.error;
    return r.data;
  }
  try {
    for (let i = 0; i < 2; i++) {
      const email = `club-isolation-${crypto.randomUUID()}@example.com`;
      const password = `${crypto.randomUUID()}Aa1!`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw created.error ?? new Error('Missing user');
      users.push(created.data.user.id);
      const granted = await admin.from('user_roles').insert({ user_id: created.data.user.id, role: 'admin' });
      if (granted.error) throw granted.error;
      const client = createClient(url, publicKey, { auth: { persistSession: false, autoRefreshToken: false, storageKey: `isolation-${i}` } });
      const signed = await client.auth.signInWithPassword({ email, password });
      if (signed.error) throw signed.error;
      clients.push(client);
    }
    const [first, second] = clients;
    if (!first || !second) throw new Error('Missing clients');
    const records = [];
    for (const [i, client] of clients.entries()) {
      const team = await insert(client, 'teams', { code: 'SAME-CODE', name: `Private team ${i}` });
      const club = await insert(client, 'clubs', { name: `Private club ${i}` });
      const athlete = await insert(client, 'athletes', { first_name: `Private athlete ${i}`, last_name: 'Test', tm_athlete_id: 'SAME-TM-ID', team_id: team.id });
      const meet = await client.rpc('resolve_import_identity', { p_kind: 'meet', p_data: { name: 'Same private meet', startDate: '2026-11-01', course: 'LCM' } });
      expect(meet.error).toBeNull();
      const again = await client.rpc('resolve_import_identity', { p_kind: 'meet', p_data: { name: 'Same private meet', startDate: '2026-11-01', course: 'LCM' } });
      expect(again.data).toBe(meet.data);
      const event = await insert(client, 'events', { meet_id: meet.data, distance: 100, stroke: 1 });
      const result = await insert(client, 'results', { meet_id: meet.data, event_id: event.id, athlete_id: athlete.id, final_time_ms: 60000 });
      await insert(client, 'meet_entries', { meet_id: meet.data, event_id: event.id, athlete_id: athlete.id, seed_time_ms: 61000 });
      await insert(client, 'splits', { result_id: result.id, split_distance: 50, cumulative_time_ms: 30000 });
      const path = `${club.id}/privacy-check.pdf`;
      const uploaded = await client.storage.from('club-documents').upload(path, new TextEncoder().encode('%PDF-test'), { contentType: 'application/pdf' });
      expect(uploaded.error).toBeNull(); files.push(path);
      await insert(client, 'club_documents', { club_id: club.id, file_name: 'privacy-check.pdf', storage_path: path });
      await insert(client, 'club_members', { club_id: club.id, first_name: `Private member ${i}` });
      records.push({ team, club, athlete, meet: meet.data, event });
    }
    const [a,b] = records;
    if (!a || !b) throw new Error('Missing records');
    expect(a.meet).not.toBe(b.meet);
    for (const table of ['meet_entries','teams','clubs','athletes','meets','events','results','splits','club_documents','club_members']) {
      const visible = await first.from(table).select('owner_id');
      expect(visible.error).toBeNull();
      expect(visible.data).toHaveLength(1);
      expect(visible.data?.[0]?.owner_id).toBe(users[0]);
    }
    expect((await first.from('athletes').select('id').eq('id',b.athlete.id)).data).toEqual([]);
    expect((await first.from('athletes').update({ first_name: 'forged' }).eq('id',b.athlete.id).select()).data).toEqual([]);
    expect((await first.from('athletes').insert({ owner_id: users[1], first_name: 'forged', last_name: 'test' })).error).not.toBeNull();
    expect((await first.from('athletes').update({ owner_id: users[1] }).eq('id',a.athlete.id)).error).not.toBeNull();
    expect((await first.from('athletes').insert({ first_name:'forged',last_name:'test',team_id:b.team.id })).error).not.toBeNull();
    expect((await first.from('events').insert({ meet_id:b.meet,distance:200,stroke:1 })).error).not.toBeNull();
    expect((await first.from('meet_entries').insert({ meet_id:b.meet,event_id:b.event.id,athlete_id:a.athlete.id })).error).not.toBeNull();
    expect((await first.from('meet_entries').insert({ meet_id:a.meet,event_id:b.event.id,athlete_id:a.athlete.id })).error).not.toBeNull();
    expect((await first.from('club_members').insert({ club_id:b.club.id,first_name:'forged' })).error).not.toBeNull();
    expect((await first.storage.from('club-documents').download(`${b.club.id}/privacy-check.pdf`)).error).not.toBeNull();
    const wrongUpload = await first.storage.from('club-documents').upload(`${b.club.id}/forged.pdf`,new TextEncoder().encode('%PDF'),{ contentType: 'application/pdf' });
    expect(wrongUpload.error).not.toBeNull(); expect(wrongUpload.error?.message ?? '').not.toMatch(/fetch failed/);
    const reset = await first.rpc('reset_management_data', { p_confirmation:'BORRAR TODO' });
    expect(reset.error).toBeNull();
    expect((await first.from('athletes').select('id')).data).toHaveLength(0);
    expect((await first.from('meet_entries').select('id')).data).toHaveLength(0);
    expect((await second.from('meet_entries').select('seed_time_ms')).data?.[0]?.seed_time_ms).toBe(61000);
    expect((await second.from('athletes').select('id')).data).toHaveLength(1);
    expect((await second.from('results').select('final_time_ms')).data?.[0]?.final_time_ms).toBe(60000);
    expect((await second.storage.from('club-documents').download(`${b.club.id}/privacy-check.pdf`)).error).toBeNull();
  } finally {
    if (files.length) await admin.storage.from('club-documents').remove(files);
    for (const id of users) {
      for (const table of tables) {
        const deleted = await admin.from(table).delete().eq('owner_id',id);
        if (deleted.error) throw deleted.error;
      }
      await admin.auth.admin.deleteUser(id);
    }
  }
}, 120000);