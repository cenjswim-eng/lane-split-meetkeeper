import preview from '@/assets/swim-lane-coach-preview.asset.json';
import { SITE_URL } from './marketing';
export const previewUrl=new URL(preview.url,SITE_URL).href;
export function publicHead(path:string,title:string,description:string,type='website'){
 return {meta:[{title},{name:'description',content:description},{property:'og:title',content:title},{property:'og:description',content:description},{property:'og:type',content:type},{property:'og:url',content:SITE_URL+path},{property:'og:image',content:previewUrl},{property:'og:image:width',content:'1200'},{property:'og:image:height',content:'630'},{name:'twitter:card',content:'summary_large_image'},{name:'twitter:title',content:title},{name:'twitter:description',content:description},{name:'twitter:image',content:previewUrl}],links:[{rel:'canonical',href:SITE_URL+path}]};
}
