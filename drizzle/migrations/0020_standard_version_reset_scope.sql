DROP TRIGGER reset_standard_versions_after_legacy_delete ON public.time_standards;
CREATE OR REPLACE FUNCTION public.reset_management_data(p_confirmation text) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 IF p_confirmation IS DISTINCT FROM 'BORRAR TODO' THEN RAISE EXCEPTION 'Confirmación requerida'; END IF;
 LOCK TABLE public.clubs, public.club_documents, public.club_members, public.teams, public.groups, public.athletes, public.meets, public.events, public.results, public.splits, public.time_standards, public.import_logs, public.standard_versions IN EXCLUSIVE MODE;
 DELETE FROM public.splits WHERE owner_id = auth.uid();
 DELETE FROM public.results WHERE owner_id = auth.uid();
 DELETE FROM public.events WHERE owner_id = auth.uid();
 DELETE FROM public.athletes WHERE owner_id = auth.uid();
 DELETE FROM public.meets WHERE owner_id = auth.uid();
 DELETE FROM public.teams WHERE owner_id = auth.uid();
 DELETE FROM public.groups WHERE owner_id = auth.uid();
 DELETE FROM public.time_standards WHERE owner_id = auth.uid();
 DELETE FROM public.standard_versions WHERE owner_id = auth.uid();
 DELETE FROM public.import_logs WHERE owner_id = auth.uid();
 DELETE FROM public.club_members WHERE owner_id = auth.uid();
 DELETE FROM public.club_documents WHERE owner_id = auth.uid();
 DELETE FROM public.clubs WHERE owner_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.reset_management_data(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reset_management_data(text) TO authenticated;