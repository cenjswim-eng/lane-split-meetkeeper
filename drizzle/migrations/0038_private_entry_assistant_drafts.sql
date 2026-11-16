ALTER TABLE public.meet_entries ADD COLUMN entry_origin text NOT NULL DEFAULT 'manual' CHECK (entry_origin IN ('manual','suggested')), ADD COLUMN reference_date date, ADD COLUMN time_converted boolean NOT NULL DEFAULT false;
CREATE TABLE public.entry_assistant_drafts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL DEFAULT auth.uid(), meet_id uuid NOT NULL REFERENCES public.meets(id) ON DELETE CASCADE, club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE, rules jsonb NOT NULL DEFAULT '{}', rows jsonb NOT NULL DEFAULT '[]', updated_at timestamptz NOT NULL DEFAULT now(), CHECK(jsonb_typeof(rules)='object'), CHECK(jsonb_typeof(rows)='array'));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.entry_assistant_drafts TO authenticated;
GRANT ALL ON public.entry_assistant_drafts TO service_role;
ALTER TABLE public.entry_assistant_drafts ENABLE ROW LEVEL SECURITY;
CREATE POLICY private_entry_assistant ON public.entry_assistant_drafts FOR ALL TO authenticated USING(owner_id=auth.uid() AND public.has_role(auth.uid(),'admin')) WITH CHECK(owner_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE TRIGGER guard_private_assistant BEFORE INSERT OR UPDATE ON public.entry_assistant_drafts FOR EACH ROW EXECUTE FUNCTION public.guard_private_row();
CREATE FUNCTION public.guard_assistant_draft() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE r jsonb; BEGIN
IF jsonb_array_length(NEW.rows)>10000 THEN RAISE EXCEPTION 'Borrador demasiado grande'; END IF;
FOR r IN SELECT value FROM jsonb_array_elements(NEW.rows) LOOP
IF NOT EXISTS(SELECT 1 FROM public.athletes WHERE id=(r->>'athleteId')::uuid AND owner_id=NEW.owner_id AND (NEW.club_id IS NULL OR club_id=NEW.club_id)) OR NOT EXISTS(SELECT 1 FROM public.events WHERE id=(r->>'eventId')::uuid AND meet_id=NEW.meet_id AND owner_id=NEW.owner_id AND NOT is_relay) THEN RAISE EXCEPTION 'Atleta o prueba fuera del borrador privado'; END IF;
IF coalesce(r->>'origin','') NOT IN ('manual','suggested') OR (r->>'timeMs' IS NOT NULL AND (r->>'timeMs' !~ '^[0-9]+$' OR (r->>'timeMs')::integer<=0)) THEN RAISE EXCEPTION 'Tiempo o procedencia inválidos'; END IF;
END LOOP; NEW.updated_at:=now(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.guard_assistant_draft() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER validate_assistant_draft BEFORE INSERT OR UPDATE ON public.entry_assistant_drafts FOR EACH ROW EXECUTE FUNCTION public.guard_assistant_draft();
CREATE FUNCTION public.commit_entry_assistant(p_draft uuid) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE d public.entry_assistant_drafts; r jsonb; n integer:=0; c uuid; BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'No autorizado'; END IF;
SELECT * INTO d FROM public.entry_assistant_drafts WHERE id=p_draft AND owner_id=auth.uid() FOR UPDATE;
IF d.id IS NULL THEN RAISE EXCEPTION 'Borrador no disponible'; END IF;
IF EXISTS(SELECT 1 FROM jsonb_array_elements(d.rows) x GROUP BY x->>'athleteId',x->>'eventId' HAVING count(*)>1) THEN RAISE EXCEPTION 'Revisa las inscripciones duplicadas'; END IF;
FOR r IN SELECT value FROM jsonb_array_elements(d.rows) LOOP
SELECT club_id INTO c FROM public.athletes WHERE id=(r->>'athleteId')::uuid AND owner_id=auth.uid();
IF c IS NOT NULL THEN INSERT INTO public.club_meets(club_id,meet_id) VALUES(c,d.meet_id) ON CONFLICT(club_id,meet_id) DO NOTHING; END IF;
INSERT INTO public.meet_entries(meet_id,athlete_id,event_id,seed_time_ms,seed_course,entry_origin,reference_date,time_converted) VALUES(d.meet_id,(r->>'athleteId')::uuid,(r->>'eventId')::uuid,(r->>'timeMs')::integer,coalesce((SELECT coalesce(e.course,m.course) FROM public.events e JOIN public.meets m ON m.id=e.meet_id WHERE e.id=(r->>'eventId')::uuid),'LCM'),r->>'origin',nullif(r->>'referenceDate','')::date,coalesce((r->>'converted')::boolean,false)) ON CONFLICT(athlete_id,event_id) DO UPDATE SET seed_time_ms=EXCLUDED.seed_time_ms,seed_course=EXCLUDED.seed_course,entry_origin=EXCLUDED.entry_origin,reference_date=EXCLUDED.reference_date,time_converted=EXCLUDED.time_converted;
n:=n+1; END LOOP; RETURN n; END $$;
REVOKE ALL ON FUNCTION public.commit_entry_assistant(uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.commit_entry_assistant(uuid) TO authenticated;