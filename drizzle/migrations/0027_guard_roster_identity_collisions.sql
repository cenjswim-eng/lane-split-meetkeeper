CREATE FUNCTION public.guard_roster_identity() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$ BEGIN
 IF NEW.federation_id IS NOT NULL AND btrim(NEW.federation_id)<>'' AND (TG_OP='INSERT' OR NEW.federation_id IS DISTINCT FROM OLD.federation_id) THEN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.owner_id::text||':'||upper(btrim(NEW.federation_id)),0));
  IF EXISTS(SELECT 1 FROM public.athletes WHERE owner_id=NEW.owner_id AND upper(btrim(federation_id))=upper(btrim(NEW.federation_id)) AND id<>NEW.id) THEN RAISE EXCEPTION 'Ese ID ya pertenece a otro atleta de tu cuenta'; END IF;
 END IF; RETURN NEW; END $$;
REVOKE ALL ON FUNCTION public.guard_roster_identity() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER guard_roster_identity BEFORE INSERT OR UPDATE ON public.athletes FOR EACH ROW EXECUTE FUNCTION public.guard_roster_identity();