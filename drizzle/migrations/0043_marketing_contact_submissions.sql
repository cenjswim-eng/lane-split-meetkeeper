CREATE TABLE public.contact_submissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), created_at timestamptz NOT NULL DEFAULT now(), name text NOT NULL, club text NOT NULL, country text NOT NULL, email text NOT NULL, campaign jsonb NOT NULL DEFAULT '{}'::jsonb);
GRANT SELECT ON public.contact_submissions TO authenticated;
GRANT ALL ON public.contact_submissions TO service_role;
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY contact_owner_read ON public.contact_submissions FOR SELECT TO authenticated USING (public.is_app_owner());