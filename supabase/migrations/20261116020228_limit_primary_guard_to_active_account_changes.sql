-- Avoid blocking edits to already-inactive accounts while preserving the
-- primary-account invariant for any operation that changes active membership.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old_decl text := '  v_old_unit_no integer;
  v_active_count integer;';
  v_new_decl text := '  v_old_unit_no integer;
  v_old_active boolean;
  v_active_count integer;';
  v_old_select text := '   select a.unit_no into v_old_unit_no
     from public.accounts a';
  v_new_select text := '   select a.unit_no,a.is_active into v_old_unit_no,v_old_active
     from public.accounts a';
  v_old_condition text := '   if v_old_unit_no is not null and
      (v_old_unit_no is distinct from p_unit_no or coalesce(p_is_active,true)=false) then';
  v_new_condition text := '   if v_old_active and v_old_unit_no is not null and
      (v_old_unit_no is distinct from p_unit_no or coalesce(p_is_active,true)=false) then';
  v_old_post text := ' select count(*),count(*) filter(where a.is_primary)
   into v_active_count,v_primary_count
   from public.accounts a
  where a.building_id=me.building_id and a.unit_no=p_unit_no and a.is_active;
 if v_active_count>0 and v_primary_count<>1 then
   raise exception ''حساب اصلی این واحد مشخص نیست؛ یک حساب اصلی انتخاب کنید'';
 end if;';
  v_new_post text := ' if coalesce(p_is_active,true) or coalesce(v_old_active,false) then
   select count(*),count(*) filter(where a.is_primary)
     into v_active_count,v_primary_count
     from public.accounts a
    where a.building_id=me.building_id and a.unit_no=p_unit_no and a.is_active;
   if v_active_count>0 and v_primary_count<>1 then
     raise exception ''حساب اصلی این واحد مشخص نیست؛ یک حساب اصلی انتخاب کنید'';
   end if;
 end if;';
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and p.proname='app_admin_save_account'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_id uuid, p_unit_no integer, p_username text, p_full_name text, p_phone text, p_occupancy text, p_is_primary boolean, p_is_active boolean, p_new_password text, p_start_ym integer, p_start_date_jalali text';
  if v_oid is null then raise exception 'تابع ذخیره حساب اصلی پیدا نشد'; end if;
  v_def := pg_get_functiondef(v_oid);
  if strpos(v_def,v_old_decl)=0 or strpos(v_def,v_old_select)=0 or strpos(v_def,v_old_condition)=0 or strpos(v_def,v_old_post)=0 then
    raise exception 'محل اصلاح وضعیت حساب قبلی پیدا نشد';
  end if;
  v_def := replace(v_def,v_old_decl,v_new_decl);
  v_def := replace(v_def,v_old_select,v_new_select);
  v_def := replace(v_def,v_old_condition,v_new_condition);
  v_def := replace(v_def,v_old_post,v_new_post);
  execute v_def;
end
$migration$;
