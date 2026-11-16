import { createServerFn } from '@tanstack/react-start';
import { contactSchema } from './marketing';
export const submitContact=createServerFn({method:'POST'}).inputValidator((input:unknown)=>contactSchema.parse(input)).handler(async({data})=>{
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const {data:row,error}=await supabaseAdmin.from('contact_submissions').insert({name:data.name,club:data.club,country:data.country,email:data.email,campaign:data.campaign}).select('id').single();
 if(error||!row)throw new Error('No se pudo guardar tu consulta. Inténtalo de nuevo.');
 let notified=false;
 try {const {data:owner}=await supabaseAdmin.from('app_owner').select('user_id').single();if(owner){const {data:account}=await supabaseAdmin.auth.admin.getUserById(owner.user_id);if(account.user?.email){const {sendTemplateEmail}=await import('./email-templates/send-email');notified=(await sendTemplateEmail('contact-owner',account.user.email,{templateData:{name:data.name,club:data.club,country:data.country,email:data.email},idempotencyKey:`contact-owner-${row.id}`})).sent;}}}catch{ /* Stored request remains visible to the owner even if email fails. */ }
 return {id:row.id,notified};
});
