import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { compactCells, compactHeaders, compactKpis, type CompactRow } from "./compact-meet-report";
import { formatTimeDiff } from "@/utils/timeDiffUtils";
import { exportFilename } from "./file-delivery";

// Print palette is defined centrally, separately from screen/account colors.
export const compactPrintTheme = { ink: "#20282c", muted: "#525c61", paper: "#ffffff", band: "#edf1f2", success: "#08733c", failure: "#b13620" };
export interface CompactPdfOptions { rows: CompactRow[]; club: string; coach: string; meets: string[]; source: string; logo?: string | null; issued?: Date }
export function compactMeetPdf(options: CompactPdfOptions): File {
  const doc = new jsPDF({ orientation:"landscape", format:"a4" });
  const { rows } = options;
  if (!rows.length) throw new Error("No hay resultados para los filtros seleccionados.");
  const width = doc.internal.pageSize.getWidth(), height = doc.internal.pageSize.getHeight();
  const theme = compactPrintTheme;
  doc.setProperties({title:"Reporte Ejecutivo / Resumido por Competencia",author:options.coach || "Swim Lane Coach",creator:"Swim Lane Coach"});
  const issued = (options.issued ?? new Date()).toLocaleDateString("es-VE");
  const truncate = (text:string, max:number) => { let value = text; while (value.length && doc.getTextWidth(value)>max) value=value.slice(0,-1); return value===text?text:`${value.slice(0,-3)}...`; };
  const header = () => {
    let x=7;
    if (options.logo) { doc.addImage(options.logo,"PNG",7,5,14,14); x=24; }
    doc.setTextColor(theme.ink); doc.setFont("helvetica","bold");doc.setFontSize(11);
    doc.text(truncate(options.club || "Swim Lane Coach",width-x-7),x,9);
    doc.setFontSize(9);doc.text("Reporte Ejecutivo / Resumido por Competencia",x,14);
    doc.setFont("helvetica","normal");doc.setFontSize(8);
    doc.text(truncate(options.meets.join(" | "),width-x-7),x,18);
    doc.setFontSize(7);doc.text(truncate(`Emisión: ${issued} · Entrenador: ${options.coach || "—"}`,width-14),7,23);
  };
  const body: ({content:string;colSpan?:number;styles?:{fillColor:string;fontStyle:"bold"}} | string)[][]=[];
  let last="";
  for (const row of rows) {
    if (last!==row.athleteId) { body.push([{content:row.athlete,colSpan:7,styles:{fillColor:theme.band,fontStyle:"bold"}}]);last=row.athleteId; }
    body.push(compactCells(row));
  }
  const colored = new Map<number,CompactRow>();
  let index=0, previous="";
  for (const row of rows) { if (previous!==row.athleteId) { index++;previous=row.athleteId; } colored.set(index++,row); }
  const kpi=compactKpis(rows);
  body.push([{content:`TOTAL · ${kpi.swims} pruebas nadadas · ${kpi.pbs} PB (${kpi.pbPercent}%) · ${kpi.targets} objetivos logrados · Tiempo descontado: ${formatTimeDiff(-kpi.savedMs)}s`,colSpan:7,styles:{fillColor:theme.band,fontStyle:"bold"}}]);
  autoTable(doc,{
    startY:27,margin:{left:7,right:7,top:27,bottom:28},head:[compactHeaders],body,
    theme:"grid",showHead:"everyPage",rowPageBreak:"avoid",
    styles:{font:"helvetica",fontSize:8,cellPadding:1.6,textColor:theme.ink,lineColor:theme.band,lineWidth:0.15,overflow:"linebreak"},
    headStyles:{fillColor:theme.ink,textColor:theme.paper,fontStyle:"bold"},
    columnStyles:{0:{cellWidth:33},1:{cellWidth:63},2:{cellWidth:25},3:{cellWidth:27},4:{cellWidth:26},5:{cellWidth:42},6:{cellWidth:67}},
    didParseCell: data=>{const row=colored.get(data.row.index);if(data.section!=="body"||!row)return;if(data.column.index===5&&row.pbDiffMs!=null)data.cell.styles.textColor=row.pbDiffMs<0?theme.success:row.pbDiffMs>0?theme.failure:theme.muted;if(data.column.index===6&&row.targetDiffMs!=null){data.cell.styles.textColor=row.targetDiffMs<=0?theme.success:theme.failure;data.cell.styles.fontStyle="bold";}},
    didDrawPage:header,
  });
  for(let p=1;p<=doc.getNumberOfPages();p++){
    doc.setPage(p);doc.setFont("helvetica","normal");doc.setFontSize(7);doc.setTextColor(theme.muted);
    const notes=[options.source,"PB histórico: mejor tiempo disponible; Diff PB: mejor registro de fecha estrictamente anterior, misma prueba/piscina.","Edad para mínimas: 31 de diciembre del año de competencia. Sin orden fiable, nados del mismo día no se comparan entre sí.","* Fecha de inicio del torneo: el resultado no guarda fecha individual; confirme la fecha de cada prueba en la vista previa."];
    const lines=notes.flatMap(n=>doc.splitTextToSize(n,width-14) as string[]);
    doc.text(lines,7,height-23,{lineHeightFactor:1.12});
    doc.text("Swim Lane Coach · Compatible con Meet Manager y Team Manager",7,height-4);
    doc.text(`${p} / ${doc.getNumberOfPages()}`,width-7,height-4,{align:"right"});
  }
  return new File([doc.output("blob")],exportFilename("Swim Lane Coach", "_reporte_ejecutivo.pdf"),{type:"application/pdf"});
}

/** Rasterize private signed logos locally; no third-party image service. */
export async function compactLogo(url: string | null): Promise<string | null> {
  if (!url) return null;
  const response=await fetch(url);if(!response.ok)throw new Error("No se pudo cargar el logo del club.");
  const bitmap=await createImageBitmap(await response.blob());
  const canvas=document.createElement("canvas");canvas.width=160;canvas.height=160;
  const ctx=canvas.getContext("2d");if(!ctx){bitmap.close();return null;}
  const scale=Math.min(160/bitmap.width,160/bitmap.height);
  ctx.drawImage(bitmap,(160-bitmap.width*scale)/2,(160-bitmap.height*scale)/2,bitmap.width*scale,bitmap.height*scale);bitmap.close();
  return canvas.toDataURL("image/png");
}