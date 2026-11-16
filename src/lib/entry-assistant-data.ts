import { queryOptions } from '@tanstack/react-query';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import type { AssistantRules, AssistantRow } from './entry-assistant';
export const assistantDraftQuery=queryOptions({queryKey:['entry-assistant-drafts'],queryFn:async()=>{const r=await supabase.from('entry_assistant_drafts').select('*').order('updated_at',{ascending:false});if(r.error)throw r.error;return r.data;}});
const rulesSchema=z.object({date:z.string(),course:z.string(),maxAthlete:z.number().int().positive().nullable(),maxEvent:z.number().int().positive().nullable(),genders:z.array(z.string()),categories:z.array(z.string()),requiresMinimum:z.boolean(),versionId:z.string(),factor:z.number().positive().nullable()});
const rowSchema=z.object({athleteId:z.string(),eventId:z.string(),timeMs:z.number().int().positive().nullable(),referenceDate:z.string().nullable(),converted:z.boolean(),origin:z.enum(['manual','suggested'])});
export function decodeAssistantDraft(rules:unknown,rows:unknown){return {rules:rulesSchema.parse(rules),rows:z.array(rowSchema).parse(rows)};}
export async function saveAssistantDraft(id:string|null,meetId:string,clubId:string|undefined,rules:AssistantRules,rows:AssistantRow[],commit:boolean){
 const payload={meet_id:meetId,club_id:clubId??null,rules:{...rules},rows:rows.map(r=>({...r}))};
 const saved=id?await supabase.from('entry_assistant_drafts').update(payload).eq('id',id).select('id').single():await supabase.from('entry_assistant_drafts').insert(payload).select('id').single();
 if(saved.error)throw saved.error;
 if(commit){const r=await supabase.rpc('commit_entry_assistant',{p_draft:saved.data.id});if(r.error)throw r.error;}
 return saved.data.id;
}