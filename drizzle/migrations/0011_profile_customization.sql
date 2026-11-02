CREATE TABLE public.profile_settings (
  user_id uuid PRIMARY KEY DEFAULT auth.uid(),
  display_name text NOT NULL DEFAULT '',
  primary_color text NOT NULL DEFAULT '#3cc8e0',
  accent_color text NOT NULL DEFAULT '#f2b33d',
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profile_colors_hex CHECK (primary_color ~ '^#[0-9a-fA-F]{6}$' AND accent_color ~ '^#[0-9a-fA-F]{6}$')
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profile_settings TO authenticated;
GRANT ALL ON public.profile_settings TO service_role;
ALTER TABLE public.profile_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile settings" ON public.profile_settings FOR ALL TO authenticated
USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
ALTER TABLE public.clubs ADD COLUMN logo_path text;