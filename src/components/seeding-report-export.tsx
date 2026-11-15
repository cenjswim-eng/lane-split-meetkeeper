import { useState } from 'react';
import { FileDown,Download,Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog,DialogContent,DialogHeader,DialogTitle } from '@/components/ui/dialog';
import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from '@/components/ui/select';
import { canShareFile,downloadFile,shareFile } from '@/lib/file-delivery';
import type { SeedingReport } from '@/lib/seeding-reports';
export function SeedingReportExport({prepare,disabled}:{prepare:(kind:SeedingReport)=>Promise<File>;disabled:boolean}){
 const [open,setOpen]=useState(false),[kind,setKind]=useState<SeedingReport>('program'),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false);
 return <Dialog open={open} onOpenChange={v=>{setOpen(v);setFile(null);}}><Button variant="outline" disabled={disabled} onClick={()=>setOpen(true)}><FileDown/>PDF / Impresión</Button><DialogContent aria-describedby={undefined}><DialogHeader><DialogTitle>Reportes de sesión</DialogTitle></DialogHeader><Select value={kind} onValueChange={v=>{setKind(v as SeedingReport);setFile(null);}}><SelectTrigger aria-label="Reporte"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="psych">Psych Sheet · Pre-siembra</SelectItem><SelectItem value="program">Meet Program · Programa</SelectItem><SelectItem value="timers">Cronometristas por carril</SelectItem></SelectContent></Select>{file?<><p className="break-all text-sm">{file.name}</p>{canShareFile(file)&&<Button onClick={()=>void shareFile(file).catch(e=>toast.error(e.message))}><Share2/>Compartir</Button>}<Button onClick={()=>downloadFile(file)}><Download/>Descargar PDF</Button></>:<Button disabled={busy} onClick={async()=>{setBusy(true);try{setFile(await prepare(kind));}catch(e){toast.error(e instanceof Error?e.message:'No se pudo generar.');}finally{setBusy(false);}}}><FileDown/>{busy?'Preparando…':'Preparar PDF'}</Button>}</DialogContent></Dialog>;
}