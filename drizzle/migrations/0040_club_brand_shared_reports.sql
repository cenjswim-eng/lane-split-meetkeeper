CREATE TABLE public.club_brands (
 club_id uuid PRIMARY KEY REFERENCES public.clubs(id) ON DELETE CASCADE,
 owner_id uuid NOT NULL DEFAULT auth.uid(), official_name text NOT NULL DEFAULT '', location text NOT NULL DEFAULT '', motto text NOT NULL DEFAULT '', contact text NOT NULL DEFAULT '',
 primary_color text NOT NULL DEFAULT '#3cc8e0' CHECK(primary_color ~ '^#[0-9A-Fa-f]{6}$'), secondary_color text NOT NULL DEFAULT '#f2b33d' CHECK(secondary_color ~ '^#[0-9A-Fa-f]{6}$'), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.club_brands TO authenticated;
GRANT ALL ON public.club_brands TO service_role;
ALTER TABLE public.club_brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "private club brand" ON public.club_brands FOR ALL TO authenticated USING(owner_id=auth.uid() AND public.has_role(auth.uid(),'admin')) WITH CHECK(owner_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE TRIGGER club_brand_owner BEFORE INSERT OR UPDATE ON public.club_brands FOR EACH ROW EXECUTE FUNCTION public.guard_private_row();
CREATE TABLE public.shared_reports (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL DEFAULT auth.uid(), club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
 token_hash text NOT NULL UNIQUE CHECK(token_hash ~ '^[0-9a-f]{64}$'), title text NOT NULL,
 storage_path text NOT NULL, brand jsonb NOT NULL, privacy jsonb NOT NULL,
 expires_at timestamptz, revoked_at timestamptz, opens integer NOT NULL DEFAULT 0, last_opened_at timestamptz, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT,INSERT,UPDATE,DELETE ON public.shared_reports TO authenticated;
GRANT ALL ON public.shared_reports TO service_role;
ALTER TABLE public.shared_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "private shared reports" ON public.shared_reports FOR ALL TO authenticated USING(owner_id=auth.uid() AND public.has_role(auth.uid(),'admin')) WITH CHECK(owner_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE TRIGGER shared_report_owner BEFORE INSERT OR UPDATE ON public.shared_reports FOR EACH ROW EXECUTE FUNCTION public.guard_private_row();
CREATE FUNCTION public.guard_shared_report() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $fn$
BEGIN
 IF TG_OP='INSERT' AND (NEW.opens<>0 OR NEW.last_opened_at IS NOT NULL OR NEW.revoked_at IS NOT NULL OR split_part(NEW.storage_path,'/',1)<>NEW.owner_id::text OR split_part(NEW.storage_path,'/',2)<>NEW.club_id::text OR NEW.storage_path<>NEW.owner_id::text||'/'||NEW.club_id::text||'/'||NEW.id::text||'.pdf') THEN RAISE EXCEPTION 'Invalid report snapshot'; END IF;
 IF TG_OP='UPDATE' AND auth.uid() IS NOT NULL AND (NEW.token_hash IS DISTINCT FROM OLD.token_hash OR NEW.storage_path IS DISTINCT FROM OLD.storage_path OR NEW.club_id IS DISTINCT FROM OLD.club_id OR NEW.brand IS DISTINCT FROM OLD.brand OR NEW.privacy IS DISTINCT FROM OLD.privacy OR NEW.opens IS DISTINCT FROM OLD.opens OR NEW.last_opened_at IS DISTINCT FROM OLD.last_opened_at) THEN RAISE EXCEPTION 'Report snapshot is immutable'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER shared_report_snapshot BEFORE INSERT OR UPDATE ON public.shared_reports FOR EACH ROW EXECUTE FUNCTION public.guard_shared_report();
CREATE POLICY "owner report file insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='shared-reports' AND (storage.foldername(name))[1]=auth.uid()::text AND public.has_role(auth.uid(),'admin') AND EXISTS(SELECT 1 FROM public.clubs c WHERE c.id::text=(storage.foldername(name))[2] AND c.owner_id=auth.uid()));
CREATE POLICY "owner report file read" ON storage.objects FOR SELECT TO authenticated USING(bucket_id='shared-reports' AND (storage.foldername(name))[1]=auth.uid()::text AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "owner report file delete" ON storage.objects FOR DELETE TO authenticated USING(bucket_id='shared-reports' AND (storage.foldername(name))[1]=auth.uid()::text AND public.has_role(auth.uid(),'admin'));
CREATE FUNCTION public.open_shared_report(p_hash text,p_count boolean DEFAULT false)
RETURNS TABLE(id uuid,owner_id uuid,title text,storage_path text,brand jsonb,expires_at timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $fn$
BEGIN
 IF p_count THEN
 RETURN QUERY UPDATE public.shared_reports s SET opens=s.opens+1,last_opened_at=now() WHERE s.token_hash=p_hash AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>now()) RETURNING s.id,s.owner_id,s.title,s.storage_path,s.brand,s.expires_at;
 ELSE
 RETURN QUERY SELECT s.id,s.owner_id,s.title,s.storage_path,s.brand,s.expires_at FROM public.shared_reports s WHERE s.token_hash=p_hash AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at>now());
 END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.open_shared_report(text,boolean) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.open_shared_report(text,boolean) TO service_role;