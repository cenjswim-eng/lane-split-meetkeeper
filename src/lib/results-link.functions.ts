import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_BYTES = 8_000_000;
const PRIVATE_HOST = /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[?::1\]?$|.*\.local$|.*\.internal$)/i;

export const fetchResultsLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { url: string }) => {
    let u: URL;
    try { u = new URL(String(input?.url ?? "").trim()); } catch { throw new Error("Escribe un enlace válido (https://…)."); }
    if (!/^https?:$/.test(u.protocol) || PRIVATE_HOST.test(u.hostname)) throw new Error("Escribe un enlace público http o https.");
    return { url: u.toString() };
  })
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (role.error || !role.data) throw new Error("No tienes permiso para importar resultados.");
    let res: Response;
    try {
      res = await fetch(data.url, { redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", Accept: "text/html,application/xhtml+xml,application/pdf,*/*;q=0.8", "Accept-Language": "es-ES,es;q=0.9,en;q=0.8" } });
    } catch { return { kind: "html" as const, html: await browserFetch(data.url), url: data.url }; }
    if (!res.ok) {
      // Anti-bot protections (e.g. Cloudflare challenges) reject server requests: read the page with a real browser instead.
      if ([401, 403, 406, 429, 503].includes(res.status)) return { kind: "html" as const, html: await browserFetch(data.url), url: data.url };
      throw new Error(`La página respondió con error ${res.status}.`);
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) throw new Error("El documento del enlace pesa más de 8 MB.");
    const isPdf = (res.headers.get("content-type") ?? "").includes("pdf") || new TextDecoder().decode(buf.slice(0, 5)) === "%PDF-";
    if (isPdf) {
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { kind: "pdf" as const, base64: btoa(bin), url: res.url || data.url };
    }
    const finalUrl = res.url || data.url;
    return { kind: "html" as const, html: decode(buf), url: finalUrl };
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
