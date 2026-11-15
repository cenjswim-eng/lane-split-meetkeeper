import { createClient } from '@supabase/supabase-js';
import { expect, it } from 'vitest';

const url = process.env['SUPABASE_URL'];
const key = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const publicKey = process.env['SUPABASE_PUBLISHABLE_KEY'];

it.skipIf(!url || !key || !publicKey)('imports Meet Manager athletes/results without ambiguous JSON aliases and rolls back orphan results', async () => {
  if (!url || !key || !publicKey) return;
  const admin = createClient(url, key, { auth: { persistSession: false } });
  const email = `swim-import-${crypto.randomUUID()}@example.com`;
  const password = `${crypto.randomUUID()}Aa1!`;
  const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (created.error || !created.data.user) throw created.error ?? new Error('Test user missing');
  const owner = created.data.user.id;
  try {
    const role = await admin.from('user_roles').insert({ user_id: owner, role: 'admin' });
    if (role.error) throw role.error;
    const client = createClient(url, publicKey, { auth: { persistSession: false } });
    const login = await client.auth.signInWithPassword({ email, password });
    if (login.error) throw login.error;
    const payload = {
      meet: { name: `Copa regression ${crypto.randomUUID()}`, startDate: '2026-11-15', endDate: '2026-11-15', location: null, course: 'LCM' },
      format: 'HY3', fileName: 'Meet Results.zip', teams: [],
      athletes: [{ key: 'athlete-1', firstName: 'Ana', lastName: 'Prueba', birthDate: '2012-05-10', gender: 'F', tmId: '001', federationId: null, teamCode: null }],
      results: [{ athleteKey: 'athlete-1', eventNumber: '12', distance: 100, stroke: 1, gender: 'F', minAge: 14, maxAge: 15, course: 'LCM', finalMs: 62340, seedMs: 64000, round: 'F', status: 'OK', isDq: false, place: 1, splits: [{ distance: 50, cumulative_ms: 30000 }] }],
    };
    for (const format of ['HY3', 'SD3', 'CL2']) {
      const response = await client.rpc('import_meet_payload', { p_payload: { ...payload, format } });
      expect(response.error).toBeNull();
      expect(response.data).toMatchObject({ results: 1, splits: 1 });
    }
    expect((await client.from('athletes').select('id')).data).toHaveLength(1);
    const results = await client.from('results').select('final_time_ms,seed_time_ms');
    expect(results.error).toBeNull();
    expect(results.data).toEqual([{ final_time_ms: 62340, seed_time_ms: 64000 }]);
    expect((await client.from('splits').select('cumulative_time_ms')).data).toEqual([{ cumulative_time_ms: 30000 }]);
    const entryOnly = await client.rpc('import_meet_payload', { p_payload: { ...payload, fileName: 'Meet Program.zip', results: [{ ...payload.results[0], finalMs: null, seedMs: 63000, status: 'NT', splits: [] }] } });
    expect(entryOnly.error).toBeNull();
    expect((await client.from('results').select('final_time_ms,seed_time_ms')).data).toEqual([{ final_time_ms: 62340, seed_time_ms: 63000 }]);
    const rejected = await client.rpc('import_meet_payload', { p_payload: { ...payload, meet: { ...payload.meet, name: 'Orphan regression' }, results: [{ ...payload.results[0], athleteKey: 'missing-athlete' }] } });
    expect(rejected.error?.message).toContain('Resultado sin atleta');
    expect((await client.from('meets').select('id')).data).toHaveLength(1);
  } finally {
    for (const table of ['splits', 'results', 'meet_entries', 'club_meets', 'events', 'athletes', 'meets', 'teams', 'import_logs']) {
      const removed = await admin.from(table).delete().eq('owner_id', owner);
      if (removed.error) throw removed.error;
    }
    await admin.from('user_roles').delete().eq('user_id', owner);
    const removed = await admin.auth.admin.deleteUser(owner);
    if (removed.error) throw removed.error;
  }
}, 120000);