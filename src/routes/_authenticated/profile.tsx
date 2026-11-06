import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ImagePlus, RotateCcw, Save, UserRound, Palette, Check, Waves } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/profile";
import { DEFAULT_THEME, applyTheme, isHexColor } from "@/lib/profile-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Mi perfil — Natacion pro" }, { name: "description", content: "Personaliza los colores de tu espacio y el logo de tu club." }, { property: "og:title", content: "Mi perfil — Natacion pro" }, { name: "twitter:title", content: "Mi perfil — Natacion pro" }, { property: "og:description", content: "Colores personalizados y logo del club." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(profileQuery),
  component: ProfilePage,
});

function ProfilePage() {
  const { data } = useSuspenseQuery(profileQuery);
  const qc = useQueryClient();
  const [name, setName] = useState(data.settings?.display_name ?? "");
  const [primary, setPrimary] = useState(data.settings?.primary_color ?? DEFAULT_THEME.primary_color);
  const [accent, setAccent] = useState(data.settings?.accent_color ?? DEFAULT_THEME.accent_color);
  const [busy, setBusy] = useState(false);
  useEffect(() => { applyTheme({ primary_color: primary, accent_color: accent }); }, [primary, accent]);
  useEffect(() => () => { qc.invalidateQueries({ queryKey: ["profile-settings"] }); }, [qc]);

  async function save(e: React.FormEvent) {
    e.preventDefault(); if (!isHexColor(primary) || !isHexColor(accent)) { toast.error("Color no válido"); return; }
    if (!data.userId) { toast.error("Inicia sesión nuevamente para guardar tu perfil"); return; }
    setBusy(true);
    const r = await supabase.from("profile_settings").upsert({ user_id: data.userId, display_name: name.trim(), primary_color: primary, accent_color: accent, updated_at: new Date().toISOString() });
    setBusy(false); if (r.error) { toast.error(r.error.message); return; }
    await qc.invalidateQueries({ queryKey: ["profile-settings"] }); toast.success("Perfil guardado");
  }
  async function uploadLogo(file: File) {
    if (!data.club) return;
    if (!/^image\/(png|jpeg|webp|svg\+xml)$/.test(file.type) || file.size > 2_000_000) { toast.error("Usa PNG, JPG, WEBP o SVG de hasta 2 MB"); return; }
    setBusy(true);
    try {
      const path = `${data.club.id}/logo-${crypto.randomUUID()}`;
      const up = await supabase.storage.from("club-documents").upload(path, file, { contentType: file.type }); if (up.error) throw up.error;
      const r = await supabase.from("clubs").update({ logo_path: path }).eq("id", data.club.id); if (r.error) throw r.error;
      if (data.club.logo_path) await supabase.storage.from("club-documents").remove([data.club.logo_path]);
      await qc.invalidateQueries({ queryKey: ["profile-settings"] }); toast.success("Logo actualizado");
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }

  return <div className="max-w-5xl space-y-8">
    <header><p className="mb-2 text-xs font-medium text-primary">MI CUENTA</p><h1>Mi perfil</h1><p className="mt-2 text-sm text-muted-foreground">{data.club?.name ?? "Entrenador"} · Cuenta privada</p></header>
    <div className="grid items-start gap-10 xl:grid-cols-[minmax(0,1fr)_280px]">
    <form onSubmit={save} className="min-w-0 space-y-8">
      <section className="space-y-5"><h2 className="flex items-center gap-3"><UserRound className="size-5 text-primary" />Identidad</h2><div className="space-y-2"><Label htmlFor="display-name">Nombre para mostrar</Label><Input id="display-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Ej. Entrenador Juan" /></div></section>
      <section className="space-y-5 border-t pt-7"><h2 className="flex items-center gap-3"><Palette className="size-5 text-primary" />Colores de mi espacio</h2>
      <div className="flex flex-wrap gap-3" role="group" aria-label="Combinaciones de colores">{[["pool", "Piscina"], ["forest", "Bosque"], ["coral", "Coral"]].map(([id, label]) => <Button key={id} type="button" variant="outline" aria-label={`Usar colores ${label}`} title={label} className={`theme-${id} h-12 gap-2 bg-card px-3 hover:bg-secondary hover:text-foreground`} onClick={() => { const style = getComputedStyle(document.documentElement); const p = style.getPropertyValue(`--preset-${id}-primary`).trim(); const a = style.getPropertyValue(`--preset-${id}-accent`).trim(); if (isHexColor(p) && isHexColor(a)) { setPrimary(p); setAccent(a); } }}><span className="theme-swatch-primary size-5 rounded-full border" /><span className="theme-swatch-accent size-5 rounded-full border" /><span className="text-xs">{label}</span></Button>)}</div>
      <div className="grid gap-4 sm:grid-cols-2">
        {([["Color principal", primary, setPrimary], ["Color de acento", accent, setAccent]] as const).map(([label, val, set], index) => <div key={label} className="space-y-2"><Label htmlFor={`profile-color-${index}`}>{label}</Label><div className="flex items-center gap-2"><input type="color" aria-label={label} value={isHexColor(val) ? val : DEFAULT_THEME.primary_color} onChange={(e) => set(e.target.value)} className="h-11 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent p-1" /><Input id={`profile-color-${index}`} aria-label={`Código de ${label.toLowerCase()}`} value={val} maxLength={7} onChange={(e) => set(e.target.value)} className="time min-w-0" /></div></div>)}
      </div></section>
      <section className="space-y-5 border-t pt-7"><h2 className="flex items-center gap-3"><ImagePlus className="size-5 text-primary" />Logo del club</h2>
      {!data.club ? <p className="text-sm text-muted-foreground">Primero crea tu club en “Mi club”.</p> : <div className="flex flex-wrap items-center gap-5">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-md border bg-card">{data.logoUrl ? <img src={data.logoUrl} alt={`Logo de ${data.club.name}`} className="size-full object-contain" /> : <Waves className="size-8 text-muted-foreground" />}</div>
        <div className="min-w-0 space-y-2"><p className="break-words font-medium">{data.club.name}</p><Button type="button" variant="outline" disabled={busy} onClick={() => document.getElementById("logo")?.click()}><ImagePlus />{data.logoUrl ? "Cambiar logo" : "Subir logo"}</Button><input id="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} /><p className="text-xs text-muted-foreground">PNG, JPG, WEBP o SVG · máx. 2 MB</p></div>
      </div>}</section>
      <div className="flex flex-wrap gap-3 border-t pt-6"><Button disabled={busy} type="submit" className="h-11"><Save />{busy ? "Guardando…" : "Guardar cambios"}</Button><Button type="button" variant="ghost" className="h-11 text-muted-foreground" onClick={() => { setPrimary(DEFAULT_THEME.primary_color); setAccent(DEFAULT_THEME.accent_color); }}><RotateCcw />Restaurar colores</Button></div>
    </form>
    <aside className="min-w-0 border-t pt-6 xl:border-l xl:border-t-0 xl:pl-8 xl:pt-0" aria-label="Vista previa del perfil"><p className="mb-4 text-xs font-medium text-muted-foreground">VISTA PREVIA</p><div className="overflow-hidden rounded-lg border bg-card"><div className="flex items-center gap-3 border-b p-5">{data.logoUrl ? <img src={data.logoUrl} alt="Logo del club en vista previa" className="size-10 object-contain" /> : <Waves className="size-8 shrink-0 text-primary" />}<div className="min-w-0"><p className="break-words font-semibold">{name.trim() || "Entrenador"}</p><p className="mt-1 break-words text-xs text-muted-foreground">{data.club?.name ?? "Mi club"}</p></div></div><div className="space-y-4 p-5"><p className="text-lg font-semibold">Natacion <span className="text-accent">pro</span></p><div className="flex items-center gap-2 text-sm text-primary"><Check className="size-4" />Cuenta privada</div><div className="h-1 rounded-full bg-primary" /><div className="h-1 w-2/3 rounded-full bg-accent" /></div></div></aside>
    </div>
  </div>;
}
