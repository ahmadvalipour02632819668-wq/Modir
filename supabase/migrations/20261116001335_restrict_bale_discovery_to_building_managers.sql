create or replace function public.app_bale_discover_authorize(
  p_token uuid,
  p_building_id integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $function$
declare
  a public.accounts;
begin
  a := public.bm_admin(p_token);
  if a.building_id is distinct from p_building_id then
    return false;
  end if;
  return coalesce(a.is_active, false);
exception when others then
  return false;
end
$function$;

revoke all on function public.app_bale_discover_authorize(uuid, integer) from public;
revoke all on function public.app_bale_discover_authorize(uuid, integer) from authenticated;
grant execute on function public.app_bale_discover_authorize(uuid, integer) to anon;
