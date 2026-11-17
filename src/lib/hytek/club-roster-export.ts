import { calculateHy3Checksum, encodeWindows1252 } from "@/lib/swim-io/exporters";
import { ageAtDec31 } from "@/lib/swim";
import { exportFilename, zipExport } from "@/lib/file-delivery";

export type ClubExportInfo = {
  code: string;
  name: string;
  short_name?: string | null;
  region_lsc?: string | null;
  head_coach?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  city?: string | null;
  country_code?: string | null;
};

export type RosterAthleteExport = {
  id?: string;
  first_name: string;
  last_name: string;
  middle_initial?: string | null;
  preferred_name?: string | null;
  gender: string | null;
  birth_date: string | null;
  federation_id?: string | null;
  team_code?: string | null;
  is_active?: boolean;
};

const ascii = (value: string | null | undefined): string =>
  (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\x20-\x7e]/g, " ");

const dateToMdy = (value: string | null | undefined): string => {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
  return `${value.slice(5, 7)}${value.slice(8, 10)}${value.slice(0, 4)}`;
};

/**
 * USA Swimming / FINA SDIF v3 record generator (fixed 160 characters per line)
 */
function sdifRecord(type: string, fields: [number, number, string | number, boolean?][]): string {
  const line = Array<string>(160).fill(" ");
  for (const [start, width, raw, right] of [[1, 2, type], [3, 1, "1"], ...fields] as [number, number, string | number, boolean?][]) {
    const value = ascii(String(raw ?? ""));
    const truncated = value.slice(0, width);
    const padded = right ? truncated.padStart(width) : truncated.padEnd(width);
    for (let i = 0; i < width; i++) {
      line[start - 1 + i] = padded[i] ?? " ";
    }
  }
  return line.join("");
}

/**
 * Validates athletes and club data before export
 */
export function validateRosterForExport(club: ClubExportInfo, athletes: RosterAthleteExport[]): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  const code = (club.code || "").trim().toUpperCase();
  if (!code || !/^[A-Z0-9]{1,5}$/.test(code)) {
    errors.push("El club necesita un código válido de 1 a 5 caracteres alfanuméricos (ej. HSP, CCV).");
  }
  if (!club.name?.trim()) {
    errors.push("El club necesita un nombre registrado.");
  }
  if (!athletes.length) {
    errors.push("No hay atletas en la plantilla para exportar.");
  }

  athletes.forEach((a, i) => {
    const name = `${a.last_name || "Sin apellido"}, ${a.first_name || "Sin nombre"}`;
    if (!a.first_name?.trim() || !a.last_name?.trim()) {
      errors.push(`Atleta #${i + 1}: Completa nombre y apellido.`);
    }
    if (!a.birth_date || !/^\d{4}-\d{2}-\d{2}$/.test(a.birth_date)) {
      errors.push(`${name}: Requiere fecha de nacimiento válida (AAAA-MM-DD).`);
    }
    const g = (a.gender || "").toUpperCase();
    if (g !== "M" && g !== "F") {
      errors.push(`${name}: Requiere sexo 'M' (Masculino) o 'F' (Femenino) para Meet Manager y Team Manager.`);
    }
    if (!a.federation_id?.trim()) {
      warnings.push(`${name}: No tiene ID federativo ni cédula registrada.`);
    }
  });

  return { valid: errors.length === 0, errors, warnings };
}

/**
 * Builds an SDIF v3 Roster file (.CL2 or .SD3) compatible with Meet Manager and Team Manager
 */
