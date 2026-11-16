-- Login resolves usernames globally (superadmin first, then account), so profile
-- updates must enforce global uniqueness across both account tables.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old text;
  v_new text;
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_update_profile'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_full_name text, p_phone text, p_email text, p_username text, p_current_password text, p_new_password text';
  if v_oid is null then raise exception 'تابع ویرایش پروفایل پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  v_old:='  if exists(
    select 1 from public.accounts a
     where a.building_id=me.building_id
       and lower(a.username)=lower(p_username)
       and a.id<>me.id
  ) then';
  v_new:='  if exists(
    select 1 from public.accounts a
     where lower(a.username)=lower(p_username)
       and a.id<>me.id
  ) or exists(
    select 1 from public.superadmin_accounts s
     where lower(s.username)=lower(p_username)
  ) then';
  if strpos(v_def,v_old)=0 then
    if strpos(v_def,'from public.superadmin_accounts s')=0 then
      raise exception 'محل بررسی نام کاربری سراسری پیدا نشد';
    end if;
  else
    execute replace(v_def,v_old,v_new);
  end if;
end
$migration$;
