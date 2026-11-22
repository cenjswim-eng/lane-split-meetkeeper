import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { normalizeResultsUrl } from "@/lib/feveda";

const MAX_BYTES = 8_000_000;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$|.*\.local$|.*\.internal$)/i;

const BROWSER_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,application/pdf,*/*;q=0.8",
  "Accept-Language": "es-VE,es-419;q=0.9,es;q=0.8,en;q=0.7",
  "Sec-Ch-Ua": '"Chromium";v="130", "Google Chrome";v="130", "Not?A_Brand";v="99"',
  "Sec-Ch-Ua-Mobile": "?0",
  "Sec-Ch-Ua-Platform": '"Windows"',
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Sec-Fetch-User": "?1",
  "Upgrade-Insecure-Requests": "1",
  "Cache-Control": "max-age=0",
};

export const fetchResultsLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string; allowBrowser?: boolean }) => {
    const clean = normalizeResultsUrl(String(input?.url ?? ""));
    let u: URL;
    try {
      u = new URL(clean);
    } catch {
      throw new Error("Escribe un enlace válido (https://…).");
    }
    if (!/^https?:$/.test(u.protocol) || PRIVATE_HOST.test(u.hostname)) {
      throw new Error("Escribe un enlace público http o https.");
    }
    return { url: u.toString(), allowBrowser: input.allowBrowser === true };
  })
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (role.error || !role.data) throw new Error("No tienes permiso para importar resultados.");

    const doFetch = async (targetUrl: string) => {
      return await fetch(targetUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
        headers: BROWSER_HEADERS,
      });
    };

    let res: Response | null = null;
    let finalRequestUrl = data.url;

    try {
      res = await doFetch(finalRequestUrl);

      // Si la URL es un directorio (ej. /2026/lara/) y dio 404, 403 o 530, probar archivos Meet Manager habituales
      if (
        !res.ok &&
        [404, 403, 530].includes(res.status) &&
        (finalRequestUrl.endsWith("/") || !/\.[a-z0-9]{2,5}$/i.test(new URL(finalRequestUrl).pathname))
      ) {
        const candidates = [
          finalRequestUrl.replace(/\/?$/, "/evtindex.htm"),
          finalRequestUrl.replace(/\/?$/, "/index.htm"),
          finalRequestUrl.replace(/\/?$/, "/index.html"),
        ];
        for (const cand of candidates) {
          try {
            const candRes = await doFetch(cand);
            if (candRes.ok) {
              res = candRes;
              finalRequestUrl = cand;
              break;
            }
          } catch {
            // Continuar con el siguiente candidato
          }
        }
      }
    } catch {
      if (!data.allowBrowser || /\.pdf(?:\?|$)/i.test(data.url)) {
        throw new Error(
          "No se pudo conectar con el servidor de resultados. Puedes descargar el archivo o copiar la tabla en tu navegador y pegarla directamente."
        );
      }
      return { kind: "html" as const, html: await browserFetch(data.url), url: data.url, via: "browser" as const };
    }

    if (!res || !res.ok) {
      const status = res ? res.status : 0;
      // Cloudflare y protecciones antibot / WAF (401, 403, 406, 429, 503, 520..530)
      const isCloudflareOrWaf = [401, 403, 406, 429, 503, 520, 521, 522, 523, 524, 525, 526, 530].includes(status);
      if (isCloudflareOrWaf) {
        if (data.allowBrowser && !/\.pdf(?:\?|$)/i.test(data.url)) {
          try {
            return { kind: "html" as const, html: await browserFetch(data.url), url: data.url, via: "browser" as const };
          } catch (e: any) {
            throw new Error(
              `Protección Cloudflare detectada (error ${status}). ${e?.message || ""} Te sugerimos copiar la tabla de resultados desde tu navegador y usar la pestaña 'Pegar Texto Directo'.`
            );
          }
        }
        let hostname = "el servidor";
        try {
          hostname = new URL(data.url).hostname;
        } catch {}
        throw new Error(
          `El sitio ${hostname} tiene activado un escudo Cloudflare / antibot (error ${status}). Puedes abrir el enlace directamente en tu navegador personal, copiar los resultados y pegarlos en la pestaña 'Pegar Texto Directo' (no requiere servidor).`
        );
      }
      throw new Error(`La página respondió con error ${status}.`);
    }

    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) throw new Error("El documento del enlace pesa más de 8 MB.");
    const isPdf =
      (res.headers.get("content-type") ?? "").includes("pdf") ||
      new TextDecoder().decode(buf.slice(0, 5)) === "%PDF-";
    if (isPdf) {
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { kind: "pdf" as const, base64: btoa(bin), url: res.url || finalRequestUrl };
    }
    const finalUrl = res.url || finalRequestUrl;
    return { kind: "html" as const, html: decode(buf), url: finalUrl, via: "direct" as const };
  });

function decode(buf: Uint8Array) {
  const t = new TextDecoder("utf-8").decode(buf);
  return t.includes("\uFFFD") ? new TextDecoder("windows-1252").decode(buf) : t;
}


async function browserFetch(url: string): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"], fc = process.env["FIRECRAWL_API_KEY"];
  if (!apiKey || !fc) throw new Error("La página bloquea la lectura automática y el lector con navegador no está configurado.");
  const r = await fetch("https://connector-gateway.lovable.dev/firecrawl/v2/scrape", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "X-Connection-Api-Key": fc },
    body: JSON.stringify({ url, formats: ["rawHtml"], onlyMainContent: false, timeout: 45000 }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!r.ok) {
    const body = await r.text();
    console.error(`Browser fetch failed [${r.status}]: ${body.slice(0, 300)}`);
    if (r.status === 402 || /credit limit/i.test(body)) throw new Error("No quedan créditos para leer páginas protegidas. Revisa los créditos del espacio de trabajo.");
    throw new Error(`La página está protegida y no se pudo abrir (error ${r.status}).`);
  }
  const j = (await r.json()) as { data?: { rawHtml?: string; metadata?: { statusCode?: number } }; rawHtml?: string };
  const html = j.data?.rawHtml ?? j.rawHtml;
  const status = j.data?.metadata?.statusCode;
  if (!html || (status && status >= 400)) throw new Error(`La página respondió con error ${status ?? "desconocido"}, incluso abriéndola como navegador.`);
  return html;
}

const GATEWAY = "https://connector-gateway.lovable.dev/firecrawl";
function gatewayHeaders() {
  const apiKey = process.env["LOVABLE_API_KEY"], fc = process.env["FIRECRAWL_API_KEY"];
  if (!apiKey || !fc) throw new Error("El lector con navegador no está configurado.");
  return { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}`, "X-Connection-Api-Key": fc };
}
async function gatewayJson(path: string, init?: RequestInit) {
  const r = await fetch(`${GATEWAY}${path}`, { ...init, headers: gatewayHeaders(), signal: AbortSignal.timeout(55_000) });
  const body = await r.text();
  if (!r.ok) {
    console.error(`Browser batch failed [${r.status}]: ${body.slice(0, 300)}`);
    if (r.status === 402 || /credit limit/i.test(body)) throw new Error("No quedan créditos para leer páginas protegidas. Revisa los créditos del espacio de trabajo.");
    throw new Error(`No se pudieron abrir las pruebas protegidas (error ${r.status}).`);
  }
  return JSON.parse(body);
}

async function requireAdmin(context: { supabase: { rpc: (...a: never[]) => unknown }; userId: string }) {
  const role = (await (context.supabase.rpc as unknown as (f: string, a: object) => Promise<{ data: unknown; error: unknown }>)("has_role", { _user_id: context.userId, _role: "admin" }));
  if (role.error || !role.data) throw new Error("No tienes permiso para importar resultados.");
}

const publicUrl = (u: unknown) => {
  let url: URL;
  try { url = new URL(String(u)); } catch { throw new Error("Enlace no válido."); }
  if (!/^https?:$/.test(url.protocol) || PRIVATE_HOST.test(url.hostname)) throw new Error("Enlace no válido.");
  return url.toString();
};

/** Starts one browser batch for many protected event pages (avoids per-request rate limits). */
export const startBrowserBatch = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { urls: string[] }) => {
    if (!Array.isArray(input?.urls) || !input.urls.length || input.urls.length > 400) throw new Error("Lista de pruebas no válida.");
    return { urls: input.urls.map(publicUrl) };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context as never);
    const j = await gatewayJson("/v2/batch/scrape", { method: "POST", body: JSON.stringify({ urls: data.urls, formats: ["rawHtml"], onlyMainContent: false, ignoreInvalidURLs: true }) });
    if (!j.id) throw new Error("No se pudo iniciar la lectura de las pruebas.");
    return { id: String(j.id) };
  });

export const browserBatchStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; next?: string }) => {
    if (!/^[\w-]{8,80}$/.test(String(input?.id))) throw new Error("Lectura no válida.");
    if (input.next && !/^\d{1,6}$/.test(input.next)) throw new Error("Lectura no válida.");
    return { id: String(input.id), next: input.next };
  })
  .handler(async ({ data, context }) => {
    await requireAdmin(context as never);
    const j = await gatewayJson(`/v2/batch/scrape/${data.id}${data.next ? `?skip=${data.next}` : ""}`);
    const pages = ((j.data ?? []) as { rawHtml?: string; metadata?: { sourceURL?: string; url?: string; statusCode?: number } }[])
      .map((d) => ({ url: d.metadata?.sourceURL ?? d.metadata?.url ?? "", html: d.metadata?.statusCode && d.metadata.statusCode >= 400 ? "" : d.rawHtml ?? "" }));
    const next = typeof j.next === "string" ? new URL(j.next).searchParams.get("skip") ?? undefined : undefined;
    return { status: String(j.status), completed: Number(j.completed ?? 0), total: Number(j.total ?? 0), pages, next };
  });
