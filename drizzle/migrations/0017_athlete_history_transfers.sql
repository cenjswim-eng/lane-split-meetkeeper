CREATE TABLE public.record_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  target_athlete_id uuid NOT NULL REFERENCES public.athletes(id) ON DELETE CASCADE,
  copied integer NOT NULL DEFAULT 0,
  skipped integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  undone_at timestamptz
);
GRANT SELECT ON public.record_transfers TO authenticated;
GRANT ALL ON public.record_transfers TO service_role;
ALTER TABLE public.record_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own transfers read" ON public.record_transfers FOR SELECT TO authenticated
  USING (owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));

ALTER TABLE public.results
  ADD COLUMN transfer_id uuid REFERENCES public.record_transfers(id) ON DELETE CASCADE,
  ADD COLUMN source_result_id uuid REFERENCES public.results(id) ON DELETE SET NULL,
  ADD COLUMN origin_team text;
CREATE INDEX results_transfer_id_idx ON public.results(transfer_id);

CREATE OR REPLACE FUNCTION public.copy_athlete_history(_target uuid, _results uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t record; src record; tid uuid; newid uuid; copied int := 0; skipped int := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  SELECT * INTO t FROM athletes WHERE id = _target AND owner_id = auth.uid();
  IF t IS NULL THEN RAISE EXCEPTION 'Atleta no encontrado'; END IF;
  INSERT INTO record_transfers(owner_id, target_athlete_id) VALUES (auth.uid(), _target) RETURNING id INTO tid;
  FOR src IN
    SELECT r.*, coalesce(tm.name, tm.code) AS team_name FROM results r
    JOIN athletes a ON a.id = r.athlete_id LEFT JOIN teams tm ON tm.id = a.team_id
    WHERE r.id = ANY(coalesce(_results, '{}')) AND r.owner_id = auth.uid() AND a.owner_id = auth.uid() AND r.athlete_id <> _target
  LOOP
    IF EXISTS (SELECT 1 FROM results x WHERE x.athlete_id = _target AND (
         x.source_result_id = src.id
         OR (x.meet_id = src.meet_id AND x.final_time_ms IS NOT DISTINCT FROM src.final_time_ms AND x.event_id IS NOT DISTINCT FROM src.event_id)
         OR (x.event_id = src.event_id AND x.round IS NOT DISTINCT FROM src.round))) THEN
      skipped := skipped + 1; CONTINUE;
    END IF;
    INSERT INTO results(athlete_id, meet_id, event_id, seed_time_ms, final_time_ms, course, place, aqua_points, is_dq, video_url, stroke_rate, round, owner_id, transfer_id, source_result_id, origin_team)
    VALUES (_target, src.meet_id, src.event_id, src.seed_time_ms, src.final_time_ms, src.course, src.place, src.aqua_points, src.is_dq, src.video_url, src.stroke_rate, src.round, auth.uid(), tid, src.id, coalesce(src.team_name, 'Club desconocido'))
    RETURNING id INTO newid;
    INSERT INTO splits(result_id, split_distance, cumulative_time_ms, lap_time_ms, owner_id)
      SELECT newid, s.split_distance, s.cumulative_time_ms, s.lap_time_ms, auth.uid() FROM splits s WHERE s.result_id = src.id;
    copied := copied + 1;
  END LOOP;
  UPDATE record_transfers SET copied = copy_athlete_history.copied, skipped = copy_athlete_history.skipped WHERE id = tid;
  IF copied = 0 THEN DELETE FROM record_transfers WHERE id = tid; tid := NULL; END IF;
  RETURN jsonb_build_object('transfer_id', tid, 'copied', copied, 'skipped', skipped);
END $$;

CREATE OR REPLACE FUNCTION public.undo_athlete_history(_transfer uuid)
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'No autorizado'; END IF;
  IF NOT EXISTS (SELECT 1 FROM record_transfers WHERE id = _transfer AND owner_id = auth.uid() AND undone_at IS NULL) THEN
    RAISE EXCEPTION 'Traspaso no encontrado o ya deshecho';
  END IF;
  DELETE FROM results WHERE transfer_id = _transfer AND owner_id = auth.uid();
  GET DIAGNOSTICS n = ROW_COUNT;
  UPDATE record_transfers SET undone_at = now() WHERE id = _transfer;
  RETURN n;
END $$;

REVOKE ALL ON FUNCTION public.copy_athlete_history(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.undo_athlete_history(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.copy_athlete_history(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.undo_athlete_history(uuid) TO authenticated;