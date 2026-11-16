import {createFileRoute} from '@tanstack/react-router';
import {MeetRunConsole} from '@/components/meet-run-console';
import {seedingQuery} from '@/lib/seeding-data';
import {runResultsQuery} from '@/lib/meet-run-data';
export const Route=createFileRoute('/_authenticated/run')({
  staticData: { sitemap: false },head:()=>({meta:[{title:'Torneo en vivo — Swim Lane Coach'},{name:'description',content:'Consola privada de cronometraje, resultados y puntos por club y atleta.'},{property:'og:title',content:'Torneo en vivo — Swim Lane Coach'},{property:'og:description',content:'Operación privada por serie con tiempos, parciales y clasificación.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),loader:async({context})=>{await Promise.all([context.queryClient.ensureQueryData(seedingQuery),context.queryClient.ensureQueryData(runResultsQuery)]);},component:MeetRunConsole});