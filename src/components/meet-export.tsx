import { useState } from "react";
import { Download, FileArchive, LoaderCircle, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { canShareFile, downloadFile, shareFile, zipExport } from "@/lib/file-delivery";
import { validateEntrySdif, entryFileFingerprint, type EntryValidation } from '@/lib/hytek/entry-validation';
import { EntryImportConfirmation } from './entry-import-confirmation';
import { PdfPreview } from './pdf-preview';
import { loadReportBrand } from '@/lib/report-brand-data';
import { brandPdf } from '@/lib/branded-pdf';

export type ExportKind = "sd3" | "hy3" | "results" | "entries";

export function MeetExport({ name, prepare, entriesOnly = false,clubId }: { name: string; prepare: (kind: ExportKind) => Promise<File>; entriesOnly?: boolean;clubId?:string|undefined }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ExportKind>("sd3");
  const [file, setFile] = useState<File | null>(null);
  const [zip, setZip] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [packed, setPacked] = useState(false);
  const [validation,setValidation]=useState<EntryValidation|null>(null);
  const [hash,setHash]=useState('');
  const [delivered,setDelivered]=useState(false);
  const selected = packed ? zip : file;
  const shareable = selected ? canShareFile(selected) : false;

  async function generate() {
    setBusy(true);
    setFile(null);
    setZip(null);
    setValidation(null);setHash('');setDelivered(false);
    try {
      const original = await prepare(kind);
      const ready=original.type==='application/pdf'?await brandPdf(original,await loadReportBrand(clubId),name):original;
      if(entriesOnly&&kind==='sd3'){
        const bytes=await ready.arrayBuffer();
        const checked=validateEntrySdif(new TextDecoder('ascii').decode(bytes));
        setValidation(checked);setHash(await entryFileFingerprint(bytes));
        if(checked.errors.length){setFile(ready);return;}
      }
      const archive = kind === "sd3" ? await zipExport(ready) : null;
      setFile(ready);
      setZip(archive);
      setPacked(kind === "sd3" && !canShareFile(ready));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "No se pudo preparar el archivo.");
    } finally { setBusy(false); }
  }

  async function share() {
    if (!selected) return;
    setSharing(true);
    try { const result=await shareFile(selected);if(result==='shared')setDelivered(true); }
    catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo compartir. Puedes descargar el archivo."); }
    finally { setSharing(false); }
  }

  return (
    <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) { setFile(null); setZip(null);setValidation(null);setHash('');setDelivered(false); } }}>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><Share2 />{entriesOnly ? "Exportar para Meet Manager" : "Exportar"}</Button>
      <DialogContent className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto rounded-lg">
        <DialogHeader>
          <DialogTitle>{entriesOnly ? "Inscripciones para Meet Manager" : "Exportar competencia"}</DialogTitle>
          <DialogDescription className="break-words">{name}</DialogDescription>
        </DialogHeader>
        <Select value={kind} disabled={busy || sharing} onValueChange={(value: ExportKind) => { setKind(value); setFile(null); setZip(null); setPacked(false);setValidation(null);setHash('');setDelivered(false); }}>
          <SelectTrigger aria-label="Formato de exportación"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="sd3">{entriesOnly ? "SD3 · Inscripciones Meet Manager" : "SD3 · Compatible con Hy-Tek"}</SelectItem>
            {entriesOnly && <SelectItem value="hy3">HY3 · Inscripciones Hy-Tek</SelectItem>}
            {!entriesOnly && <SelectItem value="results">PDF · Marcas</SelectItem>}
            <SelectItem value="entries">PDF · Inscripción</SelectItem>
          </SelectContent>
        </Select>
        {!file ? <Button onClick={generate} disabled={busy}>{busy ? <LoaderCircle className="animate-spin" /> : <Download />}{busy ? "Preparando…" : "Preparar archivo"}</Button> : <>
          {zip && <div className="flex gap-2">
            <Button className="flex-1" variant={!packed ? "secondary" : "outline"} disabled={sharing} onClick={() => setPacked(false)}>SD3</Button>
            <Button className="flex-1" variant={packed ? "secondary" : "outline"} disabled={sharing} onClick={() => setPacked(true)}><FileArchive />ZIP</Button>
          </div>}
          <p className="break-all text-sm text-muted-foreground">{selected?.name}</p>
          {file.type==='application/pdf'&&<PdfPreview file={file}/>}
          {shareable && <Button onClick={share} disabled={sharing}><Share2 />{sharing ? "Compartiendo…" : "Compartir…"}</Button>}
          <Button variant="outline" disabled={sharing||!!validation?.errors.length} onClick={() => { if (selected) {downloadFile(selected);setDelivered(true);} }}><Download />Descargar archivo</Button>
          {validation&&hash&&<EntryImportConfirmation key={hash} validation={validation} file={file} hash={hash} delivered={delivered}/>}
        </>}
      </DialogContent>
    </Dialog>
  );
}