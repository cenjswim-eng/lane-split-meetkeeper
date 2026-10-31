import { useState } from "react";
import { readAccessFile, type AccessDatabase } from "@/lib/access";
import { mapClubMembers, suggestMemberMapping, MEMBER_ROLES, type MemberDraft, type MemberMapping, type MemberRole } from "@/lib/club";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export function ClubAccessImport({ onSave }: { onSave: (file: File, db: AccessDatabase, members: MemberDraft[]) => Promise<void> }) {
  const [file, setFile] = useState<File | null>(null);
  const [db, setDb] = useState<AccessDatabase | null>(null);
  const [tableName, setTableName] = useState("");
  const [mapping, setMapping] = useState<MemberMapping>({ first: "", last: "", id: "", birth: "", email: "", phone: "" });
  const [role, setRole] = useState<MemberRole>("nadador");
  const [busy, setBusy] = useState(false);
  const table = db?.tables.find((t) => t.name === tableName);
  const preview = table ? mapClubMembers(table, mapping, role) : { members: [], skipped: 0 };
  async function pick(f: File | undefined) {
    if (!f) return;
    setBusy(true); setDb(null); setFile(null);
    try { const data = await readAccessFile(f); setDb(data); setFile(f); const first = data.tables[0]; if (first) { setTableName(first.name); setMapping(suggestMemberMapping(first)); } }
    catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  }
  return <section className="space-y-4 border-b pb-6">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-2xl font-semibold uppercase">Documento base</h2><Button asChild variant="outline"><label className="cursor-pointer">Cargar Access .mdb<input aria-label="Documento Access del club" type="file" accept=".mdb" className="hidden" disabled={busy} onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} /></label></Button></div>
    {busy && <p role="status">Procesando documento…</p>}
    {db && <><p className="break-all text-sm text-muted-foreground">{db.name} · {db.tables.length} tablas</p>
      <div className="grid gap-3 sm:grid-cols-2"><div><p className="mb-1 text-sm">Tabla de integrantes</p><Select value={tableName} onValueChange={(name) => { setTableName(name); const t = db.tables.find((v) => v.name === name); if (t) setMapping(suggestMemberMapping(t)); }}><SelectTrigger aria-label="Tabla de integrantes"><SelectValue /></SelectTrigger><SelectContent>{db.tables.map((t) => <SelectItem key={t.name} value={t.name}>{t.name} ({t.rows.length})</SelectItem>)}</SelectContent></Select></div>
      <div><p className="mb-1 text-sm">Tipo de integrantes de esta tabla</p><Select value={role} onValueChange={(v) => setRole(v as MemberRole)}><SelectTrigger aria-label="Tipo de integrantes"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(MEMBER_ROLES).map(([v, label]) => <SelectItem value={v} key={v}>{label}</SelectItem>)}</SelectContent></Select></div></div>
      {table && <div className="grid gap-3 sm:grid-cols-3">{Object.entries({ first: "Nombre (obligatorio)", last: "Apellido", id: "Identificador estable", birth: "Nacimiento", email: "Correo", phone: "Teléfono" }).map(([key, label]) => <div key={key}><p className="mb-1 text-sm">{label}</p><Select value={mapping[key as keyof MemberMapping] || "__none"} onValueChange={(v) => setMapping((m) => ({ ...m, [key]: v === "__none" ? "" : v }))}><SelectTrigger aria-label={label}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none">Sin columna</SelectItem>{table.columns.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>)}</div>}
      <p className="text-sm">{preview.members.length} integrantes para guardar · {preview.skipped} filas vacías o duplicadas omitidas</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Nombre</th><th className="p-2">Tipo</th><th className="p-2">Correo</th></tr></thead><tbody>{preview.members.slice(0, 5).map((m) => <tr key={m.source_key}><td className="p-2">{m.first_name} {m.last_name}</td><td className="p-2">{MEMBER_ROLES[m.member_role]}</td><td className="p-2">{m.email ?? "—"}</td></tr>)}</tbody></table></div>
      <p className="text-xs text-muted-foreground">El documento original se conserva privado. Guardar otra tabla añade integrantes; no elimina a quienes ya están registrados.</p>
      <Button disabled={busy || !preview.members.length || !file} onClick={async () => { if (!file) return; setBusy(true); try { await onSave(file, db, preview.members); toast.success("Documento e integrantes guardados"); } catch(e) { toast.error((e as Error).message); } finally { setBusy(false); } }}>Guardar documento e integrantes</Button>
    </>}
  </section>;
}