import { useState } from "react";
import { Download, FileText, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { canShareFile, downloadFile, shareFile } from "@/lib/file-delivery";
import { trackEvent } from '@/lib/marketing-analytics';
import { PdfPreview } from './pdf-preview';
import { loadReportBrand,brandQuery } from '@/lib/report-brand-data';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from './ui/select';
import { brandPdf } from '@/lib/branded-pdf';
import type { ReportBrand } from '@/lib/report-brand';

export function PdfExport({ title, prepare, label = "Exportar PDF", clubId }: { title: string; prepare: (brand?:ReportBrand) => File | Promise<File>; label?: string; clubId?:string|undefined }) {
  const {data:brands}=useSuspenseQuery(brandQuery);
  const [brandClub,setBrandClub]=useState(brands.clubs.length===1?brands.clubs[0]?.id??'neutral':'neutral');
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  return <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setFile(null); }}>
    <Button variant="outline" onClick={() => setOpen(true)}><FileText className="size-4" />{label}</Button>
    <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{label}</DialogDescription></DialogHeader>
      {!clubId&&!label.includes('Excel')&&!file&&<Select value={brandClub} disabled={busy} onValueChange={setBrandClub}><SelectTrigger aria-label="Marca del PDF"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="neutral">Swim Lane Coach · Neutro</SelectItem>{brands.clubs.map(c=><SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>}
      {!file ? <Button disabled={busy} onClick={async () => { setBusy(true); try { const brand=await loadReportBrand(clubId??(brandClub==='neutral'?undefined:brandClub));const ready=await prepare(brand);setFile(ready.type==='application/pdf'?await brandPdf(ready,brand,title):ready); } catch(e) { toast.error((e as Error).message); } finally { setBusy(false); } }}>{busy ? "Preparando…" : label.includes("Excel") || label === "Exportar" ? "Preparar archivo" : "Preparar PDF"}</Button> : <>
        <p className="break-all text-sm text-muted-foreground">{file.name}</p>
        {file.type==='application/pdf'&&<PdfPreview file={file}/>}
        {canShareFile(file) && <Button disabled={busy} onClick={async () => { setBusy(true); try { await shareFile(file); trackEvent("report_shared", {channel: "native_file"}); } catch(e) { toast.error((e as Error).message); } finally { setBusy(false); } }}><Share2 className="size-4" />Compartir…</Button>}
        <Button disabled={busy} variant="outline" onClick={() => downloadFile(file)}><Download className="size-4" />{file.type === "application/pdf" ? "Descargar PDF" : "Descargar archivo"}</Button>
      </>}
    </DialogContent>
  </Dialog>;
}