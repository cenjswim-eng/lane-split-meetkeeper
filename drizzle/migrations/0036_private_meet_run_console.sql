ALTER TABLE public.results ADD COLUMN is_exhibition boolean NOT NULL DEFAULT false, ADD COLUMN scoring_club_id uuid REFERENCES public.clubs(id) ON DELETE SET NULL, ADD COLUMN scoring_unattached boolean NOT NULL DEFAULT false, ADD COLUMN scoring_category text, ADD COLUMN run_entry_id uuid REFERENCES public.meet_entries(id) ON DELETE SET NULL;
ALTER TABLE public.relay_entries ADD COLUMN is_exhibition boolean NOT NULL DEFAULT false;
CREATE FUNCTION public.recalculate_run_event(p_event uuid,p_round text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE pts jsonb; BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'No autorizado'; END IF;
SELECT CASE WHEN jsonb_typeof(m.scoring_system->'individual')='array' THEN m.scoring_system->'individual' ELSE '[]'::jsonb END INTO pts FROM public.meets m JOIN public.events e ON e.meet_id=m.id WHERE e.id=p_event AND m.owner_id=auth.uid();
UPDATE public.results SET place=NULL,points_scored=0 WHERE event_id=p_event AND round=p_round AND owner_id=auth.uid();
WITH valid AS (SELECT r.id,rank() OVER(PARTITION BY a.gender,r.scoring_category ORDER BY r.final_time_ms) pos FROM public.results r JOIN public.athletes a ON a.id=r.athlete_id WHERE r.event_id=p_event AND r.round=p_round AND r.owner_id=auth.uid() AND r.status='OK' AND r.final_time_ms IS NOT NULL AND NOT r.is_exhibition) UPDATE public.results r SET place=v.pos FROM valid v WHERE r.id=v.id;
WITH ranked AS (SELECT r.id,a.gender,r.scoring_category,r.final_time_ms,rank() OVER(PARTITION BY a.gender,r.scoring_category ORDER BY r.final_time_ms) pos,count(*) OVER(PARTITION BY a.gender,r.scoring_category,r.final_time_ms) tied FROM public.results r JOIN public.athletes a ON a.id=r.athlete_id WHERE r.event_id=p_event AND r.round=p_round AND r.owner_id=auth.uid() AND r.status='OK' AND r.final_time_ms IS NOT NULL AND NOT r.is_exhibition AND NOT r.scoring_unattached), scored AS (SELECT q.id,CASE WHEN p_round='F' THEN (SELECT coalesce(sum(coalesce((pts->>k)::numeric,0)),0)/q.tied FROM generate_series(q.pos::integer-1,q.pos::integer+q.tied::integer-2) k) ELSE 0 END points FROM ranked q) UPDATE public.results r SET points_scored=s.points FROM scored s WHERE r.id=s.id;
END $$;
REVOKE ALL ON FUNCTION public.recalculate_run_event(uuid,text) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.recalculate_run_event(uuid,text) TO authenticated;
CREATE FUNCTION public.save_run_heat(p_meet uuid,p_event uuid,p_heat integer,p_round text,p_rows jsonb) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE ev public.events; m public.meets; r jsonb; ent public.meet_entries; relay public.relay_entries; a public.athletes; rid uuid; ms integer; state text; split jsonb; prev integer; dist integer; lastdist integer; category text; age integer; unattached boolean; n integer:=0; pts jsonb;
BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'No autorizado'; END IF;
SELECT * INTO m FROM public.meets WHERE id=p_meet AND owner_id=auth.uid();SELECT * INTO ev FROM public.events WHERE id=p_event AND meet_id=p_meet AND owner_id=auth.uid();
IF m.id IS NULL OR ev.id IS NULL OR p_heat IS NULL OR p_heat<1 OR p_round IS NULL OR p_round NOT IN('F','P','S') OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Serie no disponible'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(p_meet::text||':run',0));
IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) x GROUP BY x->>'id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Inscripciones duplicadas'; END IF;
IF ev.is_relay THEN SELECT count(*) INTO n FROM public.relay_entries WHERE event_id=p_event AND heat=p_heat AND status<>'SCR';ELSE SELECT count(*) INTO n FROM public.meet_entries WHERE event_id=p_event AND heat=p_heat AND status<>'SCR'; END IF;
IF n=0 OR n<>jsonb_array_length(p_rows) THEN RAISE EXCEPTION 'Los carriles han cambiado; actualiza la serie'; END IF;
FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
state:=r->>'status';IF state IS NULL OR state NOT IN('OK','DQ','NS','EXH') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
IF r->>'timeMs' IS NOT NULL AND r->>'timeMs'!~'^[0-9]+$' THEN RAISE EXCEPTION 'Tiempo no entero'; END IF;ms:=(r->>'timeMs')::integer;
IF state IN('OK','EXH') AND (ms IS NULL OR ms<=0) THEN RAISE EXCEPTION 'Falta tiempo final'; END IF;
IF state='DQ' AND btrim(coalesce(r->>'dqCode',''))='' THEN RAISE EXCEPTION 'Indica la infracción de descalificación'; END IF;
IF ev.is_relay THEN
IF p_round<>'F' THEN RAISE EXCEPTION 'Relevos: solo finales por tiempo en esta versión'; END IF;
SELECT * INTO relay FROM public.relay_entries WHERE id=(r->>'id')::uuid AND event_id=p_event AND heat=p_heat AND status<>'SCR' AND owner_id=auth.uid();IF relay.id IS NULL THEN RAISE EXCEPTION 'Relevo no disponible'; END IF;
UPDATE public.relay_entries SET finals_time_ms=CASE WHEN state IN('OK','EXH') THEN ms ELSE NULL END,status=CASE WHEN state IN('OK','EXH') THEN 'COMPLETED' ELSE state END,is_exhibition=state='EXH',dq_code=CASE WHEN state='DQ' THEN r->>'dqCode' ELSE NULL END,points_scored=0 WHERE id=relay.id;
IF jsonb_array_length(coalesce(r->'splits','[]'))>0 THEN RAISE EXCEPTION 'Parciales de relevo no disponibles; no se guardará información incompleta'; END IF;
ELSE
SELECT * INTO ent FROM public.meet_entries WHERE id=(r->>'id')::uuid AND event_id=p_event AND heat=p_heat AND status<>'SCR' AND owner_id=auth.uid();IF ent.id IS NULL THEN RAISE EXCEPTION 'Inscripción no disponible'; END IF;
SELECT * INTO a FROM public.athletes WHERE id=ent.athlete_id AND owner_id=auth.uid();age:=extract(year FROM m.start_date)::integer-extract(year FROM a.birth_date)::integer;
IF age IS NULL OR age<0 THEN RAISE EXCEPTION 'Completa nacimiento y fecha de competencia'; END IF;
SELECT c.name INTO category FROM public.swim_categories c WHERE c.owner_id=auth.uid() AND age>=coalesce(c.age_min,0) AND age<=coalesce(c.age_max,999) ORDER BY c.sort LIMIT 1;
category:=coalesce(category,CASE WHEN age<=8 THEN '8 y menor' WHEN age<=10 THEN '9-10' WHEN age<=12 THEN '11-12' WHEN age<=14 THEN '13-14' WHEN age<=17 THEN '15-17' ELSE '18+' END);
unattached:=a.is_unattached OR a.club_id IS NULL OR coalesce((SELECT c.is_unattached FROM public.clubs c WHERE c.id=a.club_id),false);
INSERT INTO public.results(owner_id,athlete_id,meet_id,event_id,seed_time_ms,final_time_ms,course,round,heat,lane,status,is_dq,is_exhibition,dq_code,dq_description,scoring_club_id,scoring_unattached,scoring_category,run_entry_id)
VALUES(auth.uid(),a.id,p_meet,p_event,ent.seed_time_ms,CASE WHEN state IN('OK','EXH') THEN ms ELSE NULL END,coalesce(ev.course,m.course),p_round,p_heat,ent.lane,CASE WHEN state='EXH' THEN 'OK' ELSE state END,state='DQ',state='EXH',CASE WHEN state='DQ' THEN r->>'dqCode' ELSE NULL END,CASE WHEN state='DQ' THEN r->>'dqDescription' ELSE NULL END,a.club_id,unattached,category,ent.id)
ON CONFLICT(athlete_id,event_id,round) DO UPDATE SET final_time_ms=EXCLUDED.final_time_ms,course=EXCLUDED.course,heat=EXCLUDED.heat,lane=EXCLUDED.lane,status=EXCLUDED.status,is_dq=EXCLUDED.is_dq,is_exhibition=EXCLUDED.is_exhibition,dq_code=EXCLUDED.dq_code,dq_description=EXCLUDED.dq_description,scoring_club_id=EXCLUDED.scoring_club_id,scoring_unattached=EXCLUDED.scoring_unattached,scoring_category=EXCLUDED.scoring_category,run_entry_id=EXCLUDED.run_entry_id RETURNING id INTO rid;
DELETE FROM public.splits WHERE result_id=rid AND owner_id=auth.uid();prev:=0;lastdist:=0;
IF jsonb_typeof(coalesce(r->'splits','[]')) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Parciales inválidos'; END IF;
FOR split IN SELECT value FROM jsonb_array_elements(coalesce(r->'splits','[]')) LOOP
IF split->>'timeMs'!~'^[0-9]+$' OR split->>'distance'!~'^[0-9]+$' THEN RAISE EXCEPTION 'Parcial no entero'; END IF;
dist:=(split->>'distance')::integer;
IF dist IS NULL OR dist<=lastdist OR dist>ev.distance OR (split->>'timeMs') IS NULL OR (split->>'timeMs')::integer<=prev OR (ms IS NOT NULL AND (split->>'timeMs')::integer>ms) THEN RAISE EXCEPTION 'Parciales fuera de orden o mayores que el final'; END IF;
INSERT INTO public.splits(owner_id,result_id,split_distance,cumulative_time_ms,lap_time_ms) VALUES(auth.uid(),rid,dist,(split->>'timeMs')::integer,(split->>'timeMs')::integer-prev);prev:=(split->>'timeMs')::integer;lastdist:=dist;
END LOOP;
END IF;
END LOOP;
IF ev.is_relay THEN
SELECT CASE WHEN jsonb_typeof(m.scoring_system->'relay')='array' THEN m.scoring_system->'relay' ELSE '[]'::jsonb END INTO pts;
WITH ranked AS(SELECT x.id,rank() OVER(ORDER BY x.finals_time_ms) pos,count(*) OVER(PARTITION BY x.finals_time_ms) tied FROM public.relay_entries x JOIN public.clubs c ON c.id=x.club_id WHERE x.event_id=p_event AND x.status='COMPLETED' AND NOT x.is_exhibition AND NOT c.is_unattached),scored AS(SELECT x.id,(SELECT coalesce(sum(coalesce((pts->>k)::numeric,0)),0)/x.tied FROM generate_series(x.pos::integer-1,x.pos::integer+x.tied::integer-2) k) points FROM ranked x) UPDATE public.relay_entries x SET points_scored=s.points FROM scored s WHERE x.id=s.id;
ELSE PERFORM public.recalculate_run_event(p_event,p_round); END IF;
RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.save_run_heat(uuid,uuid,integer,text,jsonb) FROM PUBLIC,anon; GRANT EXECUTE ON FUNCTION public.save_run_heat(uuid,uuid,integer,text,jsonb) TO authenticated;