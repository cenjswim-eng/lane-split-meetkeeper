/**
 * Módulo de Análisis e Importación de Documentos de Atletas (ZIP, PDF, CSV, Hy-Tek)
 * Ubicación: src/lib/athlete-document-parser.ts
 *
 * Extrae automáticamente nadadores y atletas desde documentos PDF y archivos comprimidos ZIP
 * (incluyendo reportes oficiales, plantillas Meet Manager .CL2/.HY3 y hojas CSV).
 */

import JSZip from "jszip";
import { readPdfLines } from "@/lib/club-document";
import { parseMeetManagerResults } from "@/lib/pdf-results";
import { detectAndParse, decodeHytek } from "@/lib/hytek";
import { normalizeTeamCode } from "@/data/fevedaClubs";
import { ageAtDec31, ageGroup } from "@/lib/swim";

export interface ExtractedAthlete {
  id: string; // Identificador temporal único
  firstName: string;
  lastName: string;
  middleInitial?: string | null;
  gender: "M" | "F" | null;
  birthDate: string | null; // YYYY-MM-DD
  age?: number | null;
  category?: string;
  federationId?: string | null;
  teamCode?: string | null;
  sourceFile: string;
  existingAthleteId?: string | null;
  status: "new" | "match";
}

export interface DocumentParseResult {
  athletes: ExtractedAthlete[];
  warnings: string[];
  summary: string;
}

/**
 * Normaliza fechas en formato DD/MM/AAAA o AAAA-MM-DD a estándar YYYY-MM-DD
 */
