CREATE FUNCTION public.swimmer_slug(p_first text,p_last text,p_birth date) RETURNS text LANGUAGE sql IMMUTABLE SET search_path=public AS $$ SELECT lower(regexp_replace(translate(coalesce(p_last,'')||'_'||coalesce(p_first,'')||'_'||coalesce(p_birth::text,''),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun'),'[^a-zA-Z0-9_]','','g')) $$;
ALTER TABLE public.athletes ADD COLUMN normalized_slug text GENERATED ALWAYS AS (public.swimmer_slug(first_name,last_name,birth_date)) STORED;
CREATE UNIQUE INDEX athletes_club_slug_key ON public.athletes(owner_id,club_id,normalized_slug) WHERE club_id IS NOT NULL;
ALTER TABLE public.meets ADD COLUMN file_hash text, ADD COLUMN source_format text;
ALTER TABLE public.results ADD COLUMN status text NOT NULL DEFAULT 'OK';
ALTER TABLE public.results ADD CONSTRAINT results_status_values CHECK(status IN ('OK','DQ','NS','SCR','DNF','NT'));
CREATE FUNCTION public.import_meet_payload(p_payload jsonb) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE m jsonb:=p_payload->'meet'; a jsonb; r jsonb; s jsonb; t jsonb; uid uuid:=auth.uid(); cid uuid; mid uuid; aid uuid; eid uuid; rid uuid; tid uuid; nc integer:=0; nm integer:=0; nr integer:=0; ns integer:=0; prev integer; sd integer; st integer; ms integer; seed integer; stat text; cr text; slug text; n integer;
BEGIN
 IF uid IS NULL OR NOT public.has_role(uid,'admin') THEN RAISE EXCEPTION 'Acceso no autorizado'; END IF;
 IF jsonb_typeof(p_payload->'athletes') IS DISTINCT FROM 'array' OR jsonb_typeof(p_payload->'results') IS DISTINCT FROM 'array' OR btrim(coalesce(m->>'name',''))='' OR m->>'startDate' IS NULL OR coalesce(m->>'course','') NOT IN ('LCM','SCM','SCY') THEN RAISE EXCEPTION 'Revisa competencia, fecha, piscina y atletas'; END IF;
 IF jsonb_array_length(p_payload->'athletes')>10000 OR jsonb_array_length(p_payload->'results')>100000 THEN RAISE EXCEPTION 'Archivo demasiado grande'; END IF;
 cid:=nullif(p_payload->>'clubId','')::uuid;
 IF cid IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.clubs WHERE id=cid AND owner_id=uid) THEN RAISE EXCEPTION 'El club no pertenece a tu cuenta'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(uid::text||':swim-import',0));
 mid:=public.resolve_import_meet(m->>'name',(m->>'startDate')::date,(m->>'endDate')::date,m->>'location',m->>'course');
 UPDATE public.meets SET file_hash=p_payload->>'fileHash',source_format=p_payload->>'format' WHERE id=mid;
 IF cid IS NOT NULL THEN INSERT INTO public.club_meets(club_id,meet_id) VALUES(cid,mid) ON CONFLICT(club_id,meet_id) DO NOTHING; END IF;
 FOR t IN SELECT value FROM jsonb_array_elements(coalesce(p_payload->'teams','[]')) LOOP
 INSERT INTO public.teams(owner_id,code,name,lsc) VALUES(uid,t->>'code',t->>'name',t->>'lsc') ON CONFLICT(owner_id,code) DO UPDATE SET name=EXCLUDED.name; END LOOP;
 FOR a IN SELECT value FROM jsonb_array_elements(p_payload->'athletes') LOOP
 IF btrim(coalesce(a->>'firstName',''))='' OR btrim(coalesce(a->>'lastName',''))='' THEN RAISE EXCEPTION 'Nombre de atleta incompleto'; END IF;
 aid:=null;tid:=null;slug:=public.swimmer_slug(a->>'firstName',a->>'lastName',(a->>'birthDate')::date);
 IF nullif(a->>'linkedAthleteId','') IS NOT NULL THEN
 SELECT id INTO aid FROM public.athletes WHERE id=(a->>'linkedAthleteId')::uuid AND owner_id=uid AND (cid IS NULL OR club_id=cid);
 IF aid IS NULL THEN RAISE EXCEPTION 'Vinculación fuera del club'; END IF;
 IF EXISTS(SELECT 1 FROM public.athletes WHERE id=aid AND ((birth_date IS NOT NULL AND a->>'birthDate' IS NOT NULL AND birth_date<>(a->>'birthDate')::date) OR (gender IN ('M','F') AND a->>'gender' IN ('M','F') AND gender<>a->>'gender') OR (nullif(federation_id,'') IS NOT NULL AND nullif(a->>'federationId','') IS NOT NULL AND federation_id<>a->>'federationId'))) THEN RAISE EXCEPTION 'Documento, nacimiento o sexo no coinciden'; END IF;
 ELSE
 IF nullif(a->>'tmId','') IS NOT NULL THEN SELECT id INTO aid FROM public.athletes WHERE owner_id=uid AND tm_athlete_id=a->>'tmId' LIMIT 1; END IF;
 IF aid IS NULL AND nullif(a->>'federationId','') IS NOT NULL THEN SELECT id INTO aid FROM public.athletes WHERE owner_id=uid AND federation_id=a->>'federationId' LIMIT 1; END IF;
 IF aid IS NULL THEN SELECT count(*),min(id::text)::uuid INTO n,aid FROM public.athletes WHERE owner_id=uid AND normalized_slug=slug AND (cid IS NULL OR club_id=cid); IF n>1 THEN RAISE EXCEPTION 'Identidad ambigua'; END IF; END IF;
 IF aid IS NOT NULL AND EXISTS(SELECT 1 FROM public.athletes WHERE id=aid AND normalized_slug<>slug AND (birth_date IS DISTINCT FROM (a->>'birthDate')::date OR lower(last_name)<>lower(a->>'lastName'))) THEN RAISE EXCEPTION 'ID asociado a otra identidad'; END IF;
 END IF;
 SELECT id INTO tid FROM public.teams WHERE owner_id=uid AND code=a->>'teamCode';
 IF aid IS NULL THEN INSERT INTO public.athletes(owner_id,club_id,tm_athlete_id,federation_id,first_name,last_name,birth_date,gender,team_id) VALUES(uid,cid,nullif(a->>'tmId',''),nullif(a->>'federationId',''),a->>'firstName',a->>'lastName',(a->>'birthDate')::date,a->>'gender',tid) RETURNING id INTO aid;nc:=nc+1; ELSE nm:=nm+1; END IF;
 FOR r IN SELECT value FROM jsonb_array_elements(p_payload->'results') WHERE value->>'athleteKey'=a->>'key' LOOP
 cr:=coalesce(r->>'course',m->>'course');stat:=coalesce(r->>'status',CASE WHEN (r->>'isDq')::boolean THEN 'DQ' ELSE 'OK' END);
 IF cr NOT IN ('LCM','SCM','SCY') OR stat NOT IN ('OK','DQ','NS','SCR','DNF','NT') OR coalesce(r->>'round','') NOT IN ('F','P','S') OR (r->>'distance')::integer<=0 OR (r->>'stroke')::integer NOT BETWEEN 1 AND 7 THEN RAISE EXCEPTION 'Prueba o estado inválido'; END IF;
 IF (r->>'finalMs' IS NOT NULL AND r->>'finalMs' !~ '^[0-9]+$') OR (r->>'seedMs' IS NOT NULL AND r->>'seedMs' !~ '^[0-9]+$') THEN RAISE EXCEPTION 'Tiempos no enteros'; END IF;
 ms:=(r->>'finalMs')::integer;seed:=(r->>'seedMs')::integer;IF ms<=0 OR seed<=0 THEN RAISE EXCEPTION 'Tiempos inválidos'; END IF;
 eid:=null;SELECT id INTO eid FROM public.events WHERE owner_id=uid AND meet_id=mid AND distance=(r->>'distance')::integer AND stroke=(r->>'stroke')::smallint AND gender IS NOT DISTINCT FROM r->>'gender' AND min_age IS NOT DISTINCT FROM (r->>'minAge')::integer AND max_age IS NOT DISTINCT FROM (r->>'maxAge')::integer AND (event_number IS NOT DISTINCT FROM r->>'eventNumber' OR event_number IS NULL OR r->>'eventNumber' IS NULL) AND (course=cr OR course IS NULL) ORDER BY (course=cr) DESC NULLS LAST,id LIMIT 1;
 IF eid IS NULL THEN INSERT INTO public.events(owner_id,meet_id,event_number,distance,stroke,gender,min_age,max_age,course,is_relay) VALUES(uid,mid,r->>'eventNumber',(r->>'distance')::integer,(r->>'stroke')::smallint,r->>'gender',(r->>'minAge')::integer,(r->>'maxAge')::integer,cr,(r->>'stroke')::integer>=6) RETURNING id INTO eid; END IF;
 INSERT INTO public.results(owner_id,athlete_id,meet_id,event_id,seed_time_ms,final_time_ms,course,round,place,is_dq,status,aqua_points) VALUES(uid,aid,mid,eid,seed,CASE WHEN stat='OK' THEN ms ELSE NULL END,cr,r->>'round',(r->>'place')::integer,stat='DQ',stat,(r->>'aquaPoints')::integer)
 ON CONFLICT(athlete_id,event_id,round) DO UPDATE SET seed_time_ms=coalesce(EXCLUDED.seed_time_ms,results.seed_time_ms),final_time_ms=CASE WHEN ms IS NOT NULL OR stat IN ('DQ','NS','SCR','DNF') THEN EXCLUDED.final_time_ms ELSE results.final_time_ms END,is_dq=CASE WHEN ms IS NOT NULL OR stat IN ('DQ','NS','SCR','DNF') THEN EXCLUDED.is_dq ELSE results.is_dq END,status=CASE WHEN ms IS NOT NULL OR stat IN ('DQ','NS','SCR','DNF') THEN stat ELSE results.status END,place=coalesce(EXCLUDED.place,results.place),aqua_points=CASE WHEN ms IS NOT NULL OR stat IN ('DQ','NS','SCR','DNF') THEN EXCLUDED.aqua_points ELSE results.aqua_points END RETURNING id INTO rid;
 nr:=nr+1;prev:=0;sd:=0;
 FOR s IN SELECT value FROM jsonb_array_elements(coalesce(r->'splits','[]')) ORDER BY (value->>'distance')::integer LOOP
 IF s->>'cumulative_ms' !~ '^[0-9]+$' THEN RAISE EXCEPTION 'Parcial no entero'; END IF;st:=(s->>'cumulative_ms')::integer;
 IF (s->>'distance')::integer<=sd OR (s->>'distance')::integer>(r->>'distance')::integer OR st<=prev THEN RAISE EXCEPTION 'Parciales no crecientes'; END IF;
 INSERT INTO public.splits(owner_id,result_id,split_distance,cumulative_time_ms,lap_time_ms) VALUES(uid,rid,(s->>'distance')::integer,st,st-prev) ON CONFLICT(result_id,split_distance) DO UPDATE SET cumulative_time_ms=EXCLUDED.cumulative_time_ms,lap_time_ms=EXCLUDED.lap_time_ms;
 prev:=st;sd:=(s->>'distance')::integer;ns:=ns+1;END LOOP;END LOOP;END LOOP;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'results') r WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->'athletes') a WHERE a->>'key'=r->>'athleteKey')) THEN RAISE EXCEPTION 'Resultado sin atleta'; END IF;
 INSERT INTO public.import_logs(file_name,file_type,summary) VALUES(coalesce(p_payload->>'fileName','Importación revisada'),p_payload->>'format',jsonb_build_object('meetId',mid,'fileHash',p_payload->>'fileHash','results',nr,'splits',ns));
 RETURN jsonb_build_object('meetId',mid,'meetName',m->>'name','teams',jsonb_array_length(coalesce(p_payload->'teams','[]')),'athletesNew',nc,'athletesMatched',nm,'results',nr,'splits',ns);END $$;
REVOKE ALL ON FUNCTION public.import_meet_payload(jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_meet_payload(jsonb) TO authenticated;