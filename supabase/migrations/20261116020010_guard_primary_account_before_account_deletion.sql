-- Serialize account deletion with residency writes and preserve a unique primary.
create or replace function public.app_admin_delete_account(
  p_token uuid,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  me public.accounts;
  target public.accounts;
  v_remaining_count integer;
  v_remaining_primary_count integer;
begin
  me := public.bm_admin(p_token);

  if p_id is null or p_id = me.id then
    raise exception 'حساب مدیر فعلی قابل حذف نیست';
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('building-residency:' || me.building_id::text, 0)
  );

  select *
    into target
    from public.accounts
   where id = p_id
     and building_id = me.building_id
   for update;

  if not found then
    raise exception 'حساب پیدا نشد';
  end if;

  select count(*), count(*) filter (where a.is_primary)
    into v_remaining_count, v_remaining_primary_count
    from public.accounts a
   where a.building_id = me.building_id
     and a.unit_no = target.unit_no
     and a.is_active
     and a.id <> target.id;

  if v_remaining_count > 0 and v_remaining_primary_count <> 1 then
    raise exception 'ابتدا حساب اصلی دیگری برای این واحد مشخص کنید؛ سپس حساب فعلی را حذف کنید';
  end if;

  update public.accounts
     set is_active = false,
         is_primary = false,
         updated_at = now()
   where id = target.id
     and building_id = me.building_id;

  update public.sessions
     set revoked_at = now()
   where account_id = target.id
     and building_id = me.building_id
     and revoked_at is null;

  return jsonb_build_object('ok', true);
end
$function$;