export function buildClubRosterSdif(
  club: ClubExportInfo,
  athletes: RosterAthleteExport[],
  options: { fileDate?: Date; year?: number } = {}
): string {
  const validation = validateRosterForExport(club, athletes);
  if (!validation.valid) {
    throw new Error(validation.errors[0] || "Datos de plantilla inválidos para exportar a SDIF.");
  }

  const now = options.fileDate ?? new Date();
  const year = options.year ?? now.getFullYear();
  const teamCode = club.code.trim().toUpperCase();
  const teamCodePadded = teamCode.length <= 4 ? teamCode.padStart(6) : teamCode.padEnd(6);
  const nowIsoDate = now.toISOString().slice(0, 10);

  const lines: string[] = [];

  // A0: Header Record (File Code 02 = Team/Roster file)
  lines.push(
    sdifRecord("A0", [
      [4, 8, "V3.0"],
      [12, 2, "02"], // 02: Team / Athlete Roster File
      [14, 30, `Plantilla ${club.name}`],
      [44, 20, "Swim Lane Coach"],
      [64, 10, "1.0"],
      [74, 32, club.head_coach || "Entrenador en Jefe"],
      [106, 8, dateToMdy(nowIsoDate)],
    ])
  );

  // C1: Team Record
  lines.push(
    sdifRecord("C1", [
      [12, 6, teamCodePadded],
      [18, 30, club.name],
      [48, 16, club.short_name || club.name.slice(0, 16)],
      [64, 2, (club.region_lsc || "").slice(0, 2)],
      [80, 1, "C"], // C = Club
    ])
  );

  // C2: Team Address & Contact Record (if available)
  if (club.head_coach || club.contact_phone || club.contact_email || club.city) {
    lines.push(
      sdifRecord("C2", [
        [12, 30, club.head_coach || ""],
        [42, 30, club.city || ""],
        [72, 20, club.city || ""],
        [92, 2, (club.region_lsc || "").slice(0, 2)],
        [104, 20, club.contact_phone || ""],
        [124, 36, club.contact_email || ""],
      ])
    );
  }

  // D0: Athlete Swimmer Records
  athletes.forEach((a) => {
    const fullName = `${a.last_name.trim().toUpperCase()}, ${a.first_name.trim().toUpperCase()}${a.middle_initial ? ` ${a.middle_initial.toUpperCase()}` : ""}`;
    const fedId = (a.federation_id || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const gender = (a.gender || "").toUpperCase();
    const age = a.birth_date ? (ageAtDec31(a.birth_date, year) ?? 0) : 0;
    const ageStr = String(Math.max(0, Math.min(99, age))).padStart(2, "0");

    lines.push(
      sdifRecord("D0", [
        [12, 28, fullName],
        [40, 12, fedId],
        [52, 4, "A   "], // Attached to club
        [56, 8, dateToMdy(a.birth_date)],
        [64, 2, ageStr, true],
        [66, 1, gender],
        [67, 1, "1"],
      ])
    );
  });

  // Z0: File Terminator Record
  const cCount = club.head_coach || club.contact_phone || club.contact_email || club.city ? 2 : 1;
  lines.push(
    sdifRecord("Z0", [
      [4, 8, "0       "], // No B records in pure team roster
      [12, 8, String(cCount).padEnd(8)],
      [20, 8, String(athletes.length).padEnd(8)],
    ])
  );

  return lines.join("\r\n") + "\r\n";
}

/**
 * Builds an HY3 format Roster file compatible with Hy-Tek Meet Manager and Team Manager
 */
export function buildClubRosterHy3(
  club: ClubExportInfo,
  athletes: RosterAthleteExport[],
  options: { fileDate?: Date; year?: number } = {}
): string {
  const validation = validateRosterForExport(club, athletes);
  if (!validation.valid) {
    throw new Error(validation.errors[0] || "Datos de plantilla inválidos para exportar a HY3.");
  }

  const now = options.fileDate ?? new Date();
  const year = options.year ?? now.getFullYear();
  const teamCode = club.code.trim().toUpperCase();
  const nowIsoDate = now.toISOString().slice(0, 10);

  const hy3Record = (type: string, fields: [number, number, string][]): string => {
    const line = Array<string>(128).fill(" ");
    line[0] = type[0] ?? " ";
    line[1] = type[1] ?? " ";
    fields.forEach(([start, width, raw]) => {
      const value = ascii(raw);
      const truncated = value.slice(0, width);
      const padded = truncated.padEnd(width);
      for (let i = 0; i < width; i++) {
        line[start - 1 + i] = padded[i] ?? " ";
      }
    });
    const data = line.join("");
    return data + calculateHy3Checksum(data);
  };

  const lines: string[] = [];

  // A1: Software header
  lines.push(
    hy3Record("A1", [
      [3, 2, "01"],
      [5, 30, "Swim Lane Coach"],
      [35, 10, "1.0"],
      [45, 8, dateToMdy(nowIsoDate)],
    ])
  );

  // C1: Club identity
  lines.push(
    hy3Record("C1", [
      [3, 5, teamCode.slice(0, 5)],
      [8, 30, club.name.slice(0, 30)],
      [38, 16, (club.short_name || club.name).slice(0, 16)],
      [54, 2, (club.region_lsc || "").slice(0, 2)],
      [56, 1, "C"],
    ])
  );

  // C2: Coach & Address
  if (club.head_coach || club.contact_phone || club.city) {
    lines.push(
      hy3Record("C2", [
        [3, 30, (club.head_coach || "").slice(0, 30)],
        [33, 30, (club.city || "").slice(0, 30)],
        [63, 30, (club.city || "").slice(0, 30)],
        [93, 2, (club.region_lsc || "").slice(0, 2)],
        [105, 20, (club.contact_phone || "").slice(0, 20)],
      ])
    );
  }

  // D1: Swimmer records
  athletes.forEach((a, i) => {
    const gender = (a.gender || "M").toUpperCase();
    const idStr = String(i + 1).padStart(5);
    const lastName = a.last_name.trim().toUpperCase().slice(0, 20);
    const firstName = a.first_name.trim().toUpperCase().slice(0, 20);
    const initial = (a.middle_initial || "").trim().toUpperCase().slice(0, 1);
    const nickname = (a.preferred_name || "").trim().slice(0, 20);
    const fedId = (a.federation_id || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 14);
    const birthMdy = dateToMdy(a.birth_date);
    const age = a.birth_date ? (ageAtDec31(a.birth_date, year) ?? 0) : 0;
    const ageStr = String(Math.max(0, Math.min(99, age))).padStart(2);

    lines.push(
      hy3Record("D1", [
        [3, 1, gender],
        [4, 5, idStr],
        [9, 20, lastName],
        [29, 20, firstName],
        [49, 1, initial],
        [50, 20, nickname],
        [70, 14, fedId],
        [84, 5, teamCode.slice(0, 5)],
        [89, 8, birthMdy],
        [97, 2, ageStr],
      ])
    );
  });

  return lines.join("\r\n") + "\r\n";
}

/**
 * Prepares files for download or sharing in the desired format
 */
export async function exportClubRosterFile(
  club: ClubExportInfo,
  athletes: RosterAthleteExport[],
  format: "cl2" | "sd3" | "hy3" | "zip",
  options?: { fileDate?: Date; year?: number }
): Promise<File> {
  const baseName = exportFilename(club.code || club.name, "_plantilla");

  if (format === "cl2" || format === "sd3") {
    const text = buildClubRosterSdif(club, athletes, options);
    const blob = new Blob([encodeWindows1252(text)], { type: "application/octet-stream" });
    const file = new File([blob], `${baseName}.${format}`, { type: "application/octet-stream" });
    return file;
  }

  if (format === "hy3") {
    const text = buildClubRosterHy3(club, athletes, options);
    const blob = new Blob([encodeWindows1252(text)], { type: "application/octet-stream" });
    const file = new File([blob], `${baseName}.hy3`, { type: "application/octet-stream" });
    return file;
  }

  // ZIP packaging: produces CL2 + HY3 inside a single zip
  const sdifText = buildClubRosterSdif(club, athletes, options);
  const hy3Text = buildClubRosterHy3(club, athletes, options);

  const cl2Blob = new Blob([encodeWindows1252(sdifText)], { type: "application/octet-stream" });
  const rawFile = new File([cl2Blob], `${baseName}.cl2`, { type: "application/octet-stream" });
  return await zipExport(rawFile);
}
