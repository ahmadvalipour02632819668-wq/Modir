do $migration$
declare
  v_oid oid;
  v_def text;
  v_new text;
  v_old text;
  v_replacement text;
begin
  -- Manager-created accounts.
  select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_admin_create_account'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_unit_no integer, p_occupancy text, p_username text, p_password text, p_full_name text, p_phone text, p_email text, p_area numeric, p_persons integer, p_start_date_jalali text';
  if v_oid is null then raise exception 'app_admin_create_account پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  v_old := 'if p_occupancy not in (''مالک ساکن'',''مالک'',''مستأجر'') then';
  v_replacement := 'if p_occupancy is null or p_occupancy not in (''مالک ساکن'',''مالک'',''مستأجر'') then';
  if strpos(v_def,v_old)=0 then raise exception 'اعتبارسنجی نوع عضویت پیدا نشد'; end if;
  v_new:=replace(v_def,v_old,v_replacement);
  v_old := 'if coalesce(trim(p_full_name),'''')='''' or coalesce(trim(p_phone),'''')='''' or coalesce(p_area,0)<=0 then';
  v_replacement := 'if coalesce(trim(p_full_name),'''')='''' or length(trim(p_full_name))>150 ' ||
    'or coalesce(trim(p_phone),'''')='''' or length(trim(p_phone))>32 ' ||
    'or (nullif(trim(p_email),'''') is not null and (length(trim(p_email))>254 or trim(p_email) !~ ''^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$'')) ' ||
    'or coalesce(p_area,0)<=0 then';
  if strpos(v_new,v_old)=0 then raise exception 'اعتبارسنجی اطلاعات حساب مدیر پیدا نشد'; end if;
  v_new:=replace(v_new,v_old,v_replacement);
  v_old := 'p_start_date_jalali IS NULL OR p_start_date_jalali IS NULL OR p_start_date_jalali !~ ''^[0-9]{4}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$''';
  v_replacement := 'p_start_date_jalali IS NULL OR p_start_date_jalali !~ ''^[0-9]{4}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$'' OR substring(p_start_date_jalali from 1 for 4)::integer NOT BETWEEN 1300 AND 1600';
  if strpos(v_new,v_old)=0 then raise exception 'اعتبارسنجی تاریخ حساب مدیر پیدا نشد'; end if;
  v_new:=replace(v_new,v_old,v_replacement);
  execute v_new;

  -- Account edits and account creation through the canonical save RPC.
  select p.oid into v_oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_admin_save_account'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_id uuid, p_unit_no integer, p_username text, p_full_name text, p_phone text, p_occupancy text, p_is_primary boolean, p_is_active boolean, p_new_password text, p_start_ym integer, p_start_date_jalali text';
  if v_oid is null then raise exception 'app_admin_save_account نسخه ۱۲ پارامتری پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  v_old := ' me := public.bm_admin(p_token);';
  v_replacement := v_old || E'\n' ||
    ' IF p_occupancy IS NULL OR p_occupancy NOT IN (''مالک ساکن'',''مالک'',''مستأجر'') THEN RAISE EXCEPTION ''نوع عضویت نامعتبر است''; END IF;' || E'\n' ||
    ' IF coalesce(trim(p_full_name),'''')='''' OR length(trim(p_full_name))>150 OR (p_phone IS NOT NULL AND length(p_phone)>32) THEN RAISE EXCEPTION ''نام یا شماره تماس معتبر نیست''; END IF;';
  if strpos(v_def,v_old)=0 then raise exception 'محل اعتبارسنجی app_admin_save_account پیدا نشد'; end if;
  v_new:=replace(v_def,v_old,v_replacement);
  v_old := 'p_start_date_jalali IS NULL OR p_start_date_jalali !~ ''^[0-9]{4}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$''';
  v_replacement := 'p_start_date_jalali IS NULL OR p_start_date_jalali !~ ''^[0-9]{4}/(0[1-9]|1[0-2])/(0[1-9]|[12][0-9]|3[01])$'' OR substring(p_start_date_jalali from 1 for 4)::integer NOT BETWEEN 1300 AND 1600';
  if strpos(v_new,v_old)=0 then raise exception 'اعتبارسنجی تاریخ در app_admin_save_account پیدا نشد'; end if;
  v_new:=replace(v_new,v_old,v_replacement);
  execute v_new;
end
$migration$;
