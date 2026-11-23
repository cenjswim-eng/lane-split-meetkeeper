import { Link, useLocation } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Users,
  CalendarDays,
  Building2,
  Upload,
  Waves,
  UserRound,
  ShieldCheck,
  MoreHorizontal,
  ArrowLeft,
  LogOut,
  ClipboardList,
  Medal,
  FileText,
  Layers,
  ChevronRight,
  Settings2,
  Trophy,
  BarChart3,
  Timer,
  Sliders,
  CalendarCheck,
  Target,
  Palette,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { WorkspaceTools } from "./workspace-tools";

const items = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  // 1. Mi Club y Atletas
  { to: "/clubs", label: "Club y Plantilla", icon: Building2 },
  { to: "/athletes", label: "Fichas de Atletas", icon: Users },
  { to: "/attendance", label: "Control de Asistencia", icon: CalendarCheck },
  { to: "/club", label: "Documentos y Staff", icon: FileText },
  // 2. Torneos y Competencias
  { to: "/meets", label: "Calendario de Torneos", icon: CalendarDays },
  { to: "/import", label: "Importar Archivos", icon: Upload },
  { to: "/entries", label: "Inscripciones", icon: ClipboardList },
  { to: "/relays", label: "Armador de Relevos", icon: Waves },
  { to: "/seeding", label: "Organizar Torneo", icon: Layers },
  { to: "/run", label: "Torneo en Vivo", icon: Timer },
  // 3. Rendimiento y Reportes
  { to: "/adael-2026", label: "Módulo ADAEL 2026", icon: ShieldCheck },
  { to: "/rankings", label: "Ranking Estadal", icon: Medal },
  { to: "/ranking-adael-2026", label: "Ranking ADAEL 2026", icon: Trophy },
  { to: "/standards", label: "Marcas Mínimas", icon: Target },
  { to: "/achievements", label: "Logros y Récords", icon: Medal },
  { to: "/reports", label: "Centro de Reportes", icon: BarChart3 },
  // 4. Configuración
  { to: "/brand", label: "Marca del Club", icon: Palette },
  { to: "/categories", label: "Categorías (31/12)", icon: Sliders },
  { to: "/profile", label: "Mi Perfil", icon: UserRound },
  { to: "/access", label: "Control de Accesos", icon: ShieldCheck },
] as const;

const groups = [
  { label: "General", paths: ["/dashboard"] },
  { label: "Mi Club y Atletas", paths: ["/clubs", "/athletes", "/attendance", "/club"] },
  { label: "Torneos y Competencias", paths: ["/meets", "/import", "/entries", "/relays", "/seeding", "/run"] },
  { label: "Rendimiento y Reportes", paths: ["/adael-2026", "/rankings", "/ranking-adael-2026", "/standards", "/achievements", "/reports"] },
  { label: "Configuración", paths: ["/brand", "/categories", "/profile", "/access"] },
];

