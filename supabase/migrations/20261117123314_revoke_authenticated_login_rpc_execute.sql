-- The unified login endpoint is called before a custom application session exists.
-- It must remain callable by anon, but authenticated has no reason to execute it.
REVOKE EXECUTE ON FUNCTION public.app_login_unified(text, text, uuid, text, text) FROM authenticated;
