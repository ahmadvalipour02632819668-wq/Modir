
alter table public.building_memberships add column if not exists resident_count_snapshot integer;
update public.building_memberships bm set resident_count_snapshot=coalesce(bm.resident_count_snapshot,u.resident_count,1)
from public.units u where u.id=bm.unit_id and bm.resident_count_snapshot is null;
alter table public.building_memberships alter column resident_count_snapshot set default 1;
alter table public.building_memberships add constraint building_memberships_resident_count_snapshot_check
 check(resident_count_snapshot is null or resident_count_snapshot>=1);

do $patch$
declare d text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='app_manager_add_unit_and_resident';
 d:=replace(d,
  'insert into public.building_memberships(building_id,account_id,unit_id,access_role,resident_type,membership_status,joined_at) values(p_building_id,v_account_id,v_unit_id,''resident'',p_occupancy,''active'',p_joined_at)',
  'insert into public.building_memberships(building_id,account_id,unit_id,access_role,resident_type,membership_status,joined_at,resident_count_snapshot) values(p_building_id,v_account_id,v_unit_id,''resident'',p_occupancy,''active'',p_joined_at,p_resident_count)');
 if position('resident_count_snapshot' in d)=0 then raise exception 'ثبت تعداد ساکن در عضویت جدید اصلاح نشد'; end if;
 execute d;
end
$patch$;

do $patch$
declare d text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='app_manager_update_member_profile';
 d:=replace(d,
  'set resident_type=p_resident_type,joined_at=p_joined_at where id=p_membership_id',
  'set resident_type=p_resident_type,joined_at=p_joined_at,resident_count_snapshot=p_resident_count where id=p_membership_id');
 if position('resident_count_snapshot=p_resident_count' in d)=0 then raise exception 'ویرایش تعداد ساکن در عضویت اصلاح نشد'; end if;
 execute d;
end
$patch$;

do $patch$
declare d text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='app_manager_review_resident_request';
 d:=replace(d,
  'INSERT INTO public.building_memberships(building_id,account_id,unit_id,access_role,resident_type,membership_status,joined_at,opening_debt)',
  'INSERT INTO public.building_memberships(building_id,account_id,unit_id,access_role,resident_type,membership_status,joined_at,resident_count_snapshot,opening_debt)');
 d:=replace(d,
  'VALUES(r.building_id,v_account_id,v_unit_id,''resident'',r.requested_role,''active'',p_join_date,p_opening_debt)',
  'VALUES(r.building_id,v_account_id,v_unit_id,''resident'',r.requested_role,''active'',p_join_date,coalesce(r.resident_count,1),p_opening_debt)');
 if position('resident_count_snapshot' in d)=0 or position('coalesce(r.resident_count,1),p_opening_debt' in d)=0 then raise exception 'ثبت تعداد ساکن در تأیید درخواست اصلاح نشد'; end if;
 execute d;
end
$patch$;

do $patch$
declare d text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='app_recurring_generate_for_building';
 d:=replace(d,
  'when ver.calculation_method=''per_resident'' then greatest(coalesce(u.resident_count,0),0)',
  'when ver.calculation_method=''per_resident'' then greatest(coalesce((select bm.resident_count_snapshot from public.building_memberships bm where bm.id=target_id),u.resident_count,0),0)');
 if position('resident_count_snapshot' in d)=0 then raise exception 'محاسبه نرخ دوره‌ای بر اساس تعداد ساکن تاریخی اصلاح نشد'; end if;
 execute d;
end
$patch$;

do $patch$
declare d text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='app_recalculate_expense_allocations';
 d:=replace(d,
  'when e.allocation_method in (''residents'',''dynamic_per_resident'') then greatest(coalesce(u.resident_count,0),0)',
  'when e.allocation_method in (''residents'',''dynamic_per_resident'') then greatest(coalesce((select bm.resident_count_snapshot from public.building_memberships bm where bm.id=v_target),u.resident_count,0),0)');
 if position('resident_count_snapshot' in d)=0 then raise exception 'محاسبه قبوض بر اساس تعداد ساکن تاریخی اصلاح نشد'; end if;
 execute d;
end
$patch$;

