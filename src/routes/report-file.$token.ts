import { createFileRoute } from '@tanstack/react-router';
import { tokenHash } from '@/lib/report-brand';
export const Route=createFileRoute('/report-file/$token')({
  staticData: { sitemap: false },server:{handlers:{GET:async({params})=>{
 const headers={'Cache-Control':'no-store','Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow'};
 if(!/^[0-9a-f]{64}$/.test(params.token))return new Response('Reporte no disponible',{status:404,headers});
 const hash=await tokenHash(params.token);const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const r=await supabaseAdmin.rpc('open_shared_report',{p_hash:hash,p_count:false});const row=r.data?.[0];
 if(r.error||!row)return new Response('Reporte no disponible',{status:404,headers});
 const role=await supabaseAdmin.from('user_roles').select('id').eq('user_id',row.owner_id).eq('role','admin').maybeSingle();
 if(role.error||!role.data)return new Response('Reporte no disponible',{status:404,headers});
 const file=await supabaseAdmin.storage.from('shared-reports').download(row.storage_path);if(file.error)return new Response('Reporte no disponible',{status:404,headers});
 return new Response(file.data,{headers:{...headers,'Content-Type':'application/pdf','Content-Disposition':'inline; filename="reporte.pdf"'}});
}}}});