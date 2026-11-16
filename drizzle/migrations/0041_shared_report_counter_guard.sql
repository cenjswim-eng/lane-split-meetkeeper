DROP TRIGGER shared_report_owner ON public.shared_reports;
CREATE FUNCTION public.guard_shared_report_owner() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $fn$
DECLARE parent_owner uuid;
BEGIN
 IF TG_OP='UPDATE' AND NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN RAISE EXCEPTION 'Invalid owner'; END IF;
 IF current_user='service_role' THEN RETURN NEW; END IF;
 IF NEW.owner_id IS NULL OR NEW.owner_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Invalid owner'; END IF;
 SELECT c.owner_id INTO parent_owner FROM public.clubs c WHERE c.id=NEW.club_id;
 IF parent_owner IS DISTINCT FROM NEW.owner_id THEN RAISE EXCEPTION 'Invalid club'; END IF;
 RETURN NEW;
END $fn$;
CREATE TRIGGER shared_report_owner BEFORE INSERT OR UPDATE ON public.shared_reports FOR EACH ROW EXECUTE FUNCTION public.guard_shared_report_owner();