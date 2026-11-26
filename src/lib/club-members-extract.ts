/**
 * Módulo de Extracción y Exportación de Integrantes del Club
 * Ubicación: src/lib/club-members-extract.ts
 *
 * Permite extraer la información completa de los integrantes y atletas del club
 * en formato PDF profesional o en paquete ZIP (con PDF, CSV para Excel, TXT y plantillas Hy-Tek).
 */

import { jsPDF } from "jspdf";
import { brandedTable as autoTable, setReportTableBrand } from "@/lib/report-table-theme";
import type { ReportBrand } from "@/lib/report-brand";
import { MEMBER_ROLES, type MemberRole } from "@/lib/club";
import { ageAtDec31, ageGroup } from "@/lib/swim";
import { exportFilename } from "@/lib/file-delivery";
import {
  exportClubRosterFile,
  type ClubExportInfo,
  type RosterAthleteExport,
} from "@/lib/hytek/club-roster-export";
import JSZip from "jszip";
import type { Tables } from "@/integrations/supabase/types";

export interface ClubMemberItem {
  id: string;
  source: "member" | "athlete";
  firstName: string;
  lastName: string;
  role: string;
  roleLabel: string;
  gender: string;
  birthDate: string | null;
  age: number | null;
  category: string;
  federationId: string | null;
  email: string | null;
  phone: string | null;
  active: boolean;
  notes?: string | null;
}

/**
 * Consolida y unifica los integrantes de `club_members` y los nadadores de `athletes`,
 * deduplicando coincidencias por nombre y apellido.
 */
export function unifyClubMembers(
  club?: Tables<"clubs"> | null,
  members: Tables<"club_members">[] = [],
  athletes: Tables<"athletes">[] = []
): ClubMemberItem[] {
  const list: ClubMemberItem[] = [];
  const seen = new Set<string>();
  const currentYear = new Date().getFullYear();

  // 1. Atletas / Nadadores
  for (const a of athletes) {
    const key = `${a.last_name?.trim().toLowerCase()}|${a.first_name?.trim().toLowerCase()}`;
    seen.add(key);
    const age = a.birth_date ? ageAtDec31(a.birth_date, currentYear) : null;
    const cat = age != null ? ageGroup(age) : "—";

    list.push({
      id: a.id,
      source: "athlete",
      firstName: a.first_name,
      lastName: a.last_name,
      role: "nadador",
      roleLabel: "Nadador",
      gender: a.gender === "F" ? "F" : "M",
      birthDate: a.birth_date,
      age,
      category: cat,
      federationId: a.federation_id || null,
      email: null,
      phone: null,
      active: a.is_active,
    });
  }

  // 2. Miembros de club_members (Staff, Entrenadores, Directivos, Delegados y Nadadores)
  for (const m of members) {
    const key = `${m.last_name?.trim().toLowerCase()}|${m.first_name?.trim().toLowerCase()}`;

    // Si ya existe como atleta, enriquecer datos de contacto
    if (m.member_role === "nadador" && seen.has(key)) {
      const existing = list.find(
        (item) => `${item.lastName.trim().toLowerCase()}|${item.firstName.trim().toLowerCase()}` === key
      );
      if (existing) {
        if (!existing.email && m.email) existing.email = m.email;
        if (!existing.phone && m.phone) existing.phone = m.phone;
        if (m.notes) existing.notes = m.notes;
      }
      continue;
    }

    seen.add(key);
    const age = m.birth_date ? ageAtDec31(m.birth_date, currentYear) : null;
    const cat = age != null ? ageGroup(age) : "—";
    const roleLabel = MEMBER_ROLES[m.member_role as MemberRole] || m.member_role;

    list.push({
      id: m.id,
      source: "member",
      firstName: m.first_name,
      lastName: m.last_name,
      role: m.member_role,
      roleLabel,
      gender: m.member_role === "nadador" ? "M" : "—",
      birthDate: m.birth_date,
      age,
      category: cat,
      federationId: null,
      email: m.email,
      phone: m.phone,
      active: m.active,
      notes: m.notes,
    });
  }

  // Ordenar: primero directivos y entrenadores, luego nadadores por apellido
  const roleWeight: Record<string, number> = {
    entrenador: 1,
    directivo: 2,
    delegado: 3,
    personal: 4,
    nadador: 5,
  };

  return list.sort((a, b) => {
    const wa = roleWeight[a.role] ?? 9;
    const wb = roleWeight[b.role] ?? 9;
    if (wa !== wb) return wa - wb;
    return a.lastName.localeCompare(b.lastName, "es");
  });
}

