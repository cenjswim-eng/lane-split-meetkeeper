CREATE OR REPLACE FUNCTION public.swim_name_key(_t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT trim(regexp_replace(translate(lower(coalesce(_t,'')), 'áéíóúüñàèìòùäëïö', 'aeiouunaeiouaeio'), '[^a-z0-9]+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.transfer_athlete_records(_target uuid, _name text DEFAULT NULL, _club text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  t record; src record; key text; moved int := 0; skipped int := 0; entries int := 0; sources int := 0; n int; s int;
BEGIN
  SELECT * INTO t FROM athletes WHERE id = _target AND owner_id = auth.uid();
  IF t IS NULL THEN RAISE EXCEPTION 'Atleta no encontrado'; END IF;
  key := swim_name_key(coalesce(nullif(trim(_name), ''), t.first_name || ' ' || t.last_name));
  FOR src IN
    SELECT a.* FROM athletes a LEFT JOIN teams tm ON tm.id = a.team_id
    WHERE a.owner_id = auth.uid() AND a.id <> _target
      AND (swim_name_key(a.first_name || ' ' || a.last_name) = key OR swim_name_key(a.last_name || ' ' || a.first_name) = key)
      AND (t.birth_date IS NULL OR a.birth_date IS NULL OR a.birth_date = t.birth_date)
      AND (t.gender IS NULL OR a.gender IS NULL OR a.gender = t.gender)
      AND (nullif(trim(_club), '') IS NULL OR swim_name_key(tm.name) LIKE '%' || swim_name_key(_club) || '%' OR swim_name_key(tm.code) = swim_name_key(_club))
  LOOP
    sources := sources + 1;
    UPDATE results r SET athlete_id = _target WHERE r.athlete_id = src.id
      AND NOT EXISTS (SELECT 1 FROM results x WHERE x.athlete_id = _target AND x.event_id = r.event_id AND x.round IS NOT DISTINCT FROM r.round);
    GET DIAGNOSTICS n = ROW_COUNT; moved := moved + n;
    SELECT count(*) INTO s FROM results WHERE athlete_id = src.id; skipped := skipped + s;
    UPDATE meet_entries e SET athlete_id = _target WHERE e.athlete_id = src.id
      AND NOT EXISTS (SELECT 1 FROM meet_entries x WHERE x.athlete_id = _target AND x.event_id = e.event_id);
    GET DIAGNOSTICS n = ROW_COUNT; entries := entries + n;
    UPDATE athletes SET active_status = false WHERE id = src.id;
  END LOOP;
  RETURN jsonb_build_object('sources', sources, 'moved', moved, 'skipped', skipped, 'entries', entries);
END $$;

REVOKE ALL ON FUNCTION public.transfer_athlete_records(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.transfer_athlete_records(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.swim_name_key(text) TO authenticated;