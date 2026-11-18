export interface FevedaMeet {
  name: string;
  startDate: string | null;
  endDate: string | null;
  location: string | null;
  url: string;
  description?: string;
}

/** Detects if a URL belongs to the Venezuelan Swimming Federation results network */
export function isFevedaUrl(url: string): boolean {
  try {
    const u = new URL(url.trim());
    return /feveda\.org/i.test(u.hostname) || /natacionvenezuela\.com/i.test(u.hostname);
  } catch {
    return false;
  }
}

/** Detects if the URL is the main directory of results rather than a single meet */
export function isFevedaDirectoryUrl(url: string): boolean {
  if (!isFevedaUrl(url)) return false;
  try {
    const u = new URL(url.trim());
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
