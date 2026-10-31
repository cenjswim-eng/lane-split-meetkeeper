CREATE OR REPLACE FUNCTION public.import_club_members(p_club_id uuid, p_document_id uuid, p_members jsonb) RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE imported integer;
BEGIN
IF NOT public.has_role(auth.uid(),'admin') THEN RAISE EXCEPTION 'Administrator access required'; END IF;
IF NOT EXISTS(SELECT 1 FROM public.club_documents WHERE id=p_document_id AND club_id=p_club_id) THEN RAISE EXCEPTION 'Document does not belong to club'; END IF;
INSERT INTO public.club_members(club_id,document_id,first_name,last_name,member_role,birth_date,email,phone,source_key)
SELECT p_club_id,p_document_id,m.first_name,COALESCE(m.last_name,''),m.member_role,m.birth_date,m.email,m.phone,m.source_key FROM jsonb_to_recordset(p_members) AS m(first_name text,last_name text,member_role text,birth_date date,email text,phone text,source_key text)
ON CONFLICT(club_id,source_key) DO UPDATE SET first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,member_role=EXCLUDED.member_role,birth_date=EXCLUDED.birth_date,email=EXCLUDED.email,phone=EXCLUDED.phone,document_id=EXCLUDED.document_id,updated_at=now();
GET DIAGNOSTICS imported=ROW_COUNT;
RETURN imported;
END $$;
REVOKE ALL ON FUNCTION public.import_club_members(uuid,uuid,jsonb) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.import_club_members(uuid,uuid,jsonb) TO authenticated,service_role;