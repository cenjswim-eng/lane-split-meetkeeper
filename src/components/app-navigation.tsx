import { Link, useLocation } from "@tanstack/react-router";
import { LayoutDashboard, Users, CalendarDays, Building2, Upload, Waves, UserRound, ShieldCheck, MoreHorizontal, ArrowLeft, LogOut, ClipboardList, Medal, FileText, Layers, ChevronRight, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogHeader, DialogTrigger } from "@/components/ui/dialog";
import { useState } from "react";
import { WorkspaceTools } from "./workspace-tools";

const items = [
  { to: "/dashboard", label: "Inicio", icon: LayoutDashboard },
  { to: "/athletes", label: "Atletas", icon: Users },
  { to: "/meets", label: "Competencias", icon: CalendarDays },
  { to: "/clubs", label: "Club", icon: Building2 },
  { to: "/rankings", label: "Rankings", icon: Medal },
  { to: "/achievements", label: "Logros", icon: Medal },
  { to: "/seeding", label: "Organizar torneo", icon: Layers },
  { to: "/run", label: "Torneo en vivo", icon: Waves },
  { to: "/club", label: "Registro del club", icon: FileText },
  { to: "/import", label: "Importar", icon: Upload },
  { to: "/entries", label: "Inscripciones", icon: ClipboardList },
  { to: "/standards", label: "Marcas mínimas", icon: Medal },
  { to: "/categories", label: "Categorías", icon: Layers },
  { to: "/reports", label: "Reportes", icon: FileText },
  { to: "/relays", label: "Relevos", icon: Waves },
  { to: "/profile", label: "Mi perfil", icon: UserRound },
  { to: "/access", label: "Accesos", icon: ShieldCheck },
] as const;

const groups = [
 {label:"Principal",paths:["/dashboard","/athletes","/meets","/standards","/rankings","/achievements","/reports","/clubs"]},
 {label:"Competencias",paths:["/import","/entries","/relays","/seeding","/run"]},
 {label:"Club y configuración",paths:["/club","/categories","/profile","/access"]},
];

