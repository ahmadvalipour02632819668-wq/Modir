-- Explicitly reject NULL statuses/actions because SQL NOT IN returns NULL.
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
       and p.proname in ('app_admin_set_unit_residency','app_admin_update_request')
       and p.prokind='f'
  loop
    v_def:=pg_get_functiondef(r.oid);
    if r.proname='app_admin_set_unit_residency' then
      v_old:='if p_residency_status not in (''owner_occupied'',''tenant_occupied'',''vacant_confirmed'') then';
      v_new:='if p_residency_status is null or p_residency_status not in (''owner_occupied'',''tenant_occupied'',''vacant_confirmed'') then';
    else
      v_old:='if p_status not in (''pending'',''approved'',''rejected'',''done'',''closed'') then';
      v_new:='if p_status is null or p_status not in (''pending'',''approved'',''rejected'',''done'',''closed'') then';
    end if;
    if strpos(v_def,v_old)>0 then
      execute replace(v_def,v_old,v_new);
    elsif strpos(v_def,v_new)=0 then
      raise exception 'محل بررسی مقدار NULL در تابع % پیدا نشد',r.proname;
    end if;
  end loop;

  for r in
    select p.oid,p.proname
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public'
       and p.proname in ('app_claim_bale_dispatch','app_claim_push_dispatch')
       and p.prokind='f'
  loop
    v_def:=pg_get_functiondef(r.oid);
    if r.proname='app_claim_bale_dispatch' then
      v_old:='IF p_action NOT IN (''send'',''discover'') THEN';
      v_new:='IF p_action IS NULL OR p_action NOT IN (''send'',''discover'') THEN';
    else
      v_old:='IF p_event NOT IN (';
      v_new:='IF p_event IS NULL OR p_event NOT IN (';
    end if;
    if strpos(v_def,v_old)>0 then
      execute replace(v_def,v_old,v_new);
    elsif strpos(v_def,v_new)=0 then
      raise exception 'محل بررسی مقدار NULL در تابع % پیدا نشد',r.proname;
    end if;
  end loop;

  for r in
    select p.oid
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='app_admin_save_expense'
       and p.prokind='f'
  loop
    v_def:=pg_get_functiondef(r.oid);
    v_old:='if p_month not between 1 and 12 or p_day not between 1 and 31 then';
    v_new:='if p_year is null or p_year not between 1300 and 1600 or p_month is null or p_month not between 1 and 12 or p_day is null or p_day not between 1 and 31 then';
    if strpos(v_def,v_old)>0 then
      v_def:=replace(v_def,v_old,v_new);
    elsif strpos(v_def,v_new)=0 then
      raise exception 'محل اعتبارسنجی تاریخ هزینه در تابع پیدا نشد';
    end if;

    v_old:='if p_expense_scope not in (''building'',''unit'') then';
    v_new:='if p_expense_scope is null or p_expense_scope not in (''building'',''unit'') then';
    if strpos(v_def,v_old)>0 then
      v_def:=replace(v_def,v_old,v_new);
    elsif strpos(v_def,v_new)=0 then
      raise exception 'محل اعتبارسنجی محدوده هزینه پیدا نشد';
    end if;

    v_old:='if p_expense_kind not in (''shared'',''nonshared'') then';
    v_new:='if p_expense_kind is null or p_expense_kind not in (''shared'',''nonshared'') then';
    if strpos(v_def,v_old)>0 then
      v_def:=replace(v_def,v_old,v_new);
    elsif strpos(v_def,v_new)=0 then
      raise exception 'محل اعتبارسنجی نوع هزینه پیدا نشد';
    end if;

    execute v_def;
  end loop;
end
$migration$;
