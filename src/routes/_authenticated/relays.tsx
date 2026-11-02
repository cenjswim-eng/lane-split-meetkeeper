import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { bestFreeRelay, bestMedleyRelay, candidatesFromResults, type RelayTeam } from "@/lib/relay";
import { formatTime, STROKES } from "@/lib/swim";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

const relayQuery = (course: string, distance: number, gender: string) =>
  queryOptions({
    queryKey: ["relay", course, distance, gender],
    queryFn: async () => {
      let q = supabase
        .from("results")
        .select("athlete_id, final_time_ms, is_dq, athletes!inner(first_name, last_name, gender, active_status), events!inner(stroke, distance)")
        .eq("course", course)
        .eq("events.distance", distance)
        .in("events.stroke", [1, 2, 3, 4])
        .eq("athletes.active_status", true)
        .not("final_time_ms", "is", null);
      if (gender !== "all") q = q.eq("athletes.gender", gender);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

export const Route = createFileRoute("/_authenticated/relays")({
  head: () => ({
    meta: [
      { title: "Optimizador de relevos — Natacion pro" },
      { name: "description", content: "Alineación más rápida de la cuarteta cruzando las mejores marcas de los nadadores activos." },
      { property: "og:title", content: "Optimizador de relevos — Natacion pro" }, { name: "twitter:title", content: "Optimizador de relevos — Natacion pro" },
      { property: "og:description", content: "Alineación más rápida de la cuarteta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RelaysPage,
});

function RelaysPage() {
  const [course, setCourse] = useState("LCM");
  const [distance, setDistance] = useState(100);
  const [gender, setGender] = useState("all");
  const [kind, setKind] = useState<"free" | "medley">("free");

  const { data } = useSuspenseQuery(relayQuery(course, distance, gender));

  const candidates = candidatesFromResults(
    data.map((r) => ({
      athlete_id: r.athlete_id,
      name: `${r.athletes.first_name} ${r.athletes.last_name}`,
      stroke: r.events.stroke,
      final_time_ms: r.final_time_ms,
      is_dq: r.is_dq,
    })),
  );

  const team: RelayTeam | null = kind === "free" ? bestFreeRelay(candidates) : bestMedleyRelay(candidates);
  const label = `4x${distance} ${kind === "free" ? "Libre" : "Combinado"}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold uppercase">Optimizador de relevos</h1>
        <p className="text-muted-foreground">Cruza las mejores marcas de los nadadores activos y sugiere la cuarteta más rápida.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Select value={kind} onValueChange={(v) => setKind(v as "free" | "medley")}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="free">Relevo libre</SelectItem>
            <SelectItem value="medley">Relevo combinado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={String(distance)} onValueChange={(v) => setDistance(Number(v))}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="50">4x50</SelectItem>
            <SelectItem value="100">4x100</SelectItem>
          </SelectContent>
        </Select>
        <Select value={course} onValueChange={setCourse}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="LCM">Piscina 50 m</SelectItem>
            <SelectItem value="SCM">Piscina 25 m</SelectItem>
          </SelectContent>
        </Select>
        <Select value={gender} onValueChange={setGender}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="M">Masculino</SelectItem>
            <SelectItem value="F">Femenino</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-display text-2xl font-semibold uppercase">{label} · {course}</h2>
          {team && <span className="time text-2xl font-semibold text-accent">{formatTime(team.totalMs)}</span>}
        </div>
        {!team ? (
          <p className="mt-4 text-muted-foreground">
            No hay suficientes nadadores activos con marcas en {distance} m para armar este relevo. Importa más resultados o ajusta los filtros.
          </p>
        ) : (
          <div className="mt-4 space-y-2">
            {team.legs.map((leg, i) => (
              <div key={leg.athleteId} className="flex items-center gap-4 rounded-lg border bg-background p-3">
                <span className="time w-6 text-center text-lg font-semibold text-muted-foreground">{i + 1}</span>
                <Badge variant="secondary" className="w-24 justify-center">{STROKES[leg.stroke]}</Badge>
                <span className="flex-1 font-medium">{leg.name}</span>
                <span className="time text-lg font-semibold text-primary">{formatTime(leg.ms)}</span>
              </div>
            ))}
            <p className="pt-2 text-xs text-muted-foreground">
              Tiempo estimado sumando las mejores marcas individuales; no incluye salidas de relevo.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
