import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { buildSd3, type ExportRow } from "@/lib/hytek/sdif";
import { entriesPdf, resultsPdf, type ReportRow } from "@/lib/reports";
import { ageAtDec31, eventLabel } from "@/lib/swim";
import { MeetExport } from "@/components/meet-export";
import { exportFilename } from "@/lib/file-delivery";

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

async function exportMeet(meet: { id: string; name: string; location: string | null; start_date: string | null; end_date: string | null; course: string }) {
  const { data, error } = await supabase
    .from("results")
    .select("seed_time_ms, final_time_ms, is_dq, place, aqua_points, course, round, athletes(first_name, last_name, federation_id, birth_date, gender, teams(code, name)), events(event_number, distance, stroke, gender, min_age, max_age), splits(split_distance, cumulative_time_ms)")
    .eq("meet_id", meet.id);
  if (error) throw error;
  const teams = new Map<string, string>();
  const rows: ExportRow[] = data
    .flatMap((r) => {
      if (!r.athletes || !r.events) return [];
      const t = r.athletes.teams;
      if (t) teams.set(t.code, t.name);
      return [{ ...r, athlete: { ...r.athletes, team_code: t?.code ?? null }, event: r.events }];
    });
  const text = buildSd3(meet, rows, [...teams].map(([code, name]) => ({ code, name })));
  return new File([text], exportFilename(meet.name, ".sd3"), { type: "application/octet-stream" });
}

async function reportRows(meetId: string): Promise<ReportRow[]> {
  const { data, error } = await supabase
    .from("results")
    .select("seed_time_ms, final_time_ms, is_dq, place, aqua_points, athletes(first_name, last_name, birth_date, gender, teams(name)), events(distance, stroke)")
    .eq("meet_id", meetId);
  if (error) throw error;
  const year = new Date().getFullYear();
  return data
    .flatMap((r): ReportRow[] => {
      if (!r.athletes || !r.events) return [];
      return [{
      athlete: `${r.athletes.last_name}, ${r.athletes.first_name}`,
      club: r.athletes.teams?.name ?? "—",
      gender: r.athletes.gender,
      age: ageAtDec31(r.athletes.birth_date, year),
      event: eventLabel(r.events.distance, r.events.stroke),
      seedMs: r.seed_time_ms,
      finalMs: r.final_time_ms,
      isDq: r.is_dq,
      place: r.place,
      points: r.aqua_points,
    }]; })
    .sort((a, b) => a.event.localeCompare(b.event) || (a.place ?? 99) - (b.place ?? 99));
}

async function exportPdf(meet: { id: string; name: string; location: string | null; start_date: string | null; course: string }, kind: "results" | "entries") {
  const rows = await reportRows(meet.id);
  const meta = `${meet.location ?? ""} · ${meet.start_date ?? ""} · ${meet.course}`;
  return kind === "results" ? resultsPdf(meet.name, meta, rows) : entriesPdf(meet.name, meta, rows);
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
