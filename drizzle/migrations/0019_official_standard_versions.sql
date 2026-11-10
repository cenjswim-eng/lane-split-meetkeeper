CREATE TABLE public.standard_versions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 owner_id uuid NOT NULL DEFAULT auth.uid(),
 document_name text NOT NULL,
 season_year integer,
 imported_at timestamptz DEFAULT now(),
 effective_from date,
 active boolean NOT NULL DEFAULT false,
 standards jsonb NOT NULL,
 warnings jsonb NOT NULL DEFAULT '[]'::jsonb,
 CONSTRAINT standard_version_year CHECK (season_year IS NULL OR season_year BETWEEN 1900 AND 2200),
 CONSTRAINT standard_version_rows CHECK (jsonb_typeof(standards) = 'array' AND jsonb_array_length(standards) > 0),
 CONSTRAINT standard_version_name CHECK (length(trim(document_name)) BETWEEN 1 AND 200)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.standard_versions TO authenticated;
GRANT ALL ON public.standard_versions TO service_role;
ALTER TABLE public.standard_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "private standard versions" ON public.standard_versions FOR ALL TO authenticated USING (owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin')) WITH CHECK (owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
CREATE INDEX standard_versions_owner ON public.standard_versions(owner_id);
INSERT INTO public.standard_versions(owner_id, document_name, season_year, imported_at, active, standards)
SELECT owner_id, 'Mínimas anteriores · referencia documental no registrada', season_year, NULL, false, jsonb_agg(to_jsonb(s) ORDER BY id) FROM public.time_standards s WHERE owner_id IS NOT NULL GROUP BY owner_id, season_year;
UPDATE public.standard_versions SET active = true WHERE id IN (SELECT DISTINCT ON (owner_id) id FROM public.standard_versions ORDER BY owner_id, season_year DESC NULLS LAST, id);
CREATE UNIQUE INDEX standard_versions_one_active ON public.standard_versions(owner_id) WHERE active;
CREATE FUNCTION public.guard_standard_version() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE r jsonb;
BEGIN
 IF NEW.owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Propietario inválido'; END IF;
 IF TG_OP = 'UPDATE' THEN
  IF (to_jsonb(NEW) - 'active') IS DISTINCT FROM (to_jsonb(OLD) - 'active') THEN RAISE EXCEPTION 'Las versiones importadas no se pueden sobrescribir'; END IF;
 ELSE
  IF NEW.imported_at IS DISTINCT FROM now() THEN RAISE EXCEPTION 'Fecha de importación inválida'; END IF;
  FOR r IN SELECT value FROM jsonb_array_elements(NEW.standards) LOOP
   IF (r->>'qualifying_time_ms')::integer IS NULL OR (r->>'qualifying_time_ms')::integer <= 0 OR (r->>'distance')::integer IS NULL OR (r->>'distance')::integer <= 0 OR (r->>'stroke')::integer IS NULL OR (r->>'stroke')::integer NOT BETWEEN 1 AND 5 OR (r->>'course') IS NULL OR (r->>'course') NOT IN ('LCM','SCM') OR ((r->>'gender') IS NOT NULL AND (r->>'gender') NOT IN ('F','M')) OR (r->>'season_year')::integer IS DISTINCT FROM NEW.season_year THEN RAISE EXCEPTION 'Revisa las marcas de la versión'; END IF;
   IF (r->>'age_min')::integer < 0 OR (r->>'age_max')::integer < 0 OR (r->>'age_min')::integer > (r->>'age_max')::integer THEN RAISE EXCEPTION 'Edades inválidas'; END IF;
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER guard_standard_version BEFORE INSERT OR UPDATE ON public.standard_versions FOR EACH ROW EXECUTE FUNCTION public.guard_standard_version();
REVOKE ALL ON FUNCTION public.guard_standard_version() FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.import_standard_version(p_document text, p_year integer, p_effective date, p_standards jsonb, p_warnings jsonb) RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
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
CREATE FUNCTION public.activate_standard_version(p_id uuid) RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Solo administradores'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended(auth.uid()::text || ':standard-versions', 0));
 IF NOT EXISTS (SELECT 1 FROM public.standard_versions WHERE id = p_id AND owner_id = auth.uid()) THEN RAISE EXCEPTION 'Versión no disponible'; END IF;
 UPDATE public.standard_versions SET active = false WHERE owner_id = auth.uid() AND active;
 UPDATE public.standard_versions SET active = true WHERE id = p_id AND owner_id = auth.uid();
END $$;
REVOKE ALL ON FUNCTION public.activate_standard_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_standard_version(uuid) TO authenticated;
CREATE FUNCTION public.reset_standard_versions() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
 DELETE FROM public.standard_versions WHERE owner_id = OLD.owner_id;
 RETURN OLD;
END $$;
CREATE TRIGGER reset_standard_versions_after_legacy_delete AFTER DELETE ON public.time_standards FOR EACH ROW EXECUTE FUNCTION public.reset_standard_versions();
REVOKE ALL ON FUNCTION public.reset_standard_versions() FROM PUBLIC, anon, authenticated;