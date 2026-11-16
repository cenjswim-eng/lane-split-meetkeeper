import { createFileRoute } from '@tanstack/react-router';
import { useSuspenseQuery } from '@tanstack/react-query';
import { achievementsQuery } from '@/lib/achievement-data';
import { AchievementList } from '@/components/achievement-list';

export const Route=createFileRoute('/_authenticated/achievements')({
  head:()=>({meta:[{title:'Logros del club — Swim Lane Coach'},{name:'description',content:'Mejores marcas personales, primeras marcas y mínimas alcanzadas en el historial privado del club.'},{property:'og:title',content:'Logros del club — Swim Lane Coach'},{property:'og:description',content:'Historial privado de logros de los atletas por prueba, piscina y competencia.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
  loader:({context})=>context.queryClient.ensureQueryData(achievementsQuery),component:Achievements,
});
function Achievements(){const {data}=useSuspenseQuery(achievementsQuery);return <div className="space-y-6"><header><h1 className="text-4xl font-bold">Logros del club</h1><p className="mt-2 text-sm text-muted-foreground">Historial completo · MP y primera marca por prueba/piscina · Primera mínima por temporada y categoría</p><p className="mt-1 text-xs text-muted-foreground">Sin hora de prueba, se usa el mejor nado del día frente a fechas anteriores. Mínimas según la versión oficial activa.</p></header><AchievementList rows={data} filters/></div>;}