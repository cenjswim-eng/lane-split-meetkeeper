ALTER TABLE public.clubs ADD COLUMN team_code text, ADD COLUMN full_name text, ADD COLUMN short_name text, ADD COLUMN region_lsc text, ADD COLUMN country_code text NOT NULL DEFAULT 'VEN', ADD COLUMN head_coach text, ADD COLUMN contact_email text, ADD COLUMN contact_phone text, ADD COLUMN team_color text, ADD COLUMN is_unattached boolean NOT NULL DEFAULT false;
ALTER TABLE public.athletes ADD COLUMN middle_initial text, ADD COLUMN preferred_name text, ADD COLUMN para_classification text, ADD COLUMN is_active boolean NOT NULL DEFAULT true;
DO $$ DECLARE u uuid; BEGIN FOR u IN SELECT DISTINCT owner_id FROM public.clubs WHERE owner_id IS NOT NULL UNION SELECT DISTINCT owner_id FROM public.athletes WHERE owner_id IS NOT NULL LOOP PERFORM set_config('request.jwt.claim.sub',u::text,true); UPDATE public.clubs SET full_name=name WHERE owner_id=u; UPDATE public.athletes SET is_active=active_status WHERE owner_id=u; END LOOP; PERFORM set_config('request.jwt.claim.sub','',true); END $$;
CREATE UNIQUE INDEX clubs_owner_team_code_key ON public.clubs(owner_id,team_code) WHERE team_code IS NOT NULL;
ALTER TABLE public.clubs ADD CONSTRAINT clubs_team_code_format CHECK(team_code IS NULL OR team_code ~ '^[A-Z0-9]{2,5}$'), ADD CONSTRAINT clubs_short_name_length CHECK(short_name IS NULL OR length(short_name)<=16), ADD CONSTRAINT clubs_country_format CHECK(country_code ~ '^[A-Z]{3}$'), ADD CONSTRAINT clubs_color_format CHECK(team_color IS NULL OR team_color ~ '^#[0-9A-Fa-f]{6}$');
ALTER TABLE public.athletes ADD CONSTRAINT athletes_middle_initial_length CHECK(middle_initial IS NULL OR length(middle_initial)<=1);
CREATE FUNCTION public.sync_roster_details() RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
BEGIN
 IF TG_TABLE_NAME='clubs' THEN
  IF NEW.team_code IS NOT NULL THEN NEW.team_code:=upper(regexp_replace(NEW.team_code,'\s','','g')); END IF;
  IF TG_OP='INSERT' THEN NEW.full_name:=coalesce(NEW.full_name,NEW.name); NEW.name:=NEW.full_name;
  ELSIF NEW.full_name IS DISTINCT FROM OLD.full_name THEN NEW.name:=NEW.full_name;
  ELSIF NEW.name IS DISTINCT FROM OLD.name THEN NEW.full_name:=NEW.name; END IF;
  IF NEW.full_name IS NULL OR btrim(NEW.full_name)='' THEN RAISE EXCEPTION 'Indica el nombre del club'; END IF;
  IF (TG_OP='INSERT' AND NEW.team_code IS NOT NULL) OR (TG_OP='UPDATE' AND NEW.full_name IS DISTINCT FROM OLD.full_name) THEN IF length(NEW.full_name)>40 THEN RAISE EXCEPTION 'El nombre del club admite hasta 40 caracteres'; END IF; END IF;
 ELSE
  IF TG_OP='INSERT' THEN IF NEW.active_status=false THEN NEW.is_active:=false; ELSE NEW.active_status:=NEW.is_active; END IF;
  ELSIF NEW.is_active IS DISTINCT FROM OLD.is_active THEN NEW.active_status:=NEW.is_active;
  ELSIF NEW.active_status IS DISTINCT FROM OLD.active_status THEN NEW.is_active:=NEW.active_status; END IF;
 END IF;
 RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.sync_roster_details() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER sync_club_details BEFORE INSERT OR UPDATE ON public.clubs FOR EACH ROW EXECUTE FUNCTION public.sync_roster_details();
CREATE TRIGGER sync_athlete_details BEFORE INSERT OR UPDATE ON public.athletes FOR EACH ROW EXECUTE FUNCTION public.sync_roster_details();