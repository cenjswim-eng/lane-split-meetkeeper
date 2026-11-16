import { createFileRoute } from '@tanstack/react-router';
import { PublicShell,contactWhatsApp } from '@/components/public-shell';
import { ContactForm } from '@/components/contact-form';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';
import { publicHead } from '@/lib/public-seo';
export const Route=createFileRoute('/contacto')({staticData:{sitemap:true},head:()=>publicHead('/contacto','Contacto y planes — Swim Lane Coach','Consulta planes para tu club de natación, solicita una demo y acuerda la activación de tu cuenta.'),component:Page});
function Page(){return <PublicShell><section className="mx-auto max-w-3xl px-5 py-12 sm:px-10"><p className="text-sm text-primary">Swim Lane Coach</p><h1 className="mt-4 text-4xl font-semibold">Hablemos de tu club</h1><p className="mt-5 leading-relaxed text-muted-foreground">Cuéntanos quién eres y qué club representas. El plan, el pago y la activación se acuerdan con el dueño; no hay cobro en esta página.</p><div className="mt-8"><ContactForm/></div><div className="mt-10 border-t pt-6"><Button asChild variant="outline"><a href={contactWhatsApp} target="_blank" rel="noopener noreferrer"><MessageCircle/>Consultar por WhatsApp</a></Button></div></section></PublicShell>;}
