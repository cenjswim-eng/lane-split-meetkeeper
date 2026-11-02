import { createFileRoute } from '@tanstack/react-router';
import { queryOptions, useSuspenseQuery } from '@tanstack/react-query';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { decideAccess, suspendAccess } from '@/lib/access-approval.functions';
import { Button } from '@/components/ui/button';
import { Ban, Check, RotateCcw, X } from 'lucide-react';

const requestsQuery = queryOptions({ queryKey: ['access-requests'], queryFn: async () => {
  const { data: owner, error } = await supabase.rpc('is_app_owner');
  if (error) throw error;
  if (!owner) return { owner: false, requests: [] };
  const result = await supabase.from('access_requests').select('*').order('created_at', { ascending: false });
  if (result.error) throw result.error;
  return { owner: true, requests: result.data };
} });

export const Route = createFileRoute('/_authenticated/access')({
  head: () => ({ meta: [{ title: 'Aprobación de cuentas — Natación Pro' }, { name: 'description', content: 'Control privado de solicitudes de acceso por el dueño.' }, { property: 'og:title', content: 'Aprobación de cuentas — Natación Pro' }, { property: 'og:description', content: 'Revisión de solicitudes de acceso al programa.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary_large_image' }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(requestsQuery),
  component: AccessPage,
});
function AccessPage() {
  const { data, refetch } = useSuspenseQuery(requestsQuery);
  const decide = useServerFn(decideAccess);
  const suspend = useServerFn(suspendAccess);
  async function toggle(id: string, on: boolean, email: string) {
    if (!window.confirm(on ? `¿Suspender el acceso de ${email}? No podrá entrar hasta que lo reactives. Sus datos se conservan.` : `¿Reactivar el acceso de ${email}?`)) return;
    setBusy(true);
    try { await suspend({ data: { id, suspend: on } }); await queryClient.invalidateQueries({ queryKey: ['access-requests'] }); toast.success(on ? 'Acceso suspendido' : 'Acceso reactivado'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo actualizar el acceso'); }
    finally { setBusy(false); }
  }
  const [busy, setBusy] = useState(false);
  const { queryClient } = Route.useRouteContext();
  async function handle(id: string, approve: boolean, email: string) {
    if (!window.confirm(approve ? `¿Autorizar a ${email}? Tendrá acceso administrativo a los datos, importación, exportación y borrado.` : `¿Rechazar la solicitud de ${email}?`)) return;
    setBusy(true);
    try { await decide({ data: { id, approve } }); await queryClient.invalidateQueries({ queryKey: ['access-requests'] }); toast.success(approve ? 'Acceso aprobado' : 'Solicitud rechazada'); }
    catch (error) { toast.error(error instanceof Error ? error.message : 'No se pudo actualizar la solicitud'); }
    finally { setBusy(false); }
  }
  if (!data.owner) return <p>Solo el dueño puede revisar y aprobar solicitudes.</p>;
  return <section className="space-y-5"><div className="flex flex-wrap items-center justify-between gap-3"><h1 className="text-4xl font-bold uppercase">Accesos</h1><Button variant="outline" onClick={() => refetch()}>Actualizar</Button></div><p className="text-muted-foreground">Las cuentas aprobadas tendrán permisos administrativos. Solo tú puedes autorizar nuevas cuentas. Si alguien no renueva su suscripción, suspende su acceso y reactívalo cuando pague; sus datos se conservan.</p>
    {!data.requests.length && <p className="border-y py-8 text-muted-foreground">No hay solicitudes de acceso.</p>}
    <div className="divide-y">{data.requests.map(request => <div key={request.id} className="flex flex-wrap items-center justify-between gap-4 py-5"><div className="min-w-0"><p className="break-all font-medium">{request.email}</p><p className="text-sm text-muted-foreground">{new Date(request.created_at).toLocaleDateString('es')} · {request.status === 'pending' ? 'Pendiente' : request.status === 'approved' ? 'Aprobada' : request.status === 'suspended' ? 'Suspendida' : 'Rechazada'}</p></div>{request.status === 'pending' && <div className="flex gap-2"><Button disabled={busy} onClick={() => handle(request.id, true, request.email)}><Check />Aprobar</Button><Button variant="outline" disabled={busy} onClick={() => handle(request.id, false, request.email)}><X />Rechazar</Button></div>}{request.status === 'approved' && <Button variant="destructive" disabled={busy} onClick={() => toggle(request.id, true, request.email)}><Ban />Suspender acceso</Button>}{request.status === 'suspended' && <Button disabled={busy} onClick={() => toggle(request.id, false, request.email)}><RotateCcw />Reactivar</Button>}</div>)}</div>
  </section>;
}