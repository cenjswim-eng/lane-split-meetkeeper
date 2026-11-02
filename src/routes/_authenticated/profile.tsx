import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ImagePlus, RotateCcw, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { profileQuery } from "@/lib/profile";
import { DEFAULT_THEME, applyTheme, isHexColor } from "@/lib/profile-theme";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({ meta: [{ title: "Mi perfil — Natación Pro" }, { name: "description", content: "Personaliza los colores de tu espacio y el logo de tu club." }, { property: "og:title", content: "Mi perfil — Natación Pro" }, { property: "og:description", content: "Colores personalizados y logo del club." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }] }),
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
    setBusy(true);
    const r = await supabase.from("profile_settings").upsert({ user_id: data.userId!, display_name: name.trim(), primary_color: primary, accent_color: accent, updated_at: new Date().toISOString() });
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

  return <div className="max-w-3xl space-y-8">
    <header><h1 className="text-4xl font-bold uppercase">Mi perfil</h1><p className="text-muted-foreground">Personaliza tu espacio. Solo tú ves estos ajustes.</p></header>
    <form onSubmit={save} className="space-y-5 rounded-lg border bg-card p-6">
      <h2 className="text-2xl font-semibold uppercase">Colores</h2>
      <div><Label htmlFor="display-name">Nombre para mostrar</Label><Input id="display-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} placeholder="Ej. Entrenador Juan" /></div>
      <div className="grid gap-4 sm:grid-cols-2">
        {([["Color principal", primary, setPrimary], ["Color de acento", accent, setAccent]] as const).map(([label, val, set]) => <div key={label}><Label>{label}</Label><div className="mt-1 flex items-center gap-2"><input type="color" aria-label={label} value={val} onChange={(e) => set(e.target.value)} className="h-10 w-14 cursor-pointer rounded border bg-transparent" /><Input value={val} onChange={(e) => set(e.target.value)} className="time" /></div></div>)}
      </div>
      <div className="flex flex-wrap items-center gap-3 rounded border p-4"><span className="text-sm text-muted-foreground">Vista previa:</span><Button type="button">Botón principal</Button><span className="font-display text-xl font-bold uppercase">Natación <span className="text-accent">Pro</span></span></div>
      <div className="flex gap-2"><Button disabled={busy} type="submit"><Save className="mr-2 size-4" />Guardar</Button><Button type="button" variant="outline" onClick={() => { setPrimary(DEFAULT_THEME.primary_color); setAccent(DEFAULT_THEME.accent_color); }}><RotateCcw className="mr-2 size-4" />Colores originales</Button></div>
    </form>
    <section className="space-y-4 rounded-lg border bg-card p-6">
      <h2 className="text-2xl font-semibold uppercase">Logo del club</h2>
      {!data.club ? <p className="text-sm text-muted-foreground">Primero crea tu club en “Mi club”.</p> : <div className="flex flex-wrap items-center gap-6">
        <div className="flex size-28 items-center justify-center overflow-hidden rounded-lg border bg-background">{data.logoUrl ? <img src={data.logoUrl} alt={`Logo de ${data.club.name}`} className="size-full object-contain" /> : <span className="text-xs text-muted-foreground">Sin logo</span>}</div>
        <div className="space-y-2"><p className="font-medium">{data.club.name}</p><Label htmlFor="logo" className="inline-flex cursor-pointer items-center rounded-md border px-3 py-2 text-sm"><ImagePlus className="mr-2 size-4" />{data.logoUrl ? "Cambiar logo" : "Subir logo"}</Label><input id="logo" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" className="sr-only" disabled={busy} onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadLogo(f); e.target.value = ""; }} /><p className="text-xs text-muted-foreground">PNG, JPG, WEBP o SVG · máx. 2 MB. Aparece en la barra superior.</p></div>
      </div>}
    </section>
  </div>;
}
