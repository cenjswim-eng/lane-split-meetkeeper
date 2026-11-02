import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const MAX_BASE64 = 11_000_000; // ~8 MB PDF

const nullableStr = z.string().nullable();
const resultsSchema = z.object({
  meet: z.object({ name: z.string(), location: nullableStr, start_date: nullableStr.describe("YYYY-MM-DD"), end_date: nullableStr.describe("YYYY-MM-DD"), course: z.enum(["LCM", "SCM", "SCY"]).nullable() }),
  swims: z.array(z.object({
    first_name: z.string(), last_name: z.string(), birth_date: nullableStr.describe("YYYY-MM-DD solo si aparece"), gender: z.enum(["F", "M"]).nullable(), team: nullableStr,
    event_number: nullableStr, distance: z.number().int(), stroke: z.number().int().describe("1 Libre, 2 Espalda, 3 Pecho, 4 Mariposa, 5 Combinado"), course: z.enum(["LCM", "SCM", "SCY"]).nullable(),
    seed_time: nullableStr.describe("m:ss.cc"), final_time: nullableStr.describe("m:ss.cc"), place: z.number().int().nullable(), is_dq: z.boolean(),
    splits: z.array(z.object({ distance: z.number().int(), cumulative_time: z.string() })),
  })),
});
const rosterSchema = z.object({
  members: z.array(z.object({ first_name: z.string(), last_name: z.string(), member_role: z.enum(["nadador", "entrenador", "directivo", "personal", "delegado"]), birth_date: nullableStr.describe("YYYY-MM-DD solo si aparece"), email: nullableStr, phone: nullableStr })),
});

const PROMPTS = {
  results: "Extrae del PDF todos los resultados INDIVIDUALES de natación (omite relevos). Copia nombres, tiempos y lugares exactamente como aparecen; no inventes datos: usa null cuando un dato no aparezca. Tiempos en formato m:ss.cc o ss.cc. Parciales acumulados si aparecen.",
  roster: "Extrae del PDF la lista de integrantes del club. Clasifica cada persona como nadador, entrenador, directivo, personal o delegado según el documento (por defecto nadador). No inventes datos: usa null si falta.",
} as const;

export const extractPdfWithAi = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { kind: "results" | "roster"; base64: string }) => {
    if (input.kind !== "results" && input.kind !== "roster") throw new Error("Tipo no válido");
    if (typeof input.base64 !== "string" || !input.base64 || input.base64.length > MAX_BASE64) throw new Error("El PDF debe pesar menos de 8 MB.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const role = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (role.error || !role.data) throw new Error("No tienes permiso para leer documentos.");
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("La lectura con IA no está configurada.");
    const { createOpenAI } = await import("@ai-sdk/openai");
    const { streamText, Output } = await import("ai");
    const provider = createOpenAI({ baseURL: "https://ai.gateway.lovable.dev/v1", apiKey, headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" } });
    const schema = data.kind === "results" ? resultsSchema : rosterSchema;
    try {
      const result = streamText({
        model: provider.responses("openai/gpt-6-astra"),
        output: Output.object({ schema }),
        messages: [{ role: "user", content: [
          { type: "text", text: PROMPTS[data.kind] },
          { type: "file", data: data.base64, mediaType: "application/pdf", filename: "documento.pdf" },
        ] }],
        providerOptions: { openai: { store: false, forceReasoning: true, reasoningEffort: "low", reasoningSummary: "auto", include: ["reasoning.encrypted_content"] } },
      });
      return { kind: data.kind, output: (await result.output) as z.infer<typeof resultsSchema> | z.infer<typeof rosterSchema> };
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      console.error("PDF AI extraction failed", status, (e as Error).message);
      if (status === 402) throw new Error("No quedan créditos de IA. Puedes usar la lectura de formato Meet Manager o añadir créditos.");
      if (status === 429) throw new Error("Demasiadas lecturas seguidas. Intenta de nuevo en un momento.");
      throw new Error("No se pudo leer el PDF con IA.");
    }
  });
