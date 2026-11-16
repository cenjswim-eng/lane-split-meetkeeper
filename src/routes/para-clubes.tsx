import { createFileRoute } from '@tanstack/react-router';
import { PublicContentPage } from '@/components/public-content-page';
import { publicPages } from '@/lib/public-content';
import { publicHead } from '@/lib/public-seo';
export const Route=createFileRoute('/para-clubes')({staticData:{sitemap:true},head:()=>publicHead('/para-clubes',publicPages['para-clubes'].title+' — Swim Lane Coach',publicPages['para-clubes'].description),component:Page});
function Page(){return <PublicContentPage page="para-clubes"/>;}
