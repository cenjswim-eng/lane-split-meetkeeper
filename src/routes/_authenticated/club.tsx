import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Download, Pencil, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables, Json } from "@/integrations/supabase/types";
import { MEMBER_ROLES, type MemberDraft, type MemberRole } from "@/lib/club";
import { downloadFile } from "@/lib/file-delivery";
import { ClubAccessImport } from "@/components/club-access-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { PdfExport } from "@/components/pdf-export";
import { clubRosterPdf } from "@/lib/reports";
import { ClubPdfImport } from "@/components/club-pdf-import";

const clubQuery = queryOptions({ queryKey: ["club-register"], queryFn: async () => {
  const [clubs, members, documents] = await Promise.all([supabase.from("clubs").select("*").order("created_at"), supabase.from("club_members").select("*").order("last_name"), supabase.from("club_documents").select("*").order("uploaded_at", { ascending: false })]);
  for (const r of [clubs, members, documents]) if (r.error) throw r.error;
  return { clubs: clubs.data ?? [], members: members.data ?? [], documents: documents.data ?? [] };
} });
export const Route = createFileRoute("/_authenticated/club")({
  validateSearch: (search: Record<string, unknown>): { club?: string | undefined } => ({ club: typeof search["club"] === "string" ? search["club"] : undefined }),
  head: () => ({ meta: [{ title: "Mi club — Swim Lane Coach" }, { name: "description", content: "Documentos Access y registro actualizado de nadadores, entrenadores, directivos y personal." }, { property: "og:title", content: "Mi club — Swim Lane Coach" }, { name: "twitter:title", content: "Mi club — Swim Lane Coach" }, { property: "og:description", content: "Registro de todos los integrantes y documentos privados del club." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(clubQuery), component: ClubPage,
});
const emptyMember = (): MemberDraft => ({ first_name: "", last_name: "", member_role: "nadador", birth_date: null, email: null, phone: null, active: true, notes: "", source_key: null });

function ClubPage() {
  const { data } = useSuspenseQuery(clubQuery);
  const qc = useQueryClient();
  const search = Route.useSearch();
  const [selected, setSelected] = useState(search.club ?? "");
  const club = data.clubs.find((c) => c.id === selected) ?? data.clubs[0];
  const [newName, setNewName] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState("all");
  const [editing, setEditing] = useState<Tables<"club_members"> | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MemberDraft>(emptyMember);
  const [saving, setSaving] = useState(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["club-register"] });
  const members = data.members.filter((m) => m.club_id === club?.id);
  const documents = data.documents.filter((d) => d.club_id === club?.id);
  const filtered = members.filter((m) => (filter === "all" || m.member_role === filter) && (status === "all" || m.active === (status === "active")) && `${m.first_name} ${m.last_name} ${m.email ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  async function createClub(e: React.FormEvent) {
    e.preventDefault(); if (!newName.trim()) return; setSaving(true);
    try { const r = await supabase.from("clubs").insert({ name: newName.trim() }).select("id").single(); if (r.error) throw r.error; setSelected(r.data.id); setNewName(""); await refresh(); } catch(e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }
  async function saveMember(e: React.FormEvent) {
    e.preventDefault(); if (!club || !draft.first_name.trim()) return; setSaving(true);
    try { const values = { ...draft, first_name: draft.first_name.trim(), club_id: club.id, updated_at: new Date().toISOString() }; const r = editing ? await supabase.from("club_members").update(values).eq("id", editing.id).eq("club_id", club.id) : await supabase.from("club_members").insert(values); if (r.error) throw r.error; setOpen(false); await refresh(); toast.success("Integrante actualizado"); } catch(e) { toast.error((e as Error).message); } finally { setSaving(false); }
  }
  return <div className="min-w-0 space-y-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-4xl font-bold uppercase">Mi club</h1><p className="text-muted-foreground">{club?.name ?? "Registro de integrantes"}</p></div>{club && <Select value={club.id} onValueChange={setSelected}><SelectTrigger className="w-56" aria-label="Club gestionado"><SelectValue /></SelectTrigger><SelectContent>{data.clubs.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>}</header>
    {!club ? <form onSubmit={createClub} className="max-w-md space-y-3"><Label htmlFor="club-name">Nombre del club</Label><Input id="club-name" value={newName} onChange={(e) => setNewName(e.target.value)} required /><Button disabled={saving}><Plus className="mr-2 size-4" />Crear registro del club</Button></form> : <>
      <div className="grid grid-cols-2 gap-4 border-y py-4 sm:grid-cols-5">{Object.entries(MEMBER_ROLES).map(([role, label]) => <div key={role}><div className="time text-3xl font-semibold">{members.filter((m) => m.member_role === role && m.active).length}</div><p className="text-sm text-muted-foreground">{label} · activos</p></div>)}</div>
      <ClubAccessImport key={club.id} onSave={async (file, db, rows) => {
        const path = `${club.id}/${crypto.randomUUID()}.mdb`;
        const upload = await supabase.storage.from("club-documents").upload(path, file, { contentType: "application/octet-stream" }); if (upload.error) throw upload.error;
        const doc = await supabase.from("club_documents").insert({ club_id: club.id, file_name: file.name, storage_path: path, table_summary: db.tables.map((t) => ({ name: t.name, rows: t.rows.length, columns: t.columns })) }).select("id").single();
        if (doc.error) { await supabase.storage.from("club-documents").remove([path]); throw doc.error; }
        const r = await supabase.rpc("import_club_members", { p_club_id: club.id, p_document_id: doc.data.id, p_members: rows as unknown as Json });
        await refresh(); if (r.error) throw new Error(`Documento conservado, pero los integrantes no se guardaron: ${r.error.message}`);
      }} />
      <section className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold uppercase">Documentos del club</h2><ClubPdfImport key={club.id} onSave={async (file, rows) => {
        const path = `${club.id}/${crypto.randomUUID()}.pdf`;
        const upload = await supabase.storage.from("club-documents").upload(path,file,{ contentType:"application/pdf" }); if(upload.error) throw upload.error;
        const doc = await supabase.from("club_documents").insert({ club_id:club.id,file_name:file.name,storage_path:path,table_summary:{ format:"PDF",members:rows.length } }).select("id").single();
        if(doc.error) { await supabase.storage.from("club-documents").remove([path]); throw doc.error; }
        if(rows.length) { const r=await supabase.rpc("import_club_members",{p_club_id:club.id,p_document_id:doc.data.id,p_members:rows as unknown as Json}); if(r.error) {await refresh(); throw new Error(`PDF conservado; no se guardaron integrantes: ${r.error.message}`);} }
        await refresh();
      }} /></div>{!documents.length && <p className="text-sm text-muted-foreground">Sin documentos guardados</p>}{documents.map((d) => <div key={d.id} className="flex items-center justify-between gap-3 border-b py-3"><div className="min-w-0"><p className="break-all font-medium">{d.file_name}</p><p className="text-xs text-muted-foreground">{new Date(d.uploaded_at).toLocaleString("es-VE")}</p></div><PdfExport title="Exportar documento del club" label="Exportar" prepare={async () => { const r = await supabase.storage.from("club-documents").download(d.storage_path); if(r.error) throw r.error; return new File([r.data],d.file_name,{ type: /\.pdf$/i.test(d.file_name) ? "application/pdf" : "application/octet-stream" }); }} /></div>)}</section>
      <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold uppercase">Integrantes ({members.length})</h2><div className="flex flex-wrap gap-2"><PdfExport title="Registro de integrantes" clubId={club.id} prepare={() => clubRosterPdf(club.name,members)} /><Button onClick={() => { setEditing(null); setDraft(emptyMember()); setOpen(true); }}><Plus className="mr-2 size-4" />Añadir integrante</Button></div></div>
        <div className="grid gap-3 sm:grid-cols-3"><Input aria-label="Buscar integrante" placeholder="Buscar por nombre o correo" value={query} onChange={(e) => setQuery(e.target.value)} /><Select value={filter} onValueChange={setFilter}><SelectTrigger aria-label="Filtrar por tipo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los tipos</SelectItem>{Object.entries(MEMBER_ROLES).map(([r, label]) => <SelectItem key={r} value={r}>{label}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Filtrar por estado"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos los estados</SelectItem><SelectItem value="active">Activos</SelectItem><SelectItem value="inactive">Inactivos</SelectItem></SelectContent></Select></div>
        <div className="max-w-full overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-muted-foreground">{["Integrante", "Tipo", "Contacto", "Estado", "Actualizado", ""].map((h,i) => <th key={i} className="whitespace-nowrap p-3">{h}</th>)}</tr></thead><tbody>{filtered.map((m) => <tr key={m.id} className="border-b"><td className="p-3 font-medium">{m.first_name} {m.last_name}</td><td className="p-3">{MEMBER_ROLES[m.member_role as MemberRole]}</td><td className="p-3">{m.email || m.phone || "—"}</td><td className="p-3">{m.active ? "Activo" : "Inactivo"}</td><td className="whitespace-nowrap p-3 text-xs text-muted-foreground">{new Date(m.updated_at).toLocaleDateString("es-VE")}</td><td className="p-3"><Button size="icon" variant="ghost" title="Editar integrante" aria-label={`Editar ${m.first_name} ${m.last_name}`} onClick={() => { setEditing(m); setDraft({ ...m, member_role: m.member_role as MemberRole }); setOpen(true); }}><Pencil className="size-4" /></Button></td></tr>)}</tbody></table></div>{!filtered.length && <p className="text-sm text-muted-foreground">No hay integrantes para esta selección.</p>}
      </section>
    </>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90dvh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Editar integrante" : "Añadir integrante"}</DialogTitle><DialogDescription>{club?.name}</DialogDescription></DialogHeader><form onSubmit={saveMember} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">{(["first_name", "last_name"] as const).map((key) => <div key={key}><Label htmlFor={key}>{key === "first_name" ? "Nombre" : "Apellido"}</Label><Input id={key} required={key === "first_name"} value={draft[key]} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))} /></div>)}</div>
      <Label>Tipo</Label><Select value={draft.member_role} onValueChange={(v) => setDraft((d) => ({ ...d, member_role: v as MemberRole }))}><SelectTrigger aria-label="Tipo de integrante"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MEMBER_ROLES).map(([r,label]) => <SelectItem key={r} value={r}>{label}</SelectItem>)}</SelectContent></Select>
      {(["birth_date", "email", "phone"] as const).map((key) => <div key={key}><Label htmlFor={key}>{key === "birth_date" ? "Fecha de nacimiento" : key === "email" ? "Correo" : "Teléfono"}</Label><Input id={key} type={key === "birth_date" ? "date" : key === "email" ? "email" : "tel"} value={draft[key] ?? ""} onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value || null }))} /></div>)}
      <div><Label htmlFor="member-notes">Notas</Label><Textarea id="member-notes" value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} /></div><div className="flex items-center gap-3"><Switch id="member-active" checked={draft.active} onCheckedChange={(active) => setDraft((d) => ({ ...d, active }))} /><Label htmlFor="member-active">Integrante activo</Label></div><Button disabled={saving} type="submit"><Save className="mr-2 size-4" />Guardar integrante</Button>
    </form></DialogContent></Dialog>
  </div>;
}