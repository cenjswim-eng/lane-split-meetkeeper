import { createFileRoute, Outlet, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AppNavigation } from "@/components/app-navigation";
import { applyTheme } from "@/lib/profile-theme";
import { profileQuery } from "@/lib/profile";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    return { user: data.user, isAdmin: !!isAdmin };
  },
  component: Layout,
});

function Layout() {
  const { isAdmin, user } = Route.useRouteContext();
  const navigate = useNavigate();
  const router = useRouter();
  const { queryClient } = Route.useRouteContext();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
    router.invalidate();
  }

  const profile = useQuery({ ...profileQuery, enabled: isAdmin });
  useEffect(() => { applyTheme(profile.data?.settings ?? null); }, [profile.data?.settings]);
  useEffect(() => () => applyTheme(null), []);

  return (
    <div className="min-h-screen">
      <AppNavigation name={profile.data?.settings?.display_name || profile.data?.club?.name || "Entrenador"} logoUrl={profile.data?.logoUrl} onSignOut={signOut} />
      <main className="mx-auto min-w-0 max-w-[1500px] px-4 pb-24 pt-6 sm:px-8 lg:ml-56 lg:pb-10 lg:pt-10">
        {isAdmin ? (
          <Outlet />
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center">
            <h2 className="text-2xl font-bold uppercase">Sin permisos</h2>
            <p className="mt-2 text-muted-foreground">La cuenta {user.email} no tiene acceso activo. Si tu suscripción venció, contacta al dueño para reactivarla.</p>
          </div>
        )}
      </main>
    </div>
  );
}
