import { jsPDF } from 'jspdf';
import { reportHeading, reportMetrics, finishReport } from './report-layout';
import { brandedTable, setReportTableBrand, setProfessionalReportTheme } from './report-table-theme';
import type { ReportBrand } from './report-brand';
import { attendanceSummary, attendanceStatus, trainingSessions, type AttendanceRow } from './attendance';
import { exportFilename } from './file-delivery';
export function attendancePdf(title:string,from:string,to:string,rows:readonly AttendanceRow[],athletes:readonly {id:string;first_name:string;last_name:string}[],brand?:ReportBrand){
 const doc=new jsPDF({orientation:'landscape'});setReportTableBrand(doc,brand);
 setProfessionalReportTheme(doc);
 const headingY=reportHeading(doc,'Reporte de asistencia',`${title} · ${from} a ${to}`,brand);
 const summary=attendanceSummary(rows);
 const contentY=reportMetrics(doc,[{label:'Asistencia del período',value:summary.percentage==null?'—':`${summary.percentage}%`},{label:'Registros',value:String(summary.total)},{label:'Presentes + tarde',value:String(summary.attended)},{label:'Ausentes / justificadas',value:`${summary.absent} / ${summary.excused}`}],headingY,brand);
 const y=()=> (doc as jsPDF & {lastAutoTable?:{finalY:number}}).lastAutoTable?.finalY??34;
 brandedTable(doc,{startY:contentY,margin:{bottom:20},head:[['Nadador','Registros','Presentes','Tarde','Ausentes','Justificadas','Asistencia']],body:athletes.filter(a=>rows.some(r=>r.athlete_id===a.id)).map(a=>{const s=attendanceSummary(rows.filter(r=>r.athlete_id===a.id));return [`${a.last_name}, ${a.first_name}`,s.total,s.present,s.late,s.absent,s.excused,`${s.percentage}%`];}),styles:{fontSize:8}});
 const names=new Map(athletes.map(a=>[a.id,`${a.last_name}, ${a.first_name}`]));
 if(rows.length)brandedTable(doc,{startY:y()+8,margin:{bottom:20},head:[['Fecha','Sesión','Nadador','Estado','Observación']],body:rows.map(r=>[r.training_date,trainingSessions[r.session],names.get(r.athlete_id)??'Nadador',attendanceStatus[r.status],r.notes||'—']),styles:{fontSize:8}});
 else {doc.setFontSize(10);doc.text('Sin asistencia registrada en el periodo seleccionado.',14,y()+10);}
 for(let page=1;page<=doc.getNumberOfPages();page++){doc.setPage(page);doc.setFontSize(7);doc.text('Asistencia: presentes + tarde / registros. Los días sin registrar no cuentan como ausencia.',14,doc.internal.pageSize.getHeight()-14);}
 finishReport(doc,brand);
 return new File([doc.output('blob')],exportFilename(title,'_asistencia.pdf'),{type:'application/pdf'});
}
