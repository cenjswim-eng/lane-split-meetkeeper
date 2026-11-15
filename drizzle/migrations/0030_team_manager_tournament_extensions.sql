ALTER TABLE public.clubs ADD COLUMN team_type text NOT NULL DEFAULT 'AGE_GROUP' CHECK (team_type IN ('AGE_GROUP','MASTERS','HIGH_SCHOOL','COLLEGE','OPEN')), ADD COLUMN division text, ADD COLUMN region text;
ALTER TABLE public.athletes ADD COLUMN is_unattached boolean NOT NULL DEFAULT false, ADD COLUMN is_federated boolean NOT NULL DEFAULT false;
ALTER TABLE public.meets ADD COLUMN facility_name text, ADD COLUMN city text, ADD COLUMN age_up_date date, ADD COLUMN lanes_count integer CHECK (lanes_count > 0), ADD COLUMN max_ind_entries integer CHECK (max_ind_entries > 0), ADD COLUMN max_ind_per_session integer CHECK (max_ind_per_session > 0), ADD COLUMN max_relay_entries integer CHECK (max_relay_entries > 0), ADD COLUMN max_total_entries integer CHECK (max_total_entries > 0), ADD COLUMN athlete_surcharge numeric NOT NULL DEFAULT 0 CHECK (athlete_surcharge >= 0), ADD COLUMN ind_entry_fee numeric NOT NULL DEFAULT 0 CHECK (ind_entry_fee >= 0), ADD COLUMN relay_entry_fee numeric NOT NULL DEFAULT 0 CHECK (relay_entry_fee >= 0), ADD COLUMN scoring_system jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.events ADD COLUMN session_number integer NOT NULL DEFAULT 1 CHECK (session_number > 0), ADD COLUMN round_type text NOT NULL DEFAULT 'TIMED_FINALS' CHECK (round_type IN ('TIMED_FINALS','PRELIMS_FINALS')), ADD COLUMN event_fee numeric CHECK (event_fee >= 0);
ALTER TABLE public.meet_entries ADD COLUMN seed_course text CHECK (seed_course IN ('LCM','SCM','SCY')), ADD COLUMN is_exhibition boolean NOT NULL DEFAULT false, ADD COLUMN heat integer CHECK (heat > 0), ADD COLUMN lane integer CHECK (lane > 0), ADD COLUMN status text NOT NULL DEFAULT 'ENTERED' CHECK (status IN ('ENTERED','SEEDED','SCR'));
ALTER TABLE public.results ADD COLUMN heat integer CHECK (heat > 0), ADD COLUMN lane integer CHECK (lane > 0), ADD COLUMN dq_code text, ADD COLUMN dq_description text, ADD COLUMN points_scored numeric;
CREATE TABLE public.relay_entries (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL DEFAULT auth.uid(), meet_id uuid NOT NULL REFERENCES public.meets(id) ON DELETE CASCADE, event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE, club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
 relay_letter text NOT NULL CHECK (relay_letter ~ '^[A-Z]{1,2}$'), seed_time_ms integer CHECK (seed_time_ms > 0), seed_course text CHECK (seed_course IN ('LCM','SCM','SCY')), heat integer CHECK (heat > 0), lane integer CHECK (lane > 0), finals_time_ms integer CHECK (finals_time_ms > 0),
 swimmer_1_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE, swimmer_2_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE, swimmer_3_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE, swimmer_4_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE, alt_1_id uuid REFERENCES public.athletes(id) ON DELETE SET NULL, alt_2_id uuid REFERENCES public.athletes(id) ON DELETE SET NULL,
 status text NOT NULL DEFAULT 'ENTERED' CHECK (status IN ('ENTERED','SEEDED','COMPLETED','DQ','NS','SCR','DNF')), dq_code text, points_scored numeric, created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(club_id,event_id,relay_letter)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.relay_entries TO authenticated;
GRANT ALL ON public.relay_entries TO service_role;
ALTER TABLE public.relay_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY private_relays ON public.relay_entries FOR ALL TO authenticated USING (owner_id=auth.uid() AND public.has_role(auth.uid(),'admin')) WITH CHECK (owner_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE TRIGGER guard_private_relay BEFORE INSERT OR UPDATE ON public.relay_entries FOR EACH ROW EXECUTE FUNCTION public.guard_private_row();
CREATE FUNCTION public.guard_relay_lineup() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE athlete_uuid uuid; ids uuid[]; ev public.events; m public.meets; competitive_age integer; n integer;
BEGIN
 SELECT * INTO ev FROM public.events WHERE id=NEW.event_id AND meet_id=NEW.meet_id;
 IF ev.id IS NULL OR NOT ev.is_relay THEN RAISE EXCEPTION 'La prueba no es un relevo de esta competencia'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.club_meets WHERE club_id=NEW.club_id AND meet_id=NEW.meet_id) THEN RAISE EXCEPTION 'Añade la competencia al club'; END IF;
 ids:=array_remove(ARRAY[NEW.swimmer_1_id,NEW.swimmer_2_id,NEW.swimmer_3_id,NEW.swimmer_4_id,NEW.alt_1_id,NEW.alt_2_id],NULL);
 IF cardinality(ids)<>(SELECT count(DISTINCT x) FROM unnest(ids) AS t(x)) THEN RAISE EXCEPTION 'No puedes repetir nadadores en el relevo'; END IF;
 SELECT * INTO m FROM public.meets WHERE id=NEW.meet_id;
 IF NEW.seed_course IS NOT NULL AND NEW.seed_course IS DISTINCT FROM coalesce(ev.course,m.course) THEN RAISE EXCEPTION 'Piscina de inscripción incompatible'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.owner_id::text||NEW.meet_id::text,0));
 FOREACH athlete_uuid IN ARRAY ids LOOP
  IF NOT EXISTS(SELECT 1 FROM public.athletes WHERE id=athlete_uuid AND owner_id=NEW.owner_id AND club_id=NEW.club_id AND is_active) THEN RAISE EXCEPTION 'Integrante ajeno, inactivo o de otro club'; END IF;
  SELECT extract(year FROM coalesce(m.start_date,current_date))::integer-extract(year FROM a.birth_date)::integer INTO competitive_age FROM public.athletes a WHERE id=athlete_uuid AND (ev.gender IS NULL OR ev.gender='X' OR ev.gender=a.gender);
  IF competitive_age IS NULL OR (ev.min_age IS NOT NULL AND competitive_age<ev.min_age) OR (ev.max_age IS NOT NULL AND competitive_age>ev.max_age) THEN RAISE EXCEPTION 'Integrante no elegible por edad al 31 de diciembre o sexo'; END IF;
  IF NEW.status<>'SCR' AND athlete_uuid=ANY(ARRAY[NEW.swimmer_1_id,NEW.swimmer_2_id,NEW.swimmer_3_id,NEW.swimmer_4_id]) THEN
   SELECT count(*) INTO n FROM public.relay_entries r WHERE r.meet_id=NEW.meet_id AND r.id<>NEW.id AND r.status<>'SCR' AND athlete_uuid=ANY(ARRAY[r.swimmer_1_id,r.swimmer_2_id,r.swimmer_3_id,r.swimmer_4_id]);
   IF m.max_relay_entries IS NOT NULL AND n+1>m.max_relay_entries THEN RAISE EXCEPTION 'Límite de relevos excedido'; END IF;
   IF m.max_total_entries IS NOT NULL AND n+1+(SELECT count(*) FROM public.meet_entries WHERE meet_id=NEW.meet_id AND athlete_id=athlete_uuid AND status<>'SCR')>m.max_total_entries THEN RAISE EXCEPTION 'Límite total de pruebas excedido'; END IF;
   IF EXISTS(SELECT 1 FROM public.relay_entries r WHERE r.event_id=NEW.event_id AND r.id<>NEW.id AND r.status<>'SCR' AND athlete_uuid=ANY(ARRAY[r.swimmer_1_id,r.swimmer_2_id,r.swimmer_3_id,r.swimmer_4_id])) THEN RAISE EXCEPTION 'El nadador ya integra otro equipo en esta prueba'; END IF;
  END IF;
 END LOOP;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_relay_lineup() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_relay_lineup BEFORE INSERT OR UPDATE ON public.relay_entries FOR EACH ROW EXECUTE FUNCTION public.guard_relay_lineup();
