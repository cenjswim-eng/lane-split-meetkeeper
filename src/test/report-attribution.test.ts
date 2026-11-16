import { expect,it } from 'vitest';
import { PDFDocument,PDFName,PDFDict,PDFString } from 'pdf-lib';
import { brandPdf } from '@/lib/branded-pdf';
import { neutralBrand } from '@/lib/report-brand';
it('preserves all report pages and adds a branded website link on each page',async()=>{
 const source=await PDFDocument.create();source.addPage([595,842]).drawText('Competition results');source.addPage([595,842]).drawText('Progress chart');
 const bytes=await source.save();
 const file={type:'application/pdf',name:'test.pdf',arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)} as File;
 const output=await brandPdf(file,neutralBrand('Club Ejemplo'),'Reporte');
 const result=await PDFDocument.load(await new Promise<ArrayBuffer>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result as ArrayBuffer);reader.onerror=reject;reader.readAsArrayBuffer(output);}));
 expect(result.getPageCount()).toBe(2);expect(result.getAuthor()).toBe('Club Ejemplo');
 for(const page of result.getPages()){
  const annotations=page.node.Annots();expect(annotations?.size()).toBe(1);
  if(!annotations)throw Error('Missing website link');
  const action=annotations.lookup(0,PDFDict).lookup(PDFName.of('A'),PDFDict);
  expect(action.lookup(PDFName.of('URI'),PDFString).decodeText()).toBe('https://swimlanecoach.app/?utm_source=report&utm_medium=referral&utm_campaign=pdf');
 }
});