export function AppNavigation({ name, logoUrl, onSignOut }: { name: string; logoUrl?: string | null; onSignOut: () => void }) {
  const [more, setMore] = useState(false);
  const { pathname } = useLocation();
  const current = items.find(item => pathname === item.to || pathname.startsWith(`${item.to}/`));
  const group = groups.find(group => group.paths.includes(current?.to ?? ""));
  function navigationItem(item: typeof items[number], mobile = false) {
    const Icon = item.icon;
    const active = current?.to === item.to;
    return <Button key={item.to} asChild variant="ghost" className={`h-10 w-full justify-start gap-3 px-3 ${active ? "bg-sidebar-accent text-primary" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"}`}><Link to={item.to} aria-current={active ? "page" : undefined} onClick={() => { if (mobile) setMore(false); }}><Icon className="size-4 shrink-0" /><span className="min-w-0 truncate">{item.label}</span>{active && <span className="ml-auto size-1.5 rounded-full bg-primary" />}</Link></Button>;
  }
  return <>
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="border-b border-sidebar-border px-5 py-6"><Link to="/dashboard" className="flex min-w-0 items-center gap-3 font-sans text-xl font-semibold"><Waves className="size-7 shrink-0 text-primary" /><span className="min-w-0 text-base">Swim Lane Coach</span></Link>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">Compatible con Meet Manager<br />y Team Manager</p></div>
      <nav aria-label="Navegación principal" className="min-h-0 flex-1 space-y-5 overflow-y-auto px-3 py-5">
        {groups.map(group => group.label==='Principal'?<div key={group.label} className="space-y-1">{group.paths.map(path=>{const item=items.find(i=>i.to===path);return item?navigationItem(item):null;})}</div>:<details key={group.label} open={group.paths.includes(current?.to??'')}><summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-muted-foreground">{group.label}</summary>{group.paths.map(path=>{const item=items.find(i=>i.to===path);return item?navigationItem(item):null;})}</details>)}
      </nav>
      <div className="border-t border-sidebar-border p-4"><Button asChild variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2"><Link to="/profile">{logoUrl ? <img src={logoUrl} alt="Logo del club" className="size-9 shrink-0 rounded-md border bg-card object-contain" /> : <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-primary"><UserRound /></span>}<span className="min-w-0 text-left"><span className="block truncate text-sm font-medium">{name}</span><span className="mt-0.5 block text-xs font-normal text-muted-foreground">Cuenta privada</span></span><Settings2 className="ml-auto text-muted-foreground" /></Link></Button><Button variant="ghost" className="mt-2 h-9 w-full justify-start text-muted-foreground" onClick={onSignOut}><LogOut />Cerrar sesión</Button></div>
    </aside>
    <header className="sticky top-0 z-20 hidden items-center justify-between gap-4 border-b bg-background/95 px-8 backdrop-blur lg:ml-64 lg:block">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 py-3"><div className="flex min-w-0 items-center gap-3 text-sm"><Button asChild variant="ghost" size="icon" aria-label="Volver"><Link to={pathname.startsWith("/athletes/")?"/athletes":group?.label==="Competencias"?"/meets":"/dashboard"}><ArrowLeft/></Link></Button><span className="text-muted-foreground">{group?.label ?? "Mi club"}</span><ChevronRight className="size-3.5 text-muted-foreground" /><span className="truncate font-medium">{current?.label ?? "Panel"}</span></div>
      <Button asChild variant="ghost" className="max-w-64 gap-2"><Link to="/profile">{logoUrl ? <img src={logoUrl} alt="Logo del club" className="size-7 object-contain" /> : <UserRound />}<span className="truncate">{name}</span></Link></Button>
      </div><WorkspaceTools/>
    </header>
    <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur lg:hidden">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 py-3"><Link to="/dashboard" className="flex min-w-0 items-center gap-2 font-display text-2xl font-bold">{logoUrl ? <img src={logoUrl} alt="Logo del club" className="size-8 shrink-0 object-contain" /> : <Waves className="size-6 shrink-0 text-primary" />}<span className="truncate text-lg">Swim Lane Coach</span></Link><Button variant="ghost" size="icon" title="Mi perfil" aria-label="Mi perfil" asChild><Link to="/profile"><UserRound /></Link></Button></div>
      <WorkspaceTools/>
      <div className="flex min-w-0 items-center gap-2 px-4 pb-2 text-xs"><Button asChild size="icon" variant="ghost" aria-label="Volver"><Link to={pathname.startsWith('/athletes/')?'/athletes':group?.label==='Competencias'?'/meets':'/dashboard'}><ArrowLeft/></Link></Button><span className="truncate text-muted-foreground">{group?.label} / {current?.label??'Inicio'}</span></div>
    </header>
    <nav aria-label="Navegación móvil" className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t bg-background/95 px-1 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur lg:hidden">
      {items.filter(i=>["/dashboard","/athletes","/meets","/standards"].includes(i.to)).map(({ to, label, icon: Icon }) => <Button key={to} asChild variant="ghost" className="h-12 flex-col gap-1 px-1 text-[10px] text-muted-foreground"><Link to={to} activeProps={{ className: "bg-secondary text-primary" }}><Icon className="size-5 shrink-0" /><span className="max-w-full truncate">{label==='Marcas mínimas'?'Mínimas':label}</span></Link></Button>)}
      <Dialog open={more} onOpenChange={setMore}><DialogTrigger asChild><Button variant="ghost" className="h-12 flex-col gap-1 px-1 text-[10px] text-muted-foreground"><MoreHorizontal className="size-5" />Más</Button></DialogTrigger><DialogContent aria-describedby={undefined} className="max-h-[85dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg"><DialogHeader><DialogTitle>Todos los paneles</DialogTitle></DialogHeader><nav className="grid gap-5">{groups.map(group => <div key={group.label}><p className="mb-1 px-3 text-xs font-semibold text-muted-foreground">{group.label}</p>{group.paths.map(path => { const item = items.find(item => item.to === path); return item ? navigationItem(item, true) : null; })}</div>)}<Button variant="ghost" className="h-11 justify-start text-muted-foreground" onClick={() => { setMore(false); onSignOut(); }}><LogOut />Cerrar sesión</Button></nav></DialogContent></Dialog>
    </nav>
  </>;
}
