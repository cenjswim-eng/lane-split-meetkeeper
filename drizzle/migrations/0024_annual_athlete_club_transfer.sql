ALTER TABLE public.athletes ADD COLUMN registration_expires_on date;
ALTER TABLE public.athletes ADD CONSTRAINT athlete_registration_december_31 CHECK (registration_expires_on IS NULL OR (extract(month FROM registration_expires_on)=12 AND extract(day FROM registration_expires_on)=31));
CREATE OR REPLACE FUNCTION public.transfer_athlete_club(p_athlete uuid, p_club uuid, p_expected_club uuid) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE a public.athletes; expiry date; linked integer;
BEGIN
 IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Acceso no autorizado'; END IF;
 SELECT * INTO a FROM public.athletes WHERE id=p_athlete AND owner_id=auth.uid() FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Atleta no disponible en tu cuenta'; END IF;
 IF a.club_id IS DISTINCT FROM p_expected_club THEN RAISE EXCEPTION 'El club del atleta cambió. Actualiza la lista antes de continuar'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.clubs WHERE id=p_club AND owner_id=auth.uid()) THEN RAISE EXCEPTION 'Club no disponible en tu cuenta'; END IF;
 expiry := make_date(extract(year FROM CURRENT_DATE)::integer,12,31);
 INSERT INTO public.club_meets(owner_id,club_id,meet_id) SELECT DISTINCT auth.uid(),p_club,e.meet_id FROM public.meet_entries e WHERE e.athlete_id=a.id AND e.owner_id=auth.uid() ON CONFLICT(club_id,meet_id) DO NOTHING;
 GET DIAGNOSTICS linked=ROW_COUNT;
 UPDATE public.athletes SET club_id=p_club, registration_expires_on=expiry WHERE id=a.id;
 RETURN jsonb_build_object('athlete_id',a.id,'expires_on',expiry,'linked_meets',linked);
END $$;
REVOKE ALL ON FUNCTION public.transfer_athlete_club(uuid,uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.transfer_athlete_club(uuid,uuid,uuid) TO authenticated;