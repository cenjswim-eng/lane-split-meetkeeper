import { useEffect,useRef,useState } from 'react';
import { ChevronLeft,ChevronRight } from 'lucide-react';
import { Button } from './ui/button';
export function PdfPreview({file,src}:{file?:File|undefined;src?:string|undefined}){
 const canvas=useRef<HTMLCanvasElement>(null);const [page,setPage]=useState(1),[total,setTotal]=useState(0),[error,setError]=useState('');
 useEffect(()=>{let active=true;let cleanup:(()=>void)|undefined;setError('');
  async function render(){try{const pdfjs=await import('pdfjs-dist/legacy/build/pdf.mjs');const worker=await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');pdfjs.GlobalWorkerOptions.workerSrc=worker.default;
   const bytes=file?await file.arrayBuffer():src?await (await fetch(src,{cache:'no-store'})).arrayBuffer():null;if(!bytes)return;
   const task=pdfjs.getDocument({data:new Uint8Array(bytes)});cleanup=()=>{void task.destroy();};const doc=await task.promise;if(!active)return;setTotal(doc.numPages);const pdfPage=await doc.getPage(Math.min(page,doc.numPages));const viewport=pdfPage.getViewport({scale:1.5});const c=canvas.current;if(!c)return;const context=c.getContext('2d');if(!context)return;c.width=viewport.width;c.height=viewport.height;await pdfPage.render({canvasContext:context,canvas:c,viewport}).promise;
  }catch{if(active)setError('Vista previa no disponible. Puedes descargar el PDF.');}}
  void render();return()=>{active=false;cleanup?.();};
 },[file,src,page]);
 return <div className="space-y-2" aria-label="Vista previa del PDF"><div className="max-h-[65dvh] overflow-auto rounded-md border bg-card"><canvas ref={canvas} className="h-auto w-full" aria-label={`Página ${page} del PDF`}/>{error&&<p className="p-4 text-sm">{error}</p>}</div>{total>1&&<div className="flex items-center justify-center gap-3"><Button variant="outline" size="icon" aria-label="Página anterior" disabled={page<=1} onClick={()=>setPage(p=>p-1)}><ChevronLeft/></Button><span className="text-xs">{page} / {total}</span><Button variant="outline" size="icon" aria-label="Página siguiente" disabled={page>=total} onClick={()=>setPage(p=>p+1)}><ChevronRight/></Button></div>}</div>;
}