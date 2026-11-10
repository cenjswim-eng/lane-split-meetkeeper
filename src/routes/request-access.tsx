import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Button } from '@/components/ui/button';
import { requestAccess } from '@/lib/access-approval.functions';

export const Route = createFileRoute('/request-access')({
  head: () => ({ meta: [{ title: 'Solicitud de acceso — Swim Lane Coach' }, { name: 'description', content: 'Solicita autorización del dueño para acceder a Swim Lane Coach.' }, { property: 'og:title', content: 'Solicitud de acceso — Swim Lane Coach' }, { name: 'twitter:title', content: 'Solicitud de acceso — Swim Lane Coach' }, { property: 'og:description', content: 'Acceso privado sujeto a aprobación del dueño.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  component: RequestPage,
});

function RequestPage() {
  const submit = useServerFn(requestAccess);
  const [status, setStatus] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  async function request() {
    setBusy(true);
    try { const result = await submit(); setStatus(result.status); setNotice(result.notice); }
    catch { setNotice('Inicia sesión con tu cuenta y confirma tu correo antes de solicitar acceso.'); }
    finally { setBusy(false); }
  }
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-6 py-12"><div className="lane-line" /><h1 className="text-4xl font-bold uppercase">Acceso privado</h1><p className="text-muted-foreground">El dueño debe autorizar tu cuenta antes de que puedas ver los datos del programa.</p>
    {status === 'approved' ? <><p className="text-success">Tu cuenta tiene acceso autorizado.</p><Button asChild><Link to="/athletes">Entrar al programa</Link></Button></> : status === 'pending' ? <p className="text-accent">Tu solicitud está pendiente de aprobación.</p> : status === 'rejected' ? <p className="text-destructive">El dueño rechazó tu solicitud de acceso.</p> : status === 'suspended' ? <p className="text-destructive">Tu acceso está suspendido por falta de renovación. Contacta al dueño para reactivarlo.</p> : <Button onClick={request} disabled={busy}>{busy ? 'Enviando…' : 'Solicitar acceso'}</Button>}
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    {status === 'pending' && <Button variant="outline" onClick={request} disabled={busy}>Consultar aprobación</Button>}
    <Button variant="ghost" asChild><Link to="/auth">Iniciar sesión con otra cuenta</Link></Button>
  </main>;
}