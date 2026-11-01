import { createClient } from '@supabase/supabase-js';
import { expect, it } from 'vitest';

const url = process.env['SUPABASE_URL'];
const serviceKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
const publicKey = process.env['SUPABASE_PUBLISHABLE_KEY'];

it.skipIf(!url || !serviceKey || !publicKey)('requesters cannot read other requests, grant themselves roles, or approve accounts', async () => {
  if (!url || !serviceKey || !publicKey) return;
  const options = { auth: { persistSession: false, autoRefreshToken: false } };
  const admin = createClient(url, serviceKey, options);
  const users: string[] = [];
  try {
    const clients = [];
    for (let i = 0; i < 2; i++) {
      const email = `privacy-${crypto.randomUUID()}@example.com`;
      const password = `${crypto.randomUUID()}Aa1!`;
      const created = await admin.auth.admin.createUser({ email, password, email_confirm: true });
      if (created.error || !created.data.user) throw created.error ?? new Error('Missing test user');
      users.push(created.data.user.id);
      const client = createClient(url, publicKey, options);
      const signedIn = await client.auth.signInWithPassword({ email, password });
      if (signedIn.error) throw signedIn.error;
      const requested = await client.rpc('request_app_access');
      expect(requested.error).toBeNull();
      clients.push(client);
    }
    const first = clients[0];
    if (!first) throw new Error('Missing client');
    const visible = await first.from('access_requests').select('id,user_id,status');
    expect(visible.error).toBeNull();
    expect(visible.data).toHaveLength(1);
    expect(visible.data?.[0]?.user_id).toBe(users[0]);
    expect(visible.data?.[0]?.status).toBe('pending');
    const other = await admin.from('access_requests').select('id').eq('user_id', users[1]).single();
    const denied = await first.rpc('decide_app_access', { p_id: other.data?.id, p_approve: true });
    expect(denied.error).not.toBeNull();
    const escalation = await first.from('user_roles').insert({ user_id: users[0], role: 'admin' });
    expect(escalation.error).not.toBeNull();
    const role = await first.rpc('has_role', { _user_id: users[0], _role: 'admin' });
    expect(role.data).toBe(false);
    const anon = createClient(url, publicKey, options);
    expect((await anon.rpc('has_role', { _user_id: users[0], _role: 'admin' })).error).not.toBeNull();
    expect((await anon.rpc('request_app_access')).error).not.toBeNull();
    expect((await anon.from('access_requests').select('id')).data ?? []).toHaveLength(0);
  } finally {
    for (const id of users) {
      const removed = await admin.from('access_requests').delete().eq('user_id', id);
      if (removed.error) throw removed.error;
      const deleted = await admin.auth.admin.deleteUser(id);
      if (deleted.error) throw deleted.error;
    }
  }
}, 60000);