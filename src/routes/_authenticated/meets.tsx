import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { buildSd3, type ExportRow } from "@/lib/hytek/sdif";
import { Button } from "@/components/ui/button";

const meetsQuery = queryOptions({
  queryKey: ["meets"],
  queryFn: async () => {
    const { data, error } = await supabase.from("meets").select("*, results(count)").order("start_date", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/_authenticated/meets")({
  head: () => ({ meta: [{ title: "Competencias — Natación Pro" }, { name: "description", content: "Competencias importadas y exportación SD3." }, { property: "og:title", content: "Competencias — Natación Pro" }, { property: "og:description", content: "Competencias importadas y exportación SD3." }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(meetsQuery),
  component: MeetsPage,
});

async function exportMeet(meet: { id: string; name: string; location: string | null; start_date: string | null; end_date: string | null; course: string }) {
  const { data, error } = await supabase
    .from("results")
    .select("seed_time_ms, final_time_ms, is_dq, place, aqua_points, course, round, athletes(first_name, last_name, federation_id, birth_date, gender, teams(code, name)), events(event_number, distance, stroke, gender, min_age, max_age), splits(split_distance, cumulative_time_ms)")
    .eq("meet_id", meet.id);
  if (error) {
    toast.error(error.message);
    return;
  }
  const teams = new Map<string, string>();
  const rows: ExportRow[] = data
    .filter((r) => r.athletes && r.events)
    .map((r) => {
      const t = r.athletes!.teams;
      if (t) teams.set(t.code, t.name);
      return { ...r, athlete: { ...r.athletes!, team_code: t?.code ?? null }, event: r.events! };
    });
  const text = buildSd3(meet, rows, [...teams].map(([code, name]) => ({ code, name })));
  const blob = new Blob([text], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${meet.name.replace(/[^\w]+/g, "_")}.sd3`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function MeetsPage() {
  const { data } = useSuspenseQuery(meetsQuery);
  return (
    <div>
      <h1 className="text-4xl font-bold uppercase">Competencias</h1>
      <div className="mt-6 space-y-2">
        {data.length === 0 && <p className="text-muted-foreground">Sin competencias todavía.</p>}
        {data.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
            <div className="flex-1">
              <div className="font-display text-xl font-semibold uppercase">{m.name}</div>
              <div className="time text-xs text-muted-foreground">{m.start_date ?? "—"} · {m.location ?? "—"} · {m.course} · {m.results?.[0]?.count ?? 0} resultados</div>
            </div>
            <Button variant="outline" size="sm" onClick={() => exportMeet(m)}>Exportar SD3</Button>
          </div>
        ))}
      </div>
    </div>
  );
}
