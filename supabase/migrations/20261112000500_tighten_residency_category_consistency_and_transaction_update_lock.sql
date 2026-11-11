-- Enforce mutually exclusive occupancy states and lock all transaction updates until confirmation.
create or replace function public.bm_residency_issues(p_building_id integer)
returns table(unit_no integer, issue text)
language sql stable security definer set search_path=public
as $$
  select u.unit_no,
    case
      when u.residency_status='pending' then 'وضعیت سکونت تعیین نشده است'
      when u.residency_status='owner_occupied' and not exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک ساکن') then 'حساب فعال مالک ساکن ثبت نشده است'
      when u.residency_status='owner_occupied' and exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مستأجر') then 'این واحد هم‌زمان حساب مستأجر فعال دارد؛ وضعیت سکونت را اصلاح کنید'
      when u.residency_status='tenant_occupied' and not exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک') then 'حساب مالک غیرساکن ثبت نشده است'
      when u.residency_status='tenant_occupied' and not exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مستأجر') then 'حساب مستأجر ثبت نشده است'
      when u.residency_status='tenant_occupied' and exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک ساکن') then 'واحد دارای مستأجر، نباید حساب مالک ساکن فعال داشته باشد'
      when u.residency_status='vacant_confirmed' and not exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک') then 'برای واحد خالی باید حساب مالک غیرساکن فعال باشد'
      when u.residency_status='vacant_confirmed' and exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy in ('مستأجر','مالک ساکن')) then 'واحد خالی دارای حساب ساکن فعال است؛ وضعیت را اصلاح کنید'
      when u.residency_confirmed_by is null or u.residency_confirmed_at is null then 'تأیید مدیر برای وضعیت این واحد ثبت نشده است'
      else null end
  from public.units u
  where u.building_id=p_building_id and (
    u.residency_status='pending'
    or (u.residency_status='owner_occupied' and (not exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک ساکن') or exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مستأجر')))
    or (u.residency_status='tenant_occupied' and (not exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک') or not exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مستأجر') or exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک ساکن')))
    or (u.residency_status='vacant_confirmed' and (not exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک') or exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy in ('مستأجر','مالک ساکن'))))
    or u.residency_confirmed_by is null or u.residency_confirmed_at is null
  ) order by u.unit_no;
$$;
revoke all on function public.bm_residency_issues(integer) from public,anon,authenticated;

drop trigger if exists trg_guard_residency_transactions on public.transactions;
create trigger trg_guard_residency_transactions before insert or update on public.transactions
for each row execute function public.bm_guard_residency_financial_write();