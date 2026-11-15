import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatTime } from './swim';
import { exportFilename } from './file-delivery';
import type { SeedAssignment } from '@/utils/seedingEngine';
export interface ProgramEvent { id:string;label:string;rows:SeedAssignment[] }
export type SeedingReport='psych'|'program'|'timers';
export function seedingPdf(meet:string,session:number,events:ProgramEvent[],kind:SeedingReport,lanes:number,closed:boolean) {
 const doc=new jsPDF();
 const title=kind==='psych'?'Psych Sheet · Pre-siembra':kind==='program'?'Meet Program · Programa':'Lane Timer Sheets · Cronometristas';
 doc.setProperties({title:`${title} — ${meet}`,author:'Swim Lane Coach',creator:'Swim Lane Coach'});
 function header(extra=''){doc.setFont('helvetica','bold');doc.setFontSize(13);doc.text(doc.splitTextToSize(meet,180),14,14);doc.setFont('helvetica','normal');doc.setFontSize(9);doc.text(`${title} · Sesión ${session}${extra} · ${closed?'Cerrada':'Borrador'}`,14,27);}
 header();
 const time=(r:SeedAssignment)=>r.rankedTimeMs==null?'NT':`${formatTime(r.rankedTimeMs)}${r.converted?' *':''}`;
 if(kind==='psych'){
 let y=34;for(const event of events){if(y>245){doc.addPage();header();y=34;}doc.setFontSize(10);doc.text(doc.splitTextToSize(event.label,180),14,y);autoTable(doc,{startY:y+8,margin:{top:34,bottom:20},head:[['#','Atleta / equipo','Edad','Club','Inscripción']],body:[...event.rows].sort((a,b)=>(a.rankedTimeMs??Infinity)-(b.rankedTimeMs??Infinity)||a.id.localeCompare(b.id)).map((r,i)=>[i+1,r.name,r.age??'—',r.club??'—',time(r)]),styles:{fontSize:8},headStyles:{fillColor:40},didDrawPage:()=>{if(doc.getCurrentPageInfo().pageNumber>1)header();}});y=(doc as jsPDF&{lastAutoTable?:{finalY:number}}).lastAutoTable?.finalY??y;y+=12;}
 } else if(kind==='program'){
 let column=0;let positions=[35,35];
 for(const event of events){const heats=[...new Set(event.rows.map(r=>r.heat))].sort((a,b)=>a-b);for(const heat of heats){const rows=event.rows.filter(r=>r.heat===heat).sort((a,b)=>a.lane-b.lane);const heading=doc.splitTextToSize(event.label,86) as string[];const height=heading.length*4+16+rows.reduce((n,r)=>n+(doc.splitTextToSize(`${r.lane}  ${r.name}`,86).length+doc.splitTextToSize(`${r.age??'—'} años · ${r.club??'—'} · ${time(r)}`,82).length)*4+2,0);if((positions[column]??35)+height>271){column=1-column;if((positions[column]??35)+height>271){doc.addPage();header();positions=[35,35];column=0;}}const x=column===0?14:110;let y=positions[column]??35;doc.setFont('helvetica','bold');doc.setFontSize(8);doc.text(heading,x,y);y+=heading.length*4+3;doc.text(`Serie ${heat}`,x,y);y+=5;doc.setFont('helvetica','normal');for(const r of rows){const name=doc.splitTextToSize(`${r.lane}  ${r.name}`,86) as string[];const detail=doc.splitTextToSize(`${r.age??'—'} años · ${r.club??'—'} · ${time(r)}`,82) as string[];doc.text(name,x,y);y+=name.length*4;doc.text(detail,x+4,y);y+=detail.length*4+2;}positions[column]=y+7;column=1-column;}}
 }else{
 for(let lane=1;lane<=lanes;lane++){if(lane>1)doc.addPage();header(` · Carril ${lane}`);const rows=events.flatMap(e=>e.rows.filter(r=>r.lane===lane).sort((a,b)=>a.heat-b.heat).map(r=>[e.label,r.heat,r.name,r.age??'—',r.club??'—',time(r),'','','']));autoTable(doc,{startY:34,margin:{top:34,bottom:20},head:[['Prueba','Serie','Atleta / equipo','Edad','Club','Siembra','Reloj 1','Reloj 2','Oficial']],body:rows,styles:{fontSize:8,minCellHeight:16},headStyles:{fillColor:40},didDrawPage:()=>header(` · Carril ${lane}`)});}
 }
 for(let page=1;page<=doc.getNumberOfPages();page++){doc.setPage(page);doc.setFont('helvetica','normal');doc.setFontSize(7);doc.text('Swim Lane Coach · Compatible con Meet Manager y Team Manager',14,282);doc.text('* Tiempo convertido por factor del organizador. Edad al 31 de diciembre.',14,286);doc.text(`${page} / ${doc.getNumberOfPages()}`,190,282,{align:'right'});}
 return new File([doc.output('blob')],exportFilename(meet,`_sesion_${session}_${kind}.pdf`),{type:'application/pdf'});
}