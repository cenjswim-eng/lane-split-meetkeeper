import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { Search,Save,RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { coachQuery } from '@/lib/coach-data';
import { useSwimCategories } from '@/lib/categories';
import { emptyFilters,useWorkspaceFilters } from '@/lib/workspace-filters';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from './ui/select';
export function WorkspaceTools(){
 const {data}=useQuery(coachQuery);const categories=useSwimCategories(),{filters,update,save}=useWorkspaceFilters();const [q,setQ]=useState('');
 const athletes=data?.athletes.filter(a=>`${a.first_name} ${a.last_name} ${a.federation_id??''}`.toLowerCase().includes(q.toLowerCase())).slice(0,8)??[];
 const meets=data?.meets.filter(m=>m.name.toLowerCase().includes(q.toLowerCase())).slice(0,8)??[];
 const seasons=[...new Set(data?.meets.flatMap(m=>m.start_date?[m.start_date.slice(0,4)]:[])??[])].sort().reverse();
 return <div className="space-y-2 border-t px-4 py-3 lg:px-8"><div className="relative"><Search className="absolute left-3 top-3 size-4 text-muted-foreground"/><Input value={q} onChange={e=>setQ(e.target.value)} aria-label="Buscar atletas y competencias" placeholder="Buscar atletas y competencias" className="pl-9"/>{q.trim()&&<div className="absolute inset-x-0 top-full z-50 max-h-72 overflow-auto rounded-md border bg-popover p-2 shadow-md">{athletes.map(a=><Button key={a.id} variant="ghost" asChild className="h-auto w-full justify-start whitespace-normal text-left"><Link to="/athletes/$id" params={{id:a.id}} onClick={()=>setQ('')}>{a.first_name} {a.last_name}</Link></Button>)}{meets.map(m=><Button key={m.id} variant="ghost" asChild className="h-auto w-full justify-start whitespace-normal text-left"><Link to="/meets" search={{meet:m.id}} onClick={()=>setQ('')}>{m.name}</Link></Button>)}{!athletes.length&&!meets.length&&<p className="p-3 text-sm text-muted-foreground">Sin coincidencias.</p>}</div>}</div><div className="grid grid-cols-2 gap-2 sm:grid-cols-[repeat(4,minmax(0,1fr))_auto_auto]">{([{key:'season',label:'Temporada',options:seasons.map(s=>[s,s])},{key:'category',label:'Categoría',options:categories.map(c=>[c.name,c.name])},{key:'gender',label:'Sexo',options:[['M','Masculino'],['F','Femenino']]},{key:'course',label:'Piscina',options:[['LCM','50 m'],['SCM','25 m']]}] as const).map(f=><Select key={f.key} value={filters[f.key]} onValueChange={v=>update({...filters,[f.key]:v})}><SelectTrigger aria-label={`Filtro global ${f.label}`} className="min-w-0"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="all">{f.label} · Todas</SelectItem>{f.options.map(([v,label])=><SelectItem value={v??''} key={v}>{label}</SelectItem>)}</SelectContent></Select>)}<Button variant="outline" size="icon" aria-label="Guardar filtros" title="Guardar filtros" onClick={()=>{save();toast.success('Filtros guardados para esta cuenta.');}}><Save/></Button><Button variant="ghost" size="icon" aria-label="Restablecer filtros" title="Restablecer filtros" onClick={()=>update(emptyFilters)}><RotateCcw/></Button></div></div>;
}