-- Preserve a unique primary account when an account is moved or deactivated.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old_decl text := 'DECLARE me public.accounts; v_id uuid; v_start_ym integer;';
  v_new_decl text := 'DECLARE me public.accounts; v_id uuid; v_start_ym integer;
  v_old_unit_no integer;
  v_active_count integer;
  v_primary_count integer;';
  v_old_start text := ' me := public.bm_admin(p_token);';
  v_new_start text := ' me := public.bm_admin(p_token);
 perform pg_advisory_xact_lock(hashtextextended(''building-residency:'' || me.building_id::text, 0));
 if p_id is not null then
   select a.unit_no into v_old_unit_no
     from public.accounts a
    where a.id=p_id and a.building_id=me.building_id
    for update;
   if not found then raise exception ''حساب موردنظر پیدا نشد''; end if;
   if v_old_unit_no is not null and
      (v_old_unit_no is distinct from p_unit_no or coalesce(p_is_active,true)=false) then
     select count(*),count(*) filter(where a.is_primary)
       into v_active_count,v_primary_count
       from public.accounts a
      where a.building_id=me.building_id and a.unit_no=v_old_unit_no
        and a.is_active and a.id<>p_id;
     if v_active_count>0 and v_primary_count<>1 then
       raise exception ''ابتدا حساب اصلی واحد قبلی را مشخص کنید؛ سپس حساب را جابه‌جا یا غیرفعال کنید'';
     end if;
   end if;
 end if;';
  v_old_end text := ' END IF;
 RETURN jsonb_build_object(''ok'',true,''id'',v_id,''start_ym'',v_start_ym,''start_date_jalali'',p_start_date_jalali);';
  v_new_end text := ' END IF;
 select count(*),count(*) filter(where a.is_primary)
   into v_active_count,v_primary_count
   from public.accounts a
  where a.building_id=me.building_id and a.unit_no=p_unit_no and a.is_active;
 if v_active_count>0 and v_primary_count<>1 then
   raise exception ''حساب اصلی این واحد مشخص نیست؛ یک حساب اصلی انتخاب کنید'';
 end if;
 RETURN jsonb_build_object(''ok'',true,''id'',v_id,''start_ym'',v_start_ym,''start_date_jalali'',p_start_date_jalali);';
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and p.proname='app_admin_save_account'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_id uuid, p_unit_no integer, p_username text, p_full_name text, p_phone text, p_occupancy text, p_is_primary boolean, p_is_active boolean, p_new_password text, p_start_ym integer, p_start_date_jalali text';
  if v_oid is null then raise exception 'تابع ذخیره حساب اصلی پیدا نشد'; end if;
  v_def := pg_get_functiondef(v_oid);
  if strpos(v_def,v_old_decl)=0 or strpos(v_def,v_old_start)=0 or strpos(v_def,v_old_end)=0 then
    raise exception 'محل درج محافظ حساب اصلی پیدا نشد';
  end if;
  v_def := replace(v_def,v_old_decl,v_new_decl);
  v_def := replace(v_def,v_old_start,v_new_start);
  v_def := replace(v_def,v_old_end,v_new_end);
  execute v_def;
end
$migration$;
