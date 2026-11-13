ALTER TABLE public.athletes ADD COLUMN club_id uuid REFERENCES public.clubs(id);
CREATE INDEX athletes_club_id_idx ON public.athletes(club_id);
CREATE TABLE public.club_meets (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid(),
 club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
 meet_id uuid NOT NULL REFERENCES public.meets(id) ON DELETE CASCADE,
 UNIQUE(club_id,meet_id)
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.club_meets TO authenticated;
GRANT ALL ON public.club_meets TO service_role;
ALTER TABLE public.club_meets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "private club competitions" ON public.club_meets FOR ALL TO authenticated USING(owner_id=auth.uid() AND public.has_role(auth.uid(),'admin')) WITH CHECK(owner_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE TRIGGER guard_private_club_meet BEFORE INSERT OR UPDATE ON public.club_meets FOR EACH ROW EXECUTE FUNCTION public.guard_private_row();
CREATE FUNCTION public.guard_club_registration() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE c uuid;
BEGIN
 IF TG_TABLE_NAME='meet_entries' THEN
  SELECT club_id INTO c FROM public.athletes WHERE id=NEW.athlete_id;
  IF c IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.club_meets WHERE club_id=c AND meet_id=NEW.meet_id) THEN RAISE EXCEPTION 'Añade primero la competencia al club del atleta'; END IF;
 ELSIF TG_TABLE_NAME='athletes' THEN
  IF NEW.club_id IS DISTINCT FROM OLD.club_id AND NEW.club_id IS NOT NULL AND EXISTS(SELECT 1 FROM public.meet_entries e WHERE e.athlete_id=NEW.id AND NOT EXISTS(SELECT 1 FROM public.club_meets cm WHERE cm.club_id=NEW.club_id AND cm.meet_id=e.meet_id)) THEN RAISE EXCEPTION 'Añade al club las competencias con inscripciones de este atleta antes de asignarlo'; END IF;
 ELSE
  IF EXISTS(SELECT 1 FROM public.meet_entries e JOIN public.athletes a ON a.id=e.athlete_id WHERE a.club_id=OLD.club_id AND e.meet_id=OLD.meet_id) THEN RAISE EXCEPTION 'No puedes retirar una competencia con inscripciones del club'; END IF;
  RETURN OLD;
 END IF;
 RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.guard_club_registration() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_club_registration BEFORE INSERT OR UPDATE ON public.meet_entries FOR EACH ROW EXECUTE FUNCTION public.guard_club_registration();
CREATE TRIGGER guard_athlete_club_registration BEFORE UPDATE ON public.athletes FOR EACH ROW EXECUTE FUNCTION public.guard_club_registration();
CREATE TRIGGER guard_club_meet_removal BEFORE DELETE ON public.club_meets FOR EACH ROW EXECUTE FUNCTION public.guard_club_registration();