export function normalizeBirthDate(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim();

  // Formato ISO: YYYY-MM-DD
  const isoMatch = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (isoMatch) {
    const y = parseInt(isoMatch[1], 10);
    const m = parseInt(isoMatch[2], 10);
    const d = parseInt(isoMatch[3], 10);
    if (y >= 1940 && y <= 2025 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  // Formato Latinoamericano: DD/MM/YYYY o D/M/YYYY
  const latMatch = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (latMatch) {
    const d = parseInt(latMatch[1], 10);
    const m = parseInt(latMatch[2], 10);
    const y = parseInt(latMatch[3], 10);
    if (y >= 1940 && y <= 2025 && m >= 1 && m <= 12 && d >= 1 && d <= 31) {
      return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    }
  }

  return null;
}

/**
 * Normaliza el valor de sexo/género a "M" | "F" | null
 */
export function normalizeGender(raw: string | null | undefined): "M" | "F" | null {
  if (!raw) return null;
  const s = raw.trim().toUpperCase();
  if (s === "M" || s.startsWith("MASC") || s === "H" || s === "HOMBRE") return "M";
  if (s === "F" || s.startsWith("FEM") || s === "MUJER") return "F";
  return null;
}

/**
 * Extrae nadadores analizando líneas de texto estructurado de un documento PDF o texto
 */
export function parseAthletesFromTextLines(
  lines: string[],
  sourceFileName = "documento.pdf",
  defaultTeamCode = "JSWIM"
): ExtractedAthlete[] {
  const athletes: ExtractedAthlete[] = [];
  const seenKeys = new Set<string>();
  const currentYear = new Date().getFullYear();

  // Detectar cabecera para mapeo de columnas si existe
  const headerIdx = lines.findIndex(
    (l) => /apellido/i.test(l) && /nombre/i.test(l)
  );

  let lastNameCol = -1;
  let firstNameCol = -1;
  let nameCol = -1;
  let genderCol = -1;
  let birthCol = -1;
  let ageCol = -1;
  let idCol = -1;
  let clubCol = -1;

  if (headerIdx >= 0) {
    const headerCols = lines[headerIdx]
      .split(/\s*\|\s*|\t|\s{2,}/)
      .map((c) => c.toLowerCase().trim());

    headerCols.forEach((col, idx) => {
      if (/apellido\s*y\s*nombre|nombre\s*completo|atleta|nadador/i.test(col)) nameCol = idx;
      else if (/apellido/i.test(col)) lastNameCol = idx;
      else if (/nombre/i.test(col)) firstNameCol = idx;
      else if (/sexo|género|gender|rama/i.test(col)) genderCol = idx;
      else if (/nacimiento|f\.?\s*nac|fec\.?\s*nac|birth/i.test(col)) birthCol = idx;
      else if (/edad|age/i.test(col)) ageCol = idx;
      else if (/cédula|cedula|ficha|id|feveda/i.test(col)) idCol = idx;
      else if (/club|equipo|team/i.test(col)) clubCol = idx;
    });
  }

  const startLine = headerIdx >= 0 ? headerIdx + 1 : 0;

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.length < 5) continue;
    // Ignorar encabezados y pies de página típicos
    if (/(?:página|page|swimlanecoach|generado|asociación|campeonato|reporte)\s*\d+/i.test(line)) continue;

    let first = "";
    let last = "";
    let gender: "M" | "F" | null = null;
    let birth: string | null = null;
    let fedId: string | null = null;
    let clubCode: string | null = defaultTeamCode;

    // Estrategia 1: Columnas detectadas por cabecera
    if (headerIdx >= 0 && (nameCol >= 0 || (lastNameCol >= 0 && firstNameCol >= 0))) {
      const cells = line.split(/\s*\|\s*|\t|\s{2,}/).map((c) => c.trim());

      if (nameCol >= 0 && cells[nameCol]) {
        const full = cells[nameCol];
        if (full.includes(",")) {
          const parts = full.split(",");
          last = parts[0]?.trim() || "";
          first = parts.slice(1).join(" ").trim();
        } else {
          const parts = full.split(/\s+/);
          if (parts.length >= 2) {
            last = parts[0];
            first = parts.slice(1).join(" ");
          }
        }
      } else if (lastNameCol >= 0 && firstNameCol >= 0) {
        last = cells[lastNameCol] || "";
        first = cells[firstNameCol] || "";
      }

      if (genderCol >= 0 && cells[genderCol]) gender = normalizeGender(cells[genderCol]);
      if (birthCol >= 0 && cells[birthCol]) birth = normalizeBirthDate(cells[birthCol]);
      if (idCol >= 0 && cells[idCol]) fedId = cells[idCol].replace(/[^\w-]/g, "") || null;
      if (clubCol >= 0 && cells[clubCol]) clubCode = cells[clubCol];
    }

    // Estrategia 2: Patrón común "Apellido, Nombre" en línea de texto
    if (!first || !last) {
      // Coincidencia tipo: 1. Segovia, Juan J   M   31   1995-03-15  JSWIM   12345678
      const commaMatch = line.match(
        /^(?:\d+[\.\)]\s*)?([A-ZÁÉÍÓÚÑa-záéíóúñ'\s]{2,30}?),\s*([A-ZÁÉÍÓÚÑa-záéíóúñ'\s]{2,30}?)(?:\s+(?:[MF]|MASC|FEM)\b|\s+\d{1,2}\b|\s+\d{4}[-/]\d{2}[-/]\d{2}|\s+\d{1,2}[-/]\d{1,2}[-/]\d{4}|\s*\||\t|$)/i
      );

      if (commaMatch) {
        last = commaMatch[1].trim();
        first = commaMatch[2].trim();

        const restOfLine = line.slice(commaMatch[0].length);

        // Extraer sexo
        const gMatch = line.match(/\b([MF]|MASC|FEM|MASCULINO|FEMENINO)\b/i);
        if (gMatch) gender = normalizeGender(gMatch[1]);

        // Extraer fecha de nacimiento
        const bMatch = line.match(/\b(\d{4}[-/]\d{2}[-/]\d{2}|\d{1,2}[-/]\d{1,2}[-/]\d{4})\b/);
        if (bMatch) birth = normalizeBirthDate(bMatch[1]);

        // Extraer Cédula o ID (números de 6 a 10 dígitos)
        const idMatch = line.match(/\b(?:V-|E-)?(\d{6,10})\b/i);
        if (idMatch) fedId = idMatch[1];
      }
    }

    // Estrategia 3: Patrón de resultados Meet Manager (e.g. "1  Perez, Maria  14  JSWIM  29.50")
    if (!first || !last) {
      const mmMatch = line.match(
        /^\s*(?:\d+|--)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ'\s]+?),\s*([A-ZÁÉÍÓÚÑa-záéíóúñ'\s]+?)\s+(\d{1,2})\s+([A-Z0-9]{2,6})\b/i
      );
      if (mmMatch) {
        last = mmMatch[1].trim();
        first = mmMatch[2].trim();
        const ageVal = parseInt(mmMatch[3], 10);
        if (!birth && ageVal > 0) {
          birth = `${currentYear - ageVal}-01-01`;
        }
        clubCode = mmMatch[4];
      }
    }

    // Limpieza y validación de nombres
    if (!first || !last) continue;
    first = first.replace(/[^A-ZÁÉÍÓÚÑa-záéíóúñ\s]/g, "").trim();
    last = last.replace(/[^A-ZÁÉÍÓÚÑa-záéíóúñ\s]/g, "").trim();

    // Palabras prohibidas / encabezados filtrados
    if (
      /^(?:nombre|apellido|atleta|nadador|swimmer|page|página|total|prueba|evento)$/i.test(first) ||
      /^(?:nombre|apellido|atleta|nadador|swimmer|page|página|total|prueba|evento)$/i.test(last)
    ) {
      continue;
    }

    if (first.length < 2 || last.length < 2) continue;

    // Deduplicar dentro del mismo documento
    const dedupKey = `${last.toLowerCase()}|${first.toLowerCase()}|${birth || ""}`;
    if (seenKeys.has(dedupKey)) continue;
    seenKeys.add(dedupKey);

    const age = birth ? ageAtDec31(birth, currentYear) : null;
    const cat = age != null ? ageGroup(age) : "—";

    athletes.push({
      id: `temp_${athletes.length + 1}_${Date.now()}`,
      firstName: first,
      lastName: last,
      middleInitial: null,
      gender,
      birthDate: birth,
      age,
      category: cat,
      federationId: fedId,
      teamCode: clubCode || defaultTeamCode,
      sourceFile: sourceFileName,
      status: "new",
    });
  }

  return athletes;
}

