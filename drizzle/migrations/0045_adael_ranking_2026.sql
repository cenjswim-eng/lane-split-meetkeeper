-- 0045_adael_ranking_2026.sql: Database schema and atomic ingest function for ADAEL 2026 Federated Ranking

-- 1. Table: adael_clubs (código Hy-Tek, nombre completo, estatus federado 2026)
CREATE TABLE IF NOT EXISTS public.adael_clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  is_federated_2026 boolean NOT NULL DEFAULT true,
  association text NOT NULL DEFAULT 'LARA',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed known official ADAEL clubs
INSERT INTO public.adael_clubs (code, name, is_federated_2026, association) VALUES
  ('PISBO', 'Club Piscinas Bolivarianas de Lara', true, 'LARA'),
  ('PIS', 'Club Piscinas Bolivarianas de Lara (Alterno)', true, 'LARA'),
  ('PBOL', 'Club Piscinas Bolivarianas (PBOL)', true, 'LARA'),
  ('HISP', 'Club Hogar Hispano de Lara', true, 'LARA'),
  ('HIL', 'Club Hogar Hispano de Lara (HIL)', true, 'LARA'),
  ('HHIS', 'Club Hogar Hispano de Lara (HHIS)', true, 'LARA'),
  ('HISPANO', 'Club Hogar Hispano de Lara', true, 'LARA'),
  ('BARQ', 'Club Barquisimeto', true, 'LARA'),
  ('CBL', 'Club Barquisimeto (CBL)', true, 'LARA'),
  ('CDLARA', 'Club Deportivo Lara', true, 'LARA'),
  ('CDL', 'Club Deportivo Lara (CDL)', true, 'LARA'),
  ('AQUALARA', 'Club Aqualara', true, 'LARA'),
  ('AQU', 'Club Aqualara (AQU)', true, 'LARA'),
  ('TRILARA', 'Club Triatlón Lara', true, 'LARA'),
  ('TRIL', 'Club Triatlón Lara (TRIL)', true, 'LARA'),
  ('ADAEL', 'Asociación de Deportes Acuáticos del Estado Lara', true, 'LARA'),
  ('ADAL', 'Asociación de Deportes Acuáticos del Estado Lara', true, 'LARA'),
  ('LARA', 'Selección de Natación del Estado Lara', true, 'LARA'),
  ('CLAR', 'Club Natación Lara', true, 'LARA'),
  ('CSLAR', 'Club Centro Social Larense', true, 'LARA'),
  ('CSL', 'Club Centro Social Larense (CSL)', true, 'LARA'),
  ('CVM', 'Club Vencedores de Morán', true, 'LARA'),
  ('PALM', 'Club Las Palmas', true, 'LARA'),
  ('TARL', 'Club Tarpones de Lara', true, 'LARA'),
  ('TAR', 'Club Tarpones de Lara (TAR)', true, 'LARA'),
  ('HOCAL', 'Club Hogar Canario Larense', true, 'LARA'),
  ('ACUAR', 'Club Acuáticos de Lara', true, 'LARA')
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  is_federated_2026 = EXCLUDED.is_federated_2026,
  association = EXCLUDED.association,
  updated_at = now();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adael_clubs TO authenticated;
GRANT SELECT ON public.adael_clubs TO anon;
GRANT ALL ON public.adael_clubs TO service_role;
ALTER TABLE public.adael_clubs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adael_clubs_read" ON public.adael_clubs FOR SELECT TO public USING (true);
CREATE POLICY "adael_clubs_write" ON public.adael_clubs FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2. Table: meets_2026 (nombre torneo, fecha inicio, curso LCM/SCM, sede)
CREATE TABLE IF NOT EXISTS public.meets_2026 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL CHECK (start_date >= '2026-01-01' AND start_date <= '2026-12-31'),
  end_date date,
  course text NOT NULL CHECK (course IN ('LCM', 'SCM')),
  location text,
  file_hash text,
  source_filename text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (name, start_date, course)
);

