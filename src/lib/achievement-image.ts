import { achievementLabels, achievementText, type Achievement } from './achievements';
import { eventLabel, formatTime } from './swim';
import { exportFilename } from './file-delivery';
import { supabase } from '@/integrations/supabase/client';

/** Browser event-handler only. Uses private Storage download, not public logo URLs. */
export async function achievementImage(a: Achievement) {
  await document.fonts.ready;
  const canvas=document.createElement('canvas');canvas.width=1080;canvas.height=1920;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('No se pudo crear la imagen.');
  const theme=getComputedStyle(document.querySelector('.app-workspace')??document.documentElement);
  const color=(name:string)=>theme.getPropertyValue(name).trim();
  ctx.fillStyle=color('--background');ctx.fillRect(0,0,1080,1920);
  ctx.fillStyle=color('--primary');ctx.fillRect(70,140,940,8);
  const text=(value:string,y:number,size:number,tone='--foreground')=>{ctx.fillStyle=color(tone);ctx.font=`600 ${size}px Barlow, sans-serif`;const words=value.split(/\s+/);let line='',dy=y;for(const w of words){const next=`${line} ${w}`.trim();if(ctx.measureText(next).width>900&&line){ctx.fillText(line,90,dy);line=w;dy+=size*1.25;}else line=next;}ctx.fillText(line,90,dy);return dy;};
  let clubName='';
  if(a.athletes?.club_id){
    const club=await supabase.from('clubs').select('name,logo_path').eq('id',a.athletes.club_id).single();
    if(club.error)throw club.error;clubName=club.data.name;
    if(club.data.logo_path){const logo=await supabase.storage.from('club-documents').download(club.data.logo_path);if(logo.error)throw logo.error;const url=URL.createObjectURL(logo.data);try{const img=new Image();img.src=url;await img.decode();const scale=Math.min(180/img.width,180/img.height);ctx.drawImage(img,90,220,img.width*scale,img.height*scale);}finally{URL.revokeObjectURL(url);}}
  }
  text(clubName||'Swim Lane Coach',470,38,'--muted-foreground');
  const name=`${a.athletes?.first_name??''} ${a.athletes?.last_name??''}`.trim();
  const y=text(name,590,68);
  text(achievementLabels[a.kind]??'Logro',y+145,46,'--primary');
  text(`${eventLabel(a.distance,a.stroke)} · ${a.course==='LCM'?'50 m':'25 m'}`,y+245,42);
  text(formatTime(a.time_ms),y+405,110);
  text(a.kind==='pb'&&a.improvement_ms!=null?`Mejoró ${(a.improvement_ms/1000).toFixed(3)} s`:a.kind==='minimum'?`Mínima: ${formatTime(a.minimum_ms)}`:'Primer registro de esta prueba',y+515,40,'--accent');
  text(a.meets?.name??'',1470,38);text(a.achieved_on,1630,34,'--muted-foreground');text('Swim Lane Coach',1780,36,'--primary');
  const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('No se pudo preparar la imagen.')),'image/png'));
  return {file:new File([blob],exportFilename(name,'_logro.png'),{type:'image/png'}),text:achievementText(a)};
}