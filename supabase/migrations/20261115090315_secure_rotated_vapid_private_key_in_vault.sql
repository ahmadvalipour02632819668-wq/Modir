
create or replace function public.app_internal_get_vapid_private_key()
returns text
language sql
stable
security definer
set search_path to 'pg_catalog','vault'
as $function$
  select decrypted_secret
  from vault.decrypted_secrets
  where name='vapid_private_key'
  order by updated_at desc
  limit 1
$function$;

revoke all on function public.app_internal_get_vapid_private_key() from public, anon, authenticated;
grant execute on function public.app_internal_get_vapid_private_key() to service_role;