CREATE FUNCTION public.guard_tournament_entry() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE ev public.events; m public.meets; a public.athletes; competitive_age integer; n integer;
BEGIN
 SELECT * INTO ev FROM public.events WHERE id=NEW.event_id; SELECT * INTO m FROM public.meets WHERE id=NEW.meet_id; SELECT * INTO a FROM public.athletes WHERE id=NEW.athlete_id;
 competitive_age:=extract(year FROM coalesce(m.start_date,current_date))::integer-extract(year FROM a.birth_date)::integer;
 IF competitive_age IS NULL OR NOT a.is_active OR (ev.gender IS NOT NULL AND ev.gender<>'X' AND ev.gender IS DISTINCT FROM a.gender) OR (ev.min_age IS NOT NULL AND competitive_age<ev.min_age) OR (ev.max_age IS NOT NULL AND competitive_age>ev.max_age) THEN RAISE EXCEPTION 'Atleta no elegible por edad al 31 de diciembre, sexo o estado'; END IF;
 IF NEW.seed_course IS NOT NULL AND NEW.seed_course IS DISTINCT FROM coalesce(ev.course,m.course) THEN RAISE EXCEPTION 'Piscina de inscripción incompatible'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(NEW.owner_id::text||NEW.meet_id::text,0));
 IF NEW.status='SCR' THEN RETURN NEW; END IF;
 SELECT count(*) INTO n FROM public.meet_entries WHERE meet_id=NEW.meet_id AND athlete_id=NEW.athlete_id AND id<>NEW.id AND status<>'SCR';
 IF m.max_ind_entries IS NOT NULL AND n+1>m.max_ind_entries THEN RAISE EXCEPTION 'Límite individual del torneo excedido'; END IF;
 IF m.max_total_entries IS NOT NULL AND n+1+(SELECT count(*) FROM public.relay_entries r WHERE meet_id=NEW.meet_id AND status<>'SCR' AND NEW.athlete_id=ANY(ARRAY[r.swimmer_1_id,r.swimmer_2_id,r.swimmer_3_id,r.swimmer_4_id]))>m.max_total_entries THEN RAISE EXCEPTION 'Límite total de pruebas excedido'; END IF;
 IF m.max_ind_per_session IS NOT NULL AND (SELECT count(*) FROM public.meet_entries e JOIN public.events v ON v.id=e.event_id WHERE e.meet_id=NEW.meet_id AND e.athlete_id=NEW.athlete_id AND e.id<>NEW.id AND e.status<>'SCR' AND v.session_number=ev.session_number)+1>m.max_ind_per_session THEN RAISE EXCEPTION 'Límite individual por sesión excedido'; END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.guard_tournament_entry() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_tournament_entry BEFORE INSERT OR UPDATE ON public.meet_entries FOR EACH ROW EXECUTE FUNCTION public.guard_tournament_entry();
