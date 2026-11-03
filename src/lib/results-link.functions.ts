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
      res = await fetch(data.url, { redirect: "follow", signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "Mozilla/5.0 (NatacionPro results reader)", Accept: "text/html,application/pdf,text/plain,*/*" } });
    } catch { throw new Error("No se pudo abrir el enlace. Revisa que la página esté disponible."); }
    if (!res.ok) throw new Error(`La página respondió con error ${res.status}.`);
    const buf = new Uint8Array(await res.arrayBuffer());
    if (buf.byteLength > MAX_BYTES) throw new Error("El documento del enlace pesa más de 8 MB.");
    const isPdf = (res.headers.get("content-type") ?? "").includes("pdf") || new TextDecoder().decode(buf.slice(0, 5)) === "%PDF-";
    if (isPdf) {
      let bin = "";
      for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
      return { kind: "pdf" as const, base64: btoa(bin), url: res.url || data.url };
    }
    const finalUrl = res.url || data.url;
    const text = decode(buf);
    const pages = await meetManagerPages(text, finalUrl);
    if (pages) return { kind: "meet" as const, ...pages, url: finalUrl };
    return { kind: "html" as const, html: text, url: finalUrl };
  });

function decode(buf: Uint8Array) {
  const t = new TextDecoder("utf-8").decode(buf);
  return t.includes("\uFFFD") ? new TextDecoder("windows-1252").decode(buf) : t;
}

async function getText(url: string) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { "User-Agent": "Mozilla/5.0 (NatacionPro results reader)" } });
  if (!r.ok) throw new Error(`La página respondió con error ${r.status}.`);
  return decode(new Uint8Array(await r.arrayBuffer()));
}

/** Meet Manager "web results" sites: a frameset with an event index linking one page per event. */
async function meetManagerPages(html: string, base: string) {
  const title = html.match(/<title>\s*(?:Meet Results:\s*)?([^<]+?)\s*<\/title>/i)?.[1] ?? null;
  let index = html, indexUrl = base;
  const frame = html.match(/<frame[^>]+src=["']?([^"' >]*evtindex[^"' >]*)/i)?.[1];
  if (frame) { indexUrl = new URL(frame, base).toString(); index = await getText(indexUrl); }
  const links = [...index.matchAll(/href=["']?([^"' >#]+?([FPS])\d{3}\.htm)/gi)].map((m) => ({ href: m[1]!, kind: m[2]!.toUpperCase() }));
  if (!links.length) return null;
  const finals = links.filter((l) => l.kind === "F");
  const chosen = [...new Set((finals.length ? finals : links).map((l) => new URL(l.href, indexUrl).toString()))];
  if (chosen.length > 400) throw new Error("La competencia tiene demasiadas pruebas para leerla de una vez.");
  const pages: string[] = [];
  for (let i = 0; i < chosen.length; i += 12) {
    pages.push(...await Promise.all(chosen.slice(i, i + 12).map((u) => getText(u).catch(() => ""))));
  }
  const dates = index.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})\s*-\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const iso = (d: string, m: string, y: string) => `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  return { title, startDate: dates ? iso(dates[1]!, dates[2]!, dates[3]!) : null, endDate: dates ? iso(dates[4]!, dates[5]!, dates[6]!) : null, pages: pages.filter(Boolean), total: chosen.length };
}
