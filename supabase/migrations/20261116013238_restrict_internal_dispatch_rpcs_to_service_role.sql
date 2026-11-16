-- These RPCs are only called by trusted Edge Functions using the service-role key.
-- They are not called directly by the browser client.
revoke execute on function public.app_bale_authorize(uuid, integer) from public, anon, authenticated;
revoke execute on function public.app_claim_bale_dispatch(uuid, text) from public, anon, authenticated;
revoke execute on function public.app_claim_push_dispatch(uuid, text) from public, anon, authenticated;

grant execute on function public.app_bale_authorize(uuid, integer) to service_role;
grant execute on function public.app_claim_bale_dispatch(uuid, text) to service_role;
grant execute on function public.app_claim_push_dispatch(uuid, text) to service_role;
