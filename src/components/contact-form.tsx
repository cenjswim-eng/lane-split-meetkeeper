import { useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import { Link } from '@tanstack/react-router';
import { Send,CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Checkbox } from './ui/checkbox';
import { submitContact } from '@/lib/contact.functions';
import { trackEvent,currentCampaign } from '@/lib/marketing-analytics';
export function ContactForm(){const submit=useServerFn(submitContact);const [busy,setBusy]=useState(false),[sent,setSent]=useState(false),[error,setError]=useState(''),[consent,setConsent]=useState(false);
 if(sent)return <div role="status" className="border-y border-primary py-8"><CheckCircle2 className="size-7 text-primary"/><h3 className="mt-4 text-xl font-semibold">Consulta recibida</h3><p className="mt-2 text-muted-foreground">Tu consulta quedó guardada para el dueño. El acceso a tu cuenta sigue sujeto a aprobación.</p></div>;
 return <form className="grid gap-5 sm:grid-cols-2" onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');const form=new FormData(e.currentTarget);try{await submit({data:{name:String(form.get('name')),club:String(form.get('club')),country:String(form.get('country')),email:String(form.get('email')),consent:true,campaign:currentCampaign()}});trackEvent('generate_lead',{form:'contact'});setSent(true);}catch{setError('No se pudo guardar tu consulta. Inténtalo de nuevo o escríbenos por WhatsApp.');}finally{setBusy(false);}}}>
 {([['name','Nombre','text',120],['club','Club','text',160],['country','País','text',80],['email','Correo','email',254]] as const).map(([name,label,type,max])=><div key={name} className="space-y-2"><Label htmlFor={`contact-${name}`}>{label}</Label><Input id={`contact-${name}`} name={name} type={type} required minLength={type==='text'?2:undefined} maxLength={max} autoComplete={name==='name'?'name':name==='email'?'email':name==='country'?'country-name':'organization'} disabled={busy}/></div>)}
 <label className="flex items-start gap-3 text-sm text-muted-foreground sm:col-span-2"><Checkbox checked={consent} disabled={busy} onCheckedChange={v=>setConsent(v===true)} aria-label="Acepto que me contacten"/><span>Acepto que me contacten sobre mi consulta y he leído la <Link to="/privacidad" className="text-primary underline">política de privacidad</Link>.</span></label>{error&&<p role="alert" className="text-destructive sm:col-span-2">{error}</p>}<Button disabled={busy||!consent} type="submit" size="lg" className="min-h-12 justify-self-start"><Send/>{busy?'Enviando…':'Solicitar información'}</Button></form>;
}
