import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useState } from "react";

export function ShareSummary({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return <Dialog open={open} onOpenChange={setOpen}>
    <Button variant="outline" className="h-11" onClick={() => setOpen(true)}><MessageCircle />WhatsApp</Button>
    <DialogContent className="w-[calc(100%-2rem)] rounded-lg"><DialogHeader><DialogTitle>Compartir resumen</DialogTitle><DialogDescription>Revisa la información del club antes de enviarla.</DialogDescription></DialogHeader><p className="max-h-72 overflow-y-auto whitespace-pre-wrap break-words text-sm">{text}</p><Button asChild><a href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener noreferrer"><MessageCircle />Compartir por WhatsApp</a></Button></DialogContent>
  </Dialog>;
}