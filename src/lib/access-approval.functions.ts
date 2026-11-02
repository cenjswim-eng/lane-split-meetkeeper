import { createServerFn } from '@tanstack/react-start';
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware';
import { z } from 'zod';

export const requestAccess = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { data, error } = await context.supabase.rpc('request_app_access');
  if (error) throw error;
  const request = z.object({ id: z.string().optional(), email: z.string().optional(), status: z.string(), created: z.boolean() }).parse(data);
  if (!request.created || !request.id) return { status: request.status, notice: '' };
  // Recipients are resolved only on the server, never supplied by the requester.
  const { supabaseAdmin } = await import('@/integrations/supabase/client.server');
  const { data: owner, error: ownerError } = await supabaseAdmin.from('app_owner').select('user_id').single();
  if (ownerError || !owner) return { status: request.status, notice: 'La solicitud quedó guardada, pero no se pudo avisar al dueño por correo.' };
  const { data: account } = await supabaseAdmin.auth.admin.getUserById(owner.user_id);
  if (!account.user?.email) return { status: request.status, notice: 'La solicitud quedó guardada, pero el dueño no tiene correo disponible.' };
  try {
    const { sendTemplateEmail } = await import('./email-templates/send-email');
    const result = await sendTemplateEmail('access-request', account.user.email, { templateData: { email: request.email, reviewUrl: 'https://lane-split-meetkeeper.lovable.app/access' }, idempotencyKey: `access-request-${request.id}` });
    return { status: request.status, notice: result.sent ? '' : 'La solicitud quedó guardada; el dueño tiene desactivada la recepción de estos correos.' };
  } catch {
    return { status: request.status, notice: 'La solicitud quedó guardada, pero el aviso por correo no pudo enviarse. El dueño puede verla en Accesos.' };
  }
});

export const decideAccess = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), approve: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: owner, error: ownerError } = await context.supabase.rpc('is_app_owner');
    if (ownerError || !owner) throw new Error('Solo el dueño puede aprobar solicitudes');
    const { error } = await context.supabase.rpc('decide_app_access', { p_id: data.id, p_approve: data.approve });
    if (error) throw error;
    return { ok: true };
  });
export const suspendAccess = createServerFn({ method: 'POST' }).middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid(), suspend: z.boolean() }).parse(input))
  .handler(async ({ context, data }) => {
    const { data: owner, error: ownerError } = await context.supabase.rpc('is_app_owner');
    if (ownerError || !owner) throw new Error('Solo el dueño puede cambiar accesos');
    const { error } = await context.supabase.rpc('set_app_access_suspended', { p_id: data.id, p_suspend: data.suspend });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
