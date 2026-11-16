import { createFileRoute } from '@tanstack/react-router';
import { PublicContentPage } from '@/components/public-content-page';
import { publicPages } from '@/lib/public-content';
import { publicHead } from '@/lib/public-seo';
export const Route=createFileRoute('/como-funciona')({staticData:{sitemap:true},head:()=>publicHead('/como-funciona',publicPages['como-funciona'].title+' — Swim Lane Coach',publicPages['como-funciona'].description),component:Page});
function Page(){return <PublicContentPage page="como-funciona"/>;}
