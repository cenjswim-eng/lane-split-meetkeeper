CREATE OR REPLACE FUNCTION public.import_standard_version(p_document text, p_year integer DEFAULT NULL, p_effective date DEFAULT NULL, p_standards jsonb DEFAULT '[]'::jsonb, p_warnings jsonb DEFAULT '[]'::jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_id uuid;
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':standard-versions', 0));
 UPDATE public.standard_versions SET active = false WHERE owner_id = auth.uid() AND active;
 INSERT INTO public.standard_versions(document_name, season_year, effective_from, standards, warnings, active) VALUES (p_document, p_year, p_effective, p_standards, coalesce(p_warnings, '[]'::jsonb), true) RETURNING id INTO v_id;
 RETURN v_id;
END $$;
REVOKE ALL ON FUNCTION public.import_standard_version(text, integer, date, jsonb, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.import_standard_version(text, integer, date, jsonb, jsonb) TO authenticated;