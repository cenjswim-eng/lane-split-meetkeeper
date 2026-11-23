import type { ParsedFile } from "@/lib/hytek/types";
import { matchScore, HIGH_MATCH, nameSimilarity, nameTokens } from "@/lib/history-match";
import { normalizeTeamCode } from "@/data/fevedaClubs";

export interface RosterAthlete { id: string; first_name: string; last_name: string; birth_date: string | null; gender: string | null; federation_id: string | null; tm_athlete_id: string | null }

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

/** Converts an HTML results page (often Meet Manager <pre> text) into plain lines. */
export function htmlToLines(html: string): string[] {
  // Modern Meet Manager wrappers publish separate cells, including a difference
  // column. Rebuild canonical result lines using labelled columns, not positions.
  const headingMatch = html.match(/<(?:h[1-6]|caption|p|div)[^>]*>([\s\S]*?)<\/(?:h[1-6]|caption|p|div)>/i);
  const heading = headingMatch?.[1];
  const isEventHeading = heading && /(?:event|evento|prueba)\s*(?:n[°oº]\.?\s*|no\.?\s*|#\s*)?\d/i.test(heading);

  if (isEventHeading && /<table\b/i.test(html)) {
    const plain = (s: string) => htmlToLines(s).join(" ").trim();
    const normalized = (s: string) => plain(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const rebuilt: string[] = [plain(heading)];
    for (const table of html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
      // 1. Buscar en <th>
      let headers = [...(table[1] ?? "").matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(m => normalized(m[1] ?? ""));
      // 2. Si no hay <th>, buscar en el primer <tr> con <td>
      if (!headers.length) {
        const firstTr = (table[1] ?? "").match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/i)?.[1];
        if (firstTr) {
          headers = [...firstTr.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => normalized(m[1] ?? ""));
        }
      }
      const name = headers.findIndex(h => /nombre|name|atleta|nadador|swimmer|apellido/.test(h));
      const team = headers.findIndex(h => /club|team|equipo|entidad|asociacion|asoc|escuela|org/.test(h));
      const final = headers.findIndex(h => /oficial|final|result|tiempo|marca|time|t\.?\s*final/.test(h));
      const seed = headers.findIndex(h => /insc|seed|entry|prev|t\.?\s*prev/.test(h));
      const age = headers.findIndex(h => /edad|age|cat|a[ñn]o/.test(h));
      const place = headers.findIndex(h => /lugar|place|pos|puesto|#|pt/.test(h));
      if (name < 0 || team < 0 || final < 0) continue;
      for (const row of (table[1] ?? "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
        const cells = [...(row[1] ?? "").matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(m => plain(m[1] ?? ""));
        if (!cells[name] || !cells[final]) continue;
        const normName = cells[name].trim().toLowerCase();
        if (normName === "nombre" || normName === "atleta" || normName === "name") continue;
        const placeVal = cells[place] ?? "--";
        const ageVal = cells[age] ? cells[age].trim() : "--";
        const teamVal = cells[team] ? cells[team].trim() : "CLUB";
        const seedVal = cells[seed] ? cells[seed].trim() : "NT";
        const finalVal = cells[final].trim();
        rebuilt.push(` ${placeVal} ${cells[name].trim()} ${ageVal} ${teamVal} ${seedVal} ${finalVal}`);
      }
    }
    if (rebuilt.length > 1) return rebuilt;
  }
  const text = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h\d|pre|table)>/gi, "\n")
    .replace(/<\/t[dh]>/gi, "  ")
    .replace(/<[^>]+>/g, "")
    .replace(/&(#\d+|[a-z]+);/gi, (m, e: string) => e[0] === "#" ? String.fromCharCode(+e.slice(1)) : ENTITIES[e.toLowerCase()] ?? m);
  return text.split(/\r?\n/).map((l) => l.replace(/\s+$/, "")).filter((l) => l.trim());
}

/** Spanish Meet Manager pages print times with decimal commas (1:29,14). */
export const commaTimes = (l: string) => l.replace(/(\d),(\d{2})(?!\d)/g, "$1.$2");

/** Keeps only swims of athletes registered in the roster, adopting the roster identity so imports land on the existing profile. */
export function filterToRoster(parsed: ParsedFile, roster: RosterAthlete[]) {
  const matched = new Map<string, RosterAthlete>();
  const athletes = parsed.athletes.flatMap((a) => {
    let best: { r: RosterAthlete; score: number } | null = null, ambiguous = false;
    for (const r of roster) {
      const { score, conflict } = matchScore(r, { id: a.key, first_name: a.firstName, last_name: a.lastName, birth_date: a.birthDate, gender: a.gender, federation_id: a.federationId });
      if (conflict) continue;
      const final = Math.max(score, truncatedScore(r, a));
      if (final >= HIGH_MATCH && (!best || final > best.score)) { best = { r, score: final }; ambiguous = false; }
      else if (best && final >= HIGH_MATCH && final === best.score) ambiguous = true;
    }
    if (!best || ambiguous) return [];
    matched.set(a.key, best.r);
    return [{ ...a, tmId: best.r.tm_athlete_id, federationId: best.r.federation_id, firstName: best.r.first_name, lastName: best.r.last_name, birthDate: best.r.birth_date, gender: best.r.gender ?? a.gender }];
  });
  const results = parsed.results.filter((r) => matched.has(r.athleteKey));
  const found = new Set([...matched.values()].map((r) => r.id)).size;
  const out: ParsedFile = { ...parsed, athletes, results, teams: parsed.teams.filter((t) => athletes.some((a) => a.teamCode === t.code)), warnings: parsed.warnings.filter((w) => !/fecha de nacimiento/.test(w)) };
  return { parsed: out, found, names: [...new Set([...matched.values()].map((r) => `${r.first_name} ${r.last_name}`))] };
}

/** Meet Manager web results: a frameset whose index frame links one page per event (e.g. 260813F001.htm). */
export function indexFrameUrl(html: string, base: string): string | null {
  // 1. Meta-refresh tag (ej. <meta http-equiv="refresh" content="0;url=evtindex.htm">)
  const metaRefresh = html.match(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*content=["']?[^"'>]*url=([^"'>\s]+)/i)?.[1];
  if (metaRefresh) {
    try {
      const u = new URL(metaRefresh.replace(/&amp;/g, "&"), base).toString();
      if (u !== base) return u;
    } catch {}
  }

  // 2. Javascript location redirect
  const jsRedirect = html.match(/(?:window\.location(?:\.replace|\.href)?|location\.href)\s*=\s*["']([^"']+)["']/i)?.[1];
  if (jsRedirect) {
    try {
      const u = new URL(jsRedirect.replace(/&amp;/g, "&"), base).toString();
      if (u !== base) return u;
    } catch {}
  }

  // 3. Frame src matching evtindex, index, pruebas, events, menu, left
  const frameSrc =
    html.match(/<(?:i?frame)[^>]+src=["']?([^"' >]*(?:evtindex|index|pruebas|events|menu|left)[^"' >]*)/i)?.[1] ??
    html.match(/<(?:i?frame)[^>]+name=["']?(?:left|leftFrame|menu|tree|index|nav)["']?[^>]+src=["']?([^"' >]+)/i)?.[1] ??
    html.match(/<(?:i?frame)[^>]+src=["']?([^"' >]+)[^>]+name=["']?(?:left|leftFrame|menu|tree|index|nav)["']/i)?.[1];

  if (frameSrc) {
    try {
      const u = new URL(frameSrc.replace(/&amp;/g, "&"), base).toString();
      if (u !== base) return u;
    } catch {}
  }

  // 4. Anchor href matching evtindex, pruebas, events, menu o enlaces con etiqueta "Pruebas" / "Resultados"
  const anchorHref =
    html.match(/<a\b[^>]*href=["']([^"']*(?:evtindex|pruebas|events|menu)\.html?(?:\?[^"']*)?)["']/i)?.[1] ??
    html.match(/<a\b[^>]*href=["']([^"']+\.html?(?:\?[^"']*)?)["'][^>]*>[\s\S]*?(?:pruebas|eventos|resultados|events|results)[\s\S]*?<\/a>/i)?.[1] ??
    (!/(?:index|evtindex)\.html?$/i.test(new URL(base).pathname)
      ? html.match(/<a\b[^>]*href=["']([^"']*index\.html?(?:\?[^"']*)?)["']/i)?.[1]
      : null);

  if (anchorHref) {
    try {
      const u = new URL(anchorHref.replace(/&amp;/g, "&"), base).toString();
      if (u !== base) return u;
    } catch {}
  }

  // 5. Si contiene <frameset y no hubo coincidencia previa, probar evtindex.htm relativo a la base
  if (/<frameset/i.test(html)) {
    try {
      const u = new URL("evtindex.htm", base).toString();
      if (u !== base) return u;
    } catch {}
  }

  return null;
}

export function meetEventPages(indexHtml: string, base: string): string[] {
  // 1. Enlaces estándar Meet Manager ([FPS]\d{1,4}) y con prefijo de fecha (ej. 260227F001.htm, 261105F001.htm)
  const mmLinks = [
    ...indexHtml.matchAll(/href=["']?([^"' >#]*?(?:\b\d{4,8})?[FPS]\d{1,4}\.html?(?:\?[^"' >#]*)?)/gi),
  ].map((m) => m[1]);
  // 2. Enlaces nombrados como event1.htm, prueba1.htm, etc.
  const namedLinks = [
    ...indexHtml.matchAll(
      /href=["']?([^"' >#]*?(?:event|evento|prueba|ev|res)[_-]?\d{1,4}\.html?(?:\?[^"' >#]*)?)/gi
    ),
  ].map((m) => m[1]);
  // 3. Enlaces numerados directos (ej. 1.htm, 01.html)
  const numLinks = [...indexHtml.matchAll(/href=["']?([^"' >#]*?\b\d{1,4}\.html?(?:\?[^"' >#]*)?)/gi)].map(
    (m) => m[1]
  );

  const nonEventPattern =
    /(?:evtindex|index|menu|header|navbar|top|bottom|team|teams|club|clubes|athlete|athletes|banner|footer|main)\.html?$/i;

  const validUrls = [...mmLinks, ...namedLinks, ...numLinks]
    .filter((href): href is string => Boolean(href && href.trim()))
    .map((href) => {
      try {
        return new URL(href.replace(/&amp;/g, "&"), base).toString();
      } catch {
        return null;
      }
    })
    .filter((u): u is string => Boolean(u) && !nonEventPattern.test(new URL(u).pathname));

  return [...new Set(validUrls)];
}

export function meetIndexInfo(html: string, indexHtml: string) {
  const title = (html.match(/<title>\s*(?:Meet Results:\s*)?([^<]+?)\s*<\/title>/i)?.[1] ?? indexHtml.match(/<h2[^>]*>(?:<[^>]+>)*\s*([^<]+?)\s*</i)?.[1] ?? null)?.replace(/&amp;/g, "&") ?? null;
  const spanish = /lang=["']es|jornada|jueves|viernes|sabado|sábado|campeonato|masculino|femenino/i.test(html + indexHtml);
  const dates = [...htmlToLines(indexHtml).join("\n").matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)].flatMap(d => {
    const a = d[1], b = d[2], y = d[3];
    if (!a || !b || !y) return [];
    const [dd, mm] = spanish || +a > 12 ? [a,b] : [b,a];
    const value = `${y}-${mm.padStart(2,"0")}-${dd.padStart(2,"0")}`;
    const dt = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(dt.valueOf()) && dt.toISOString().slice(0,10) === value ? [value] : [];
  }).sort();
  return { title, startDate: dates[0] ?? null, endDate: dates.at(-1) ?? null };
}

/** Meet Manager pages cut long names ("Colmenarez, Val"): accept a first-name prefix when the surname matches and no identity field conflicts. */
function truncatedScore(r: RosterAthlete, a: { firstName: string; lastName: string; gender: string | null; birthDate: string | null }) {
  if (a.gender && r.gender && a.gender !== r.gender) return 0;
  if (a.birthDate && r.birth_date && a.birthDate !== r.birth_date) return 0;
  if (nameSimilarity(a.lastName, r.last_name) < 0.9 && nameSimilarity(a.lastName, `${r.last_name} ${r.first_name}`) < 0.9) return 0;
  const first = nameTokens(a.firstName).filter((t) => t.length >= 3);
  const rosterTokens = nameTokens(`${r.first_name} ${r.last_name}`);
  if (!first.length || !first.every((t) => rosterTokens.some((x) => x.startsWith(t)))) return 0;
  return HIGH_MATCH;
}

export interface DetectedMeetClub {
  code: string;
  name: string;
  state: string;
  lsc: string;
  athleteCount: number;
  resultCount: number;
  isMyClub: boolean;
}

/**
 * Extrae y agrupa todos los clubes presentes en un archivo de resultados parseado (PDF o web).
 * Normaliza los códigos mediante el catálogo oficial FEVEDA para evitar truncamientos.
 */
export function extractAllClubsFromParsed(
  parsed: ParsedFile,
  myClubCode = "JSWIM"
): DetectedMeetClub[] {
  const normMyClub = normalizeTeamCode(myClubCode).code;
  const clubMap = new Map<string, DetectedMeetClub>();

  for (const team of parsed.teams) {
    const norm = normalizeTeamCode(team.code, team.name);
    if (!clubMap.has(norm.code)) {
      clubMap.set(norm.code, {
        code: norm.code,
        name: norm.name,
        state: norm.state,
        lsc: norm.lsc,
        athleteCount: 0,
        resultCount: 0,
        isMyClub: norm.code === normMyClub,
      });
    }
  }

  const athleteClubMap = new Map<string, string>();
  for (const ath of parsed.athletes) {
    const norm = normalizeTeamCode(ath.teamCode || "CLUB");
    athleteClubMap.set(ath.key, norm.code);

    if (!clubMap.has(norm.code)) {
      clubMap.set(norm.code, {
        code: norm.code,
        name: norm.name,
        state: norm.state,
        lsc: norm.lsc,
        athleteCount: 0,
        resultCount: 0,
        isMyClub: norm.code === normMyClub,
      });
    }
    clubMap.get(norm.code)!.athleteCount += 1;
  }

  for (const res of parsed.results) {
    const clubCode = athleteClubMap.get(res.athleteKey);
    if (clubCode && clubMap.has(clubCode)) {
      clubMap.get(clubCode)!.resultCount += 1;
    }
  }

  return Array.from(clubMap.values()).sort((a, b) => b.resultCount - a.resultCount);
}

/**
 * Filtra el archivo parseado para conservar únicamente los nadadores y marcas
 * pertenecientes a los códigos de clubes seleccionados (ej. clubes rivales).
 */
export function filterParsedByClubCodes(
  parsed: ParsedFile,
  selectedClubCodes: string[]
): ParsedFile {
  const targetCodes = new Set(selectedClubCodes.map((c) => c.toUpperCase().trim()));

  const athleteKeyToNorm = new Map<string, string>();
  for (const ath of parsed.athletes) {
    const norm = normalizeTeamCode(ath.teamCode || "CLUB");
    athleteKeyToNorm.set(ath.key, norm.code);
  }

  const athletes = parsed.athletes
    .filter((a) => {
      const normCode = athleteKeyToNorm.get(a.key);
      return normCode && targetCodes.has(normCode);
    })
    .map((a) => {
      const norm = normalizeTeamCode(a.teamCode || "CLUB");
      return {
        ...a,
        teamCode: norm.code,
      };
    });

  const athleteKeys = new Set(athletes.map((a) => a.key));
  const results = parsed.results.filter((r) => athleteKeys.has(r.athleteKey));

  const teams = Array.from(
    new Map(
      athletes.map((a) => {
        const norm = normalizeTeamCode(a.teamCode || "CLUB");
        return [norm.code, { code: norm.code, name: norm.name, lsc: norm.lsc }];
      })
    ).values()
  );

  return {
    ...parsed,
    athletes,
    results,
    teams,
    warnings: parsed.warnings.filter((w) => !/fecha de nacimiento/.test(w)),
  };
}
