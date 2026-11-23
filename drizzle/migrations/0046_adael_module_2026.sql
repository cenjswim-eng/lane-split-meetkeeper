-- 0046_adael_module_2026.sql: Arquitectura de Datos Oficial ADAEL 2026 (Clubes, Fichaje y Resultados)

-- 1. Tabla: adael_clubs_2026
CREATE TABLE IF NOT EXISTS public.adael_clubs_2026 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_code text NOT NULL UNIQUE,
  club_name text NOT NULL,
  aliases text[] NOT NULL DEFAULT '{}',
  season integer NOT NULL DEFAULT 2026,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Índices para optimizar búsquedas y resolución de alias
CREATE INDEX IF NOT EXISTS idx_adael_clubs_2026_code ON public.adael_clubs_2026(club_code);
CREATE INDEX IF NOT EXISTS idx_adael_clubs_2026_aliases ON public.adael_clubs_2026 USING GIN(aliases);

-- Seed de clubes oficiales de la Asociación de Deportes Acuáticos del Estado Lara (ADAEL)
INSERT INTO public.adael_clubs_2026 (club_code, club_name, aliases, season) VALUES
  ('JSWIM', 'Centro Acuático JSwim Lara', ARRAY['C.E. JSWIM', 'JSWIM-LA', 'J SWIM', 'JSWI', 'J-SWIM', 'CLUB JSWIM'], 2026),
  ('HOCAL', 'Club Hogar Canario Larense', ARRAY['HOCALAR', 'HOGAR CANARIO', 'HOCA', 'HIL', 'HHIS', 'HOGAR CANARIO LARENSE', 'HOGAR CANARIO DE LARA'], 2026),
  ('ITALO', 'Club Italo Venezolano de Barquisimeto', ARRAY['ITALVEN', 'CIVLA', 'ITALO VENEZOLANO', 'ITAL', 'CLUB ITALO', 'CENTRO ITALO VENEZOLANO'], 2026),
  ('POLI', 'Piscinas Bolivarianas de Lara / Polideportivo', ARRAY['POLIDEPORTIVO', 'PIBOL', 'PISBO', 'PBOL', 'PIS', 'POLI LARA', 'COMPLEJO DE PISCINAS BOLIVARIANAS'], 2026),
  ('LUSOL', 'Club Lusitano Lu Sol', ARRAY['LUSO', 'LU SOL', 'LUSITANO', 'LUSOL LARA', 'CLUB LUSITANO'], 2026),
  ('BARQ', 'Club Barquisimeto', ARRAY['CBL', 'CLUB BARQUISIMETO', 'BARQUISIMETO'], 2026),
  ('CDLARA', 'Club Deportivo Lara', ARRAY['CDL', 'DEPORTIVO LARA', 'DEP LARA'], 2026),
  ('AQUALARA', 'Club Aqualara', ARRAY['AQU', 'AQUA LARA', 'AQUALAR'], 2026),
  ('TRILARA', 'Club Triatlón Lara', ARRAY['TRIL', 'TRIATLON LARA'], 2026),
  ('CSLAR', 'Club Centro Social Larense', ARRAY['CSL', 'CENTRO SOCIAL LARENSE', 'SOC LARENSE'], 2026),
  ('PALM', 'Club Las Palmas', ARRAY['LAS PALMAS', 'PALMAS'], 2026),
  ('TARL', 'Club Tarpones de Lara', ARRAY['TAR', 'TARPONES', 'TARPONES DE LARA'], 2026),
  ('CVM', 'Club Vencedores de Morán', ARRAY['VENCEDORES DE MORAN', 'MORAN', 'VENC MORAN'], 2026),
  ('GATLA', 'Club Gatos de Lara', ARRAY['GATL', 'GATOS LARA', 'GATOS'], 2026),
  ('CADIP', 'CADIP Lara', ARRAY['CADI', 'CADIP'], 2026),
  ('CNCAR', 'Club Natación Carora', ARRAY['CNCA', 'CARORA', 'NATACION CARORA'], 2026),
  ('CCTRY', 'Barquisimeto Country Club', ARRAY['COUNTRY CLUB', 'BCC', 'COUNTRY'], 2026),
  ('CAQC', 'Centro Acuático Quíbor', ARRAY['QUIBOR', 'CAQC', 'ACUATICO QUIBOR'], 2026),
  ('CIVLA', 'Club Italo Venezolano Lara', ARRAY['CIVL', 'ITALO LARA'], 2026),
  ('DELFJ', 'Delfines de Javier', ARRAY['DELF', 'DELFINES JAVIER'], 2026),
  ('HUNLA', 'Hunter Swimming Lara', ARRAY['HUNL', 'HUNTER LARA'], 2026),
  ('YARA', 'Asociación de Deportes Acuáticos de Yaracuy (Invitado)', ARRAY['ADAY', 'YARACUY', 'SELECCION YARACUY', 'YARACUY ASODAY'], 2026),
  ('LARA', 'Selección de Natación del Estado Lara', ARRAY['SELECCION LARA', 'LARA', 'ADAEL', 'ASOCIACION LARA'], 2026)
