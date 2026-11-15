DO $migration$
DECLARE
  v_definition text;
  v_old_check text := 'IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->''results'') r WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->''athletes'') a WHERE a->>''key''=r->>''athleteKey''))';
  v_new_check text := 'IF EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->''results'') AS result_rows(result_json) WHERE NOT EXISTS(SELECT 1 FROM jsonb_array_elements(p_payload->''athletes'') AS athlete_rows(athlete_json) WHERE athlete_rows.athlete_json->>''key''=result_rows.result_json->>''athleteKey''))';
BEGIN
  v_definition := pg_get_functiondef('public.import_meet_payload(jsonb)'::regprocedure);
  IF strpos(v_definition, v_old_check) > 0 THEN
    EXECUTE replace(v_definition, v_old_check, v_new_check);
  ELSIF strpos(v_definition, v_new_check) = 0 THEN
    RAISE EXCEPTION 'La comprobación de resultados cambió; revisa la función antes de aplicar la corrección';
  END IF;
END
$migration$;
COMMENT ON FUNCTION public.import_meet_payload(jsonb) IS 'Atomic owner-scoped Meet Manager import; JSON validation uses explicit columns separate from PL/pgSQL loop variables.';