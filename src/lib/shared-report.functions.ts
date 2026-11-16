import { createServerFn } from '@tanstack/react-start';
import { setResponseHeader } from '@tanstack/react-start/server';
import { z } from 'zod';
import { tokenHash,brandSchema } from './report-brand';
export const sharedReportInfo=createServerFn({method:'GET'}).inputValidator((input:{token:string;count?:boolean})=>z.object({token:z.string().regex(/^[0-9a-f]{64}$/),count:z.boolean().default(false)}).parse(input)).handler(async({data})=>{
 setResponseHeader('Cache-Control','no-store');setResponseHeader('Referrer-Policy','no-referrer');
 const hash=await tokenHash(data.token);
 // Token capability gates this exact immutable snapshot; no private sporting tables are queried.
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const response=await supabaseAdmin.rpc('open_shared_report',{p_hash:hash,p_count:data.count});
 if(response.error)throw Error('No se pudo abrir el reporte.');
 const row=response.data?.[0];if(!row)return null;
 // Suspension invalidates outstanding links as well as account access.
 const role=await supabaseAdmin.from('user_roles').select('id').eq('user_id',row.owner_id).eq('role','admin').maybeSingle();
 if(role.error||!role.data)return null;
 return {title:row.title,brand:brandSchema.parse(row.brand),expires:row.expires_at};
});