ON CONFLICT (club_code) DO UPDATE SET
  club_name = EXCLUDED.club_name,
  aliases = EXCLUDED.aliases,
  season = EXCLUDED.season,
  updated_at = now();

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adael_clubs_2026 TO authenticated;
GRANT SELECT ON public.adael_clubs_2026 TO anon;
GRANT ALL ON public.adael_clubs_2026 TO service_role;
ALTER TABLE public.adael_clubs_2026 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adael_clubs_2026_read" ON public.adael_clubs_2026 FOR SELECT TO public USING (true);
CREATE POLICY "adael_clubs_2026_write" ON public.adael_clubs_2026 FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2. Tabla: adael_athletes_2026 (Padrón de Fichados 2026)
CREATE TABLE IF NOT EXISTS public.adael_athletes_2026 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faveda_adael_id text,
  full_name text NOT NULL,
  normalized_name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('M', 'F')),
  birth_date date,
  birth_year integer NOT NULL,
  age_group_2026 text NOT NULL CHECK (
    age_group_2026 IN (
      'Pre-Infantil',
      'Infantil A',
      'Infantil B',
      'Juvenil A',
      'Juvenil B',
      'Máxima',
      'Máster'
    )
  ),
  club_id uuid NOT NULL REFERENCES public.adael_clubs_2026(id) ON DELETE CASCADE,
  is_federated boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'Activo 2026',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_adael_athletes_2026_identity UNIQUE (normalized_name, birth_year, gender, club_id)
);

CREATE INDEX IF NOT EXISTS idx_adael_athletes_2026_norm_name ON public.adael_athletes_2026(normalized_name);
CREATE INDEX IF NOT EXISTS idx_adael_athletes_2026_club_cat ON public.adael_athletes_2026(club_id, age_group_2026);
CREATE INDEX IF NOT EXISTS idx_adael_athletes_2026_faveda_id ON public.adael_athletes_2026(faveda_adael_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adael_athletes_2026 TO authenticated;
GRANT SELECT ON public.adael_athletes_2026 TO anon;
GRANT ALL ON public.adael_athletes_2026 TO service_role;
ALTER TABLE public.adael_athletes_2026 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adael_athletes_2026_read" ON public.adael_athletes_2026 FOR SELECT TO public USING (true);
CREATE POLICY "adael_athletes_2026_write" ON public.adael_athletes_2026 FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3. Tabla: adael_results_2026
CREATE TABLE IF NOT EXISTS public.adael_results_2026 (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meet_name text NOT NULL,
  meet_date date NOT NULL,
  pool_course text NOT NULL CHECK (pool_course IN ('LCM', 'SCM')),
  athlete_id uuid NOT NULL REFERENCES public.adael_athletes_2026(id) ON DELETE CASCADE,
  club_id uuid NOT NULL REFERENCES public.adael_clubs_2026(id) ON DELETE CASCADE,
  event_code text NOT NULL,
  round text NOT NULL CHECK (round IN ('Prelims', 'Finals', 'Timed Finals')),
  seed_time_ms integer,
  final_time_ms integer,
  final_time_formatted text,
  splits jsonb NOT NULL DEFAULT '[]'::jsonb,
  fina_points integer,
  rank integer,
  status text NOT NULL CHECK (status IN ('OK', 'DQ', 'NS', 'DNF', 'EXH')),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_adael_results_2026_entry UNIQUE (meet_name, meet_date, pool_course, athlete_id, event_code, round)
);

CREATE INDEX IF NOT EXISTS idx_adael_results_2026_event_perf ON public.adael_results_2026(event_code, pool_course, final_time_ms);
CREATE INDEX IF NOT EXISTS idx_adael_results_2026_ath_event ON public.adael_results_2026(athlete_id, event_code, pool_course);
CREATE INDEX IF NOT EXISTS idx_adael_results_2026_club_meet ON public.adael_results_2026(club_id, meet_date);
CREATE INDEX IF NOT EXISTS idx_adael_results_2026_meet_name ON public.adael_results_2026(meet_name);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.adael_results_2026 TO authenticated;
GRANT SELECT ON public.adael_results_2026 TO anon;
GRANT ALL ON public.adael_results_2026 TO service_role;
ALTER TABLE public.adael_results_2026 ENABLE ROW LEVEL SECURITY;
CREATE POLICY "adael_results_2026_read" ON public.adael_results_2026 FOR SELECT TO public USING (true);
CREATE POLICY "adael_results_2026_write" ON public.adael_results_2026 FOR ALL TO authenticated USING (true) WITH CHECK (true);
