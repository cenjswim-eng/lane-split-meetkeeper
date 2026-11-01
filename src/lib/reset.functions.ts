import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { requireResetAdmin, validateResetConfirmation } from "./reset-policy";

export const resetManagementData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { confirmation: string }) => ({ confirmation: validateResetConfirmation(input.confirmation) }))
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (role.error) throw new Error("No se pudieron verificar los permisos.");
    requireResetAdmin(role.data);
    const clubs = await context.supabase.from('clubs').select('id');
    if (clubs.error) throw new Error('No se pudieron verificar tus documentos. No se borró ningún dato.');
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const result = await context.supabase.rpc("reset_management_data", { p_confirmation: data.confirmation });
    if (result.error) throw new Error('No se pudo completar el borrado. Tus documentos no fueron eliminados.');
    // Only captured, RLS-visible club prefixes may be cleaned. Never empty the shared bucket.
    const storage = supabaseAdmin.storage.from('club-documents');
    for (const club of clubs.data ?? []) {
      while (true) {
        const listed = await storage.list(club.id, { limit: 100 });
        if (listed.error) throw new Error('Tus registros se borraron, pero quedan archivos privados pendientes de limpieza.');
        const paths = (listed.data ?? []).filter(file => file.id).map(file => `${club.id}/${file.name}`);
        if (!paths.length) break;
        const removed = await storage.remove(paths);
        if (removed.error) throw new Error('Tus registros se borraron, pero quedan archivos privados pendientes de limpieza.');
      }
    }
    return { ok: true };
  });