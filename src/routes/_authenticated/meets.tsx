import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MeetExport } from "@/components/meet-export";
import { exportMeet, exportPdf } from "@/lib/meet-files";

const meetsQuery = queryOptions({
  queryKey: ["meets"],
  queryFn: async () => {
    const { data, error } = await supabase.from("meets").select("*, results(count)").order("start_date", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/_authenticated/meets")({
  head: () => ({ meta: [{ title: "Competencias — Natacion pro" }, { name: "description", content: "Competencias, exportación SD3 y reportes PDF para compartir." }, { property: "og:title", content: "Competencias — Natacion pro" }, { name: "twitter:title", content: "Competencias — Natacion pro" }, { property: "og:description", content: "Competencias, exportación SD3 y reportes PDF para compartir." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(meetsQuery),
  component: MeetsPage,
});

function MeetsPage() {
  const { data } = useSuspenseQuery(meetsQuery);
  return (
    <div>
      <h1 className="text-4xl font-bold uppercase">Competencias</h1>
      <div className="mt-6 space-y-2">
        {data.length === 0 && <p className="text-muted-foreground">Sin competencias todavía.</p>}
        {data.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
            <div className="min-w-0 flex-1 basis-48 break-words">
              <div className="font-display text-xl font-semibold uppercase">{m.name}</div>
              <div className="time text-xs text-muted-foreground">{m.start_date ?? "—"} · {m.location ?? "—"} · {m.course} · {m.results?.[0]?.count ?? 0} resultados</div>
            </div>
            <MeetExport name={m.name} prepare={(kind) => kind === "sd3" ? exportMeet(m) : exportPdf(m, kind)} />
          </div>
        ))}
      </div>
    </div>
  );
}
