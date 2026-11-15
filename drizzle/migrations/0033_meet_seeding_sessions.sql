ALTER TABLE public.meet_entries ADD COLUMN seeding_time_ms integer;
ALTER TABLE public.relay_entries ADD COLUMN seeding_time_ms integer;
CREATE TABLE public.meet_seeding_sessions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL DEFAULT auth.uid(), meet_id uuid NOT NULL REFERENCES public.meets(id) ON DELETE CASCADE, session_number integer NOT NULL CHECK(session_number>0), lanes integer NOT NULL DEFAULT 8 CHECK(lanes IN(6,8,10)), mode text NOT NULL DEFAULT 'timed' CHECK(mode IN('timed','circle')), conversion_enabled boolean NOT NULL DEFAULT false, conversion_factor numeric NOT NULL DEFAULT 1 CHECK(conversion_factor>0), closed boolean NOT NULL DEFAULT false, revision integer NOT NULL DEFAULT 0, UNIQUE(meet_id,session_number));
GRANT SELECT,INSERT,UPDATE,DELETE ON public.meet_seeding_sessions TO authenticated;
GRANT ALL ON public.meet_seeding_sessions TO service_role;
ALTER TABLE public.meet_seeding_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY owner_admin ON public.meet_seeding_sessions FOR ALL TO authenticated USING(owner_id=auth.uid() AND public.has_role(auth.uid(),'admin')) WITH CHECK(owner_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE TRIGGER guard_private_row BEFORE INSERT OR UPDATE ON public.meet_seeding_sessions FOR EACH ROW EXECUTE FUNCTION public.guard_private_row();
CREATE FUNCTION public.guard_seeding_entry() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ DECLARE mid uuid; sn integer; BEGIN
IF TG_OP='DELETE' THEN mid:=OLD.meet_id; ELSE mid:=NEW.meet_id; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(mid::text||':seeding',0));
IF TG_OP<>'INSERT' AND EXISTS(SELECT 1 FROM public.meet_seeding_sessions s JOIN public.events e ON e.meet_id=s.meet_id AND e.session_number=s.session_number WHERE e.id=OLD.event_id AND s.closed) THEN RAISE EXCEPTION 'Session fermee: reouvrez avant de modifier les inscriptions'; END IF;
IF TG_OP<>'DELETE' THEN
IF EXISTS(SELECT 1 FROM public.meet_seeding_sessions s JOIN public.events e ON e.meet_id=s.meet_id AND e.session_number=s.session_number WHERE e.id=NEW.event_id AND s.closed) THEN RAISE EXCEPTION 'Sesión cerrada: reabre antes de modificar inscripciones'; END IF;
IF (NEW.heat IS NULL) IS DISTINCT FROM (NEW.lane IS NULL) OR NEW.heat<1 OR NEW.lane<1 OR NEW.lane>10 OR NEW.seeding_time_ms<=0 THEN RAISE EXCEPTION 'Serie, carril o tiempo inválido'; END IF;
RETURN NEW; END IF; RETURN OLD; END $$;
CREATE TRIGGER guard_seeding_entry BEFORE INSERT OR UPDATE OR DELETE ON public.meet_entries FOR EACH ROW EXECUTE FUNCTION public.guard_seeding_entry();
CREATE TRIGGER guard_seeding_entry BEFORE INSERT OR UPDATE OR DELETE ON public.relay_entries FOR EACH ROW EXECUTE FUNCTION public.guard_seeding_entry();
CREATE FUNCTION public.save_meet_seeding(p_meet uuid,p_session integer,p_revision integer,p_lanes integer,p_mode text,p_conversion boolean,p_factor numeric,p_rows jsonb,p_close boolean DEFAULT false) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE cfg public.meet_seeding_sessions; r jsonb; ev uuid; rid uuid; kind text; total integer; newrev integer;
BEGIN
IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') OR NOT EXISTS(SELECT 1 FROM public.meets WHERE id=p_meet AND owner_id=auth.uid()) THEN RAISE EXCEPTION 'Competencia no disponible'; END IF;
IF p_session IS NULL OR p_session<1 OR p_lanes IS NULL OR p_lanes NOT IN(6,8,10) OR p_mode IS NULL OR p_mode NOT IN('timed','circle') OR p_factor IS NULL OR p_factor<=0 OR p_conversion IS NULL OR p_close IS NULL OR jsonb_typeof(p_rows) IS DISTINCT FROM 'array' THEN RAISE EXCEPTION 'Configuración inválida'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(p_meet::text||':seeding',0));
INSERT INTO public.meet_seeding_sessions(meet_id,session_number) VALUES(p_meet,p_session) ON CONFLICT(meet_id,session_number) DO NOTHING;
SELECT * INTO cfg FROM public.meet_seeding_sessions WHERE meet_id=p_meet AND session_number=p_session FOR UPDATE;
IF cfg.closed THEN RAISE EXCEPTION 'Sesión cerrada'; END IF;
IF cfg.revision IS DISTINCT FROM p_revision THEN RAISE EXCEPTION 'La siembra cambió: actualiza antes de guardar'; END IF;
SELECT (SELECT count(*) FROM public.meet_entries x JOIN public.events e ON e.id=x.event_id WHERE x.meet_id=p_meet AND e.session_number=p_session)+(SELECT count(*) FROM public.relay_entries x JOIN public.events e ON e.id=x.event_id WHERE x.meet_id=p_meet AND e.session_number=p_session) INTO total;
IF jsonb_array_length(p_rows)<>total OR EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) x GROUP BY x->>'kind',x->>'id' HAVING count(*)>1) THEN RAISE EXCEPTION 'Las inscripciones cambiaron o están duplicadas'; END IF;
FOR r IN SELECT value FROM jsonb_array_elements(p_rows) LOOP
rid:=(r->>'id')::uuid;ev:=(r->>'eventId')::uuid;kind:=r->>'kind';
IF NOT EXISTS(SELECT 1 FROM public.events WHERE id=ev AND meet_id=p_meet AND session_number=p_session) OR kind NOT IN('individual','relay') OR kind IS NULL OR coalesce(r->>'status','') NOT IN('OK','NT','SCR') THEN RAISE EXCEPTION 'Inscripción inválida'; END IF;
IF r->>'status'<>'SCR' AND ((r->>'heat') IS NULL OR (r->>'lane') IS NULL OR (r->>'heat')::integer<1 OR (r->>'lane')::integer NOT BETWEEN 1 AND p_lanes) THEN RAISE EXCEPTION 'Carril o serie inválido'; END IF;
IF kind='individual' THEN
UPDATE public.meet_entries SET heat=CASE WHEN r->>'status'='SCR' THEN NULL ELSE (r->>'heat')::integer END,lane=CASE WHEN r->>'status'='SCR' THEN NULL ELSE (r->>'lane')::integer END,status=r->>'status',seeding_time_ms=(r->>'timeMs')::integer WHERE id=rid AND event_id=ev AND meet_id=p_meet AND owner_id=auth.uid();
ELSE
UPDATE public.relay_entries SET heat=CASE WHEN r->>'status'='SCR' THEN NULL ELSE (r->>'heat')::integer END,lane=CASE WHEN r->>'status'='SCR' THEN NULL ELSE (r->>'lane')::integer END,status=r->>'status',seeding_time_ms=(r->>'timeMs')::integer WHERE id=rid AND event_id=ev AND meet_id=p_meet AND owner_id=auth.uid(); END IF;
IF NOT FOUND THEN RAISE EXCEPTION 'Inscripción ajena o eliminada'; END IF;
END LOOP;
IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_rows) x WHERE x->>'status'<>'SCR' GROUP BY x->>'eventId',x->>'heat',x->>'lane' HAVING count(*)>1) THEN RAISE EXCEPTION 'Dos inscripciones en un mismo carril'; END IF;
UPDATE public.meet_seeding_sessions SET lanes=p_lanes,mode=p_mode,conversion_enabled=p_conversion,conversion_factor=p_factor,closed=p_close,revision=revision+1 WHERE id=cfg.id RETURNING revision INTO newrev;
RETURN newrev;
END $$;
REVOKE ALL ON FUNCTION public.save_meet_seeding(uuid,integer,integer,integer,text,boolean,numeric,jsonb,boolean) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.save_meet_seeding(uuid,integer,integer,integer,text,boolean,numeric,jsonb,boolean) TO authenticated;
CREATE FUNCTION public.reopen_meet_seeding(p_meet uuid,p_session integer,p_revision integer) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acceso no autorizado'; END IF;
PERFORM pg_advisory_xact_lock(hashtextextended(p_meet::text||':seeding',0));
UPDATE public.meet_seeding_sessions SET closed=false,revision=revision+1 WHERE meet_id=p_meet AND session_number=p_session AND owner_id=auth.uid() AND revision=p_revision;
IF NOT FOUND THEN RAISE EXCEPTION 'Sesión no disponible o modificada'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.reopen_meet_seeding(uuid,integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.reopen_meet_seeding(uuid,integer,integer) TO authenticated;