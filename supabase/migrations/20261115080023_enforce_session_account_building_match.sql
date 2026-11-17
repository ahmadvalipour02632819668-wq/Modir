create or replace function public.bm_auth(p_token uuid)
returns public.accounts
language plpgsql
stable
security definer
set search_path to 'public'
as $function$
declare
  a public.accounts;
begin
  select ac.* into a
  from public.sessions s
  join public.accounts ac on ac.id=s.account_id
  join public.buildings b on b.id=s.building_id
  where s.token=p_token
    and s.revoked_at is null
    and s.expires_at>now()
    and ac.building_id=s.building_id
    and ac.is_active
    and b.status='active';

  if not found then
    raise exception 'AUTH_REQUIRED';
  end if;

  return a;
end
$function$;
