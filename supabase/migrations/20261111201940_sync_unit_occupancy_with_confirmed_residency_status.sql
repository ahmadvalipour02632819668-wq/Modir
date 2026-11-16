-- Keep the legacy occupancy field aligned with the manager-confirmed residency category.
create or replace function public.app_admin_set_unit_residency(p_token uuid,p_unit_no integer,p_residency_status text)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare me public.accounts; v_issue text; v_occupancy text;
begin
  me:=public.bm_admin(p_token);
  if p_residency_status not in ('owner_occupied','tenant_occupied','vacant_confirmed') then raise exception 'وضعیت سکونت انتخاب‌شده معتبر نیست'; end if;
  v_occupancy:=case p_residency_status when 'owner_occupied' then 'مالک ساکن' when 'tenant_occupied' then 'مستأجر' when 'vacant_confirmed' then 'مالک' end;
  update public.units set residency_status=p_residency_status,occupancy=v_occupancy,residency_confirmed_at=now(),residency_confirmed_by=me.id,updated_at=now()
  where building_id=me.building_id and unit_no=p_unit_no;
  if not found then raise exception 'واحد موردنظر پیدا نشد'; end if;
  select issue into v_issue from public.bm_residency_issues(me.building_id) where unit_no=p_unit_no limit 1;
  if v_issue is not null then raise exception 'امکان تأیید این وضعیت وجود ندارد: %',v_issue; end if;
  return jsonb_build_object('ok',true,'unit_no',p_unit_no,'residency_status',p_residency_status);
end;
$$;

create or replace function public.bm_residency_issues(p_building_id integer)
returns table(unit_no integer,issue text)
language sql stable security definer set search_path=public
as $$
  select u.unit_no,case
    when u.residency_status='pending' then 'وضعیت سکونت تعیین نشده است'
    when u.residency_status='owner_occupied' and u.occupancy<>'مالک ساکن' then 'نوع سکونت واحد با وضعیت تأییدشده هم‌خوانی ندارد'
    when u.residency_status='owner_occupied' and not exists(select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک ساکن') then 'حساب فعال مالک ساکن ثبت نشده است'
    when u.residency_status='owner_occupied' and exists(select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مستأجر') then 'این واحد هم‌زمان حساب مستأجر فعال دارد؛ وضعیت سکونت را اصلاح کنید'
    when u.residency_status='tenant_occupied' and u.occupancy<>'مستأجر' then 'نوع سکونت واحد با وضعیت تأییدشده هم‌خوانی ندارد'
    when u.residency_status='tenant_occupied' and not exists(select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک') then 'حساب مالک غیرساکن ثبت نشده است'
    when u.residency_status='tenant_occupied' and not exists(select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مستأجر') then 'حساب مستأجر ثبت نشده است'
    when u.residency_status='tenant_occupied' and exists(select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک ساکن') then 'واحد دارای مستأجر، نباید حساب مالک ساکن فعال داشته باشد'
    when u.residency_status='vacant_confirmed' and u.occupancy<>'مالک' then 'نوع سکونت واحد با وضعیت تأییدشده هم‌خوانی ندارد'
    when u.residency_status='vacant_confirmed' and not exists(select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک') then 'برای واحد خالی باید حساب مالک غیرساکن فعال باشد'
    when u.residency_status='vacant_confirmed' and exists(select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy in ('مستأجر','مالک ساکن')) then 'واحد خالی دارای حساب ساکن فعال است؛ وضعیت را اصلاح کنید'
    when u.residency_confirmed_by is null or u.residency_confirmed_at is null then 'تأیید مدیر برای وضعیت این واحد ثبت نشده است'
    else null end
  from public.units u where u.building_id=p_building_id and (
    u.residency_status='pending'
    or (u.residency_status='owner_occupied' and (u.occupancy<>'مالک ساکن' or not exists(select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک ساکن') or exists(select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مستأجر')))
    or (u.residency_status='tenant_occupied' and (u.occupancy<>'مستأجر' or not exists(select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک') or not exists(select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مستأجر') or exists(select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک ساکن')))
    or (u.residency_status='vacant_confirmed' and (u.occupancy<>'مالک' or not exists(select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک') or exists(select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy in ('مستأجر','مالک ساکن'))))
    or u.residency_confirmed_by is null or u.residency_confirmed_at is null
  ) order by u.unit_no;
$$;
revoke all on function public.bm_residency_issues(integer) from public,anon,authenticated;
revoke all on function public.app_admin_set_unit_residency(uuid,integer,text) from public;
grant execute on function public.app_admin_set_unit_residency(uuid,integer,text) to anon,authenticated;