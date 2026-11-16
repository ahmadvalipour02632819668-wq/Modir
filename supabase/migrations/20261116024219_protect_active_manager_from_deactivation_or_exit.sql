-- Do not allow a manager to deactivate or exit their own manager account.
-- Management must first be transferred through the dedicated handoff workflow.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old text;
  v_new text;
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_admin_save_account'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_id uuid, p_unit_no integer, p_username text, p_full_name text, p_phone text, p_occupancy text, p_is_primary boolean, p_is_active boolean, p_new_password text, p_start_ym integer, p_start_date_jalali text';
  if v_oid is null then raise exception 'تابع ذخیره حساب پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  v_old:='DECLARE me public.accounts; v_id uuid; v_start_ym integer;
  v_old_unit_no integer;
  v_old_active boolean;
  v_active_count integer;
  v_primary_count integer;';
  v_new:='DECLARE me public.accounts; v_id uuid; v_start_ym integer;
  v_old_unit_no integer;
  v_old_active boolean;
  v_old_is_admin boolean;
  v_active_count integer;
  v_primary_count integer;';
  if strpos(v_def,v_old)=0 then
    if strpos(v_def,'v_old_is_admin boolean')=0 then raise exception 'متغیر وضعیت مدیر در ذخیره حساب پیدا نشد'; end if;
  else
    v_def:=replace(v_def,v_old,v_new);
  end if;
  v_old:='select a.unit_no,a.is_active into v_old_unit_no,v_old_active
     from public.accounts a';
  v_new:='select a.unit_no,a.is_active,a.is_admin into v_old_unit_no,v_old_active,v_old_is_admin
     from public.accounts a';
  if strpos(v_def,v_old)=0 then raise exception 'محل خواندن وضعیت حساب مدیر پیدا نشد'; end if;
  v_def:=replace(v_def,v_old,v_new);
  v_old:='   if not found then raise exception ''حساب موردنظر پیدا نشد''; end if;';
  v_new:=v_old || '
   if v_old_is_admin and coalesce(p_is_active,true)=false then
     raise exception ''مدیر فعلی باید ابتدا مدیریت را منتقل کند؛ سپس می‌تواند غیرفعال شود'';
   end if;';
  if strpos(v_def,v_old)=0 then
    if strpos(v_def,'مدیر فعلی باید ابتدا مدیریت را منتقل کند')=0 then raise exception 'محل محافظ غیرفعال‌سازی مدیر پیدا نشد'; end if;
  else
    v_def:=replace(v_def,v_old,v_new);
  end if;
  execute v_def;

  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_confirm_account_exit'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_account_id uuid, p_exit_date_jalali text, p_exit_date date, p_month_days integer, p_next_occupancy text, p_next_start_date_jalali text, p_next_start_date date, p_next_persons integer';
  if v_oid is null then raise exception 'تابع تسویه خروج حساب پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  v_old:='  if not found or not a.is_active then raise exception ''حساب فعال موردنظر پیدا نشد''; end if;';
  v_new:=v_old || '
  if a.is_admin then
    raise exception ''مدیر فعلی باید ابتدا مدیریت را منتقل کند؛ سپس می‌تواند خارج شود'';
  end if;';
  if strpos(v_def,v_old)=0 then
    if strpos(v_def,'مدیر فعلی باید ابتدا مدیریت را منتقل کند')=0 then raise exception 'محل محافظ خروج مدیر پیدا نشد'; end if;
  else
    v_def:=replace(v_def,v_old,v_new);
  end if;
  execute v_def;

  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_admin_delete_account'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_id uuid';
  v_def:=pg_get_functiondef(v_oid);
  v_old:='  if not found then
    raise exception ''حساب پیدا نشد'';
  end if;';
  v_new:=v_old || '
  if target.is_admin and target.is_active then
    raise exception ''مدیر فعال را نمی‌توان حذف کرد؛ ابتدا مدیریت را منتقل کنید'';
  end if;';
  if strpos(v_def,v_old)>0 then
    v_def:=replace(v_def,v_old,v_new);
    execute v_def;
  elsif strpos(v_def,'مدیر فعال را نمی‌توان حذف کرد')=0 then
    raise exception 'محل محافظ حذف مدیر فعال پیدا نشد';
  end if;
end
$migration$;
