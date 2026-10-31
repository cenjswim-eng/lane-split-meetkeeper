CREATE OR REPLACE FUNCTION public.reset_management_data(p_confirmation text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Solo administradores'; END IF;
  IF p_confirmation IS DISTINCT FROM 'BORRAR TODO' THEN RAISE EXCEPTION 'Confirmación requerida'; END IF;
  LOCK TABLE public.clubs, public.club_documents, public.club_members, public.teams, public.groups, public.athletes, public.meets, public.events, public.results, public.splits, public.time_standards, public.import_logs IN EXCLUSIVE MODE;
  DELETE FROM public.splits WHERE id IS NOT NULL;
  DELETE FROM public.results WHERE id IS NOT NULL;
  DELETE FROM public.events WHERE id IS NOT NULL;
  DELETE FROM public.athletes WHERE id IS NOT NULL;
  DELETE FROM public.meets WHERE id IS NOT NULL;
  DELETE FROM public.teams WHERE id IS NOT NULL;
  DELETE FROM public.groups WHERE id IS NOT NULL;
  DELETE FROM public.time_standards WHERE id IS NOT NULL;
  DELETE FROM public.import_logs WHERE id IS NOT NULL;
  DELETE FROM public.club_members WHERE id IS NOT NULL;
  DELETE FROM public.club_documents WHERE id IS NOT NULL;
  DELETE FROM public.clubs WHERE id IS NOT NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.reset_management_data(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_management_data(text) TO authenticated;