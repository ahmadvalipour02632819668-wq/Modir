-- The Bale discovery authorization RPC is internal to the Edge Function.
-- The function still validates the custom session and manager role; only the
-- server-side service role may invoke it.
revoke execute on function public.app_bale_discover_authorize(uuid, integer)
  from public, anon, authenticated;
grant execute on function public.app_bale_discover_authorize(uuid, integer)
  to service_role;
