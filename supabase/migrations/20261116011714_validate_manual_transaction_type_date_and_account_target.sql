-- Validate manual transaction type/date/occupancy and prevent ambiguous account assignment.
do $migration$
declare
  v_sig regprocedure := 'public.app_admin_save_transaction(uuid,bigint,integer,integer,integer,integer,text,text,text,text,bigint,text,boolean)'::regprocedure;
  v_def text;
  v_auth text := E'me:=public.bm_admin(p_token);';
  v_checks text := E'me:=public.bm_admin(p_token);\n if p_tx_type is null or p_tx_type not in (''درآمد'',''هزینه'') then raise exception ''نوع تراکنش معتبر نیست''; end if;\n if p_year is null or p_year not between 1300 and 1600 or p_month is null or p_month not between 1 and 12 or p_day is null or p_day not between 1 and 31 then raise exception ''تاریخ تراکنش معتبر نیست''; end if;\n if p_occupancy is not null and p_occupancy not in (''مالک'',''مالک ساکن'',''مستأجر'') then raise exception ''نوع سکونت معتبر نیست''; end if;';
  v_dupe_marker text := E' if not coalesce(p_force,false) and exists(select 1 from public.transactions x';
  v_dupe_guard text := E' if p_tx_type=''درآمد'' and v_unit is not null then\n  if (select count(*) from public.accounts a where a.building_id=me.building_id and a.unit_no=v_unit and a.occupancy=v_occ and a.is_active)>1\n     and (select count(*) from public.accounts a where a.building_id=me.building_id and a.unit_no=v_unit and a.occupancy=v_occ and a.is_active and a.is_primary)<>1 then\n    raise exception ''برای ثبت درآمد، حساب فعال این نوع سکونت در واحد باید به‌صورت یکتا مشخص شده باشد'';\n  end if;\n end if;\n';
begin
  select pg_get_functiondef(v_sig::oid) into v_def;
  if position('نوع تراکنش معتبر نیست' in v_def)>0 then return; end if;
  if position(v_auth in v_def)=0 or position(v_dupe_marker in v_def)=0 then
    raise exception 'Expected insertion point missing in app_admin_save_transaction';
  end if;
  v_def:=replace(v_def,v_auth,v_checks);
  v_def:=replace(v_def,v_dupe_marker,v_dupe_guard||v_dupe_marker);
  execute v_def;
end
$migration$;
