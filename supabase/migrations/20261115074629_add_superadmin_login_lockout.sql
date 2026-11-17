alter table public.superadmin_accounts
  add column if not exists failed_attempts integer not null default 0,
  add column if not exists locked_until timestamptz;

do $migration$
declare
  v_def text;
  v_old text := $old$
  if found and sa.password_hash=extensions.crypt(coalesce(p_password,''),sa.password_hash) then
$old$;
  v_new text := $new$
  if found and sa.locked_until is not null and sa.locked_until > now() then
    return jsonb_build_object('ok',false,'error','نام کاربری یا رمز عبور اشتباه است');
  end if;

  if found and sa.password_hash<>extensions.crypt(coalesce(p_password,''),sa.password_hash) then
    update public.superadmin_accounts
       set failed_attempts = case when failed_attempts + 1 >= 5 then 0 else failed_attempts + 1 end,
           locked_until = case when failed_attempts + 1 >= 5 then now() + interval '10 minutes' else null end
     where id = sa.id;
    return jsonb_build_object('ok',false,'error','نام کاربری یا رمز عبور اشتباه است');
  end if;

  if found and sa.password_hash=extensions.crypt(coalesce(p_password,''),sa.password_hash) then
    update public.superadmin_accounts set failed_attempts=0, locked_until=null where id=sa.id;
$new$;
begin
  select pg_get_functiondef(p.oid) into v_def
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public'
    and p.proname='app_login_unified'
    and pg_get_function_identity_arguments(p.oid) =
      'p_login text, p_password text, p_replace_session_id uuid, p_device_label text, p_device_id text';

  if v_def is null then raise exception 'Active login function signature not found'; end if;
  if position(v_old in v_def)=0 then raise exception 'Expected login code segment not found; no function change applied'; end if;
  v_def := replace(v_def, v_old, v_new);
  execute v_def;
end
$migration$;
