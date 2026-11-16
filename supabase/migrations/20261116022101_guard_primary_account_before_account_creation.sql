-- A newly created account becomes primary only when it is the first active
-- account in the unit. Existing units must already have exactly one primary.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old_decl text := 'declare me public.accounts; u public.units; v_id uuid; v_start integer; v_residency_status text;';
  v_new_decl text := 'declare me public.accounts; u public.units; v_id uuid; v_start integer; v_residency_status text;
 v_active_count integer; v_primary_count integer; v_make_primary boolean;';
  v_old_start text := ' v_start:=substring(p_start_date_jalali from 1 for 4)::integer*100+substring(p_start_date_jalali from 6 for 2)::integer;';
  v_new_start text := ' select count(*),count(*) filter(where a.is_primary)
   into v_active_count,v_primary_count
   from public.accounts a
  where a.building_id=me.building_id and a.unit_no=p_unit_no and a.is_active;
 if v_active_count=0 then
   v_make_primary:=true;
 elsif v_primary_count=1 then
   v_make_primary:=false;
 else
   raise exception ''ابتدا حساب اصلی این واحد را مشخص کنید؛ سپس حساب جدید اضافه کنید'';
 end if;

 v_start:=substring(p_start_date_jalali from 1 for 4)::integer*100+substring(p_start_date_jalali from 6 for 2)::integer;';
  v_old_primary text := '(p_occupancy=''مالک ساکن'' OR NOT EXISTS(SELECT 1 FROM public.accounts existing WHERE existing.building_id=me.building_id AND existing.unit_no=p_unit_no AND existing.is_active AND existing.is_primary))';
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_admin_create_account'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_unit_no integer, p_occupancy text, p_username text, p_password text, p_full_name text, p_phone text, p_email text, p_area numeric, p_persons integer, p_start_date_jalali text';
  if v_oid is null then raise exception 'تابع ایجاد حساب پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  if strpos(v_def,v_old_decl)=0 or strpos(v_def,v_old_start)=0 or strpos(v_def,v_old_primary)=0 then
    raise exception 'محل محافظ حساب اصلی در تابع ایجاد حساب پیدا نشد';
  end if;
  v_def:=replace(v_def,v_old_decl,v_new_decl);
  v_def:=replace(v_def,v_old_start,v_new_start);
  v_def:=replace(v_def,v_old_primary,'v_make_primary');
  execute v_def;
end
$migration$;
