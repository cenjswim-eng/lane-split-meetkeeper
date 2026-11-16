import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { privateSurname,type ReportPrivacy,type ReportBrand } from './report-brand';
import { brandPdf } from './branded-pdf';
import { formatTime,eventLabel } from './swim';
import type { coachQuery } from './coach-data';
import { internalRanking,aquaRanking } from './entry-rules';
export type CoachData=Awaited<ReturnType<NonNullable<typeof coachQuery.queryFn>>>;
export type SharedSelection={kind:'athlete'|'meet'|'ranking';clubId:string;athleteId?:string|undefined;meetId?:string|undefined};
/** A fresh, selected-club snapshot: never publish the original full/private PDF. */
export async function shareablePdf(data:CoachData,selection:SharedSelection,privacy:ReportPrivacy,brand:ReportBrand){
 const athletes=data.athletes.filter(a=>a.club_id===selection.clubId);const ids=new Set(athletes.map(a=>a.id));
 if(selection.kind==='athlete'&&!ids.has(selection.athleteId??''))throw Error('El atleta no pertenece al club seleccionado.');
 const results=data.results.filter(r=>ids.has(r.athlete_id)&&(selection.kind!=='athlete'||r.athlete_id===selection.athleteId)&&(selection.kind!=='meet'||r.meets?.id===selection.meetId));
 const rows=selection.kind==='ranking'?privacy.aqua?aquaRanking(results):internalRanking(results):results;
 if(!rows.length)throw Error('No hay resultados de este club para compartir.');
 const doc=new jsPDF({orientation:'landscape'});const title=selection.kind==='athlete'?'Reporte individual':selection.kind==='meet'?'Resultados de competencia':'Ranking del club';
 doc.setFontSize(16);doc.text(title,14,16);
 const columns=['Atleta','Prueba','Piscina','Tiempo','Competencia','Fecha',...(privacy.birthDate?['Nacimiento']:[]),...(privacy.aqua?['AQUA']:[])];
 autoTable(doc,{startY:24,head:[columns],body:rows.map(r=>{const a=athletes.find(a=>a.id===r.athlete_id);return [`${a?.first_name??''} ${privateSurname(a?.last_name??'',privacy.fullSurname)}`,r.events?eventLabel(r.events.distance,r.events.stroke):'—',r.course??'—',r.is_dq?'DQ':formatTime(r.final_time_ms),r.meets?.name??'—',r.meets?.start_date??'—',...(privacy.birthDate?[a?.birth_date??'—']:[]),...(privacy.aqua?[(r as {aqua_points?:number|null}).aqua_points??'—']:[])];}),styles:{fontSize:8},headStyles:{fillColor:brand.primary,textColor: '#182e39'},margin:{bottom:16}});
 return {file:await brandPdf(new File([doc.output('blob')],'reporte_compartido.pdf',{type:'application/pdf'}),brand,title),title};
}