-- Bound user-supplied periods in report and account-exit preview calculations.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_new text;
  v_old text;
  v_replacement text;
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_report'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_year integer, p_month integer';
  if v_oid is null then raise exception 'تابع app_report پیدا نشد'; end if;
  v_def := pg_get_functiondef(v_oid);
  v_old := $old$select coalesce(nullif(left(regexp_replace(value,'[^0-9]','','g'),6),'')::int,140406) into v_start from public.settings where building_id=me.building_id and key='start_ym';$old$;
  v_replacement := $new$select coalesce(nullif(left(regexp_replace(value,'[^0-9]','','g'),6),'')::int,140406) into v_start from public.settings where building_id=me.building_id and key='start_ym';
 if p_year is null or p_year not between 1300 and 1600 or p_month is null or p_month not between 1 and 12 then
   raise exception 'سال یا ماه گزارش معتبر نیست';
 end if;
 if v_start / 100 not between 1300 and 1600 or v_start % 100 not between 1 and 12 then
   raise exception 'ماه شروع محاسبات ساختمان معتبر نیست';
 end if;
 if v_ym >= v_start
    and ((v_ym / 100) * 12 + (v_ym % 100))
        - ((v_start / 100) * 12 + (v_start % 100)) > 240 then
   raise exception 'بازه گزارش نمی‌تواند بیش از ۲۴۰ ماه باشد';
 end if;$new$;
  if strpos(v_def,v_old)=0 then raise exception 'محل کنترل تاریخ در app_report پیدا نشد'; end if;
  v_new := replace(v_def,v_old,v_replacement);
  execute v_new;

  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_preview_account_exit'
     and pg_get_function_identity_arguments(p.oid) like 'p_token uuid, p_account_id uuid, p_exit_date_jalali text, p_exit_date date, p_month_days integer%';
  if v_oid is null then raise exception 'تابع app_preview_account_exit پیدا نشد'; end if;
  v_def := pg_get_functiondef(v_oid);
  v_old := 'v_start := coalesce(a.start_ym,140406);';
  v_replacement := $new$v_start := coalesce(a.start_ym,140406);
  if v_exit_ym / 100 not between 1300 and 1600
     or v_exit_ym % 100 not between 1 and 12
     or v_start / 100 not between 1300 and 1600
     or v_start % 100 not between 1 and 12 then
    raise exception 'بازه تاریخ تسویه معتبر نیست';
  end if;
  if v_exit_ym >= v_start
     and ((v_exit_ym / 100) * 12 + (v_exit_ym % 100))
         - ((v_start / 100) * 12 + (v_start % 100)) > 240 then
    raise exception 'محاسبه تسویه نمی‌تواند بیش از ۲۴۰ ماه را پوشش دهد';
  end if;$new$;
  if strpos(v_def,v_old)=0 then raise exception 'محل کنترل تاریخ در app_preview_account_exit پیدا نشد'; end if;
  v_new := replace(v_def,v_old,v_replacement);
  execute v_new;
end
$migration$;
