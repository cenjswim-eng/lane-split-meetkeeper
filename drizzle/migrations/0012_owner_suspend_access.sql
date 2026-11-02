ALTER TABLE public.access_requests DROP CONSTRAINT access_requests_status_check;
ALTER TABLE public.access_requests ADD CONSTRAINT access_requests_status_check CHECK (status = ANY (ARRAY['pending','approved','rejected','suspended']));
CREATE OR REPLACE FUNCTION public.set_app_access_suspended(p_id uuid, p_suspend boolean) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE v_user uuid; v_status text;
BEGIN
  IF NOT public.is_app_owner() THEN RAISE EXCEPTION 'Solo el dueño puede cambiar accesos'; END IF;
  SELECT user_id, status INTO v_user, v_status FROM public.access_requests WHERE id=p_id FOR UPDATE;
  IF v_user IS NULL THEN RAISE EXCEPTION 'Solicitud no encontrada'; END IF;
  IF EXISTS (SELECT 1 FROM public.app_owner WHERE user_id=v_user) THEN RAISE EXCEPTION 'No puedes suspender al dueño'; END IF;
  IF p_suspend THEN
    IF v_status <> 'approved' THEN RAISE EXCEPTION 'Solo se suspenden cuentas aprobadas'; END IF;
    DELETE FROM public.user_roles WHERE user_id=v_user AND role='admin';
    UPDATE public.access_requests SET status='suspended', decided_at=now(), decided_by=auth.uid() WHERE id=p_id;
  ELSE
    IF v_status <> 'suspended' THEN RAISE EXCEPTION 'La cuenta no está suspendida'; END IF;
    INSERT INTO public.user_roles(user_id,role) VALUES (v_user,'admin') ON CONFLICT (user_id,role) DO NOTHING;
    UPDATE public.access_requests SET status='approved', decided_at=now(), decided_by=auth.uid() WHERE id=p_id;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.set_app_access_suspended(uuid,boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_app_access_suspended(uuid,boolean) TO authenticated;