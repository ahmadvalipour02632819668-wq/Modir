-- Bound debt-report month iteration to a valid Jalali month and a maximum 20-year span.
-- This protects the three authenticated-token report RPCs from unbounded loops.
do $migration$
declare
  r record;
  v_def text;
  v_new text;
  v_guard text := $guard$if stop_ym is null
       or stop_ym / 100 not between 1300 and 1600
       or stop_ym % 100 not between 1 and 12
       or cur / 100 not between 1300 and 1600
       or cur % 100 not between 1 and 12 then
    raise exception 'بازه ماهانه گزارش معتبر نیست';
  end if;
  if stop_ym >= cur
     and ((stop_ym / 100) * 12 + (stop_ym % 100))
         - ((cur / 100) * 12 + (cur % 100)) > 240 then
    raise exception 'بازه گزارش نمی‌تواند بیش از ۲۴۰ ماه باشد';
  end if;
  while cur <= stop_ym loop$guard$;
begin
  for r in
    select p.oid, p.proname
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in (
         'app_get_user_debts',
         'app_get_unit_account_debts_for_admin',
         'app_get_unit_debts_for_admin'
       )
       and pg_get_function_identity_arguments(p.oid) like '%p_today_ym%'
  loop
    v_def := pg_get_functiondef(r.oid);
    v_new := regexp_replace(
      v_def,
      'while[[:space:]]+cur[[:space:]]*<=[[:space:]]*stop_ym[[:space:]]+loop',
      v_guard,
      'i'
    );
    if v_new = v_def then
      raise exception 'الگوی حلقه در تابع % پیدا نشد', r.proname;
    end if;
    execute v_new;
  end loop;
end
$migration$;
