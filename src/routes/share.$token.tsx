import { createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Download } from 'lucide-react';
import { sharedReportInfo } from '@/lib/shared-report.functions';
import { Button } from '@/components/ui/button';
import { contrastInk } from '@/lib/report-brand';
export const Route=createFileRoute('/share/$token')({
 head:()=>({meta:[{title:'Reporte compartido — Swim Lane Coach'},{name:'description',content:'Reporte de solo lectura compartido por el entrenador.'},{property:'og:title',content:'Reporte compartido — Swim Lane Coach'},{property:'og:description',content:'Reporte autorizado del club, disponible durante la vigencia elegida.'},{property:'og:type',content:'website'},{name:'twitter:card',content:'summary'},{name:'robots',content:'noindex, nofollow'}]}),
 loader:({params})=>sharedReportInfo({data:{token:params.token}}),component:SharedReport,
});
function SharedReport(){const info=Route.useLoaderData(),{token}=Route.useParams(),open=useServerFn(sharedReportInfo);useEffect(()=>{if(info)void open({data:{token,count:true}});},[token]);
 if(!info)return <main className="mx-auto max-w-xl space-y-3 p-8"><h1 className="text-3xl font-bold">Reporte no disponible</h1><p>El enlace venció, fue revocado o no existe.</p></main>;
 const b=info.brand;return <main className="mx-auto min-h-screen max-w-5xl space-y-5 p-4 sm:p-8" style={{'--primary':b.primary,'--accent':b.secondary,'--primary-foreground':contrastInk(b.primary)} as React.CSSProperties}><header className="flex flex-wrap items-center gap-4 border-t-4 border-primary py-5">{b.logo&&<img src={b.logo} alt={`Logo de ${b.name}`} className="h-16 w-40 object-contain"/>}<div className="min-w-0"><p className="break-words text-xl font-semibold">{b.name}</p><h1 className="mt-2 break-words text-3xl font-bold">{info.title}</h1><p className="mt-2 text-xs text-muted-foreground">Solo lectura · {info.expires?`Disponible hasta ${new Date(info.expires).toLocaleDateString('es')}`:'Sin vencimiento'}</p></div></header><Button asChild><a href={`/report-file/${token}`} target="_blank" rel="noopener noreferrer" download="reporte.pdf"><Download/>Descargar PDF</a></Button><object data={`/report-file/${token}`} type="application/pdf" aria-label="Reporte compartido en PDF" className="h-[65dvh] w-full rounded-md border"><p className="p-6 text-sm">Abre o descarga el PDF con el botón anterior.</p></object><footer className="border-t border-accent pt-4 text-sm"><p>{[b.location,b.motto,b.contact].filter(Boolean).join(' · ')}</p><p className="mt-2 text-xs text-muted-foreground">Generado con Swim Lane Coach</p></footer></main>;
}