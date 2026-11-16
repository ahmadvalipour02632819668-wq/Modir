-- Bound login RPC inputs before username lookup and password hashing.
-- Username matches the frontend's 32-character limit; password is capped at 128
-- characters to preserve compatibility while preventing oversized hash inputs.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old text;
  v_new text;
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_login_unified'
     and pg_get_function_identity_arguments(p.oid)='p_login text, p_password text, p_replace_session_id uuid, p_device_label text, p_device_id text';
  if v_oid is null then raise exception 'تابع ورود جدید پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  v_old:=$old$  if v_device_id is null then
    return jsonb_build_object('ok',false,'code','DEVICE_ID_REQUIRED','error','شناسه این دستگاه دریافت نشد؛ صفحه را تازه‌سازی کنید');
  end if;$old$;
  v_new:=$new$  if v_device_id is null then
    return jsonb_build_object('ok',false,'code','DEVICE_ID_REQUIRED','error','شناسه این دستگاه دریافت نشد؛ صفحه را تازه‌سازی کنید');
  end if;
  -- Match the frontend's 32-character username limit and bound password work.
  if p_login is null or length(trim(p_login)) > 32
     or p_password is null or length(p_password) > 128 then
    return jsonb_build_object('ok',false,'error','نام کاربری یا رمز عبور اشتباه است');
  end if;$new$;
  if strpos(v_def,v_old)=0 then raise exception 'محل اعتبارسنجی ورودی ورود پیدا نشد'; end if;
  execute replace(v_def,v_old,v_new);
end
$migration$;
