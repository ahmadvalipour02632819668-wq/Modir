-- Require a minimally sized device identifier at login so push registration
-- can bind subscriptions to a meaningful authenticated device ID.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old text := 'if v_device_id is null then';
  v_new text := 'if v_device_id is null or length(v_device_id)<8 then';
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_login_unified'
     and pg_get_function_identity_arguments(p.oid)='p_login text, p_password text, p_replace_session_id uuid, p_device_label text, p_device_id text';
  if v_oid is null then raise exception 'تابع ورود جدید پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  if strpos(v_def,v_old)=0 then
    if strpos(v_def,'length(v_device_id)<8')=0 then
      raise exception 'محل اعتبارسنجی شناسه دستگاه پیدا نشد';
    end if;
  else
    execute replace(v_def,v_old,v_new);
  end if;
end
$migration$;
