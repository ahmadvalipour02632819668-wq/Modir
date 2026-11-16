-- Acquire the building residency advisory lock before updating a unit so all
-- residency writers follow the same lock order and avoid write races/deadlocks.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old text := 'me:=public.bm_admin(p_token);';
  v_new text := 'me:=public.bm_admin(p_token);
 perform pg_advisory_xact_lock(hashtextextended(''building-residency:'' || me.building_id::text,0));';
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_admin_set_unit_residency'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_unit_no integer, p_residency_status text';
  if v_oid is null then raise exception 'تابع تأیید وضعیت سکونت پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  if strpos(v_def,v_old)>0 then
    execute replace(v_def,v_old,v_new);
  elsif strpos(v_def,'building-residency:' )=0 then
    raise exception 'محل قفل ساختمان پیدا نشد';
  end if;
end
$migration$;
