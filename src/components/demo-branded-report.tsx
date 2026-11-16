import { useState } from 'react';
import { FileText,Download } from 'lucide-react';
import { Button } from './ui/button';
import { PdfPreview } from './pdf-preview';
import { demoAthletes,demoSwims } from '@/lib/demo-data';
import { downloadFile } from '@/lib/file-delivery';
import { toast } from 'sonner';
/** Local fictional report only: this module never imports a database client. */
export function DemoBrandedReport(){
 const [file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false);
 async function prepare(){setBusy(true);try{
  const [{jsPDF},{default:autoTable},{brandPdf},{neutralBrand}]=await Promise.all([import('jspdf'),import('jspdf-autotable'),import('@/lib/branded-pdf'),import('@/lib/report-brand')]);
  const canvas=document.createElement('canvas');canvas.width=600;canvas.height=240;const ctx=canvas.getContext('2d');const brand=neutralBrand('Club Horizonte · Demo');
  if(ctx){ctx.fillStyle=brand.primary;ctx.fillRect(0,0,600,240);ctx.fillStyle=brand.secondary;ctx.font='bold 56px sans-serif';ctx.textAlign='center';ctx.fillText('HORIZONTE',300,145);brand.logo=canvas.toDataURL('image/png');}
  brand.location='Ciudad de ejemplo';brand.motto='Datos ficticios · No son marcas oficiales';
  const doc=new jsPDF({orientation:'landscape'});doc.text('Resultados de ejemplo',14,16);
  autoTable(doc,{startY:24,head:[['Atleta','Competencia','Fecha','100 Libre · LCM']],body:demoAthletes.slice(0,4).flatMap(a=>demoSwims(a).map(s=>[a.name,s.meet.name,s.meet.date,`${(s.time/1000).toFixed(2)} s`])),styles:{fontSize:8},headStyles:{fillColor:brand.primary}});
  setFile(await brandPdf(new File([doc.output('blob')],'Club_Horizonte_Demo.pdf',{type:'application/pdf'}),brand,'Reporte de ejemplo'));
 }catch{toast.error('No se pudo preparar el ejemplo.');}finally{setBusy(false);}}
 return <section className="space-y-4 border-y py-5"><div className="flex items-center gap-3"><span className="flex size-12 items-center justify-center rounded-md bg-primary text-primary-foreground"><FileText/></span><div><h2>Club Horizonte · Reporte PDF</h2><p className="text-xs text-muted-foreground">Logo, colores y resultados ficticios</p></div></div>{file?<><PdfPreview file={file}/><Button onClick={()=>downloadFile(file)}><Download/>Descargar ejemplo PDF</Button></>:<Button disabled={busy} onClick={()=>void prepare()}><FileText/>{busy?'Preparando…':'Vista previa del ejemplo PDF'}</Button>}</section>;
}