CREATE INDEX IF NOT EXISTS idx_meets_2026_dates ON public.meets_2026(start_date, course);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.meets_2026 TO authenticated;
GRANT SELECT ON public.meets_2026 TO anon;
GRANT ALL ON public.meets_2026 TO service_role;
ALTER TABLE public.meets_2026 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "meets_2026_read" ON public.meets_2026 FOR SELECT TO public USING (true);
CREATE POLICY "meets_2026_write" ON public.meets_2026 FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 3. Table: official_results_2026 (atleta, ID federativo, fecha nacimiento, género, club_code, distancia, estilo, tiempo_ms, estado OK/DQ/DNS, es_relevo_leadoff, puntos_wa)
CREATE TABLE IF NOT EXISTS public.official_results_2026 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meet_id uuid NOT NULL REFERENCES public.meets_2026(id) ON DELETE CASCADE,
  swimmer_name text NOT NULL,
  federation_id text,
  birth_date date NOT NULL,
  gender text NOT NULL CHECK (gender IN ('M', 'F', 'X')),
  club_code text NOT NULL REFERENCES public.adael_clubs(code) ON DELETE RESTRICT ON UPDATE CASCADE,
  distance integer NOT NULL CHECK (distance IN (25, 50, 100, 200, 400, 800, 1500)),
  stroke text NOT NULL CHECK (stroke IN ('FREE', 'BACK', 'BREAST', 'FLY', 'IM')),
  course text NOT NULL CHECK (course IN ('LCM', 'SCM')),
  time_ms integer,
  status text NOT NULL CHECK (status IN ('OK', 'DQ', 'DNS', 'DNF', 'SCR', 'NS')),
  is_relay_leadoff boolean NOT NULL DEFAULT false,
  wa_points integer,
  round text NOT NULL DEFAULT 'F' CHECK (round IN ('F', 'P', 'S')),
  event_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (meet_id, swimmer_name, birth_date, distance, stroke, course, round, is_relay_leadoff)
);

