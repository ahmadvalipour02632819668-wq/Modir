-- Tighten account/registration/profile input validation.
-- Email domain separator uses one regex escape so valid email addresses are accepted.
do $migration$
declare
  r record;
  v_def text;
  v_new text;
  v_old text;
  v_replacement text;
begin
  for r in
    select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) args
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.prokind='f'
       and p.proname in ('app_admin_create_account','app_submit_member_registration','app_submit_registration')
       and position('p_email' in pg_get_functiondef(p.oid))>0
  loop
    v_def:=pg_get_functiondef(r.oid);
    v_new:=replace(v_def,repeat(chr(92),4)||'.',chr(92)||'.');
    v_new:=replace(v_new,repeat(chr(92),2)||'.',chr(92)||'.');
    if v_new<>v_def then execute v_new; end if;
  end loop;

  select p.oid into r from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_submit_member_registration';
  v_def:=pg_get_functiondef(r.oid);
  v_old := 'coalesce(trim(p_full_name),'''')='''' or coalesce(trim(p_phone),'''')='''' or coalesce(trim(p_email),'''')=''''';
  v_replacement := 'coalesce(trim(p_full_name),'''')='''' or length(trim(p_full_name))>150 ' ||
    'or coalesce(trim(p_phone),'''')='''' or length(trim(p_phone))>32 ' ||
    'or coalesce(trim(p_email),'''')='''' or length(trim(p_email))>254';
  if strpos(v_def,v_old)=0 then raise exception 'فیلدهای ثبت‌نام عضویت پیدا نشد'; end if;
  v_new:=replace(v_def,v_old,v_replacement);
  v_old := 'p_start_date_jalali IS NULL OR p_start_date_jalali IS NULL OR p_start_date_jalali !~';
  v_replacement := 'p_start_date_jalali IS NULL OR p_start_date_jalali !~';
  if strpos(v_new,v_old)>0 then v_new:=replace(v_new,v_old,v_replacement); end if;
  v_old := 'p_start_date_jalali !~ ''^[0-9]{4}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$''';
  v_replacement := v_old || ' OR substring(p_start_date_jalali from 1 for 4)::integer NOT BETWEEN 1300 AND 1600';
  if strpos(v_new,v_old)=0 then raise exception 'تاریخ ثبت‌نام عضویت پیدا نشد'; end if;
  v_new:=replace(v_new,v_old,v_replacement);
  execute v_new;

  select p.oid into r from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_submit_registration'
     and pg_get_function_identity_arguments(p.oid) like 'p_building_name text, p_address text, p_username text, p_password text, p_full_name text, p_phone text, p_email text, p_units_count integer, p_manager_is_resident%';
  v_def:=pg_get_functiondef(r.oid);
  v_old := 'coalesce(trim(p_building_name),'''')='''' or coalesce(trim(p_address),'''')='''' or coalesce(trim(p_full_name),'''')='''' or coalesce(trim(p_phone),'''')='''' or coalesce(trim(p_email),'''')=''''';
  v_replacement := 'coalesce(trim(p_building_name),'''')='''' or length(trim(p_building_name))>120 ' ||
    'or coalesce(trim(p_address),'''')='''' or length(trim(p_address))>300 ' ||
    'or coalesce(trim(p_full_name),'''')='''' or length(trim(p_full_name))>150 ' ||
    'or coalesce(trim(p_phone),'''')='''' or length(trim(p_phone))>32 ' ||
    'or coalesce(trim(p_email),'''')='''' or length(trim(p_email))>254';
  if strpos(v_def,v_old)=0 then raise exception 'فیلدهای ثبت‌نام ساختمان پیدا نشد'; end if;
  v_new:=replace(v_def,v_old,v_replacement);
  v_old := 'p_manager_start_date_jalali !~ ''^[0-9]{4}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$''';
  v_replacement := v_old || ' OR substring(p_manager_start_date_jalali from 1 for 4)::integer NOT BETWEEN 1300 AND 1600';
  if strpos(v_new,v_old)=0 then raise exception 'تاریخ شروع مدیر در ثبت‌نام ساختمان پیدا نشد'; end if;
  v_new:=replace(v_new,v_old,v_replacement);
  execute v_new;

  select p.oid into r from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_update_profile';
  v_def:=pg_get_functiondef(r.oid);
  v_old := 'me:=public.bm_auth(p_token);';
  v_replacement := v_old || E'\n' ||
    ' if coalesce(trim(p_full_name),'''')='''' or length(trim(p_full_name))>150 ' ||
    'or (p_phone is not null and length(p_phone)>32) ' ||
    'or (p_email is not null and length(p_email)>254) ' ||
    'or (nullif(trim(p_email),'''') is not null and trim(p_email) !~ ''^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'') then ' ||
    'return jsonb_build_object(''ok'',false,''error'',''نام، شماره تماس یا ایمیل معتبر نیست''); end if;' || E'\n';
  if strpos(v_def,v_old)=0 then raise exception 'محل اعتبارسنجی پروفایل پیدا نشد'; end if;
  v_new:=replace(v_def,v_old,v_replacement);
  v_old := 'if p_username !~ ''^[A-Za-z][A-Za-z0-9_]{2,31}$'' then';
  v_replacement := 'if coalesce(p_username,'''') !~ ''^[A-Za-z][A-Za-z0-9_]{2,31}$'' then';
  if strpos(v_new,v_old)=0 then raise exception 'اعتبارسنجی نام کاربری پروفایل پیدا نشد'; end if;
  v_new:=replace(v_new,v_old,v_replacement);
  execute v_new;
end
$migration$;