CREATE FUNCTION public.merge_clubs(p_source uuid,p_target uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE moved integer;
BEGIN
 IF NOT public.has_role(auth.uid(),'admin') OR p_source=p_target THEN RAISE EXCEPTION 'Fusión inválida'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text||'club-merge',0));
 PERFORM id FROM public.clubs WHERE id IN(p_source,p_target) AND owner_id=auth.uid() ORDER BY id FOR UPDATE;
 IF (SELECT count(*) FROM public.clubs WHERE id IN(p_source,p_target) AND owner_id=auth.uid())<>2 THEN RAISE EXCEPTION 'Ambos clubes deben pertenecer a tu cuenta'; END IF;
 IF EXISTS(SELECT 1 FROM public.relay_entries a JOIN public.relay_entries b ON a.event_id=b.event_id AND a.relay_letter=b.relay_letter WHERE a.club_id=p_source AND b.club_id=p_target) THEN RAISE EXCEPTION 'Revisa los relevos duplicados antes de fusionar'; END IF;
 IF EXISTS(SELECT 1 FROM public.club_documents WHERE club_id=p_source) THEN RAISE EXCEPTION 'El club de origen tiene documentos privados: muévelos mediante almacenamiento antes de fusionar'; END IF;
 INSERT INTO public.club_meets(club_id,meet_id) SELECT p_target,meet_id FROM public.club_meets WHERE club_id=p_source ON CONFLICT(club_id,meet_id) DO NOTHING;
 UPDATE public.athletes SET club_id=p_target WHERE club_id=p_source; GET DIAGNOSTICS moved=ROW_COUNT;
 UPDATE public.relay_entries SET club_id=p_target WHERE club_id=p_source;
 UPDATE public.club_members SET club_id=p_target WHERE club_id=p_source;
 DELETE FROM public.club_meets WHERE club_id=p_source;
 DELETE FROM public.clubs WHERE id=p_source;
 RETURN jsonb_build_object('athletes',moved);
END $$;
REVOKE ALL ON FUNCTION public.merge_clubs(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.merge_clubs(uuid,uuid) TO authenticated;
CREATE FUNCTION public.guard_relay_club_change() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='athletes' THEN
  IF NEW.club_id IS DISTINCT FROM OLD.club_id AND EXISTS(SELECT 1 FROM public.relay_entries r WHERE OLD.id=ANY(ARRAY[r.swimmer_1_id,r.swimmer_2_id,r.swimmer_3_id,r.swimmer_4_id,r.alt_1_id,r.alt_2_id]) AND r.club_id IS DISTINCT FROM NEW.club_id) THEN
   IF current_setting('app.club_merge',true) IS DISTINCT FROM auth.uid()::text THEN RAISE EXCEPTION 'Retira al atleta de los relevos antes de cambiar de club'; END IF;
  END IF; RETURN NEW;
 ELSE
  IF EXISTS(SELECT 1 FROM public.relay_entries WHERE club_id=OLD.club_id AND meet_id=OLD.meet_id) THEN RAISE EXCEPTION 'No puedes retirar una competencia con relevos'; END IF; RETURN OLD;
 END IF;
END $$;
REVOKE ALL ON FUNCTION public.guard_relay_club_change() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_relay_athlete_club BEFORE UPDATE ON public.athletes FOR EACH ROW EXECUTE FUNCTION public.guard_relay_club_change();
CREATE TRIGGER guard_relay_club_meet BEFORE DELETE ON public.club_meets FOR EACH ROW EXECUTE FUNCTION public.guard_relay_club_change();