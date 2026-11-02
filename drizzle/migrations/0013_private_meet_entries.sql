CREATE TABLE public.meet_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL DEFAULT auth.uid(), meet_id uuid NOT NULL REFERENCES public.meets(id) ON DELETE CASCADE, athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE, event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE, seed_time_ms integer CHECK (seed_time_ms IS NULL OR seed_time_ms > 0), created_at timestamptz NOT NULL DEFAULT now(), UNIQUE(athlete_id,event_id));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meet_entries TO authenticated;
GRANT ALL ON public.meet_entries TO service_role;
ALTER TABLE public.meet_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "private account entries" ON public.meet_entries FOR ALL TO authenticated USING (owner_id=auth.uid() AND public.has_role(auth.uid(),'admin')) WITH CHECK(owner_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE TRIGGER guard_private_entry BEFORE INSERT OR UPDATE ON public.meet_entries FOR EACH ROW EXECUTE FUNCTION public.guard_private_row();
CREATE FUNCTION public.guard_entry_event() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN IF NOT EXISTS (SELECT 1 FROM public.events WHERE id=NEW.event_id AND meet_id=NEW.meet_id AND NOT is_relay) THEN RAISE EXCEPTION 'La prueba individual no pertenece a la competencia'; END IF; RETURN NEW; END; $$;
CREATE TRIGGER guard_entry_meet BEFORE INSERT OR UPDATE ON public.meet_entries FOR EACH ROW EXECUTE FUNCTION public.guard_entry_event();
CREATE INDEX meet_entries_meet_idx ON public.meet_entries(meet_id);