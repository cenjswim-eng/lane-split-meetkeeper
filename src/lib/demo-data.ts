import { aquaPoints } from "@/lib/swim";

export const DEMO_SEASON = 2026;
export const demoMeets = Object.freeze([
  Object.freeze({ id: "copa", name: "Copa Horizonte", date: "2026-05-16", location: "Centro Acuático de Ejemplo" }),
  Object.freeze({ id: "regional", name: "Encuentro Regional Demo", date: "2026-08-22", location: "Piscina Municipal de Ejemplo" }),
  Object.freeze({ id: "club", name: "Festival del Club Demo", date: "2026-11-07", location: "Centro Acuático de Ejemplo" }),
]);

export const demoAthletes = Object.freeze([
  { id: "demo-ana", name: "Ana Ríos", gender: "F", birth: "2011-04-12", times: [68400, 66900, 65400] },
  { id: "demo-lucas", name: "Lucas Vega", gender: "M", birth: "2010-09-03", times: [61500, 60800, 59100] },
  { id: "demo-sofia", name: "Sofía Torres", gender: "F", birth: "2011-02-19", times: [70100, 69200, 69500] },
  { id: "demo-mateo", name: "Mateo Luna", gender: "M", birth: "2010-06-21", times: [65200, 63900, 62600] },
  { id: "demo-elena", name: "Elena Sol", gender: "F", birth: "2011-08-30", times: [67800, 66200, 64900] },
  { id: "demo-diego", name: "Diego Mar", gender: "M", birth: "2010-12-04", times: [62800, 61000, 60300] },
].map(athlete => Object.freeze({ ...athlete, times: Object.freeze(athlete.times) })));

// Illustrative thresholds only; never use these as official standards.
export const demoMinimums = Object.freeze({ F: 66000, M: 60000 });

export function demoSwims(athlete: typeof demoAthletes[number]) {
  const minimum = athlete.gender === "F" ? demoMinimums.F : demoMinimums.M;
  return demoMeets.map((meet, index) => {
    const time = athlete.times[index] ?? 0;
    const previous = index > 0 ? athlete.times[index - 1] : undefined;
    return { meet, time, minimum, remaining: time - minimum, change: previous === undefined ? null : time - previous, points: aquaPoints(time, "LCM", athlete.gender, 100, 1) ?? 0 };
  });
}

export function demoRanking() {
  return demoAthletes.map(athlete => {
    const best = demoSwims(athlete).reduce((a, b) => a.time <= b.time ? a : b);
    return { athlete, best };
  }).sort((a, b) => b.best.points - a.best.points || a.athlete.name.localeCompare(b.athlete.name));
}

export function demoSummary() {
  const ranking = demoRanking();
  return { athletes: demoAthletes.length, meets: demoMeets.length, bests: ranking.length, qualified: ranking.filter(row => row.best.remaining <= 0).length, swims: demoAthletes.length * demoMeets.length };
}