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
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const files = await supabaseAdmin.storage.emptyBucket("club-documents");
    if (files.error) throw new Error("No se pudieron eliminar los documentos. No se ha borrado el registro.");
    const result = await context.supabase.rpc("reset_management_data", { p_confirmation: data.confirmation });
    if (result.error) throw new Error("No se pudo completar el borrado del registro. Los documentos ya fueron eliminados; vuelve a intentarlo.");
    return { ok: true };
  });