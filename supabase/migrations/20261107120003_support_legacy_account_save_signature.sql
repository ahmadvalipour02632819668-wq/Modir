
create or replace function public.app_admin_save_account(
  p_token uuid,
  p_id uuid,
  p_username text,
  p_full_name text,
  p_phone text,
  p_occupancy text,
  p_is_primary boolean,
  p_is_active boolean,
  p_new_password text,
  p_start_ym integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  me public.accounts;
  v_unit_no integer;
begin
  me := public.bm_admin(p_token);

  if p_id is null then
    raise exception 'برای ایجاد حساب جدید، شماره واحد لازم است؛ برنامه را به‌روزرسانی کنید';
  end if;

  select a.unit_no
    into v_unit_no
  from public.accounts a
  where a.id = p_id
    and a.building_id = me.building_id;

  if v_unit_no is null then
    raise exception 'حساب موردنظر در ساختمان شما پیدا نشد';
  end if;

  return public.app_admin_save_account(
    p_token,
    p_id,
    v_unit_no,
    p_username,
    p_full_name,
    p_phone,
    p_occupancy,
    p_is_primary,
    p_is_active,
    p_new_password,
    p_start_ym
  );
end;
$function$;

notify pgrst, 'reload schema';

