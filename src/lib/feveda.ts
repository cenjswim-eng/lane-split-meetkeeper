export interface FevedaMeet {
  name: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  url: string;
  description?: string;
}

/**
 * Normaliza y sanea URLs de resultados (FEVEDA, Natación Venezuela, Meet Manager, PDFs).
 * - Corrige errores habituales de tipeo al copiar/pegar (ej. "atacionvenezuela.com" -> "natacionvenezuela.com").
 * - Corrige URLs sin protocolo (agrega "https://").
 * - Convierte enlaces compartidos de Google Drive o Dropbox en enlaces de descarga directa.
 */
export function normalizeResultsUrl(raw: string): string {
  if (!raw) return "";
  let clean = raw.trim();
  // Eliminar delimitadores como <>, "", '', [] o espacios
  clean = clean.replace(/^[<"'\s\[\(]+|[>"'\s\]\)]+$/g, "");
  // Corregir tipeo común cuando se pierde la 'a' inicial al seleccionar "adael.com.ve"
  clean = clean.replace(/^(https?:\/\/)?(?:www\.)?dael\.com\.ve/i, "$1adael.com.ve");
  // Corregir tipeo común cuando se pierde la 'n' inicial al seleccionar "natacionvenezuela.com"
  clean = clean.replace(/^(https?:\/\/)?(?:www\.)?atacionvenezuela\.com/i, "$1natacionvenezuela.com");
  // Corregir tipeo común cuando se pierde la 'f' inicial al seleccionar "feveda.org"
  clean = clean.replace(/^(https?:\/\/)?(?:www\.)?eveda\.org/i, "$1feveda.org");

  // IMPORTANTE: adael.com.ve no tiene activo puerto 443 (HTTPS), solo puerto 80 (HTTP).
  // Forzar http:// para adael.com.ve para evitar fallos de conexión SSL / ECONNREFUSED.
  if (/^(?:https?:\/\/)?(?:www\.)?adael\.com\.ve/i.test(clean)) {
    clean = clean.replace(/^https?:\/\//i, "http://");
    if (!clean.startsWith("http://")) {
      clean = `http://${clean}`;
    }
  } else if (!/^https?:\/\//i.test(clean)) {
    clean = `https://${clean}`;
  }

  // Convertir enlaces compartidos de Google Drive en descarga directa
  const gdriveMatch = clean.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (gdriveMatch?.[1]) {
    return `https://drive.google.com/uc?export=download&id=${gdriveMatch[1]}`;
  }
  // Convertir enlaces compartidos de Dropbox a descarga directa (dl=1)
  if (/dropbox\.com/i.test(clean)) {
    if (!clean.includes("dl=1")) {
      clean = clean.replace(/[?&]dl=0/, "");
      clean += clean.includes("?") ? "&dl=1" : "?dl=1";
    }
  }
  return clean;
}

/** Extrae múltiples URLs de un texto pegado (separadas por espacios, saltos de línea, etc.) */
export function extractUrlsFromText(text: string): string[] {
  if (!text) return [];
  const tokens = text.split(/[\s,;\r\n]+/).filter(Boolean);
  const urls: string[] = [];
  for (const t of tokens) {
    if (t.includes(".") && (t.includes("http") || t.includes("feveda") || t.includes("adael") || t.includes("natacionvenezuela") || t.includes(".htm"))) {
      try {
        const norm = normalizeResultsUrl(t);
        if (norm && /^https?:\/\//i.test(norm)) {
          urls.push(norm);
        }
      } catch {}
    }
  }
  return [...new Set(urls)];
}

/** Detects if a URL belongs to the Venezuelan Swimming Federation or State Associations (ADAEL, ADAEM, ADADC, ADAC) */
export function isFevedaUrl(url: string): boolean {
  try {
    const normalized = normalizeResultsUrl(url);
    const u = new URL(normalized);
    return (
      /feveda\.org/i.test(u.hostname) ||
      /natacionvenezuela\.com/i.test(u.hostname) ||
      /adael\.com\.ve/i.test(u.hostname) ||
      /adaem\.com\.ve/i.test(u.hostname) ||
      /adadc\.com\.ve/i.test(u.hostname) ||
      /adac\.com\.ve/i.test(u.hostname)
    );
  } catch {
    return false;
  }
}

export interface ParsedMeetUrlInfo {
  meetName?: string;
  state?: string;
  association?: string;
  year?: number;
  course?: "LCM" | "SCM";
}

/**
 * Extrae metadatos inteligentes de la URL de una competencia
 * (ej. "https://www.adael.com.ve/3erEstadalADAEL2026/index.htm" ->
 * Nombre: "3er Estadal ADAEL 2026", Estado: "Lara", Asociación: "ADAEL", Año: 2026)
 */
export function parseMeetUrlInfo(rawUrl: string): ParsedMeetUrlInfo {
  try {
    const clean = normalizeResultsUrl(rawUrl);
    const u = new URL(clean);
    const segments = u.pathname.split("/").filter(Boolean);
    if (!segments.length) return {};

    let candidate = segments[segments.length - 1] ?? "";
    if (/(?:index|evtindex|default|home|resultados|pruebas|events)\.[a-z0-9]+$/i.test(candidate)) {
      candidate = segments.length > 1 ? segments[segments.length - 2]! : candidate;
    }
    candidate = decodeURIComponent(candidate).replace(/\.[a-z0-9]+$/i, "");

    const yearMatch = candidate.match(/\b(202\d)\b/) || u.pathname.match(/\b(202\d)\b/);
    const year = yearMatch ? parseInt(yearMatch[1], 10) : new Date().getFullYear();

    const pathLower = u.pathname.toLowerCase();
    const candidateLower = candidate.toLowerCase();

    // Mapeos específicos de alta precisión para los torneos venezolanos oficiales 2026
    if (candidateLower.includes("jdnj") || pathLower.includes("/jdnj")) {
      return {
        meetName: `Juegos Deportivos Nacionales Juveniles (JDNJ) ${year}`,
        state: "Nacional",
        association: "FEVEDA",
        year,
        course: "LCM",
      };
    }

    if (candidateLower.includes("nacionalcategoria") || pathLower.includes("/nacionalcategoria")) {
      return {
        meetName: `Campeonato Nacional por Categorías FEVEDA ${year}`,
        state: "Nacional",
        association: "FEVEDA",
        year,
        course: "LCM",
      };
    }

    if (candidateLower === "infantil" || pathLower.includes("/infantil")) {
      return {
        meetName: `Campeonato Nacional Infantil FEVEDA ${year}`,
        state: "Nacional",
        association: "FEVEDA",
        year,
        course: "LCM",
      };
    }

    if (candidateLower === "juvenil" || pathLower.includes("/juvenil")) {
      return {
        meetName: `Campeonato Nacional Juvenil FEVEDA ${year}`,
        state: "Nacional",
        association: "FEVEDA",
        year,
        course: "LCM",
      };
    }

    if (candidateLower.includes("occidente") || pathLower.includes("/occidente")) {
      return {
        meetName: `Campeonato Regional de Natación Occidente ${year}`,
        state: "Occidente",
        association: "FEVEDA / ADAEF",
        year,
        course: "LCM",
      };
    }

    if (candidateLower === "lara" || pathLower.includes("/2026/lara")) {
      return {
        meetName: `I Campeonato Estadal ADAEL ${year}`,
        state: "Lara",
        association: "ADAEL",
        year,
        course: "LCM",
      };
    }

    let state = "Lara";
    let association = "ADAEL";

    if (/adael/i.test(u.hostname) || /adael/i.test(u.pathname)) {
      state = "Lara";
      association = "ADAEL";
    } else if (/adaem/i.test(u.hostname) || /adaem/i.test(u.pathname) || /miranda/i.test(u.pathname)) {
      state = "Miranda";
      association = "ADAEM";
    } else if (/adadc/i.test(u.hostname) || /adadc/i.test(u.pathname) || /distrito/i.test(u.pathname)) {
      state = "Distrito Capital";
      association = "ADADC";
    } else if (/adac/i.test(u.hostname) || /carabobo/i.test(u.pathname)) {
      state = "Carabobo";
      association = "ADAC";
    } else if (/adaef/i.test(u.hostname) || /falcon/i.test(u.pathname)) {
      state = "Falcón";
      association = "ADAEF";
    } else if (/asodan/i.test(u.hostname) || /yaracuy/i.test(u.pathname)) {
      state = "Yaracuy";
      association = "ASODAN";
    }

    let formattedName = candidate;
    const estadalMatch = candidate.match(/^(\d+(?:er|do|ro|to|mo)?)\s*estadal\s*([a-z]+)?\s*(\d{4})?$/i);
    if (estadalMatch) {
      const ordinal = estadalMatch[1];
      const assoc = estadalMatch[2] ? estadalMatch[2].toUpperCase() : association;
      const yr = estadalMatch[3] || year;
      formattedName = `${ordinal} Estadal ${assoc} ${yr}`;
    } else {
      formattedName = candidate
        .replace(/(\d+)(er|do|ro|to|mo)/gi, "$1$2 ")
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/([A-Z]+)(\d{4})/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }

    return {
      meetName: formattedName || `Torneo Oficial ${association} ${year}`,
      state,
      association,
      year,
      course: /piscina[-_ ]?corta|25m|scm/i.test(candidate) ? "SCM" : "LCM",
    };
  } catch {
    return {};
  }
}

/** Detects if the URL is the main directory of results rather than a single meet */
export function isFevedaDirectoryUrl(url: string): boolean {
  if (!isFevedaUrl(url)) return false;
  try {
    const normalized = normalizeResultsUrl(url);
    const u = new URL(normalized);
    return /\/resultados\/?$/i.test(u.pathname) || /\/resultados-\d{4}\/?$/i.test(u.pathname) || u.pathname === "/" || u.pathname === "";
  } catch {
    return false;
  }
}

/** Parses the JSON-LD or HTML cards from feveda.org/resultados/ to extract available championships */
export function parseFevedaDirectory(html: string, baseUrl = "https://feveda.org/resultados/"): FevedaMeet[] {
  const meets: FevedaMeet[] = [];
  const seenUrls = new Set<string>();

  // 1. Extract structured Schema.org JSON-LD (FEVEDA embeds @graph with an ItemList of SportsEvents)
  try {
    const jsonLdMatches = [...html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
    for (const match of jsonLdMatches) {
      const raw = match[1]?.trim();
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      const graph = Array.isArray(parsed) ? parsed : (parsed["@graph"] as unknown[]) || [parsed];

      for (const node of graph) {
        if (typeof node === "object" && node !== null && (node as { "@type"?: string })["@type"] === "ItemList") {
          const items = (node as { itemListElement?: unknown[] }).itemListElement;
          if (Array.isArray(items)) {
            for (const el of items) {
              const item = ((el as { item?: unknown }).item || el) as {
                name?: string;
                startDate?: string;
                endDate?: string;
                url?: string;
                description?: string;
                location?: { name?: string; address?: { addressRegion?: string } };
              };
              if (item.url) {
                const canonicalUrl = new URL(item.url, baseUrl).toString();
                if (!seenUrls.has(canonicalUrl)) {
                  seenUrls.add(canonicalUrl);
                  const loc = item.location?.name
                    ? `${item.location.name}${item.location.address?.addressRegion ? ` (${item.location.address.addressRegion})` : ""}`
                    : null;
                  meets.push({
                    name: item.name || "Competencia FEVEDA",
                    startDate: item.startDate || null,
                    endDate: item.endDate || null,
                    location: loc,
                    url: canonicalUrl,
                    ...(item.description ? { description: item.description } : {}),
                  });
                }
              }
            }
          }
        }
      }
    }
  } catch {
    // If JSON-LD parsing fails, continue to fallback
  }

  // 2. Fallback: extract competition links directly from HTML anchors
  const linkMatches = [...html.matchAll(/<a\s+[^>]*href=["'](https?:\/\/[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for (const m of linkMatches) {
    const href = m[1]?.trim();
    const rawText = m[2]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    if (!href || !rawText || seenUrls.has(href)) continue;
    if (/202\d\/(infantil|juvenil|regional|nacional|occidente|oriente|coro|puertocabello|jdnj|comunales)/i.test(href)) {
      seenUrls.add(href);
      const cleanName = rawText
        .replace(/^(Ver resultados|RESULTADOS EN VIVO)\s*·?\s*/i, "")
        .replace(/\s*·\s*Ver resultados.*$/i, "")
        .trim();
      meets.push({
        name: cleanName || "Torneo FEVEDA",
        startDate: null,
        endDate: null,
        location: null,
        url: href,
      });
    }
  }

  return meets;
}
