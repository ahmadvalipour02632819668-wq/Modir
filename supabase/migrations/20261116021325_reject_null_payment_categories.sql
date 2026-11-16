-- Reject NULL payment categories explicitly. NOT IN with NULL evaluates to NULL
-- and can otherwise skip an IF condition.
do $migration$
declare
  r record;
  v_def text;
  v_old text;
  v_new text;
begin
  for r in
    select p.oid,p.proname
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public'
       and p.proname in ('app_submit_payment','app_admin_submit_account_payment')
       and p.prokind='f'
  loop
    v_def:=pg_get_functiondef(r.oid);
    if lower(v_def) like '%p_category is null%' then
      continue;
    end if;
    if r.proname='app_submit_payment' then
      v_old:='OR (p_category NOT IN (';
      v_new:='OR p_category IS NULL OR (p_category NOT IN (';
    else
      v_old:='or (p_category not in (';
      v_new:='or p_category is null or (p_category not in (';
    end if;
    if strpos(v_def,v_old)=0 then
      raise exception 'محل بررسی دسته‌بندی در تابع % پیدا نشد',r.proname;
    end if;
    execute replace(v_def,v_old,v_new);
  end loop;
end
$migration$;
