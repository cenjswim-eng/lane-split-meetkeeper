import { describe,it,expect } from 'vitest';
import { contactSchema,campaignFromSearch } from '@/lib/marketing';
import { sitemapXML } from '@/lib/sitemap';
import { trackPublicPage,trackEvent } from '@/lib/marketing-analytics';
import { vi } from 'vitest';
describe('contact privacy and campaign attribution',()=>{
 it('requires name, club, country, email and explicit consent',()=>{
  const data={name:'Juan',club:'Club Ejemplo',country:'Venezuela',email:'test@example.com',consent:true};
  expect(contactSchema.parse(data).club).toBe('Club Ejemplo');
  for(const key of Object.keys(data)){const missing={...data};delete missing[key as keyof typeof missing];expect(contactSchema.safeParse(missing).success).toBe(false);}
  expect(contactSchema.safeParse({...data,consent:false}).success).toBe(false);
 });
 it('stores only UTM keys, not athlete IDs or report tokens',()=>{
  expect(campaignFromSearch('?utm_source=whatsapp&utm_medium=social&athlete=private&token=secret')).toEqual({utm_source:'whatsapp',utm_medium:'social'});
 });
 it('does not emit private page views or capability URLs',()=>{
  const send=vi.fn();Object.assign(window,{slcGtag:send});
  trackPublicPage('/athletes/private');trackPublicPage('/share/private');trackPublicPage('/auth');expect(send).not.toHaveBeenCalled();
  trackPublicPage('/funciones');expect(send).toHaveBeenCalledWith('event','page_view',{page_path:'/funciones',page_location:'https://swimlanecoach.app/funciones'});
 });
 it('omits lastmod without a page-specific timestamp',()=>{const xml=sitemapXML('https://swimlanecoach.app',[{path:'/funciones'}]);expect(xml).toContain('https://swimlanecoach.app/funciones');expect(xml).not.toContain('lastmod');});
 it('sanitizes page context for shares from private screens',()=>{const send=vi.fn();Object.assign(window,{slcGtag:send});trackEvent('report_shared',{channel:'copy',kind:'athlete'});expect(send).toHaveBeenCalledWith('event','report_shared',{channel:'copy',kind:'athlete',page_location:'https://swimlanecoach.app/',page_path:'/',page_referrer:''});});
});