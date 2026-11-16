-- When the manager creates the first active account for a unit, make it primary.
-- Serialize with the shared residency/account lock so concurrent account creation
-- cannot both decide that no primary exists.
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
   where n.nspname='public' and p.proname='app_admin_create_account'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_unit_no integer, p_occupancy text, p_username text, p_password text, p_full_name text, p_phone text, p_email text, p_area numeric, p_persons integer, p_start_date_jalali text';
  if v_oid is null then raise exception 'تابع ایجاد حساب مدیر پیدا نشد'; end if;
  v_def := pg_get_functiondef(v_oid);

  v_old := ' perform pg_advisory_xact_lock(hashtextextended(''membership:''||me.building_id::text||'':''||p_unit_no::text,0));';
  v_replacement := v_old || E'\n' ||
    ' perform pg_advisory_xact_lock(hashtextextended(''building-residency:''||me.building_id::text,0));';
  if strpos(v_def,v_old)=0 then raise exception 'قفل عضویت در تابع ایجاد حساب پیدا نشد'; end if;
  v_new := replace(v_def,v_old,v_replacement);

  v_old := 'p_occupancy,false,p_occupancy=''مالک ساکن'',true,true,v_start,me.building_id,';
  v_replacement := 'p_occupancy,false,(p_occupancy=''مالک ساکن'' OR NOT EXISTS(' ||
    'SELECT 1 FROM public.accounts existing WHERE existing.building_id=me.building_id ' ||
    'AND existing.unit_no=p_unit_no AND existing.is_active AND existing.is_primary)),true,true,v_start,me.building_id,';
  if strpos(v_new,v_old)=0 then raise exception 'محل تعیین حساب اصلی در تابع ایجاد حساب پیدا نشد'; end if;
  v_new := replace(v_new,v_old,v_replacement);
  execute v_new;
end
$migration$;
