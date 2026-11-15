import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { WandSparkles, UserPlus, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { athleteSchema, generateFederationId, rosterCategory, type AthleteFormValues } from "@/lib/roster-rules";
import { ageAt, ageAtDec31 } from "@/lib/swim";
import { useSwimCategories } from "@/lib/categories";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";

export function QuickAthleteEntry({clubId,clubs,athlete}:{clubId?:string;clubs:Tables<"clubs">[];athlete?:Tables<"athletes">}) {
 const [federated,setFederated]=useState(false),[unattached,setUnattached]=useState(false);
 const [open,setOpen]=useState(false); const qc=useQueryClient(); const categories=useSwimCategories();
 const empty=(club:string):AthleteFormValues=>({last_name:"",first_name:"",middle_initial:"",preferred_name:"",gender:"M",birth_date:"",federation_id:"",para_classification:"",is_active:true,club_id:club});
 const form=useForm<AthleteFormValues>({resolver:zodResolver(athleteSchema),defaultValues:empty(clubId??"")}); const values=form.watch();
 function show(){setFederated(athlete?.is_federated??false);setUnattached(athlete?.is_unattached??false);form.reset(athlete?{...empty(athlete.club_id??""),last_name:athlete.last_name,first_name:athlete.first_name,middle_initial:athlete.middle_initial??"",preferred_name:athlete.preferred_name??"",gender:athlete.gender==="F"?"F":"M",birth_date:athlete.birth_date??"",federation_id:athlete.federation_id??"",para_classification:athlete.para_classification??"",is_active:athlete.is_active}:empty(clubId??""));setOpen(true);}
 function generate(){if(values.federation_id.trim()){toast.info('Conservamos el ID existente.');return;}try{form.setValue("federation_id",generateFederationId(values.first_name,values.last_name,values.birth_date,values.gender),{shouldDirty:true});}catch(e){toast.error(e instanceof Error?e.message:"Completa los datos.");}}
 async function save(v:AthleteFormValues,next:boolean){
  try {
   const id=v.federation_id.trim()||generateFederationId(v.first_name,v.last_name,v.birth_date,v.gender);
   const existing=await supabase.from("athletes").select("id").eq("federation_id",id); if(existing.error)throw new Error(existing.error.message);
   if(existing.data.some(a=>a.id!==athlete?.id))throw new Error("Ese ID ya pertenece a otro atleta. Indica un ID diferente o revisa su ficha.");
   const payload={...v,federation_id:id,club_id:v.club_id||null,active_status:v.is_active,is_federated:federated,is_unattached:unattached};
   const r=athlete?await supabase.from("athletes").update(payload).eq("id",athlete.id).select("id").single():await supabase.from("athletes").insert({...payload,registration_expires_on:`${new Date().getUTCFullYear()}-12-31`}).select("id").single(); if(r.error)throw new Error(r.error.message);
   await Promise.all(["athletes","coach-data","dashboard"].map(k=>qc.invalidateQueries({queryKey:[k]})));toast.success("Atleta guardado.");
   if(next){form.reset(empty(v.club_id));requestAnimationFrame(()=>form.setFocus("last_name"));}else setOpen(false);
  }catch(e){toast.error(e instanceof Error?e.message:"No se pudo guardar el atleta.");}
 }
 const fields:{key:"last_name"|"first_name"|"middle_initial"|"preferred_name"|"birth_date"|"federation_id"|"para_classification";label:string;max:number;type?:string}[]=[{key:"last_name",label:"Apellido",max:100},{key:"first_name",label:"Nombre",max:100},{key:"middle_initial",label:"Inicial intermedia",max:1},{key:"preferred_name",label:"Nombre preferido",max:40},{key:"birth_date",label:"Fecha de nacimiento",max:10,type:"date"},{key:"federation_id",label:"ID Federación",max:12},{key:"para_classification",label:"Clasificación para",max:40}];
 return <Dialog open={open} onOpenChange={setOpen}><Button variant={athlete?"ghost":"outline"} size={athlete?"icon":"default"} aria-label={athlete?`Editar ${athlete.first_name} ${athlete.last_name}`:undefined} title={athlete?"Editar atleta":undefined} onClick={show}>{athlete?<Pencil/>:<UserPlus/>}{!athlete&&"Entrada rápida de atletas"}</Button><DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-lg"><DialogHeader><DialogTitle>{athlete?"Editar atleta":"Entrada rápida de atletas"}</DialogTitle><DialogDescription>{clubs.find(c=>c.id===values.club_id)?.name??"Libre / sin club"}</DialogDescription></DialogHeader>
 <form onSubmit={form.handleSubmit(v=>save(v,!athlete))} className="grid gap-4 sm:grid-cols-2">
 {fields.map(f=><div key={f.key} className="space-y-1.5"><Label htmlFor={`quick-${f.key}`}>{f.label}</Label><div className="flex gap-2"><Input id={`quick-${f.key}`} autoFocus={f.key==="last_name"} type={f.type??"text"} maxLength={f.max} max={f.type==="date"?new Date().toISOString().slice(0,10):undefined} {...form.register(f.key)}/>{f.key==="federation_id"&&<Button type="button" variant="outline" size="icon" title="Generar ID" aria-label="Generar ID" onClick={generate}><WandSparkles/></Button>}</div>{form.formState.errors[f.key]&&<p className="text-xs text-destructive">{form.formState.errors[f.key]?.message}</p>}</div>)}
 <div className="space-y-1.5"><Label htmlFor="quick-gender">Sexo</Label><select id="quick-gender" className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register("gender")}><option value="M">Masculino</option><option value="F">Femenino</option></select></div>
 <div className="space-y-1.5"><Label htmlFor="quick-club">Club</Label><select id="quick-club" disabled={!!athlete} className="h-10 w-full rounded-md border bg-background px-3 text-sm" {...form.register("club_id")}><option value="">Libre / sin club</option>{clubs.map(c=><option key={c.id} value={c.id}>{c.team_code?`${c.team_code} · `:""}{c.name}</option>)}</select></div>
 <label className="flex items-center gap-2 text-sm"><Checkbox checked={federated} onCheckedChange={v=>setFederated(v===true)}/>Federado</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={unattached} onCheckedChange={v=>setUnattached(v===true)}/>Sin club / Unattached</label><label className="flex items-center gap-2 text-sm"><Checkbox checked={values.is_active} onCheckedChange={v=>form.setValue("is_active",v===true)}/>Atleta activo</label>
 {values.birth_date&&<div className="flex flex-wrap gap-x-5 gap-y-1 border-y py-3 text-sm sm:col-span-2"><span>Edad actual: {ageAt(values.birth_date)??"—"}</span><span>Edad al 31/12: {ageAtDec31(values.birth_date,new Date().getFullYear())??"—"}</span><span className="font-semibold text-primary">{rosterCategory(values.birth_date,new Date().getFullYear(),categories)}</span></div>}
 <div className="flex flex-wrap gap-2 sm:col-span-2"><Button type="button" variant="outline" disabled={form.formState.isSubmitting} onClick={()=>void form.handleSubmit(v=>save(v,false))()}>Guardar y cerrar</Button>{!athlete&&<Button type="submit" disabled={form.formState.isSubmitting}>Guardar y agregar otro</Button>}</div>
 </form></DialogContent></Dialog>;
}