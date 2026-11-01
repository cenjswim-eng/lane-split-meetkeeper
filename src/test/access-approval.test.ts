import { beforeEach, describe, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ rpc: vi.fn(), send: vi.fn(), owner: vi.fn(), account: vi.fn() }));
vi.mock('@tanstack/react-start', () => ({ createServerFn: () => {
  const builder = { middleware: () => builder, inputValidator: () => builder, handler: (handler: unknown) => handler };
  return builder;
} }));
vi.mock('@/integrations/supabase/auth-middleware', () => ({ requireSupabaseAuth: {} }));
vi.mock('@/integrations/supabase/client.server', () => ({ supabaseAdmin: { from: () => ({ select: () => ({ single: mocks.owner }) }), auth: { admin: { getUserById: mocks.account } } } }));
vi.mock('@/lib/email-templates/send-email', () => ({ sendTemplateEmail: mocks.send }));
import { decideAccess, requestAccess } from '@/lib/access-approval.functions';
const context = { userId: 'user', supabase: { rpc: mocks.rpc } };
const decide = decideAccess as unknown as (args: { context: typeof context; data: { id: string; approve: boolean } }) => Promise<unknown>;
const request = requestAccess as unknown as (args: { context: typeof context }) => Promise<unknown>;
beforeEach(() => vi.resetAllMocks());
describe('owner approval rules', () => {
  it('ordinary administrators cannot approve accounts', async () => {
    mocks.rpc.mockResolvedValue({ data: false, error: null });
    await expect(decide({ context, data: { id: 'request', approve: true } })).rejects.toThrow('Solo el dueño');
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
  it('only an owner can request an atomic approval', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: true, error: null }).mockResolvedValueOnce({ error: null });
    await expect(decide({ context, data: { id: 'request', approve: true } })).resolves.toEqual({ ok: true });
    expect(mocks.rpc).toHaveBeenLastCalledWith('decide_app_access', { p_id: 'request', p_approve: true });
  });
  it('sends a new request only to the server-resolved owner', async () => {
    mocks.rpc.mockResolvedValue({ data: { id: 'request-1', email: 'requester@example.com', status: 'pending', created: true }, error: null });
    mocks.owner.mockResolvedValue({ data: { user_id: 'owner' }, error: null });
    mocks.account.mockResolvedValue({ data: { user: { email: 'owner@example.com' } } });
    mocks.send.mockResolvedValue({ sent: true });
    await expect(request({ context })).resolves.toEqual({ status: 'pending', notice: '' });
    expect(mocks.account).toHaveBeenCalledWith('owner');
    expect(mocks.send).toHaveBeenCalledWith('access-request', 'owner@example.com', { templateData: { email: 'requester@example.com', reviewUrl: 'https://lane-split-meetkeeper.lovable.app/access' }, idempotencyKey: 'access-request-request-1' });
  });
  it('repeated requests never send duplicate owner emails', async () => {
    mocks.rpc.mockResolvedValue({ data: { id: 'request-1', status: 'pending', created: false }, error: null });
    await request({ context });
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it('a failed email does not grant access or lose the pending request', async () => {
    mocks.rpc.mockResolvedValue({ data: { id: 'request-1', status: 'pending', created: true }, error: null });
    mocks.owner.mockResolvedValue({ data: { user_id: 'owner' }, error: null });
    mocks.account.mockResolvedValue({ data: { user: { email: 'owner@example.com' } } });
    mocks.send.mockRejectedValue(new Error('Unavailable'));
    expect(await request({ context })).toMatchObject({ status: 'pending' });
    expect(mocks.rpc).toHaveBeenCalledTimes(1);
  });
});