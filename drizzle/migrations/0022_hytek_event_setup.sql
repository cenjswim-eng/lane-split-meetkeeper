ALTER TABLE public.events ADD COLUMN course text, ADD COLUMN qualifying_times_ms jsonb, ADD COLUMN setup_metadata jsonb;
COMMENT ON COLUMN public.events.qualifying_times_ms IS 'Meet-specific entry cuts by LCM/SCM/SCY in integer milliseconds; never national standards.';
CREATE OR REPLACE FUNCTION public.import_meet_setup(p_setup jsonb, p_file_name text) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE m jsonb; r jsonb; v_meet uuid; v_event uuid; v_count integer := 0; q jsonb; c text;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Inicia sesión con acceso administrativo'; END IF;
 m := p_setup->'meet';
 IF coalesce(btrim(m->>'name'),'') = '' OR (m->>'course') NOT IN ('LCM','SCM','SCY') OR jsonb_typeof(p_setup->'events') IS DISTINCT FROM 'array' OR jsonb_array_length(p_setup->'events') NOT BETWEEN 1 AND 5000 THEN RAISE EXCEPTION 'Revisa el nombre, piscina y pruebas de la competencia'; END IF;
 v_meet := public.resolve_import_meet(m->>'name',(m->>'startDate')::date,(m->>'endDate')::date,m->>'location',m->>'course');
 IF NOT EXISTS (SELECT 1 FROM public.meets WHERE id=v_meet AND owner_id=auth.uid()) THEN RAISE EXCEPTION 'Competencia no disponible'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(v_meet::text,42));
 FOR r IN SELECT value FROM jsonb_array_elements(p_setup->'events') LOOP
  IF coalesce(r->>'eventNumber','') = '' OR (r->>'distance')::integer IS NULL OR (r->>'distance')::integer <= 0 OR (r->>'stroke')::integer IS NULL OR (r->>'stroke')::integer NOT BETWEEN 1 AND 7 OR coalesce(r->>'gender','') NOT IN ('M','F','X') OR coalesce(r->>'course','') NOT IN ('LCM','SCM','SCY') OR ((r->>'minAge')::integer < 0) OR ((r->>'maxAge')::integer < (r->>'minAge')::integer) THEN RAISE EXCEPTION 'Prueba incompatible'; END IF;
  q := r->'qualifyingTimesMs';
  IF jsonb_typeof(q) IS DISTINCT FROM 'object' THEN RAISE EXCEPTION 'Límites incompatibles'; END IF;
  FOR c IN SELECT jsonb_object_keys(q) LOOP
   IF c NOT IN ('LCM','SCM','SCY') OR (q->>c IS NOT NULL AND ((q->>c)::integer <= 0)) THEN RAISE EXCEPTION 'Tiempo límite inválido'; END IF;
  END LOOP;
  v_event := public.resolve_import_event(v_meet,r->>'eventNumber',(r->>'distance')::integer,(r->>'stroke')::smallint,r->>'gender',(r->>'minAge')::integer,(r->>'maxAge')::integer);
  UPDATE public.events SET course=r->>'course',qualifying_times_ms=q,setup_metadata=r->'metadata',is_relay=(r->>'stroke')::integer IN (6,7) WHERE id=v_event AND owner_id=auth.uid();
  v_count := v_count + 1;
 END LOOP;
 INSERT INTO public.import_logs(file_name,file_type,summary) VALUES(p_file_name,upper(p_setup->>'format'),jsonb_build_object('meetId',v_meet,'events',v_count,'kind','meet_setup'));
 RETURN v_meet;
END; $$;
REVOKE ALL ON FUNCTION public.import_meet_setup(jsonb,text) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_meet_setup(jsonb,text) TO authenticated,service_role;