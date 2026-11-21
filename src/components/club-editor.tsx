import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { clubSchema, formatTeamCode, type ClubFormValues } from "@/lib/roster-rules";
import { FEDERATIONS, getAssociationsForFederation } from "@/lib/federations";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";

export function ClubEditor({ club, onSaved }: { club?: Tables<"clubs">; onSaved?: (id: string) => void }) {
 const [open,setOpen]=useState(false); const qc=useQueryClient();
 const form=useForm<ClubFormValues>({resolver:zodResolver(clubSchema),defaultValues:{team_code:"",full_name:"",short_name:"",region_lsc:"",country_code:"VEN",head_coach:"",contact_email:"",contact_phone:"",team_color:"#3cc8e0",is_unattached:false,team_type:"AGE_GROUP",division:"",region:""}});
 const values=form.watch();
 function show() { form.reset({team_code:club?.team_code??"",full_name:club?.full_name??club?.name??"",short_name:club?.short_name??"",region_lsc:club?.region_lsc??"",country_code:club?.country_code??"VEN",head_coach:club?.head_coach??"",contact_email:club?.contact_email??"",contact_phone:club?.contact_phone??"",team_color:club?.team_color??"#3cc8e0",is_unattached:club?.is_unattached??false,team_type:(club?.team_type??"AGE_GROUP") as ClubFormValues["team_type"],division:club?.division??"",region:club?.region??""}); setOpen(true); }
 async function save(v:ClubFormValues) {
  try { const payload={...v,name:v.full_name}; const r=club ? await supabase.from("clubs").update(payload).eq("id",club.id).select("id").single() : await supabase.from("clubs").insert(payload).select("id").single(); if(r.error) throw new Error(r.error.code==="23505"?"Ya existe un club con ese código en tu cuenta.":r.error.message); await Promise.all(["club-management","club-register","coach-data"].map(k=>qc.invalidateQueries({queryKey:[k]}))); setOpen(false); onSaved?.(r.data.id); toast.success("Club guardado."); } catch(e){toast.error(e instanceof Error?e.message:"No se pudo guardar el club.");}
 }
 const fields: {key:Exclude<keyof ClubFormValues,"is_unattached"|"team_type">;label:string;max:number;type?:string}[]=[{key:"team_code",label:"Código del club",max:5},{key:"full_name",label:"Nombre completo",max:30},{key:"short_name",label:"Nombre corto",max:16},{key:"region_lsc",label:"Asociación / región",max:40},{key:"country_code",label:"País (ISO)",max:3},{key:"head_coach",label:"Entrenador principal",max:100},{key:"contact_email",label:"Correo de contacto",max:150,type:"email"},{key:"contact_phone",label:"Teléfono",max:40},{key:"division",label:"División",max:10},{key:"region",label:"Región",max:10},{key:"team_color",label:"Color del club",max:7,type:"color"}];
 return <Dialog open={open} onOpenChange={setOpen}><Button variant="outline" onClick={show}>{club?<Pencil/>:<Plus/>}{club?"Editar club":"Crear club"}</Button><DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg"><DialogHeader><DialogTitle>{club?"Editar club":"Crear club"}</DialogTitle><DialogDescription>Identidad y contacto del equipo</DialogDescription></DialogHeader>
 <div className="flex items-center gap-3 border-y py-3"><span className="rounded border bg-muted px-3 py-1 font-mono font-bold text-primary">{values.team_code||"CLUB"}</span><span className="h-4 w-4 rounded-sm" style={{backgroundColor:values.team_color}}/><span className="min-w-0 break-words text-sm">{values.short_name||values.full_name||"Nombre del club"}</span></div>
 <form onSubmit={form.handleSubmit(save)} className="grid gap-4 sm:grid-cols-2">{fields.map(f=><div key={f.key} className="space-y-1.5"><Label htmlFor={`club-${f.key}`}>{f.label}</Label><Input id={`club-${f.key}`} type={f.type??"text"} maxLength={f.max} list={f.key==="country_code"?"club-editor-fed-list":f.key==="region_lsc"?"club-editor-assoc-list":undefined} {...form.register(f.key)} onChange={e=>{const value=f.key==="team_code"?formatTeamCode(e.target.value):f.key==="country_code"?e.target.value.toUpperCase():e.target.value; form.setValue(f.key,value,{shouldDirty:true}); if(f.key==="full_name"&&!form.getFieldState("short_name").isDirty)form.setValue("short_name",value.slice(0,16));}}/>{form.formState.errors[f.key]&&<p className="text-xs text-destructive">{form.formState.errors[f.key]?.message}</p>}</div>)}
 <datalist id="club-editor-fed-list">{FEDERATIONS.map(fed=><option key={fed.code} value={fed.code}>{fed.flag} {fed.country} · {fed.shortName}</option>)}</datalist>
 <datalist id="club-editor-assoc-list">{getAssociationsForFederation(values.country_code).map(assoc=><option key={assoc} value={assoc}/>)}</datalist>
 <div className="space-y-1.5"><Label htmlFor="club-type">Tipo de equipo</Label><select id="club-type" className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register("team_type")}><option value="AGE_GROUP">Grupos de edad</option><option value="MASTERS">Masters</option><option value="HIGH_SCHOOL">Escolar</option><option value="COLLEGE">Universitario</option><option value="OPEN">Abierto</option></select></div><p className="text-xs text-muted-foreground sm:col-span-2">El código identifica al club en los archivos HY3 y SD3.</p><label className="flex items-center gap-2 text-sm"><Checkbox checked={values.is_unattached} onCheckedChange={v=>{form.setValue("is_unattached",v===true);if(v===true)form.setValue("team_code","UN");}}/>Sin club / UN</label><Button disabled={form.formState.isSubmitting} type="submit" className="sm:col-span-2">Guardar club</Button></form></DialogContent></Dialog>;
}