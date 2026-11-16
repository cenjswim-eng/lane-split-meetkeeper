import { supabase } from '@/integrations/supabase/client';
import { type ReportBrand,type ReportPrivacy,reportExpiry,tokenHash } from './report-brand';
import type { Json } from '@/integrations/supabase/types';
export async function createSharedReport(file:File,clubId:string,title:string,brand:ReportBrand,privacy:ReportPrivacy,days:7|30|null){
 if(file.type!=='application/pdf'||file.size>20*1024*1024)throw Error('El reporte debe ser PDF y pesar hasta 20 MB.');
 const {data,error}=await supabase.auth.getUser();if(error||!data.user)throw Error('Inicia sesión nuevamente.');
 const bytes=crypto.getRandomValues(new Uint8Array(32));const token=Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');const hash=await tokenHash(token),id=crypto.randomUUID();
 const path=`${data.user.id}/${clubId}/${id}.pdf`;const up=await supabase.storage.from('shared-reports').upload(path,file,{contentType:'application/pdf'});if(up.error)throw up.error;
 const saved=await supabase.from('shared_reports').insert({id,club_id:clubId,token_hash:hash,title,storage_path:path,brand:brand as unknown as Json,privacy:privacy as unknown as Json,expires_at:reportExpiry(days)});
 if(saved.error){await supabase.storage.from('shared-reports').remove([path]);throw saved.error;}
 return `${window.location.origin}/share/${token}`;
}