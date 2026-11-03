CREATE OR REPLACE FUNCTION public.swim_name_key(_t text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT trim(regexp_replace(translate(lower(coalesce(_t,'')), 'áéíóúüñàèìòùäëïöçâêîôû', 'aeiouunaeiouaeiocaeiou'), '[^a-z0-9]+', ' ', 'g'))
$$;

CREATE OR REPLACE FUNCTION public.find_athlete_record_sources(_target uuid, _name text DEFAULT NULL)
RETURNS TABLE(id uuid, first_name text, last_name text, birth_date date, gender text, federation_id text, team text, results bigint, match text)
LANGUAGE plpgsql STABLE SECURITY INVOKER SET search_path = public AS $$
DECLARE t record; toks text[];
BEGIN
  SELECT * INTO t FROM athletes a WHERE a.id = _target AND a.owner_id = auth.uid();
  IF t IS NULL THEN RAISE EXCEPTION 'Atleta no encontrado'; END IF;
  toks := array_remove(string_to_array(swim_name_key(coalesce(nullif(trim(_name),''), t.first_name||' '||t.last_name)), ' '), '');
  RETURN QUERY
  SELECT a.id, a.first_name, a.last_name, a.birth_date, a.gender, a.federation_id, coalesce(tm.name, tm.code),
    (SELECT count(*) FROM results r WHERE r.athlete_id = a.id),
    CASE
      WHEN (t.federation_id IS NOT NULL AND a.federation_id IS NOT NULL AND swim_name_key(a.federation_id) <> swim_name_key(t.federation_id))
        OR (t.birth_date IS NOT NULL AND a.birth_date IS NOT NULL AND a.birth_date <> t.birth_date)
        OR (t.gender IS NOT NULL AND a.gender IS NOT NULL AND a.gender <> t.gender) THEN 'conflicto'
      WHEN t.federation_id IS NOT NULL AND swim_name_key(a.federation_id) = swim_name_key(t.federation_id)
        AND t.birth_date IS NOT NULL AND a.birth_date = t.birth_date THEN 'cedula_fecha'
      WHEN t.federation_id IS NOT NULL AND swim_name_key(a.federation_id) = swim_name_key(t.federation_id) THEN 'cedula'
      WHEN t.birth_date IS NOT NULL AND a.birth_date = t.birth_date THEN 'nombre_fecha'
      ELSE 'nombre' END
  FROM athletes a LEFT JOIN teams tm ON tm.id = a.team_id
  WHERE a.owner_id = auth.uid() AND a.id <> _target AND (
    (t.federation_id IS NOT NULL AND trim(t.federation_id) <> '' AND swim_name_key(a.federation_id) = swim_name_key(t.federation_id))
    OR (cardinality(toks) > 0 AND toks <@ array_remove(string_to_array(swim_name_key(a.first_name||' '||a.last_name),' '),''))
    OR (cardinality(toks) > 0 AND array_remove(string_to_array(swim_name_key(a.first_name||' '||a.last_name),' '),'') <@ toks
        AND cardinality(array_remove(string_to_array(swim_name_key(a.first_name||' '||a.last_name),' '),'')) >= 2))
  ORDER BY 9, 2, 3;
END $$;

CREATE OR REPLACE FUNCTION public.transfer_selected_athlete_records(_target uuid, _sources uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE t record; sid uuid; moved int := 0; skipped int := 0; entries int := 0; sources int := 0; n int; s int;
BEGIN
  SELECT * INTO t FROM athletes WHERE id = _target AND owner_id = auth.uid();
  IF t IS NULL THEN RAISE EXCEPTION 'Atleta no encontrado'; END IF;
  FOREACH sid IN ARRAY coalesce(_sources, '{}') LOOP
    IF sid = _target OR NOT EXISTS (SELECT 1 FROM athletes WHERE id = sid AND owner_id = auth.uid()) THEN CONTINUE; END IF;
    sources := sources + 1;
    UPDATE results r SET athlete_id = _target WHERE r.athlete_id = sid
      AND NOT EXISTS (SELECT 1 FROM results x WHERE x.athlete_id = _target AND x.event_id = r.event_id AND x.round IS NOT DISTINCT FROM r.round);
    GET DIAGNOSTICS n = ROW_COUNT; moved := moved + n;
    SELECT count(*) INTO s FROM results WHERE athlete_id = sid; skipped := skipped + s;
    UPDATE meet_entries e SET athlete_id = _target WHERE e.athlete_id = sid
      AND NOT EXISTS (SELECT 1 FROM meet_entries x WHERE x.athlete_id = _target AND x.event_id = e.event_id);
    GET DIAGNOSTICS n = ROW_COUNT; entries := entries + n;
    UPDATE athletes SET active_status = false WHERE id = sid;
  END LOOP;
  RETURN jsonb_build_object('sources', sources, 'moved', moved, 'skipped', skipped, 'entries', entries);
END $$;

REVOKE ALL ON FUNCTION public.find_athlete_record_sources(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.transfer_selected_athlete_records(uuid, uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.find_athlete_record_sources(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.transfer_selected_athlete_records(uuid, uuid[]) TO authenticated;