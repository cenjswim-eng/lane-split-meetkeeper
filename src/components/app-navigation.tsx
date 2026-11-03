import { Link } from "@tanstack/react-router";
import { LayoutDashboard, Users, CalendarDays, Building2, Upload, Waves, UserRound, ShieldCheck, MoreHorizontal, LogOut, ClipboardList, Medal, FileText, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";

const items = [
  { to: "/dashboard", label: "Panel", icon: LayoutDashboard },
  { to: "/athletes", label: "Atletas", icon: Users },
  { to: "/meets", label: "Competencias", icon: CalendarDays },
  { to: "/club", label: "Mi club", icon: Building2 },
  { to: "/import", label: "Importar", icon: Upload },
  { to: "/entries", label: "Inscripciones", icon: ClipboardList },
  { to: "/standards", label: "Mínimas", icon: Medal },
  { to: "/categories", label: "Categorías", icon: Layers },
  { to: "/reports", label: "Reportes", icon: FileText },
  { to: "/relays", label: "Relevos", icon: Waves },
  { to: "/profile", label: "Mi perfil", icon: UserRound },
  { to: "/access", label: "Accesos", icon: ShieldCheck },
] as const;

export function AppNavigation({ name, logoUrl, onSignOut }: { name: string; logoUrl?: string | null; onSignOut: () => void }) {
  const [more, setMore] = useState(false);
  return <>
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-56 flex-col border-r bg-sidebar px-4 py-6 lg:flex">
      <Link to="/dashboard" className="flex min-w-0 items-center gap-2 font-display text-3xl font-bold">{logoUrl ? <img src={logoUrl} alt="Logo del club" className="size-9 shrink-0 object-contain" /> : <Waves className="size-7 shrink-0 text-primary" />}<span>Natacion <span className="text-accent">pro</span></span></Link>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Compatible con Meet Manager y Team Manager</p>
      <div className="lane-line my-6" />
      <nav aria-label="Navegación principal" className="space-y-1">
        {items.map(({ to, label, icon: Icon }) => <Button key={to} asChild variant="ghost" className="h-11 w-full justify-start text-sidebar-foreground"><Link to={to} activeProps={{ className: "bg-sidebar-accent text-primary" }}><Icon />{label}</Link></Button>)}
      </nav>
      <div className="mt-auto border-t pt-5"><p className="truncate text-sm font-medium">{name}</p><p className="mt-1 text-xs text-muted-foreground">Cuenta privada</p><Button variant="ghost" className="mt-3 w-full justify-start text-muted-foreground" onClick={onSignOut}><LogOut />Salir</Button></div>
    </aside>
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur lg:hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"><Link to="/dashboard" className="flex min-w-0 items-center gap-2 font-display text-2xl font-bold">{logoUrl ? <img src={logoUrl} alt="Logo del club" className="size-8 shrink-0 object-contain" /> : <Waves className="size-6 shrink-0 text-primary" />}<span className="truncate">Natacion <span className="text-accent">pro</span></span></Link><Button variant="ghost" size="icon" title="Mi perfil" aria-label="Mi perfil" asChild><Link to="/profile"><UserRound /></Link></Button></div>
      <div className="lane-line" />
    </header>
    <nav aria-label="Navegación móvil" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
      {items.slice(0, 4).map(({ to, label, icon: Icon }) => <Button key={to} asChild variant="ghost" className="h-12 flex-col gap-1 px-1 text-[10px] text-muted-foreground"><Link to={to} activeProps={{ className: "bg-secondary text-primary" }}><Icon className="size-5" />{label}</Link></Button>)}
      <Dialog open={more} onOpenChange={setMore}><DialogTrigger asChild><Button variant="ghost" className="h-12 flex-col gap-1 px-1 text-[10px] text-muted-foreground"><MoreHorizontal className="size-5" />Más</Button></DialogTrigger><DialogContent aria-describedby={undefined} className="w-[calc(100%-2rem)] rounded-lg"><DialogHeader><DialogTitle>Natacion pro</DialogTitle></DialogHeader><nav className="grid gap-1">{items.slice(4).map(({ to, label, icon: Icon }) => <Button key={to} asChild variant="ghost" className="h-12 justify-start"><Link to={to} onClick={() => setMore(false)}><Icon />{label}</Link></Button>)}<Button variant="ghost" className="h-12 justify-start" onClick={() => { setMore(false); onSignOut(); }}><LogOut />Salir</Button></nav></DialogContent></Dialog>
    </nav>
  </>;
}
