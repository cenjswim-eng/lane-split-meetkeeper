import { Copy, Mail, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from './ui/button';
import { trackEvent } from '@/lib/marketing-analytics';

export function ShareLinkActions({ url }: { url: string }) {
  return <div className="flex flex-wrap gap-3">
    <Button variant="outline" onClick={async () => {
      try { await navigator.clipboard.writeText(url); trackEvent('report_shared', { channel: 'copy' }); toast.success('Enlace copiado'); }
      catch { toast.error('No se pudo copiar el enlace.'); }
    }}><Copy />Copiar enlace</Button>
    <Button asChild><a href={`https://wa.me/?text=${encodeURIComponent(`Reporte · Swim Lane Coach\n${url}`)}`} target="_blank" rel="noopener noreferrer" onClick={() => trackEvent('report_shared', { channel: 'whatsapp' })}><MessageCircle />Compartir por WhatsApp</a></Button>
    <Button asChild variant="outline"><a href={`mailto:?subject=${encodeURIComponent('Reporte · Swim Lane Coach')}&body=${encodeURIComponent(url)}`} onClick={() => trackEvent('report_shared', { channel: 'email' })}><Mail />Compartir por correo</a></Button>
  </div>;
}