/**
 * Lee y analiza un archivo CSV o TXT delimitado
 */
export function parseAthletesFromCsv(
  csvText: string,
  sourceFileName = "atletas.csv",
  defaultTeamCode = "JSWIM"
): ExtractedAthlete[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (!lines.length) return [];

  const athletes: ExtractedAthlete[] = [];
  const currentYear = new Date().getFullYear();

  // Detectar delimitador (coma o punto y coma)
  const delimiter = lines[0].includes(";") ? ";" : ",";

  const headers = lines[0]
    .split(delimiter)
    .map((h) => h.replace(/^["'\s]+|["'\s]+$/g, "").toLowerCase());

  const fnCol = headers.findIndex((h) => /nombre|first|fname/i.test(h) && !/completo/i.test(h));
  const lnCol = headers.findIndex((h) => /apellido|last|lname/i.test(h));
  const fullCol = headers.findIndex((h) => /nombre_completo|nombre completo|atleta|nadador/i.test(h));
  const genCol = headers.findIndex((h) => /sexo|gender|rama/i.test(h));
  const birthCol = headers.findIndex((h) => /nacimiento|birth|dob/i.test(h));
  const idCol = headers.findIndex((h) => /cedula|cédula|ficha|id|feveda/i.test(h));
  const clubCol = headers.findIndex((h) => /club|equipo|team/i.test(h));

  for (let i = 1; i < lines.length; i++) {
    const rawCells = lines[i].split(delimiter).map((c) => c.replace(/^["'\s]+|["'\s]+$/g, "").trim());
    if (rawCells.length < 2) continue;

    let first = "";
    let last = "";

    if (lnCol >= 0 && fnCol >= 0 && rawCells[lnCol] && rawCells[fnCol]) {
      last = rawCells[lnCol];
      first = rawCells[fnCol];
    } else if (fullCol >= 0 && rawCells[fullCol]) {
      const full = rawCells[fullCol];
      if (full.includes(",")) {
        const parts = full.split(",");
        last = parts[0]?.trim() || "";
        first = parts.slice(1).join(" ").trim();
      } else {
        const parts = full.split(/\s+/);
        last = parts[0];
        first = parts.slice(1).join(" ");
      }
    } else if (rawCells[0] && rawCells[1]) {
      last = rawCells[0];
      first = rawCells[1];
    }

    if (!first || !last) continue;

    const gender = genCol >= 0 ? normalizeGender(rawCells[genCol]) : null;
    const birth = birthCol >= 0 ? normalizeBirthDate(rawCells[birthCol]) : null;
    const fedId = idCol >= 0 ? rawCells[idCol] : null;
    const team = clubCol >= 0 ? rawCells[clubCol] : defaultTeamCode;

    const age = birth ? ageAtDec31(birth, currentYear) : null;

    athletes.push({
      id: `csv_${i}_${Date.now()}`,
      firstName: first,
      lastName: last,
      gender,
      birthDate: birth,
      age,
      category: age != null ? ageGroup(age) : "—",
      federationId: fedId,
      teamCode: team || defaultTeamCode,
      sourceFile: sourceFileName,
      status: "new",
    });
  }

  return athletes;
}

/**
 * Función central de extracción: Procesa archivos PDF o ZIP (con descompresión recursiva)
 * y devuelve la lista completa de nadadores detectados.
 */
export async function parseAthletesFromDocument(
  file: File,
  defaultTeamCode = "JSWIM"
): Promise<DocumentParseResult> {
  const fileName = file.name.toLowerCase();
  const warnings: string[] = [];
  const athletesMap = new Map<string, ExtractedAthlete>();
  const currentYear = new Date().getFullYear();

  // 1. CASO ARCHIVO ZIP (.zip)
  if (fileName.endsWith(".zip")) {
    const buffer = await file.arrayBuffer();
    const zip = await JSZip.loadAsync(buffer);
    const fileEntries = Object.keys(zip.files).filter((k) => !zip.files[k].dir);

    if (!fileEntries.length) {
      throw new Error("El archivo .ZIP está vacío.");
    }

    for (const entryName of fileEntries) {
      const lower = entryName.toLowerCase();
      const zipEntry = zip.files[entryName];

      try {
        // A. Archivo Hy-Tek (.cl2, .hy3, .sd3)
        if (lower.endsWith(".cl2") || lower.endsWith(".hy3") || lower.endsWith(".sd3")) {
          const bytes = await zipEntry.async("uint8array");
          const text = decodeHytek(bytes);
          const parsed = detectAndParse(entryName, text);

          if (parsed && parsed.athletes.length > 0) {
            for (const a of parsed.athletes) {
              const key = `${a.lastName.toLowerCase()}|${a.firstName.toLowerCase()}|${a.birthDate || ""}`;
              if (!athletesMap.has(key)) {
                const age = a.birthDate ? ageAtDec31(a.birthDate, currentYear) : null;
                athletesMap.set(key, {
                  id: `hytek_${athletesMap.size + 1}`,
                  firstName: a.firstName,
                  lastName: a.lastName,
                  middleInitial: a.middleInitial || null,
                  gender: a.gender === "F" ? "F" : "M",
                  birthDate: a.birthDate,
                  age,
                  category: age != null ? ageGroup(age) : "—",
                  federationId: a.federationId || null,
                  teamCode: a.teamCode || defaultTeamCode,
                  sourceFile: entryName,
                  status: "new",
                });
              }
            }
          }
        }
        // B. Archivo PDF dentro del ZIP (.pdf)
        else if (lower.endsWith(".pdf")) {
          const bytes = await zipEntry.async("uint8array");
          const pdfBlob = new File([bytes], entryName, { type: "application/pdf" });
          const lines = await readPdfLines(pdfBlob);

          // Probar con parseMeetManagerResults
          const mmParsed = parseMeetManagerResults(lines, entryName);
          if (mmParsed.athletes.length > 0) {
            for (const a of mmParsed.athletes) {
              const key = `${a.lastName.toLowerCase()}|${a.firstName.toLowerCase()}|${a.birthDate || ""}`;
              if (!athletesMap.has(key)) {
                const age = a.birthDate ? ageAtDec31(a.birthDate, currentYear) : null;
                athletesMap.set(key, {
                  id: `pdf_mm_${athletesMap.size + 1}`,
                  firstName: a.firstName,
                  lastName: a.lastName,
                  gender: a.gender === "F" ? "F" : "M",
                  birthDate: a.birthDate,
                  age,
                  category: age != null ? ageGroup(age) : "—",
                  federationId: a.federationId || null,
                  teamCode: a.teamCode || defaultTeamCode,
                  sourceFile: entryName,
                  status: "new",
                });
              }
            }
          }

          // Probar extractor estructurado de líneas
          const lineAthletes = parseAthletesFromTextLines(lines, entryName, defaultTeamCode);
          for (const a of lineAthletes) {
            const key = `${a.lastName.toLowerCase()}|${a.firstName.toLowerCase()}|${a.birthDate || ""}`;
            if (!athletesMap.has(key)) {
              athletesMap.set(key, a);
            }
          }
        }
        // C. Archivo CSV o TXT dentro del ZIP
        else if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
          const text = await zipEntry.async("text");
          const csvAthletes = parseAthletesFromCsv(text, entryName, defaultTeamCode);
          for (const a of csvAthletes) {
            const key = `${a.lastName.toLowerCase()}|${a.firstName.toLowerCase()}|${a.birthDate || ""}`;
            if (!athletesMap.has(key)) {
              athletesMap.set(key, a);
            }
          }
        }
      } catch (entryErr: any) {
        warnings.push(`No se pudo procesar ${entryName}: ${entryErr?.message || "formato no reconocido"}`);
      }
    }
  }
  // 2. CASO ARCHIVO PDF (.pdf)
  else if (fileName.endsWith(".pdf")) {
    const lines = await readPdfLines(file);

    // Intentar Meet Manager results / entry report
    const mmParsed = parseMeetManagerResults(lines, file.name);
    if (mmParsed.athletes.length > 0) {
      for (const a of mmParsed.athletes) {
        const key = `${a.lastName.toLowerCase()}|${a.firstName.toLowerCase()}|${a.birthDate || ""}`;
        if (!athletesMap.has(key)) {
          const age = a.birthDate ? ageAtDec31(a.birthDate, currentYear) : null;
          athletesMap.set(key, {
            id: `pdf_mm_${athletesMap.size + 1}`,
            firstName: a.firstName,
            lastName: a.lastName,
            gender: a.gender === "F" ? "F" : "M",
            birthDate: a.birthDate,
            age,
            category: age != null ? ageGroup(age) : "—",
            federationId: a.federationId || null,
            teamCode: a.teamCode || defaultTeamCode,
            sourceFile: file.name,
            status: "new",
          });
        }
      }
    }

    // Extractor tabular y por líneas
    const lineAthletes = parseAthletesFromTextLines(lines, file.name, defaultTeamCode);
    for (const a of lineAthletes) {
      const key = `${a.lastName.toLowerCase()}|${a.firstName.toLowerCase()}|${a.birthDate || ""}`;
      if (!athletesMap.has(key)) {
        athletesMap.set(key, a);
      }
    }
  }
  // 3. CASO HY-TEK DIRECTO (.cl2, .hy3, .sd3)
  else if (fileName.endsWith(".cl2") || fileName.endsWith(".hy3") || fileName.endsWith(".sd3")) {
    const buffer = await file.arrayBuffer();
    const text = decodeHytek(new Uint8Array(buffer));
    const parsed = detectAndParse(file.name, text);

    if (parsed && parsed.athletes.length > 0) {
      for (const a of parsed.athletes) {
        const key = `${a.lastName.toLowerCase()}|${a.firstName.toLowerCase()}|${a.birthDate || ""}`;
        const age = a.birthDate ? ageAtDec31(a.birthDate, currentYear) : null;
        athletesMap.set(key, {
          id: `hytek_${athletesMap.size + 1}`,
          firstName: a.firstName,
          lastName: a.lastName,
          gender: a.gender === "F" ? "F" : "M",
          birthDate: a.birthDate,
          age,
          category: age != null ? ageGroup(age) : "—",
          federationId: a.federationId || null,
          teamCode: a.teamCode || defaultTeamCode,
          sourceFile: file.name,
          status: "new",
        });
      }
    }
  }
  // 4. CASO CSV DIRECTO (.csv)
  else if (fileName.endsWith(".csv") || fileName.endsWith(".txt")) {
    const text = await file.text();
    const csvAthletes = parseAthletesFromCsv(text, file.name, defaultTeamCode);
    for (const a of csvAthletes) {
      const key = `${a.lastName.toLowerCase()}|${a.firstName.toLowerCase()}|${a.birthDate || ""}`;
      athletesMap.set(key, a);
    }
  } else {
    throw new Error(
      "Formato no reconocido. Sube un documento en formato .PDF, un archivo comprimido .ZIP (con nóminas o plantillas Hy-Tek) o un archivo .CSV."
    );
  }

  const result = Array.from(athletesMap.values());

  if (!result.length) {
    throw new Error(
      "No se pudieron identificar nadadores en este documento. Asegúrate de que contenga nombres de atletas, fecha de nacimiento o columnas de nadadores."
    );
  }

  return {
    athletes: result,
    warnings,
    summary: `Se detectaron ${result.length} atletas en ${file.name}.`,
  };
}
