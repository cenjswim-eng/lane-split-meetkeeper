import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { ageAt, ageAtDec31, ageGroup } from "@/lib/swim";

const athletesQuery = queryOptions({
  queryKey: ["athletes"],
  queryFn: async () => {
    const { data, error } = await supabase
      .from("athletes")
      .select("id, first_name, last_name, birth_date, gender, federation_id, active_status, teams(code, name)")
      .order("last_name")
      .limit(1000);
    if (error) throw error;
    return data;
  },
});

export const Route = createFileRoute("/_authenticated/athletes/")({
  head: () => ({ meta: [{ title: "Atletas — Natación Pro" }, { name: "description", content: "Listado de nadadores importados." }, { property: "og:title", content: "Atletas — Natación Pro" }, { property: "og:description", content: "Listado de nadadores importados." }, { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(athletesQuery),
  component: AthletesPage,
});

function AthletesPage() {
  const { data } = useSuspenseQuery(athletesQuery);
  const [q, setQ] = useState("");
  const list = data.filter((a) => `${a.first_name} ${a.last_name} ${a.federation_id ?? ""}`.toLowerCase().includes(q.toLowerCase()));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold uppercase">Atletas</h1>
          <p className="text-muted-foreground">{data.length} nadadores</p>
        </div>
        <Input placeholder="Buscar por nombre o ID" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
      </div>
      {data.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          Aún no hay atletas. <Link to="/import" className="text-primary underline">Importa un archivo de Hy-Tek</Link>.
        </div>
      ) : (
        <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((a) => (
            <Link key={a.id} to="/athletes/$id" params={{ id: a.id }} className="group rounded-lg border bg-card p-4 transition-colors hover:border-primary">
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-display text-xl font-semibold uppercase group-hover:text-primary">{a.last_name}, {a.first_name}</div>
                  <div className="text-sm text-muted-foreground">{a.teams?.name ?? "Sin club"}</div>
                </div>
                <span className="time rounded bg-secondary px-2 py-0.5 text-xs">
                  {a.gender ?? "-"} · {ageAt(a.birth_date) ?? "?"} · {ageGroup(ageAtDec31(a.birth_date, new Date().getFullYear()))}
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
