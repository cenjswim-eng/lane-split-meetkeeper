import { mapClubMembers, suggestMemberMapping, MEMBER_ROLES, type MemberDraft, type MemberRole } from "./club";
import type { AccessDatabase } from "./access";

export function automaticAccessMembers(db: AccessDatabase) {
  const members: MemberDraft[] = [];
  const warnings: string[] = [];
  for (const table of db.tables) {
    const mapping = suggestMemberMapping(table);
    if (!mapping.first || !mapping.last) continue;
    const roleColumn = table.columns.find((c) => /^(member_role|role|tipo|cargo)$/i.test(c));
    const tableRole: MemberRole | undefined = /athlet|swimm|nadador/i.test(table.name) ? "nadador" : /coach|entrenador/i.test(table.name) ? "entrenador" : /delegad/i.test(table.name) ? "delegado" : /directiv/i.test(table.name) ? "directivo" : /staff|personal/i.test(table.name) ? "personal" : undefined;
    for (const row of table.rows) {
      const raw = roleColumn ? String(row[roleColumn] ?? "").toLowerCase().trim() : "";
      const role = (Object.keys(MEMBER_ROLES) as MemberRole[]).find((r) => r === raw) ?? tableRole;
      if (!role) { warnings.push(`${table.name}: tipo de integrante no reconocido`); continue; }
      members.push(...mapClubMembers({ ...table, rows: [row] }, mapping, role).members);
    }
  }
  return { members: [...new Map(members.map((m) => [m.source_key, m])).values()], warnings: [...new Set(warnings)] };
}

/** PDF rows require an explicit roster header; never guess people from prose. */
export function parseRosterLines(lines: string[]) {
  const header = lines.findIndex((line) => /nombre/i.test(line) && /apellido/i.test(line) && /tipo|cargo/i.test(line));
  const headerLine = lines[header];
  if (header < 0 || !headerLine) return [];
  const columns = headerLine.split(/\s*\|\s*|\t|\s{2,}/).map((s) => s.toLowerCase().trim());
  const get = (cells: string[], pattern: RegExp) => cells[columns.findIndex((c) => pattern.test(c))]?.trim() ?? "";
  const members: MemberDraft[] = [];
  for (const line of lines.slice(header + 1)) {
    const cells = line.split(/\s*\|\s*|\t|\s{2,}/);
    const first = get(cells, /^nombre$/), last = get(cells, /^apellido/);
    const rawRole = get(cells, /tipo|cargo/).toLowerCase();
    const role = (Object.keys(MEMBER_ROLES) as MemberRole[]).find((r) => r === rawRole);
    if (!first || !last || !role) continue;
    const birth = get(cells, /nacimiento|birth/);
    const email = get(cells, /correo|email/);
    members.push({ first_name: first, last_name: last, member_role: role, birth_date: /^\d{4}-\d{2}-\d{2}$/.test(birth) ? birth : null, email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null, phone: get(cells, /tel[eé]fono|phone/) || null, active: true, notes: "", source_key: `pdf:name:${first.toLowerCase()}|${last.toLowerCase()}|${birth}|${role}` });
  }
  return [...new Map(members.map((m) => [m.source_key, m])).values()];
}

export async function readClubPdf(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const worker = await import("pdfjs-dist/legacy/build/pdf.worker.min.mjs?url");
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  const lines: string[] = [];
  try {
    for (let i = 1; i <= pdf.numPages; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const rows = new Map<number, { x: number; text: string }[]>();
      for (const item of content.items) {
        if (!("str" in item)) continue;
        const y = Math.round(item.transform[5]);
        const row = rows.get(y) ?? [];
        row.push({ x: item.transform[4], text: item.str }); rows.set(y, row);
      }
      for (const [, row] of [...rows].sort(([a], [b]) => b - a)) lines.push(row.sort((a,b) => a.x-b.x).filter((x) => x.text.trim()).map((x) => x.text).join("  "));
    }
  } finally { await task.destroy(); }
  return parseRosterLines(lines);
}