-- Category codes are rendered in financial screens. Accept only compact ASCII
-- identifiers; all current and legacy category codes use lowercase snake_case.
do $migration$
declare
  r record;
  v_def text;
  v_old text;
  v_new text;
begin
  for r in
    select p.oid,p.proname,pg_get_function_identity_arguments(p.oid) args
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public'
       and p.proname in ('app_admin_save_expense','app_admin_save_transaction')
       and pg_get_function_identity_arguments(p.oid) like '%p_category text%'
  loop
    v_def:=pg_get_functiondef(r.oid);
    if position('p_category !~' in v_def)>0 then
      continue;
    end if;
    if position('me := public.bm_admin(p_token);' in v_def)>0 then
      v_old:='me := public.bm_admin(p_token);';
      v_new:='me := public.bm_admin(p_token);
  if p_category is not null and p_category <> '''' and p_category !~ ''^[a-z0-9_]{1,64}$'' then
    raise exception ''دسته‌بندی معتبر نیست'';
  end if;';
    elsif position('me:=public.bm_admin(p_token);' in v_def)>0 then
      v_old:='me:=public.bm_admin(p_token);';
      v_new:='me:=public.bm_admin(p_token);
 if p_category is not null and p_category <> '''' and p_category !~ ''^[a-z0-9_]{1,64}$'' then
   raise exception ''دسته‌بندی معتبر نیست'';
 end if;';
    else
      raise exception 'محل اعتبارسنجی دسته‌بندی در تابع % پیدا نشد',r.proname;
    end if;
    execute replace(v_def,v_old,v_new);
  end loop;
end
$migration$;