export function AppNavigation({ name, logoUrl, onSignOut }: { name: string; logoUrl?: string | null; onSignOut: () => void }) {
  const [more, setMore] = useState(false);
  const { pathname } = useLocation();
  const current = items.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`));
  const group = groups.find((group) => group.paths.includes(current?.to ?? ""));

  function navigationItem(item: typeof items[number], mobile = false) {
    const Icon = item.icon;
    const active = current?.to === item.to;
    return (
      <Button
        key={item.to}
        asChild
        variant="ghost"
        className={`h-9 w-full justify-start gap-3 px-3 text-xs ${
          active
            ? "bg-sidebar-accent font-semibold text-primary"
            : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
        }`}
      >
        <Link
          to={item.to}
          aria-current={active ? "page" : undefined}
          onClick={() => {
            if (mobile) setMore(false);
          }}
        >
          <Icon className="size-4 shrink-0" />
          <span className="min-w-0 truncate">{item.label}</span>
          {active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}
        </Link>
      </Button>
    );
  }

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="border-b border-sidebar-border px-5 py-5">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-3 font-sans text-xl font-semibold">
            <Waves className="size-7 shrink-0 text-primary" />
            <span className="min-w-0 text-base font-bold">Swim Lane Coach</span>
          </Link>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Ecosistema de Natación para Clubes<br />Meet Manager · Team Manager
          </p>
        </div>

        <nav aria-label="Navegación principal" className="min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
          {groups.map((grp) =>
            grp.label === "General" ? (
              <div key={grp.label} className="space-y-1">
                {grp.paths.map((path) => {
                  const item = items.find((i) => i.to === path);
                  return item ? navigationItem(item) : null;
                })}
              </div>
            ) : (
              <details
                key={grp.label}
                open={grp.paths.includes(current?.to ?? "") || ["Mi Club y Atletas", "Torneos y Competencias"].includes(grp.label)}
                className="group"
              >
                <summary className="cursor-pointer rounded-md px-3 py-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors">
                  {grp.label}
                </summary>
                <div className="space-y-0.5 pt-1 pl-1">
                  {grp.paths.map((path) => {
                    const item = items.find((i) => i.to === path);
                    return item ? navigationItem(item) : null;
                  })}
                </div>
              </details>
            )
          )}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <Button asChild variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2">
            <Link to="/profile">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo del club" className="size-8 shrink-0 rounded-md border bg-card object-contain" />
              ) : (
                <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary">
                  <UserRound className="size-4" />
                </span>
              )}
              <span className="min-w-0 text-left">
                <span className="block truncate text-xs font-semibold">{name}</span>
                <span className="block text-[10px] text-muted-foreground">Cuenta Privada</span>
              </span>
              <Settings2 className="ml-auto size-4 text-muted-foreground" />
            </Link>
          </Button>
          <Button variant="ghost" className="mt-1 h-8 w-full justify-start text-xs text-muted-foreground" onClick={onSignOut}>
            <LogOut className="size-3.5 mr-2" />
            Cerrar sesión
          </Button>
        </div>
      </aside>

      <header className="sticky top-0 z-20 hidden items-center justify-between gap-4 border-b bg-background/95 px-8 backdrop-blur lg:ml-64 lg:block">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3">
          <div className="flex min-w-0 items-center gap-3 text-sm">
            <Button asChild variant="ghost" size="icon" aria-label="Volver">
              <Link to={pathname.startsWith("/athletes/") ? "/athletes" : group?.label === "Torneos y Competencias" ? "/meets" : "/dashboard"}>
                <ArrowLeft />
              </Link>
            </Button>
            <span className="text-muted-foreground">{group?.label ?? "Panel"}</span>
            <ChevronRight className="size-3.5 text-muted-foreground" />
            <span className="truncate font-medium">{current?.label ?? "Panel"}</span>
          </div>
          <Button asChild variant="ghost" className="max-w-64 gap-2">
            <Link to="/profile">
              {logoUrl ? <img src={logoUrl} alt="Logo del club" className="size-7 object-contain" /> : <UserRound />}
              <span className="truncate">{name}</span>
            </Link>
          </Button>
        </div>
        <WorkspaceTools />
      </header>

      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3">
          <Link to="/dashboard" className="flex min-w-0 items-center gap-2 font-display text-2xl font-bold">
            {logoUrl ? <img src={logoUrl} alt="Logo del club" className="size-8 shrink-0 object-contain" /> : <Waves className="size-6 shrink-0 text-primary" />}
            <span className="truncate text-lg">Swim Lane Coach</span>
          </Link>
          <Button variant="ghost" size="icon" title="Mi perfil" aria-label="Mi perfil" asChild>
            <Link to="/profile"><UserRound /></Link>
          </Button>
        </div>
        <WorkspaceTools />
        <div className="flex min-w-0 items-center gap-2 px-4 pb-2 text-xs">
          <Button asChild size="icon" variant="ghost" aria-label="Volver">
            <Link to={pathname.startsWith("/athletes/") ? "/athletes" : group?.label === "Torneos y Competencias" ? "/meets" : "/dashboard"}>
              <ArrowLeft />
            </Link>
          </Button>
          <span className="truncate text-muted-foreground">{group?.label} / {current?.label ?? "Inicio"}</span>
        </div>
      </header>

      <nav aria-label="Navegación móvil" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
        {items
          .filter((i) => ["/dashboard", "/clubs", "/meets", "/rankings"].includes(i.to))
          .map(({ to, label, icon: Icon }) => (
            <Button key={to} asChild variant="ghost" className="h-12 flex-col gap-1 px-1 text-[10px] text-muted-foreground">
              <Link to={to} activeProps={{ className: "bg-secondary text-primary" }}>
                <Icon className="size-5 shrink-0" />
                <span className="max-w-full truncate">
                  {label === "Club y Plantilla" ? "Club" : label === "Calendario de Torneos" ? "Torneos" : label === "Rankings AQUA" ? "Rankings" : label}
                </span>
              </Link>
            </Button>
          ))}
        <Dialog open={more} onOpenChange={setMore}>
          <DialogTrigger asChild>
            <Button variant="ghost" className="h-12 flex-col gap-1 px-1 text-[10px] text-muted-foreground">
              <MoreHorizontal className="size-5" />
              Más
            </Button>
          </DialogTrigger>
          <DialogContent aria-describedby={undefined} className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
            <DialogHeader>
              <DialogTitle>Ecosistema Swim Lane Coach</DialogTitle>
            </DialogHeader>
            <nav className="grid gap-4">
              {groups.map((grp) => (
                <div key={grp.label}>
                  <p className="mb-1 px-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">{grp.label}</p>
                  <div className="space-y-0.5">
                    {grp.paths.map((path) => {
                      const item = items.find((i) => i.to === path);
                      return item ? navigationItem(item, true) : null;
                    })}
                  </div>
                </div>
              ))}
              <Button variant="ghost" className="h-11 justify-start text-muted-foreground" onClick={() => { setMore(false); onSignOut(); }}>
                <LogOut className="mr-2 size-4" />
                Cerrar sesión
              </Button>
            </nav>
          </DialogContent>
        </Dialog>
      </nav>
    </>
  );
}
