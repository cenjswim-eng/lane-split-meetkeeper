import { z } from 'zod';
import { DEFAULT_THEME } from './profile-theme';
export const brandSchema=z.object({name:z.string().max(160),location:z.string().max(160).default(''),motto:z.string().max(160).default(''),contact:z.string().max(160).default(''),primary:z.string().regex(/^#[\da-f]{6}$/i),secondary:z.string().regex(/^#[\da-f]{6}$/i),logo:z.string().startsWith('data:image/png;base64,').max(3000000).nullable().default(null)});
export type ReportBrand=z.infer<typeof brandSchema>;
export const neutralBrand=(name='Swim Lane Coach'):ReportBrand=>({name,location:'',motto:'',contact:'',primary:DEFAULT_THEME.primary_color,secondary:DEFAULT_THEME.accent_color,logo:null});
export const privacySchema=z.object({fullSurname:z.boolean().default(false),birthDate:z.boolean().default(false),aqua:z.boolean().default(false)});
export type ReportPrivacy=z.infer<typeof privacySchema>;
export const minimalPrivacy:ReportPrivacy={fullSurname:false,birthDate:false,aqua:false};
export function privateSurname(name:string,full:boolean){return full?name:name.split(/\s+/).filter(Boolean).map(n=>`${n[0]??''}.`).join(' ');}
export function reportExpiry(days:7|30|null,now=new Date()){return days===null?null:new Date(now.getTime()+days*86400000).toISOString();}
export function validateLogo(file:{size:number;type:string}){if(file.size>2*1024*1024)throw Error('El logo supera 2 MB.');if(!['image/png','image/jpeg','image/svg+xml'].includes(file.type))throw Error('Usa PNG, JPG o SVG.');}
export function contrastInk(hex:string){const n=parseInt(hex.slice(1),16);const values=[(n>>16)&255,(n>>8)&255,n&255].map(c=>{const s=c/255;return s<=0.04045?s/12.92:((s+0.055)/1.055)**2.4;});const lum=(values[0]??0)*.2126+(values[1]??0)*.7152+(values[2]??0)*.0722;return lum>.179?'#182e39':'#ffffff';}
export async function tokenHash(token:string){const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token));return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');}