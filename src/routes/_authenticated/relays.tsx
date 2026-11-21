import { RelayCategorySelector } from '@/components/relay-category-selector';
import { relayCategoryEligible, type RelayAgeCategory } from '@/lib/relay-category';
import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { candidatesFromResults } from "@/lib/relay";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RelayInteractiveBuilder } from "@/components/team-hub/relay-interactive-builder";
import { optimizeFreeRelay, optimizeMedleyRelay, RelaySwimmerCandidate } from "@/lib/team-hub/smart-relay-builder";

const relayQuery = (course: string, distance: number, gender: string) =>
  queryOptions({
    queryKey: ["relay", course, distance, gender],
    queryFn: async () => {
      let q = supabase
        .from("results")
        .select("athlete_id, final_time_ms, is_dq, athletes!inner(first_name, last_name, gender, active_status, birth_date), events!inner(stroke, distance)")
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
  staticData: { sitemap: false },
  head: () => ({
    meta: [
      { title: "Optimizador de relevos — Swim Lane Coach" },
      { name: "description", content: "Alineación más rápida de la cuarteta cruzando las mejores marcas de los nadadores activos." },
      { property: "og:title", content: "Optimizador de relevos — Swim Lane Coach" }, { name: "twitter:title", content: "Optimizador de relevos — Swim Lane Coach" },
      { property: "og:description", content: "Alineación más rápida de la cuarteta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RelaysPage,
});

function RelaysPage() {
  const [category,setCategory]=useState<RelayAgeCategory|null>(null);
  const [year,setYear]=useState(new Date().getFullYear());
  const [course, setCourse] = useState("LCM");
  const [distance, setDistance] = useState(100);
  const [gender, setGender] = useState("all");
  const [kind, setKind] = useState<"free" | "medley">("free");

  const { data } = useSuspenseQuery(relayQuery(course, distance, gender));

  const candidates = candidatesFromResults(
    data.filter(r=>relayCategoryEligible(r.athletes.birth_date,year,category)).map((r) => ({
      athlete_id: r.athlete_id,
      name: `${r.athletes.first_name} ${r.athletes.last_name}`,
      stroke: r.events.stroke,
      final_time_ms: r.final_time_ms,
      is_dq: r.is_dq,
    })),
  );

  const swimmerCandidates: RelaySwimmerCandidate[] = candidates.map((c) => {
    const athleteRecord = data.find((d) => d.athlete_id === c.id);
    return {
      id: c.id,
      name: c.name,
      gender: ((athleteRecord?.athletes?.gender || 'M') === 'F' ? 'F' : 'M') as 'M' | 'F',
      birthDate: athleteRecord?.athletes?.birth_date,
      bestTimes: c.best,
    };
  });

  const optimizedRelay = kind === 'free'
    ? optimizeFreeRelay(swimmerCandidates, { isMixed: gender === 'all' })
    : optimizeMedleyRelay(swimmerCandidates, { isMixed: gender === 'all' });

  const label = `4x${distance} ${kind === 'free' ? 'Libre' : 'Combinado'}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold uppercase">Constructor Inteligente de Relevos</h1>
        <p className="text-muted-foreground">
          Optimiza la cuarteta más rápida calculando tiempos planos y ventajas de partida lanzada (-0.70s).
        </p>
      </div>

      <RelayCategorySelector category={category} onChange={setCategory} year={year} onYearChange={setYear}/>
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
            <SelectItem value="all">Todos (Mixto)</SelectItem>
            <SelectItem value="M">Masculino</SelectItem>
            <SelectItem value="F">Femenino</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {optimizedRelay ? (
        <RelayInteractiveBuilder initialRelay={optimizedRelay} />
      ) : (
        <div className="rounded-lg border bg-card p-6 text-center">
          <p className="text-muted-foreground">
            No hay suficientes nadadores activos con marcas registradas en {distance} m para conformar la cuarteta de {label}. Importa más resultados o ajusta la categoría de edad.
          </p>
        </div>
      )}
    </div>
  );
}
