CREATE TABLE public.athlete_achievements (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid NOT NULL,
 athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
 result_id uuid NOT NULL REFERENCES public.results(id) ON DELETE CASCADE,
 meet_id uuid NOT NULL REFERENCES public.meets(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('first','pb','minimum')),
 distance integer NOT NULL, stroke smallint NOT NULL, course text NOT NULL,
 time_ms integer NOT NULL, previous_ms integer, improvement_ms integer,
 achieved_on date NOT NULL, minimum_ms integer, standard_version_id uuid, standard_key text NOT NULL DEFAULT '',
 created_at timestamptz NOT NULL DEFAULT now(),
 UNIQUE(result_id,kind,standard_key)
);
GRANT SELECT ON public.athlete_achievements TO authenticated;
GRANT ALL ON public.athlete_achievements TO service_role;
ALTER TABLE public.athlete_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "private achievement reads" ON public.athlete_achievements FOR SELECT TO authenticated USING (owner_id=auth.uid() AND public.has_role(auth.uid(),'admin'));
CREATE INDEX achievements_owner_date ON public.athlete_achievements(owner_id,achieved_on DESC);
CREATE INDEX achievements_athlete ON public.athlete_achievements(athlete_id);

CREATE FUNCTION public.compute_athlete_achievements(p_owner uuid)
RETURNS TABLE(owner_id uuid,athlete_id uuid,result_id uuid,meet_id uuid,kind text,distance integer,stroke smallint,course text,time_ms integer,previous_ms integer,improvement_ms integer,achieved_on date,minimum_ms integer,standard_version_id uuid,standard_key text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path=public AS $fn$
WITH valid AS (
 SELECT r.id result_id,r.owner_id,r.athlete_id,r.meet_id,e.distance,e.stroke,r.course,r.final_time_ms time_ms,m.start_date achieved_on,a.birth_date,a.gender,
 row_number() OVER(PARTITION BY r.athlete_id,e.distance,e.stroke,r.course,m.start_date ORDER BY r.final_time_ms,CASE r.round WHEN 'P' THEN 0 WHEN 'S' THEN 1 ELSE 2 END,r.created_at,r.id) day_rank
 FROM public.results r JOIN public.events e ON e.id=r.event_id AND e.owner_id=r.owner_id JOIN public.meets m ON m.id=r.meet_id AND m.owner_id=r.owner_id JOIN public.athletes a ON a.id=r.athlete_id AND a.owner_id=r.owner_id
 WHERE r.owner_id=p_owner AND r.final_time_ms>0 AND NOT r.is_dq AND r.status='OK' AND NOT e.is_relay AND r.course IN ('LCM','SCM') AND m.start_date IS NOT NULL
), daily AS (SELECT * FROM valid WHERE day_rank=1), history AS (
 SELECT d.*,min(d.time_ms) OVER(PARTITION BY d.athlete_id,d.distance,d.stroke,d.course ORDER BY d.achieved_on ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) prior
 FROM daily d
), active_version AS (
 SELECT v.* FROM public.standard_versions v WHERE v.owner_id=p_owner AND v.active ORDER BY v.imported_at DESC NULLS LAST,v.id LIMIT 1
), qualified AS (
 SELECT h.*,v.id version_id,s.value std,
 concat_ws('|',extract(year FROM h.achieved_on)::text,s.value->>'age_group',s.value->>'age_min',s.value->>'age_max',s.value->>'gender',h.distance::text,h.stroke::text,h.course) scope_key,
 row_number() OVER(PARTITION BY h.athlete_id,h.distance,h.stroke,h.course,extract(year FROM h.achieved_on),s.value->>'age_group',s.value->>'age_min',s.value->>'age_max',s.value->>'gender' ORDER BY h.achieved_on,h.time_ms,h.result_id) qualification_rank
 FROM history h CROSS JOIN active_version v CROSS JOIN LATERAL jsonb_array_elements(v.standards) s(value)
 WHERE (v.effective_from IS NULL OR h.achieved_on>=v.effective_from)
 AND (s.value->>'season_year' IS NULL OR (s.value->>'season_year')::integer=extract(year FROM h.achieved_on)::integer)
 AND (s.value->>'distance')::integer=h.distance AND (s.value->>'stroke')::smallint=h.stroke AND s.value->>'course'=h.course
 AND (s.value->>'gender' IS NULL OR s.value->>'gender'='' OR s.value->>'gender'=h.gender)
 AND (h.birth_date IS NOT NULL OR (s.value->>'age_min' IS NULL AND s.value->>'age_max' IS NULL AND s.value->>'age_group' IS NULL))
 AND (s.value->>'age_min' IS NULL OR extract(year FROM h.achieved_on)::integer-extract(year FROM h.birth_date)::integer>=(s.value->>'age_min')::integer)
 AND (s.value->>'age_max' IS NULL OR extract(year FROM h.achieved_on)::integer-extract(year FROM h.birth_date)::integer<=(s.value->>'age_max')::integer)
 AND (s.value->>'age_group' IS NULL OR s.value->>'age_min' IS NOT NULL OR s.value->>'age_max' IS NOT NULL)
 AND h.time_ms<=(s.value->>'qualifying_time_ms')::integer AND (s.value->>'qualifying_time_ms')::integer>0
)
SELECT h.owner_id,h.athlete_id,h.result_id,h.meet_id,CASE WHEN h.prior IS NULL THEN 'first' ELSE 'pb' END,h.distance,h.stroke,h.course,h.time_ms,h.prior,CASE WHEN h.prior IS NULL THEN NULL ELSE h.prior-h.time_ms END,h.achieved_on,NULL::integer,NULL::uuid,''::text FROM history h WHERE h.prior IS NULL OR h.time_ms<h.prior
UNION ALL
SELECT q.owner_id,q.athlete_id,q.result_id,q.meet_id,'minimum',q.distance,q.stroke,q.course,q.time_ms,q.prior,CASE WHEN q.prior IS NULL THEN NULL ELSE q.prior-q.time_ms END,q.achieved_on,(q.std->>'qualifying_time_ms')::integer,q.version_id,q.scope_key FROM qualified q WHERE q.qualification_rank=1;
$fn$;
REVOKE ALL ON FUNCTION public.compute_athlete_achievements(uuid) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.compute_athlete_achievements(uuid) TO service_role;

CREATE FUNCTION public.refresh_athlete_achievements() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $fn$
DECLARE o uuid; flag text;
BEGIN
 o := CASE WHEN TG_OP='DELETE' THEN OLD.owner_id ELSE NEW.owner_id END;
 IF o IS NULL THEN RETURN NULL; END IF;
 flag := 'achievements.refreshed_'||replace(o::text,'-','');
 IF current_setting(flag,true)='yes' THEN RETURN NULL; END IF;
 PERFORM set_config(flag,'yes',true);
 PERFORM pg_advisory_xact_lock(hashtextextended('achievements:'||o::text,0));
 INSERT INTO public.athlete_achievements(owner_id,athlete_id,result_id,meet_id,kind,distance,stroke,course,time_ms,previous_ms,improvement_ms,achieved_on,minimum_ms,standard_version_id,standard_key)
 SELECT * FROM public.compute_athlete_achievements(o)
 ON CONFLICT(result_id,kind,standard_key) DO UPDATE SET time_ms=excluded.time_ms,previous_ms=excluded.previous_ms,improvement_ms=excluded.improvement_ms,achieved_on=excluded.achieved_on,minimum_ms=excluded.minimum_ms,standard_version_id=excluded.standard_version_id,meet_id=excluded.meet_id,distance=excluded.distance,stroke=excluded.stroke,course=excluded.course;
 DELETE FROM public.athlete_achievements a WHERE a.owner_id=o AND NOT EXISTS(SELECT 1 FROM public.compute_athlete_achievements(o) c WHERE c.result_id=a.result_id AND c.kind=a.kind AND c.standard_key=a.standard_key);
 RETURN NULL;
END $fn$;
REVOKE ALL ON FUNCTION public.refresh_athlete_achievements() FROM PUBLIC,anon,authenticated;
CREATE CONSTRAINT TRIGGER results_achievements AFTER INSERT OR UPDATE OR DELETE ON public.results DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.refresh_athlete_achievements();
CREATE CONSTRAINT TRIGGER meets_achievements AFTER UPDATE OR DELETE ON public.meets DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.refresh_athlete_achievements();
CREATE CONSTRAINT TRIGGER events_achievements AFTER UPDATE OR DELETE ON public.events DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.refresh_athlete_achievements();
CREATE CONSTRAINT TRIGGER athletes_achievements AFTER UPDATE ON public.athletes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.refresh_athlete_achievements();
CREATE CONSTRAINT TRIGGER standards_achievements AFTER INSERT OR UPDATE OR DELETE ON public.standard_versions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION public.refresh_athlete_achievements();
INSERT INTO public.athlete_achievements(owner_id,athlete_id,result_id,meet_id,kind,distance,stroke,course,time_ms,previous_ms,improvement_ms,achieved_on,minimum_ms,standard_version_id,standard_key)
SELECT c.* FROM (SELECT DISTINCT r.owner_id FROM public.results r WHERE r.owner_id IS NOT NULL) owners CROSS JOIN LATERAL public.compute_athlete_achievements(owners.owner_id) c;
COMMENT ON TABLE public.athlete_achievements IS 'Derived private full-history achievements. Same-day swims without exact timestamps use the best daily swim, never an invented chronology. Minimum is first per season/category in the active official snapshot.';