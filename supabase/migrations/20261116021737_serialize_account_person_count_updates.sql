-- Serialize changes to unit person counts with residency and financial writes.
-- Also fail if the account's unit row is unexpectedly missing.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old_start text := ' me:=public.bm_admin(p_token);';
  v_new_start text := ' me:=public.bm_admin(p_token);
 perform pg_advisory_xact_lock(hashtextextended(''building-residency:'' || me.building_id::text,0));';
  v_old_unit text := ' update public.units set persons=n,updated_at=now() where building_id=me.building_id and unit_no=a.unit_no;';
  v_new_unit text := ' update public.units set persons=n,updated_at=now() where building_id=me.building_id and unit_no=a.unit_no;
 if not found then raise exception ''واحد حساب پیدا نشد''; end if;';
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_admin_set_account_persons'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_account_id uuid, p_persons integer';
  if v_oid is null then raise exception 'تابع تغییر تعداد نفرات پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  if strpos(v_def,v_old_start)=0 or strpos(v_def,v_old_unit)=0 then
    raise exception 'محل قفل یا بررسی واحد در تابع پیدا نشد';
  end if;
  v_def:=replace(v_def,v_old_start,v_new_start);
  v_def:=replace(v_def,v_old_unit,v_new_unit);
  execute v_def;
end
$migration$;
