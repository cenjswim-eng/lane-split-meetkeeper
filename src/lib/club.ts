import type { AccessRow, AccessTable } from "./access";
export const MEMBER_ROLES = { nadador: "Nadador", entrenador: "Entrenador", directivo: "Directivo", personal: "Personal" } as const;
export type MemberRole = keyof typeof MEMBER_ROLES;
export interface MemberDraft { first_name: string; last_name: string; member_role: MemberRole; birth_date: string | null; email: string | null; phone: string | null; active: boolean; notes: string; source_key: string | null }
export interface MemberMapping { first: string; last: string; id: string; birth: string; email: string; phone: string }
const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
export function suggestMemberMapping(table: AccessTable): MemberMapping {
  const find = (...names: string[]) => table.columns.find((c) => names.some((n) => normalize(n) === normalize(c))) ?? "";
  return { first: find("first_name", "first", "fname", "nombre", "name"), last: find("last_name", "last", "lname", "apellido"), id: find("id", "athlete_id", "athlete_no", "member_id"), birth: find("birth_date", "birth", "dob"), email: find("email", "correo"), phone: find("phone", "telefono", "mobile") };
}
export function mapClubMembers(table: AccessTable, mapping: MemberMapping, role: MemberRole): { members: MemberDraft[]; skipped: number } {
  const text = (r: AccessRow, key: string) => key && r[key] != null ? String(r[key]).trim() : "";
  const members: MemberDraft[] = [];
  for (const r of table.rows) {
    const first_name = text(r, mapping.first);
    if (!first_name) continue;
    const last_name = text(r, mapping.last);
    const b = r[mapping.birth];
    const birth_date = b instanceof Date && !Number.isNaN(b.getTime()) ? b.toISOString().slice(0, 10) : /^\d{4}-\d{2}-\d{2}$/.test(text(r, mapping.birth)) ? text(r, mapping.birth) : null;
    const identifier = text(r, mapping.id);
    const source_key = identifier ? `${normalize(table.name)}:${identifier}` : `${normalize(table.name)}:name:${first_name.toLocaleLowerCase()}|${last_name.toLocaleLowerCase()}|${birth_date ?? ""}|${role}`;
    members.push({ first_name, last_name, member_role: role, birth_date, email: text(r, mapping.email) || null, phone: text(r, mapping.phone) || null, active: true, notes: "", source_key });
  }
  const unique = new Map(members.map((m) => [m.source_key, m]));
  return { members: [...unique.values()], skipped: table.rows.length - unique.size };
}