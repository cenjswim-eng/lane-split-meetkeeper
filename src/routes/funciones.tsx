import { createFileRoute } from '@tanstack/react-router';
import { PublicContentPage } from '@/components/public-content-page';
import { publicPages } from '@/lib/public-content';
import { publicHead } from '@/lib/public-seo';
export const Route=createFileRoute('/funciones')({staticData:{sitemap:true},head:()=>publicHead('/funciones',publicPages['funciones'].title+' — Swim Lane Coach',publicPages['funciones'].description),component:Page});
function Page(){return <PublicContentPage page="funciones"/>;}
