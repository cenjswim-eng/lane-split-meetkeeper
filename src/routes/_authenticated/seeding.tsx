import { createFileRoute } from '@tanstack/react-router';
import { SeedingManagerView } from '@/components/seeding-manager-view';
import { seedingQuery } from '@/lib/seeding-data';
export const Route=createFileRoute('/_authenticated/seeding')({
 head:()=>({meta:[{title:'Organización de torneos — Swim Lane Coach'},{name:'description',content:'Sembrado de series y carriles, programa de competencia y hojas de cronometristas por sesión.'},{property:'og:title',content:'Organización de torneos — Swim Lane Coach'},{property:'og:description',content:'Sembrado, series, bajas y programas de competencia privados para entrenadores.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary_large_image'}]}),
 loader:({context})=>context.queryClient.ensureQueryData(seedingQuery),component:SeedingManagerView,
});