/**
 * Genera el documento PDF oficial de integrantes del club con membrete y tabla detallada.
 */
export function generateClubMembersPdf(
  club: { name: string; team_code?: string | null; region_lsc?: string | null },
  items: ClubMemberItem[],
  brand?: ReportBrand
): File {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  setReportTableBrand(doc, brand);

  const clubName = club.name || "Club";
  const clubCode = club.team_code ? ` (${club.team_code.toUpperCase()})` : "";
  const association = club.region_lsc || "LARA / FEVEDA";
  const dateStr = new Date().toLocaleDateString("es-VE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  // 1. Encabezado Oficial
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(30, 58, 138);
  doc.text(`REGISTRO OFICIAL DE INTEGRANTES — ${clubName.toUpperCase()}${clubCode}`, 14, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Entidad / Asociación: ${association}   ·   Fecha de Emisión: ${dateStr}   ·   SwimLaneCoach`, 14, 21);
  doc.setTextColor(0);

  // 2. Barra de Métricas y Totales
  const total = items.length;
  const swimmers = items.filter((i) => i.role === "nadador").length;
  const coaches = items.filter((i) => i.role === "entrenador").length;
  const staff = total - swimmers - coaches;
  const activeCount = items.filter((i) => i.active).length;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setFillColor(241, 245, 249);
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(14, 24, doc.internal.pageSize.getWidth() - 28, 8, 1.5, 1.5, "FD");
  doc.setTextColor(30, 41, 59);
  doc.text(
    `Total Integrantes: ${total}   |   Nadadores: ${swimmers}   |   Entrenadores: ${coaches}   |   Directiva/Staff: ${staff}   |   Activos: ${activeCount}`,
    18,
    29.5
  );

  // 3. Tabla con autoTable
  const head = [
    [
      "#",
      "Apellido y Nombre",
      "Rol / Cargo",
      "Sexo",
      "F. Nac.",
      "Edad",
      "Categoría",
      "Cédula / Ficha",
      "Correo Electrónico",
      "Teléfono",
      "Estado",
    ],
  ];

  const body = items.map((item, idx) => [
    String(idx + 1),
    `${item.lastName}, ${item.firstName}`,
    item.roleLabel,
    item.gender,
    item.birthDate || "—",
    item.age != null ? String(item.age) : "—",
    item.category || "—",
    item.federationId || "—",
    item.email || "—",
    item.phone || "—",
    item.active ? "Activo" : "Inactivo",
  ]);

  autoTable(doc, {
    startY: 35,
    head,
    body,
    styles: { fontSize: 8, cellPadding: 2.2, overflow: "linebreak" },
    headStyles: {
      fillColor: [30, 58, 138],
      textColor: 255,
      fontStyle: "bold",
    },
    columnStyles: {
      0: { cellWidth: 8, halign: "center" },
      1: { cellWidth: 46, fontStyle: "bold" },
      2: { cellWidth: 24 },
      3: { cellWidth: 12, halign: "center" },
      4: { cellWidth: 22, halign: "center" },
      5: { cellWidth: 12, halign: "center" },
      6: { cellWidth: 24 },
      7: { cellWidth: 24 },
      8: { cellWidth: 42 },
      9: { cellWidth: 26 },
      10: { cellWidth: 18, halign: "center" },
    },
    alternateRowStyles: { fillColor: [248, 250, 252] },
  });

  // 4. Pie de página en todas las hojas
  const totalPages = doc.getNumberOfPages();
  for (let page = 1; page <= totalPages; page++) {
    doc.setPage(page);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(130);
    doc.text(
      `Página ${page} de ${totalPages} — ${clubName} — Documento oficial emitido por SwimLaneCoach (swimlanecoach.app)`,
      14,
      doc.internal.pageSize.getHeight() - 6
    );
  }

  const fileName = exportFilename(club.name, "_integrantes.pdf");
  return new File([doc.output("blob")], fileName, { type: "application/pdf" });
}

/**
 * Genera una hoja de cálculo CSV con codificación UTF-8 con BOM compatible con Microsoft Excel.
 */
export function generateClubMembersCsv(
  club: { name: string; team_code?: string | null },
  items: ClubMemberItem[]
): File {
  const headers = [
    "Nro",
    "Apellido",
    "Nombre",
    "Nombre_Completo",
    "Rol_Cargo",
    "Sexo",
    "Fecha_Nacimiento",
    "Edad_31_Dic",
    "Categoria",
    "Cedula_o_Ficha_FEVEDA",
    "Correo_Electronico",
    "Telefono",
    "Estado",
    "Codigo_Club",
    "Nombre_Club",
  ];

  const escapeCsv = (val: string | number | null | undefined) => {
    const s = String(val ?? "").trim();
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const rows = items.map((item, idx) => [
    idx + 1,
    escapeCsv(item.lastName),
    escapeCsv(item.firstName),
    escapeCsv(`${item.lastName}, ${item.firstName}`),
    escapeCsv(item.roleLabel),
    escapeCsv(item.gender),
    escapeCsv(item.birthDate),
    escapeCsv(item.age != null ? item.age : ""),
    escapeCsv(item.category),
    escapeCsv(item.federationId),
    escapeCsv(item.email),
    escapeCsv(item.phone),
    escapeCsv(item.active ? "Activo" : "Inactivo"),
    escapeCsv(club.team_code || "JSWIM"),
    escapeCsv(club.name),
  ]);

  // \uFEFF es el BOM UTF-8 para que Excel en Windows reconozca acentos y caracteres especiales
  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map((r) => r.join(","))].join("\r\n");
  const fileName = exportFilename(club.name, "_integrantes.csv");
  return new File([csvContent], fileName, { type: "text/csv;charset=utf-8" });
}

/**
 * Genera un archivo de texto con el resumen estructurado de integrantes y categorías.
 */
export function generateClubMembersSummaryText(
  club: { name: string; team_code?: string | null; region_lsc?: string | null; head_coach?: string | null },
  items: ClubMemberItem[]
): File {
  const dateStr = new Date().toLocaleDateString("es-VE");
  const swimmers = items.filter((i) => i.role === "nadador");
  const coaches = items.filter((i) => i.role === "entrenador");
  const directors = items.filter((i) => i.role === "directivo");
  const others = items.filter((i) => !["nadador", "entrenador", "directivo"].includes(i.role));

  const text = `================================================================================
REGISTRO OFICIAL DE INTEGRANTES Y PLANTILLA DEL CLUB
================================================================================
Club: ${club.name}
Código Oficial: ${club.team_code || "JSWIM"}
Asociación: ${club.region_lsc || "LARA / ADAEL"}
Entrenador Principal: ${club.head_coach || "Por registrar"}
Fecha de Emisión: ${dateStr}
Generado en: SwimLaneCoach (swimlanecoach.app)

--------------------------------------------------------------------------------
RESUMEN GENERAL:
--------------------------------------------------------------------------------
- Total de Integrantes: ${items.length}
- Nadadores / Atletas: ${swimmers.length} (Masculino: ${swimmers.filter((s) => s.gender === "M").length}, Femenino: ${swimmers.filter((s) => s.gender === "F").length})
- Entrenadores y Personal Técnico: ${coaches.length}
- Directivos y Delegados: ${directors.length}
- Personal de Apoyo: ${others.length}
- Integrantes Activos: ${items.filter((i) => i.active).length}
- Integrantes Inactivos: ${items.filter((i) => !i.active).length}

--------------------------------------------------------------------------------
STAFF TÉCNICO Y DIRECTIVA:
--------------------------------------------------------------------------------
${[...coaches, ...directors, ...others]
  .map(
    (m, i) =>
      `${i + 1}. ${m.lastName}, ${m.firstName} | ${m.roleLabel} | ${m.email || "Sin correo"} | ${m.phone || "Sin tlf"} | ${m.active ? "Activo" : "Inactivo"}`
  )
  .join("\n") || "Sin registros de staff."}

--------------------------------------------------------------------------------
LISTA DE NADADORES / ATLETAS:
--------------------------------------------------------------------------------
${swimmers
  .map(
    (s, i) =>
      `${i + 1}. ${s.lastName}, ${s.firstName} | Sexo: ${s.gender} | F. Nac: ${s.birthDate || "—"} | Edad: ${s.age ?? "—"} (${s.category}) | Ficha/ID: ${s.federationId || "—"}`
  )
  .join("\n") || "Sin atletas registrados."}
================================================================================
`;

  const fileName = exportFilename(club.name, "_resumen.txt");
  return new File([text], fileName, { type: "text/plain;charset=utf-8" });
}

/**
 * Empaqueta todos los formatos (PDF, CSV, TXT y plantillas Hy-Tek .CL2/.HY3) en un archivo ZIP.
 */
export async function generateClubMembersZip(
  club: {
    name: string;
    team_code?: string | null;
    short_name?: string | null;
    region_lsc?: string | null;
    head_coach?: string | null;
  },
  items: ClubMemberItem[],
  brand?: ReportBrand
): Promise<File> {
  const zip = new JSZip();

  // 1. PDF oficial
  const pdfFile = generateClubMembersPdf(club, items, brand);
  zip.file(pdfFile.name, await pdfFile.arrayBuffer());

  // 2. CSV para Excel
  const csvFile = generateClubMembersCsv(club, items);
  zip.file(csvFile.name, await csvFile.arrayBuffer());

  // 3. Resumen en Texto
  const txtFile = generateClubMembersSummaryText(club, items);
  zip.file(txtFile.name, await txtFile.arrayBuffer());

  // 4. Plantillas oficiales Meet Manager / Team Manager (CL2 y HY3)
  const swimmers = items.filter((i) => i.role === "nadador");
  if (swimmers.length > 0) {
    const clubInfo: ClubExportInfo = {
      code: (club.team_code || "JSWIM").trim().toUpperCase(),
      name: club.name || "Club",
      short_name: club.short_name || club.name.slice(0, 16),
      region_lsc: club.region_lsc || null,
      head_coach: club.head_coach || null,
    };

    const rosterAthletes: RosterAthleteExport[] = swimmers.map((s) => ({
      id: s.id,
      first_name: s.firstName,
      last_name: s.lastName,
      gender: s.gender === "F" ? "F" : "M",
      birth_date: s.birthDate,
      federation_id: s.federationId,
      team_code: club.team_code || "JSWIM",
      is_active: s.active,
    }));

    try {
      const cl2 = await exportClubRosterFile(clubInfo, rosterAthletes, "cl2");
      zip.file(cl2.name, await cl2.arrayBuffer());
    } catch {}

    try {
      const hy3 = await exportClubRosterFile(clubInfo, rosterAthletes, "hy3");
      zip.file(hy3.name, await hy3.arrayBuffer());
    } catch {}
  }

  const bytes = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE" });
  const zipName = exportFilename(club.name, "_integrantes_completo.zip");
  return new File([bytes as BlobPart], zipName, { type: "application/zip" });
}
