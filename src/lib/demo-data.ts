import { aquaPoints } from "@/lib/swim";

export const DEMO_SEASON = 2026;
export const demoMeets = Object.freeze([
  Object.freeze({ id: "copa", name: "Copa Horizonte", date: "2026-03-14", location: "Centro Acuático de Ejemplo" }),
  Object.freeze({ id: "regional", name: "Encuentro Regional Demo", date: "2026-05-16", location: "Piscina Municipal de Ejemplo" }),
  Object.freeze({ id: "festival", name: "Festival del Club Demo", date: "2026-06-20", location: "Centro Acuático de Ejemplo" }),
  Object.freeze({ id: "ciudad", name: "Copa Ciudad Demo", date: "2026-08-22", location: "Piscina Municipal de Ejemplo" }),
  Object.freeze({ id: "liga", name: "Encuentro de Liga Demo", date: "2026-10-10", location: "Centro Acuático de Ejemplo" }),
  Object.freeze({ id: "cierre", name: "Encuentro de Cierre Demo", date: "2026-11-07", location: "Centro Acuático de Ejemplo" }),
]);

export const demoAthletes = Object.freeze([
  { id: "demo-ana", name: "Ana Ríos", gender: "F", birth: "2011-04-12", times: [68400, 66900, 65400, 66200, 64800, 64100] },
  { id: "demo-lucas", name: "Lucas Vega", gender: "M", birth: "2010-09-03", times: [61500, 60800, 59100, 59800, 58600, 58200] },
  { id: "demo-sofia", name: "Sofía Torres", gender: "F", birth: "2011-02-19", times: [70100, 69200, 69500, 68800, 67900, 67200] },
  { id: "demo-mateo", name: "Mateo Luna", gender: "M", birth: "2010-06-21", times: [65200, 63900, 62600, 63100, 61800, 61200] },
  { id: "demo-elena", name: "Elena Sol", gender: "F", birth: "2011-08-30", times: [67800, 66200, 64900, 65500, 64200, 63800] },
  { id: "demo-diego", name: "Diego Mar", gender: "M", birth: "2010-12-04", times: [62800, 61000, 60300, 59800, 59200, 58900] },
  { id: "demo-valeria", name: "Valeria Rojas", gender: "F", birth: "2012-01-25", times: [66500, 65800, 65100, 65900, 64600, 65200] },
  { id: "demo-andres", name: "Andrés Peña", gender: "M", birth: "2011-02-14", times: [62200, 61400, 60700, 60100, 59500, 58800] },
  { id: "demo-camila", name: "Camila Prato", gender: "F", birth: "2010-11-08", times: [69200, 68500, 67800, 68100, 67400, 66900] },
  { id: "demo-sebastian", name: "Sebastián Ortiz", gender: "M", birth: "2011-08-09", times: [63500, 62700, 61900, 62400, 61500, 60800] },
  { id: "demo-gabriela", name: "Gabriela Sosa", gender: "F", birth: "2011-06-14", times: [67400, 66800, 66100, 65700, 65000, 64500] },
  { id: "demo-tomas", name: "Tomás Bravo", gender: "M", birth: "2010-04-30", times: [61200, 60500, 59900, 59300, 58700, 58100] },
  { id: "demo-daniela", name: "Daniela Ruiz", gender: "F", birth: "2012-03-02", times: [71000, 70400, 69800, 70200, 69500, 68900] },
  { id: "demo-emilio", name: "Emilio Castro", gender: "M", birth: "2012-01-16", times: [64400, 63600, 62900, 63300, 62500, 61700] },
  { id: "demo-mariana", name: "Mariana Paz", gender: "F", birth: "2010-07-19", times: [66800, 66200, 65600, 66300, 64900, 64400] },
  { id: "demo-joaquin", name: "Joaquín Reyes", gender: "M", birth: "2011-10-05", times: [61800, 61100, 60400, 59700, 59100, 58500] },
  { id: "demo-lucia", name: "Lucía Herrera", gender: "F", birth: "2011-09-27", times: [68300, 67600, 67000, 66400, 66800, 66100] },
  { id: "demo-facundo", name: "Facundo Luna", gender: "M", birth: "2010-08-28", times: [64100, 63300, 62600, 63000, 62100, 61400] },
  { id: "demo-paula", name: "Paula Medina", gender: "F", birth: "2012-05-11", times: [69900, 69100, 68600, 69300, 68400, 67700] },
  { id: "demo-bruno", name: "Bruno Herrera", gender: "M", birth: "2011-05-22", times: [60900, 60200, 60100, 60400, 60300, 60200] },
  { id: "demo-renata", name: "Renata Gil", gender: "F", birth: "2010-12-23", times: [67200, 66500, 65900, 65300, 64700, 64000] },
  { id: "demo-nicolas", name: "Nicolás Vera", gender: "M", birth: "2012-07-13", times: [63800, 63000, 62300, 62700, 61800, 61100] },
  { id: "demo-antonia", name: "Antonia Salas", gender: "F", birth: "2011-03-17", times: [68800, 68100, 67500, 67900, 67100, 66600] },
  { id: "demo-santiago", name: "Santiago Mora", gender: "M", birth: "2010-10-19", times: [62600, 61800, 61100, 61500, 60700, 60100] },
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
