import { useState } from 'react';
import { Download,Share2,FileDown } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog,DialogContent,DialogHeader,DialogTitle } from '@/components/ui/dialog';
import { canShareFile,downloadFile,shareFile } from '@/lib/file-delivery';
export function EventFileDownload({prepare}:{prepare:()=>Promise<File>}) {
 const [open,setOpen]=useState(false),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false);
 async function generate(){setBusy(true);try{setFile(await prepare());}catch(e){toast.error((e as Error).message);}finally{setBusy(false);}}
 return <Dialog open={open} onOpenChange={v=>{setOpen(v);if(!v)setFile(null);}}><Button variant="outline" onClick={()=>setOpen(true)}><FileDown/>Exportar EV3</Button><DialogContent><DialogHeader><DialogTitle>Convocatoria EV3</DialogTitle></DialogHeader>{file?<><p className="break-all text-sm">{file.name}</p>{canShareFile(file)&&<Button onClick={()=>void shareFile(file).catch(e=>toast.error(e.message))}><Share2/>Compartir</Button>}<Button onClick={()=>downloadFile(file)}><Download/>Descargar EV3</Button></>:<Button disabled={busy} onClick={generate}><FileDown/>{busy?'Preparando…':'Preparar convocatoria'}</Button>}</DialogContent></Dialog>;
}