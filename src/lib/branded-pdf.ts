import { PDFDocument,StandardFonts,rgb } from 'pdf-lib';
import { contrastInk,type ReportBrand } from './report-brand';
export async function brandPdf(file:File,brand:ReportBrand,title:string):Promise<File>{
 if(file.type!=='application/pdf')return file;
 const source=await PDFDocument.load(await file.arrayBuffer()),doc=await PDFDocument.create();
 const font=await doc.embedFont(StandardFonts.Helvetica),bold=await doc.embedFont(StandardFonts.HelveticaBold);
 const color=(hex:string)=>{const n=parseInt(hex.slice(1),16);return rgb(((n>>16)&255)/255,((n>>8)&255)/255,(n&255)/255);};
 const ink=color('#182e39'),muted=color('#586873'),primary=color(brand.primary),secondary=color(brand.secondary);
 const safe=(s:string)=>s.replace(/[^\x20-\xff]/g,' ');
 const clip=(s:string,max:number,size:number)=>{let v=safe(s);while(v&&font.widthOfTextAtSize(v,size)>max)v=v.slice(0,-1);return v;};
 const logo=brand.logo?await doc.embedPng(brand.logo):null;
 const pages=await doc.embedPages(source.getPages());
 pages.forEach((embedded,i)=>{const width=embedded.width,height=embedded.height,page=doc.addPage([width,height]);
  const availableHeight=height-86,scale=Math.min(1,availableHeight/height);const drawW=width*scale;
  page.drawPage(embedded,{x:(width-drawW)/2,y:34,width:drawW,height:height*scale});
  page.drawRectangle({x:0,y:height-47,width,height:47,color:primary});
  let x=16;if(logo){const dims=logo.scaleToFit(66,30);page.drawImage(logo,{x:16+(66-dims.width)/2,y:height-39+(30-dims.height)/2,width:dims.width,height:dims.height});x=90;}
  page.drawText(clip(brand.name,width-x-16,12),{x,y:height-20,size:12,font:bold,color:color(contrastInk(brand.primary))});
  page.drawText(clip(title,width-x-16,9),{x,y:height-34,size:9,font,color:color(contrastInk(brand.primary))});
  page.drawLine({start:{x:16,y:29},end:{x:width-16,y:29},thickness:1,color:secondary});
  page.drawText(clip([brand.location,brand.motto,brand.contact].filter(Boolean).join(' · '),width-32,7),{x:16,y:19,size:7,font,color:ink});
  page.drawText(`Generado con Swim Lane Coach · ${new Date().toLocaleDateString('es-VE')}`,{x:16,y:8,size:7,font,color:muted});
  const number=`${i+1} / ${pages.length}`;page.drawText(number,{x:width-16-font.widthOfTextAtSize(number,7),y:8,size:7,font,color:muted});
 });
 doc.setTitle(safe(title));doc.setAuthor(safe(brand.name));doc.setCreator('Swim Lane Coach');
 return new File([new Uint8Array(await doc.save())],file.name,{type:'application/pdf'});
}