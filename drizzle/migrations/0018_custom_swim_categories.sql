CREATE TABLE public.swim_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL DEFAULT auth.uid(),
  name text NOT NULL CHECK (length(trim(name)) between 1 and 60),
  age_min integer CHECK (age_min between 0 and 120),
  age_max integer CHECK (age_max between 0 and 120),
  sort integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (age_min IS NOT NULL OR age_max IS NOT NULL),
  CHECK (age_min IS NULL OR age_max IS NULL OR age_min <= age_max),
  UNIQUE (owner_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.swim_categories TO authenticated;
GRANT ALL ON public.swim_categories TO service_role;
ALTER TABLE public.swim_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own categories" ON public.swim_categories FOR ALL TO authenticated
  USING (owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (owner_id = auth.uid() AND public.has_role(auth.uid(), 'admin'::app_role));