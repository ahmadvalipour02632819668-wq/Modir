-- A credential reset or account deactivation must revoke push delivery as well
-- as sessions. Otherwise an old device can keep receiving private notifications.
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
  v_old:='IF coalesce(p_new_password,'''')<>'''' OR coalesce(p_is_active,true)=false THEN UPDATE public.sessions SET revoked_at=now() WHERE account_id=v_id AND building_id=me.building_id AND revoked_at IS NULL; END IF;';
  v_new:='IF coalesce(p_new_password,'''')<>'''' OR coalesce(p_is_active,true)=false THEN
     UPDATE public.sessions SET revoked_at=now() WHERE account_id=v_id AND building_id=me.building_id AND revoked_at IS NULL;
     DELETE FROM public.push_subscriptions WHERE account_id=v_id AND building_id=me.building_id;
   END IF;';
  if strpos(v_def,v_old)>0 then
    v_def:=replace(v_def,v_old,v_new);
    execute v_def;
  elsif strpos(v_def,'DELETE FROM public.push_subscriptions WHERE account_id=v_id')=0 then
    raise exception 'محل باطل‌سازی نشست حساب پیدا نشد';
  end if;

  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_admin_delete_account'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_id uuid';
  v_def:=pg_get_functiondef(v_oid);
  v_old:='  update public.sessions
     set revoked_at = now()
   where account_id = target.id
     and building_id = me.building_id
     and revoked_at is null;';
  v_new:=v_old || '
  delete from public.push_subscriptions
   where account_id=target.id and building_id=me.building_id;';
  if strpos(v_def,v_old)>0 then
    execute replace(v_def,v_old,v_new);
  elsif strpos(v_def,'account_id=target.id and building_id=me.building_id')=0 then
    raise exception 'محل حذف اشتراک اعلان حساب حذف‌شده پیدا نشد';
  end if;

  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_confirm_account_exit'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_account_id uuid, p_exit_date_jalali text, p_exit_date date, p_month_days integer, p_next_occupancy text, p_next_start_date_jalali text, p_next_start_date date, p_next_persons integer';
  v_def:=pg_get_functiondef(v_oid);
  v_old:='  update public.sessions
     set revoked_at=now()
   where account_id=a.id
     and building_id=me.building_id
     and revoked_at is null;';
  v_new:=v_old || '
  delete from public.push_subscriptions
   where account_id=a.id and building_id=me.building_id;';
  if strpos(v_def,v_old)>0 then
    execute replace(v_def,v_old,v_new);
  elsif strpos(v_def,'account_id=a.id and building_id=me.building_id')=0 then
    raise exception 'محل حذف اشتراک اعلان حساب خروجی پیدا نشد';
  end if;

  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_admin_reset_password'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_id uuid';
  v_def:=pg_get_functiondef(v_oid);
  v_old:='  update public.sessions
     set revoked_at=now()
   where account_id=p_id
     and building_id=me.building_id
     and revoked_at is null;';
  v_new:=v_old || '
  delete from public.push_subscriptions
   where account_id=p_id and building_id=me.building_id;';
  if strpos(v_def,v_old)>0 then
    execute replace(v_def,v_old,v_new);
  elsif strpos(v_def,'account_id=p_id and building_id=me.building_id')=0 then
    raise exception 'محل حذف اشتراک اعلان پس از بازنشانی رمز پیدا نشد';
  end if;

  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_reset_password'
     and pg_get_function_identity_arguments(p.oid)='p_username text, p_phone text, p_new_password text';
  v_def:=pg_get_functiondef(v_oid);
  v_old:=' update public.sessions set revoked_at=now() where account_id=a.id and revoked_at is null;';
  v_new:=v_old || '
 delete from public.push_subscriptions where account_id=a.id;';
  if strpos(v_def,v_old)>0 then
    execute replace(v_def,v_old,v_new);
  elsif strpos(v_def,'delete from public.push_subscriptions where account_id=a.id')=0 then
    raise exception 'محل حذف اشتراک اعلان در بازیابی رمز پیدا نشد';
  end if;
end
$migration$;
