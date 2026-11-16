import { useState } from 'react';
import { useSuspenseQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { EntryAssistantView } from './entry-assistant-view';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { assistantDraftQuery, decodeAssistantDraft, saveAssistantDraft } from '@/lib/entry-assistant-data';
import { versionStandards } from '@/lib/standard-versions';
import { useSwimCategories } from '@/lib/categories';
import { coachQuery } from '@/lib/coach-data';
import { MeetExport } from './meet-export';
import { prepareEntries } from '@/lib/entry-files';
export function EntryAssistant({meetId,clubId}:{meetId:string;clubId?:string}){
 const {data}=useSuspenseQuery(coachQuery),{data:drafts}=useSuspenseQuery(assistantDraftQuery);const categories=useSwimCategories(),qc=useQueryClient();
 const [selected,setSelected]=useState('new'),[busy,setBusy]=useState(false),[revision,setRevision]=useState(0);
 const meet=data.meets.find(m=>m.id===meetId);if(!meet)return null;
 const relevant=drafts.filter(d=>d.meet_id===meetId&&d.club_id===(clubId??null));const draft=relevant.find(d=>d.id===selected);
 const athletes=data.athletes.filter(a=>!clubId||a.club_id===clubId);
 const events=data.events.filter(e=>e.meet_id===meetId);
 return <><Select value={draft?.id??'new'} onValueChange={setSelected}><SelectTrigger aria-label="Retomar borrador" className="w-full sm:w-80"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="new">Nuevo borrador</SelectItem>{relevant.map(d=><SelectItem value={d.id} key={d.id}>Borrador · {new Date(d.updated_at).toLocaleString('es')}</SelectItem>)}</SelectContent></Select><EntryAssistantView key={`${meetId}-${clubId}-${selected}-${revision}`} athletes={athletes} events={events} results={data.results} date={meet.start_date??''} course={meet.course} categories={categories} versions={data.versions.map(v=>({id:v.id,name:v.document_name,standards:versionStandards(v)}))} initial={draft?decodeAssistantDraft(draft.rules,draft.rows):undefined} busy={busy} onSave={async(rules,rows,commit)=>{setBusy(true);try{if(rules.date!==meet.start_date||rules.course!==meet.course)throw new Error('La fecha o piscina difiere de la competencia guardada. Actualiza la competencia antes de confirmar este borrador.');const id=await saveAssistantDraft(draft?.id??null,meetId,clubId,rules,rows,commit);await Promise.all([qc.invalidateQueries({queryKey:['entry-assistant-drafts']}),qc.invalidateQueries({queryKey:['coach-data']}),qc.invalidateQueries({queryKey:['club-management']})]);setSelected(id);setRevision(x=>x+1);toast.success(commit?'Inscripciones guardadas.':'Borrador guardado.');}finally{setBusy(false);}}} exportControl={data.entries.some(e=>e.meet_id===meetId&&(!clubId||athletes.some(a=>a.id===e.athlete_id)))?<MeetExport key={data.entries.map(e=>`${e.id}:${e.seed_time_ms}`).join(',')} entriesOnly name={meet.name} prepare={kind=>Promise.resolve(prepareEntries(data,meetId,kind==='sd3'?'sd3':kind==='hy3'?'hy3':'pdf',clubId))}/>:undefined}/></>;
}