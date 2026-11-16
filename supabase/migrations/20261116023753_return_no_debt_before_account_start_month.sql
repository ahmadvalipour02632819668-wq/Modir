-- Do not return opening/transfer debt when the requested report month precedes
-- the account's start month. Keep admin account lists intact with empty debt rows.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old text;
  v_new text;
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_get_unit_account_debts_for_admin'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_unit_no integer, p_today_ym integer';
  if v_oid is null then raise exception 'گزارش بدهی حساب‌های واحد پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  v_old:='  if stop_ym >= cur
     and ((stop_ym / 100) * 12 + (stop_ym % 100))
         - ((cur / 100) * 12 + (cur % 100)) > 240 then
    raise exception ''بازه گزارش نمی‌تواند بیش از ۲۴۰ ماه باشد'';
  end if;
  while cur <= stop_ym loop';
  v_new:='  if stop_ym >= cur
     and ((stop_ym / 100) * 12 + (stop_ym % 100))
         - ((cur / 100) * 12 + (cur % 100)) > 240 then
    raise exception ''بازه گزارش نمی‌تواند بیش از ۲۴۰ ماه باشد'';
  end if;
  if stop_ym < cur then
    accounts_json := accounts_json || jsonb_build_array(jsonb_build_object(
      ''account_id'',acc.id,''full_name'',acc.full_name,''occupancy'',acc.occupancy,
      ''debts'',''[]''::jsonb,''total'',0
    ));
    continue;
  end if;
  while cur <= stop_ym loop';
  if strpos(v_def,v_old)=0 then raise exception 'محل کنترل ماه شروع در گزارش واحد پیدا نشد'; end if;
  execute replace(v_def,v_old,v_new);

  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_get_user_debts'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_today_ym integer';
  v_def:=pg_get_functiondef(v_oid);
  v_old:='  if stop_ym >= cur
     and ((stop_ym / 100) * 12 + (stop_ym % 100))
         - ((cur / 100) * 12 + (cur % 100)) > 240 then
    raise exception ''بازه گزارش نمی‌تواند بیش از ۲۴۰ ماه باشد'';
  end if;
  while cur <= stop_ym loop';
  v_new:='  if stop_ym >= cur
     and ((stop_ym / 100) * 12 + (stop_ym % 100))
         - ((cur / 100) * 12 + (cur % 100)) > 240 then
    raise exception ''بازه گزارش نمی‌تواند بیش از ۲۴۰ ماه باشد'';
  end if;
  if stop_ym < cur then
    return ''[]''::jsonb;
  end if;
  while cur <= stop_ym loop';
  if strpos(v_def,v_old)=0 then raise exception 'محل کنترل ماه شروع در بدهی ساکن پیدا نشد'; end if;
  execute replace(v_def,v_old,v_new);

  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_get_unit_debts_for_admin'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_unit_no integer, p_today_ym integer';
  v_def:=pg_get_functiondef(v_oid);
  v_old:='  if stop_ym >= cur
     and ((stop_ym / 100) * 12 + (stop_ym % 100))
         - ((cur / 100) * 12 + (cur % 100)) > 240 then
    raise exception ''بازه گزارش نمی‌تواند بیش از ۲۴۰ ماه باشد'';
  end if;
  while cur <= stop_ym loop';
  v_new:='  if stop_ym >= cur
     and ((stop_ym / 100) * 12 + (stop_ym % 100))
         - ((cur / 100) * 12 + (cur % 100)) > 240 then
    raise exception ''بازه گزارش نمی‌تواند بیش از ۲۴۰ ماه باشد'';
  end if;
  if stop_ym < cur then
    return ''[]''::jsonb;
  end if;
  while cur <= stop_ym loop';
  if strpos(v_def,v_old)=0 then raise exception 'محل کنترل ماه شروع در گزارش تک‌حسابی پیدا نشد'; end if;
  execute replace(v_def,v_old,v_new);
end
$migration$;
