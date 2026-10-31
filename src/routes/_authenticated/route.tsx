import { createFileRoute, Link, Outlet, redirect, useNavigate, useRouter } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

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

  const link = "rounded px-3 py-1.5 text-sm font-medium uppercase tracking-wide text-muted-foreground hover:text-foreground";
  const active = { className: `${link} bg-secondary text-foreground` };

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-2 overflow-x-auto px-4 py-3">
          <Link to="/" className="mr-3 font-display text-xl font-bold uppercase">
            Natación <span className="text-accent">Pro</span>
          </Link>
          <Link to="/dashboard" className={link} activeProps={active}>Panel</Link>
          <Link to="/club" className={link} activeProps={active}>Mi club</Link>
          <Link to="/athletes" className={link} activeProps={active}>Atletas</Link>
          <Link to="/meets" className={link} activeProps={active}>Competencias</Link>
          <Link to="/relays" className={link} activeProps={active}>Relevos</Link>
          <Link to="/import" className={link} activeProps={active}>Importar</Link>
          <Button variant="ghost" size="sm" className="ml-auto" onClick={signOut}>Salir</Button>
        </div>
        <div className="lane-line" />
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">
        {isAdmin ? (
          <Outlet />
        ) : (
          <div className="rounded-lg border bg-card p-8 text-center">
            <h2 className="text-2xl font-bold uppercase">Sin permisos</h2>
            <p className="mt-2 text-muted-foreground">La cuenta {user.email} no es administradora.</p>
          </div>
        )}
      </main>
    </div>
  );
}
