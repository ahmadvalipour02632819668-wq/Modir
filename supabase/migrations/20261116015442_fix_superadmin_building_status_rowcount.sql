-- Preserve the building UPDATE row count before session revocation changes FOUND.
create or replace function public.app_superadmin_set_building_status(
  p_token uuid,
  p_building_id integer,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public
as $function$
declare
  v_updated integer;
begin
  perform public.bm_superadmin_auth(p_token);

  if p_building_id is null or p_status is null
     or p_status not in ('active', 'suspended', 'deleted') then
    return jsonb_build_object('ok', false, 'error', 'وضعیت یا شناسه ساختمان نامعتبر است');
  end if;

  update public.buildings
     set status = p_status
   where id = p_building_id;

  get diagnostics v_updated = row_count;
  if v_updated = 0 then
    return jsonb_build_object('ok', false, 'error', 'ساختمان پیدا نشد');
  end if;

  if p_status <> 'active' then
    update public.sessions
       set revoked_at = now()
     where building_id = p_building_id
       and revoked_at is null;
  end if;

  return jsonb_build_object('ok', true, 'status', p_status);
end
$function$;
