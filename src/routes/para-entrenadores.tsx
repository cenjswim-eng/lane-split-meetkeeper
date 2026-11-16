import { createFileRoute } from '@tanstack/react-router';
import { PublicContentPage } from '@/components/public-content-page';
import { publicPages } from '@/lib/public-content';
import { publicHead } from '@/lib/public-seo';
export const Route=createFileRoute('/para-entrenadores')({staticData:{sitemap:true},head:()=>publicHead('/para-entrenadores',publicPages['para-entrenadores'].title+' — Swim Lane Coach',publicPages['para-entrenadores'].description),component:Page});
function Page(){return <PublicContentPage page="para-entrenadores"/>;}
