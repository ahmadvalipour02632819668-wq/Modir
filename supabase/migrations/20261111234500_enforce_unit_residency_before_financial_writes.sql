-- Requires all units to have an explicit, manager-confirmed occupancy state before financial writes.
alter table public.units
  add column if not exists residency_status text not null default 'pending',
  add column if not exists residency_confirmed_at timestamptz,
  add column if not exists residency_confirmed_by uuid;

do $$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.units'::regclass and conname='units_residency_status_check') then
    alter table public.units add constraint units_residency_status_check
      check (residency_status in ('pending','owner_occupied','tenant_occupied','vacant_confirmed'));
  end if;
end $$;

update public.units u
set residency_status = case
  when exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک ساکن') then 'owner_occupied'
  when exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک')
   and exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مستأجر') then 'tenant_occupied'
  else 'pending' end,
  residency_confirmed_at = case
    when exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک ساکن')
      or (exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک')
      and exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مستأجر'))
    then coalesce(u.residency_confirmed_at,now()) else null end;

create or replace function public.bm_residency_issues(p_building_id integer)
returns table(unit_no integer, issue text)
language sql stable security definer set search_path=public
as $$
  select u.unit_no,
    case
      when u.residency_status='pending' then 'وضعیت سکونت تعیین نشده است'
      when u.residency_status='owner_occupied' and not exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک ساکن') then 'حساب فعال مالک ساکن ثبت نشده است'
      when u.residency_status='tenant_occupied' and not exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک') then 'حساب مالک غیرساکن ثبت نشده است'
      when u.residency_status='tenant_occupied' and not exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مستأجر') then 'حساب مستأجر ثبت نشده است'
      when u.residency_status='vacant_confirmed' and not exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک') then 'برای واحد خالی باید حساب مالک غیرساکن فعال باشد'
      when u.residency_status='vacant_confirmed' and exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مستأجر') then 'واحد خالی دارای حساب مستأجر فعال است؛ وضعیت را اصلاح کنید'
      else null end
  from public.units u
  where u.building_id=p_building_id and (
    u.residency_status='pending'
    or (u.residency_status='owner_occupied' and not exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک ساکن'))
    or (u.residency_status='tenant_occupied' and (not exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک') or not exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مستأجر')))
    or (u.residency_status='vacant_confirmed' and (not exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مالک') or exists (select 1 from public.accounts a where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active and a.occupancy='مستأجر')))
  ) order by u.unit_no;
$$;

create or replace function public.bm_assert_building_residency_complete(p_building_id integer)
returns void language plpgsql stable security definer set search_path=public
as $$
declare v_units text;
begin
  select string_agg('واحد '||x.unit_no::text||': '||x.issue, '، ' order by x.unit_no) into v_units
  from public.bm_residency_issues(p_building_id) x;
  if v_units is not null then
    raise exception 'تا زمان تعیین تکلیف و تأیید وضعیت سکونت تمام واحدها، ثبت تراکنش مالی مجاز نیست. موارد باقی‌مانده: %',v_units;
  end if;
  if not exists(select 1 from public.units where building_id=p_building_id) then
    raise exception 'ابتدا واحدهای ساختمان را ثبت کنید؛ تا آن زمان ثبت تراکنش مالی مجاز نیست';
  end if;
end;
$$;

create or replace function public.app_admin_set_unit_residency(p_token uuid,p_unit_no integer,p_residency_status text)
returns jsonb language plpgsql security definer set search_path=public
as $$
declare me public.accounts; v_issue text;
begin
  me:=public.bm_admin(p_token);
  if p_residency_status not in ('owner_occupied','tenant_occupied','vacant_confirmed') then raise exception 'وضعیت سکونت انتخاب‌شده معتبر نیست'; end if;
  update public.units set residency_status=p_residency_status,residency_confirmed_at=now(),residency_confirmed_by=me.id,updated_at=now()
  where building_id=me.building_id and unit_no=p_unit_no;
  if not found then raise exception 'واحد موردنظر پیدا نشد'; end if;
  select issue into v_issue from public.bm_residency_issues(me.building_id) where unit_no=p_unit_no limit 1;
  if v_issue is not null then raise exception 'امکان تأیید این وضعیت وجود ندارد: %',v_issue; end if;
  return jsonb_build_object('ok',true,'unit_no',p_unit_no,'residency_status',p_residency_status);
end;
$$;

create or replace function public.app_get_units(p_token uuid)
returns jsonb language plpgsql stable security definer set search_path=public
as $function$
declare me public.accounts;
begin
  me:=public.bm_auth(p_token);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'unit_no',u.unit_no,'persons',u.persons,'area',u.area,'occupancy',u.occupancy,
      'has_parking',u.has_parking,'notes',u.notes,'residency_status',u.residency_status,
      'residency_confirmed_at',u.residency_confirmed_at,
      'residency_issue',(select i.issue from public.bm_residency_issues(me.building_id) i where i.unit_no=u.unit_no limit 1),
      'exemptions',coalesce((select jsonb_agg(e.category) from public.exemptions e where e.building_id=me.building_id and e.unit_no=u.unit_no),'[]'::jsonb),
      'accounts',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',a.id,'username',a.username,'full_name',a.full_name,'phone',a.phone,'email',a.email,
          'occupancy',a.occupancy,'is_admin',a.is_admin,'start_ym',a.start_ym,
          'start_date_jalali',a.start_date_jalali,'exit_date_jalali',a.exit_date_jalali,
          'is_primary',a.is_primary,'is_active',a.is_active,
          'must_change_password',a.must_change_password,'updated_at',a.updated_at
        ) order by a.is_primary desc,a.occupancy)
        from public.accounts a where a.building_id=me.building_id and a.unit_no=u.unit_no and (me.is_admin or a.id=me.id)
      ),'[]'::jsonb)
    ) order by u.unit_no)
    from public.units u where u.building_id=me.building_id and (me.is_admin or u.unit_no=me.unit_no)
  ),'[]'::jsonb);
end
$function$;

create or replace function public.bm_guard_residency_financial_write()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
  perform public.bm_assert_building_residency_complete(new.building_id);
  return new;
end;
$$;

drop trigger if exists trg_guard_residency_transactions on public.transactions;
create trigger trg_guard_residency_transactions
before insert or update of year,month,day,unit_no,tx_type,amount,category,expense_scope,expense_kind,allocation_method,payer_occupancies,excluded_units,expense_shares,bill_period_start,bill_period_end
on public.transactions for each row execute function public.bm_guard_residency_financial_write();

drop trigger if exists trg_guard_residency_payment_requests on public.payment_requests;
create trigger trg_guard_residency_payment_requests
before insert on public.payment_requests for each row execute function public.bm_guard_residency_financial_write();

revoke all on function public.bm_residency_issues(integer) from public;
revoke all on function public.bm_assert_building_residency_complete(integer) from public;
revoke all on function public.bm_guard_residency_financial_write() from public;
revoke all on function public.app_admin_set_unit_residency(uuid,integer,text) from public;
grant execute on function public.app_admin_set_unit_residency(uuid,integer,text) to anon,authenticated;
