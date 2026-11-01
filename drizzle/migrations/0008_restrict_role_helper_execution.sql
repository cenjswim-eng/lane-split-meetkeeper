REVOKE EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid,public.app_role) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.handle_first_admin() FROM PUBLIC, anon, authenticated;
COMMENT ON FUNCTION public.handle_first_admin() IS 'Disabled legacy signup trigger; not callable through the public API.';