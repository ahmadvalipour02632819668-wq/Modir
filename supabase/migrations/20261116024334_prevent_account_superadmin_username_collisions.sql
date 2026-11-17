do $migration$
declare
  v_oid oid;
  v_def text;
  v_old text;
  v_new text;
begin
  -- Existing account edits must not collide with the superadmin login namespace.
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_admin_save_account'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_id uuid, p_unit_no integer, p_username text, p_full_name text, p_phone text, p_occupancy text, p_is_primary boolean, p_is_active boolean, p_new_password text, p_start_ym integer, p_start_date_jalali text';
  if v_oid is null then raise exception 'تابع ذخیره حساب پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  v_old:='IF EXISTS(SELECT 1 FROM public.accounts WHERE lower(username)=lower(p_username) AND id IS DISTINCT FROM p_id) THEN RAISE EXCEPTION ''این نام کاربری قبلاً استفاده شده است''; END IF;';
  v_new:='IF EXISTS(SELECT 1 FROM public.accounts WHERE lower(username)=lower(p_username) AND id IS DISTINCT FROM p_id)
    OR EXISTS(SELECT 1 FROM public.superadmin_accounts WHERE lower(username)=lower(p_username)) THEN
    RAISE EXCEPTION ''این نام کاربری قبلاً استفاده شده است'';
  END IF;';
  if strpos(v_def,v_old)=0 then
    if strpos(v_def,'public.superadmin_accounts WHERE lower(username)=lower(p_username)')=0 then
      raise exception 'محل بررسی تداخل نام کاربری با سوپرادمین پیدا نشد';
    end if;
  else
    v_def:=replace(v_def,v_old,v_new);
    execute v_def;
  end if;

  -- New-building registration approval must recheck the superadmin namespace.
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_superadmin_review_registration'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_request_id bigint, p_decision text';
  if v_oid is null then raise exception 'تابع تأیید ثبت‌نام ساختمان پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  v_old:=' if exists(select 1 from public.accounts where lower(username)=lower(r.username)) then
  return jsonb_build_object(''ok'',false,''error'',''نام کاربری قبلاً استفاده شده است'');
 end if;';
  v_new:=' if exists(select 1 from public.accounts where lower(username)=lower(r.username))
    or exists(select 1 from public.superadmin_accounts where lower(username)=lower(r.username)) then
  return jsonb_build_object(''ok'',false,''error'',''نام کاربری قبلاً استفاده شده است'');
 end if;';
  if strpos(v_def,v_old)=0 then
    if strpos(v_def,'public.superadmin_accounts where lower(username)=lower(r.username)')=0 then
      raise exception 'محل بررسی تداخل نام کاربری در تأیید ساختمان پیدا نشد';
    end if;
  else
    v_def:=replace(v_def,v_old,v_new);
    execute v_def;
  end if;

  -- One-time bootstrap must not shadow an existing building account.
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_superadmin_bootstrap'
     and pg_get_function_identity_arguments(p.oid)='p_setup_key uuid, p_username text, p_password text, p_full_name text';
  if v_oid is null then raise exception 'تابع راه‌اندازی سوپرادمین پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  v_old:='  if exists(select 1 from public.superadmin_accounts) then
    return jsonb_build_object(''ok'',false,''error'',''حساب سوپرادمین قبلاً ساخته شده است'');
  end if;
  update private.superadmin_bootstrap_keys';
  v_new:='  if exists(select 1 from public.superadmin_accounts) then
    return jsonb_build_object(''ok'',false,''error'',''حساب سوپرادمین قبلاً ساخته شده است'');
  end if;
  if exists(select 1 from public.accounts where lower(username)=lower(p_username)) then
    return jsonb_build_object(''ok'',false,''error'',''این نام کاربری قبلاً در حساب ساختمان استفاده شده است'');
  end if;
  update private.superadmin_bootstrap_keys';
  if strpos(v_def,v_old)=0 then
    if strpos(v_def,'این نام کاربری قبلاً در حساب ساختمان استفاده شده است')=0 then
      raise exception 'محل بررسی نام کاربری در راه‌اندازی سوپرادمین پیدا نشد';
    end if;
  else
    v_def:=replace(v_def,v_old,v_new);
    execute v_def;
  end if;
end
$migration$;