CREATE INDEX IF NOT EXISTS idx_results_2026_ranking ON public.official_results_2026(course, stroke, distance, gender, status, time_ms);
CREATE INDEX IF NOT EXISTS idx_results_2026_club ON public.official_results_2026(club_code);
CREATE INDEX IF NOT EXISTS idx_results_2026_meet ON public.official_results_2026(meet_id);
CREATE INDEX IF NOT EXISTS idx_results_2026_birth ON public.official_results_2026(birth_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.official_results_2026 TO authenticated;
GRANT SELECT ON public.official_results_2026 TO anon;
GRANT ALL ON public.official_results_2026 TO service_role;
ALTER TABLE public.official_results_2026 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "official_results_2026_read" ON public.official_results_2026 FOR SELECT TO public USING (true);
CREATE POLICY "official_results_2026_write" ON public.official_results_2026 FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Ingestion Stored Procedure: public.ingest_adael_meet_payload
CREATE OR REPLACE FUNCTION public.ingest_adael_meet_payload(p_payload jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE
  v_meet jsonb := p_payload->'meet';
  v_clubs jsonb := coalesce(p_payload->'clubs', '[]'::jsonb);
  v_results jsonb := coalesce(p_payload->'results', '[]'::jsonb);
  v_meet_id uuid;
  v_club jsonb;
  v_res jsonb;
  v_total_swimmers integer := 0;
  v_inserted integer := 0;
  v_leadoffs integer := 0;
  v_name text;
  v_start date;
  v_end date;
  v_course text;
  v_loc text;
  v_hash text;
  v_file text;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Acceso no autorizado: se requiere rol de administrador.';
  END IF;

  v_name := btrim(coalesce(v_meet->>'name', ''));
  v_start := (v_meet->>'startDate')::date;
  v_end := (v_meet->>'endDate')::date;
  v_course := upper(coalesce(v_meet->>'course', 'LCM'));
  v_loc := v_meet->>'location';
  v_hash := v_meet->>'fileHash';
  v_file := v_meet->>'fileName';

  IF v_name = '' OR v_start IS NULL OR v_course NOT IN ('LCM', 'SCM') THEN
    RAISE EXCEPTION 'Datos de competencia incompletos: Nombre, Fecha de inicio (2026) y Curso (LCM/SCM) son obligatorios.';
  END IF;

  IF v_start < '2026-01-01'::date OR v_start > '2026-12-31'::date THEN
    RAISE EXCEPTION 'Fecha de torneo fuera de la temporada 2026 (Rango oficial: 01/01/2026 al 31/12/2026).';
  END IF;

  -- Upsert Meet (evita duplicados si se vuelve a subir el mismo torneo)
  INSERT INTO public.meets_2026 (name, start_date, end_date, course, location, file_hash, source_filename, updated_at)
  VALUES (v_name, v_start, coalesce(v_end, v_start), v_course, v_loc, v_hash, v_file, now())
  ON CONFLICT (name, start_date, course)
  DO UPDATE SET
    end_date = coalesce(EXCLUDED.end_date, public.meets_2026.end_date),
    location = coalesce(EXCLUDED.location, public.meets_2026.location),
    file_hash = coalesce(EXCLUDED.file_hash, public.meets_2026.file_hash),
    source_filename = coalesce(EXCLUDED.source_filename, public.meets_2026.source_filename),
    updated_at = now()
  RETURNING id INTO v_meet_id;

  -- Upsert C1 Clubs
  FOR v_club IN SELECT value FROM jsonb_array_elements(v_clubs) LOOP
    INSERT INTO public.adael_clubs (code, name, is_federated_2026, association)
    VALUES (
      upper(btrim(v_club->>'code')),
      coalesce(v_club->>'name', upper(btrim(v_club->>'code'))),
      coalesce((v_club->>'isFederated')::boolean, true),
      coalesce(v_club->>'association', 'LARA')
    )
    ON CONFLICT (code) DO UPDATE SET
      name = coalesce(public.adael_clubs.name, EXCLUDED.name),
      updated_at = now();
  END LOOP;

  -- Ingest Official Results & Lead-Offs
  FOR v_res IN SELECT value FROM jsonb_array_elements(v_results) LOOP
    -- Garantizar que el club exista en adael_clubs antes de insertar FK
    INSERT INTO public.adael_clubs (code, name, is_federated_2026, association)
    VALUES (
      upper(btrim(v_res->>'clubCode')),
      upper(btrim(v_res->>'clubCode')),
      true,
      'LARA'
    )
    ON CONFLICT (code) DO NOTHING;

    INSERT INTO public.official_results_2026 (
      meet_id,
      swimmer_name,
      federation_id,
      birth_date,
      gender,
      club_code,
      distance,
      stroke,
      course,
      time_ms,
      status,
      is_relay_leadoff,
      wa_points,
      round,
      event_number
    )
    VALUES (
      v_meet_id,
      btrim(v_res->>'swimmerName'),
      nullif(btrim(v_res->>'federationId'), ''),
      (v_res->>'birthDate')::date,
      upper(coalesce(v_res->>'gender', 'M')),
      upper(btrim(v_res->>'clubCode')),
      (v_res->>'distance')::integer,
      upper(v_res->>'stroke'),
      v_course,
      (v_res->>'timeMs')::integer,
      upper(coalesce(v_res->>'status', 'OK')),
      coalesce((v_res->>'isRelayLeadOff')::boolean, false),
      (v_res->>'waPoints')::integer,
      upper(coalesce(v_res->>'round', 'F')),
      nullif(btrim(v_res->>'eventNumber'), '')
    )
    ON CONFLICT (meet_id, swimmer_name, birth_date, distance, stroke, course, round, is_relay_leadoff)
    DO UPDATE SET
      time_ms = EXCLUDED.time_ms,
      status = EXCLUDED.status,
      wa_points = EXCLUDED.wa_points,
      club_code = EXCLUDED.club_code,
      federation_id = coalesce(EXCLUDED.federation_id, public.official_results_2026.federation_id);

    IF (v_res->>'isRelayLeadOff')::boolean THEN
      v_leadoffs := v_leadoffs + 1;
    ELSE
      v_inserted := v_inserted + 1;
    END IF;
  END LOOP;

  SELECT count(DISTINCT (swimmer_name || '_' || birth_date::text))
  INTO v_total_swimmers
  FROM public.official_results_2026
  WHERE meet_id = v_meet_id;

  RETURN jsonb_build_object(
    'meetId', v_meet_id,
    'meetName', v_name,
    'course', v_course,
    'startDate', v_start,
    'totalSwimmers', v_total_swimmers,
    'individualResults', v_inserted,
    'relayLeadOffs', v_leadoffs,
    'totalResultsIngested', v_inserted + v_leadoffs
  );
END;
$$;

REVOKE ALL ON FUNCTION public.ingest_adael_meet_payload(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ingest_adael_meet_payload(jsonb) TO authenticated;
