-- Serialize account exit with other residency writes and require one primary
-- among the remaining active accounts before deactivating the exiting account.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old_decl text := '  v_settlement_id uuid;';
  v_new_decl text := '  v_settlement_id uuid;
  v_remaining_count integer;
  v_remaining_primary_count integer;';
  v_old_select text := '  me := public.bm_admin(p_token);
  select * into a from public.accounts
   where id=p_account_id and building_id=me.building_id
   for update;
  if not found or not a.is_active then raise exception ''حساب فعال موردنظر پیدا نشد''; end if;';
  v_new_select text := '  me := public.bm_admin(p_token);
  perform pg_advisory_xact_lock(hashtextextended(''building-residency:'' || me.building_id::text, 0));
  select * into a from public.accounts
   where id=p_account_id and building_id=me.building_id
   for update;
  if not found or not a.is_active then raise exception ''حساب فعال موردنظر پیدا نشد''; end if;

  select count(*), count(*) filter (where x.is_primary)
    into v_remaining_count, v_remaining_primary_count
    from public.accounts x
   where x.building_id=me.building_id
     and x.unit_no=a.unit_no
     and x.is_active
     and x.id<>a.id;

  if v_remaining_count>0 and v_remaining_primary_count<>1 then
    raise exception ''ابتدا حساب اصلی واحد را برای یکی از حساب‌های باقی‌مانده مشخص کنید؛ سپس تسویه خروج را انجام دهید'';
  end if;';
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and p.proname='app_confirm_account_exit'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_account_id uuid, p_exit_date_jalali text, p_exit_date date, p_month_days integer, p_next_occupancy text, p_next_start_date_jalali text, p_next_start_date date, p_next_persons integer';
  if v_oid is null then raise exception 'تابع تسویه خروج پیدا نشد'; end if;
  v_def := pg_get_functiondef(v_oid);
  if strpos(v_def,v_old_decl)=0 or strpos(v_def,v_old_select)=0 then
    raise exception 'محل اصلاح قفل و بررسی حساب اصلی پیدا نشد';
  end if;
  v_def := replace(v_def,v_old_decl,v_new_decl);
  v_def := replace(v_def,v_old_select,v_new_select);
  execute v_def;
end
$migration$;
