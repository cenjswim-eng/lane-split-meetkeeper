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
    return { kind: "html" as const, html: decode(buf), url: finalUrl };
  });

function decode(buf: Uint8Array) {
  const t = new TextDecoder("utf-8").decode(buf);
  return t.includes("\uFFFD") ? new TextDecoder("windows-1252").decode(buf) : t;
}

