REVOKE ALL ON FUNCTION public.app_reset_password(text,text,text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.app_reset_password(text,text,text) FROM anon, authenticated;
