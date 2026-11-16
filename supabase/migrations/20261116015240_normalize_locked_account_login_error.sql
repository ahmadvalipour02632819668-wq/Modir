-- Do not reveal whether a known account is currently locked.
do $migration$
declare
  v_oid oid;
  v_def text;
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and p.proname='app_login_unified'
     and pg_get_function_identity_arguments(p.oid)='p_login text, p_password text, p_replace_session_id uuid, p_device_label text, p_device_id text';
  if v_oid is null then raise exception 'تابع ورود اصلی پیدا نشد'; end if;
  v_def := pg_get_functiondef(v_oid);
  if position('حساب موقتاً قفل است' in v_def) = 0 then
    raise exception 'متن پاسخ قفل حساب در تابع ورود پیدا نشد';
  end if;
  execute replace(v_def, 'حساب موقتاً قفل است', 'نام کاربری یا رمز عبور اشتباه است');
end
$migration$;
