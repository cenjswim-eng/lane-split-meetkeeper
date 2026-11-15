import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { MeetExport } from "@/components/meet-export";
import { exportMeet, exportPdf } from "@/lib/meet-files";
import { SwimFileImporterModal } from '@/components/imports/SwimFileImporterModal';
import { coachQuery } from '@/lib/coach-data';
import { clubManagementQuery } from '@/lib/club-management-data';
import { HytekFileCenter } from '@/components/hytek-file-center';

const meetsQuery = queryOptions({
  queryKey: ["meets"],
  queryFn: async () => {
    const { data, error } = await supabase.from("meets").select("*, results(count)").order("start_date", { ascending: false });
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/_authenticated/meets")({
  head: () => ({ meta: [{ title: "Competencias — Swim Lane Coach" }, { name: "description", content: "Competencias, exportación SD3 y reportes PDF para compartir." }, { property: "og:title", content: "Competencias — Swim Lane Coach" }, { name: "twitter:title", content: "Competencias — Swim Lane Coach" }, { property: "og:description", content: "Competencias, exportación SD3 y reportes PDF para compartir." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: async ({ context }) => { await Promise.all([context.queryClient.ensureQueryData(meetsQuery), context.queryClient.ensureQueryData(coachQuery), context.queryClient.ensureQueryData(clubManagementQuery)]); },
  component: MeetsPage,
});

function MeetsPage() {
  const { data } = useSuspenseQuery(meetsQuery);
  return (
    <div>
      <h1 className="text-4xl font-bold uppercase">Competencias</h1>
      <div className="mt-3 flex flex-wrap gap-2"><SwimFileImporterModal/><Button asChild variant="outline"><Link to="/run">Torneo en vivo</Link></Button><Button asChild variant="outline"><Link to="/seeding">Organizar torneo</Link></Button><Button asChild variant="outline"><Link to="/import">Cargar eventos EV3 / HYV</Link></Button><Button asChild variant="outline"><Link to="/entries">Inscripciones</Link></Button><Button asChild variant="outline"><Link to="/reports">Reportes</Link></Button></div>
      <div className="mt-6 space-y-2">
        <HytekFileCenter meets={data}/>
        {data.length === 0 && <p className="text-muted-foreground">Sin competencias todavía.</p>}
        {data.map((m) => (
          <div key={m.id} className="flex flex-wrap items-center gap-4 rounded-lg border bg-card p-4">
            <div className="min-w-0 flex-1 basis-48 break-words">
              <div className="font-display text-xl font-semibold uppercase">{m.name}</div>
              <div className="time text-xs text-muted-foreground">{m.start_date ?? "—"} · {m.location ?? "—"} · {m.course} · {m.results?.[0]?.count ?? 0} resultados</div>
            </div>
            <MeetExport name={m.name} prepare={(kind) => kind === "sd3" ? exportMeet(m) : exportPdf(m, kind === 'results' ? 'results' : 'entries')} />
          </div>
        ))}
      </div>
    </div>
  );
}
