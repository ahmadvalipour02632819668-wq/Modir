-- Ensure the first approved account in a unit becomes its primary account.
-- Serialize approval with all building residency/account writes.
create or replace function public.app_admin_review_membership_registration(
  p_token uuid,
  p_request_id bigint,
  p_decision text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $function$
declare
  me public.accounts;
  r public.membership_registration_requests;
  v_start integer;
  v_id uuid;
  v_residency_status text;
  v_active_count integer;
  v_primary_count integer;
  v_make_primary boolean;
begin
  me := public.bm_admin(p_token);

  if p_decision not in ('approve','reject') then
    return jsonb_build_object('ok',false,'error','تصمیم نامعتبر است');
  end if;

  select * into r
    from public.membership_registration_requests
   where id=p_request_id
     and building_id=me.building_id
     and status='pending'
   for update;

  if not found then
    return jsonb_build_object('ok',false,'error','درخواست پیدا نشد یا قبلاً بررسی شده است');
  end if;

  if p_decision='reject' then
    update public.membership_registration_requests
       set status='rejected',reviewed_at=now(),reviewed_by=me.id
     where id=r.id;
    return jsonb_build_object('ok',true,'status','rejected');
  end if;

  perform pg_advisory_xact_lock(hashtextextended('membership:'||r.building_id::text||':'||r.unit_no::text,0));
  perform pg_advisory_xact_lock(hashtextextended('building-residency:'||me.building_id::text,0));

  if exists(select 1 from public.superadmin_accounts where lower(username)=lower(r.username))
     or exists(select 1 from public.accounts where lower(username)=lower(r.username)) then
    return jsonb_build_object('ok',false,'error','این نام کاربری در این فاصله استفاده شده است');
  end if;

  if (r.occupancy='مالک ساکن' and exists(select 1 from public.accounts where building_id=me.building_id and unit_no=r.unit_no))
     or (r.occupancy='مالک' and exists(select 1 from public.accounts where building_id=me.building_id and unit_no=r.unit_no and occupancy in ('مالک','مالک ساکن')))
     or (r.occupancy='مستأجر' and exists(select 1 from public.accounts where building_id=me.building_id and unit_no=r.unit_no and occupancy in ('مستأجر','مالک ساکن'))) then
    return jsonb_build_object('ok',false,'error','شرایط ظرفیت واحد هنگام تأیید تغییر کرده است');
  end if;

  select count(*),count(*) filter(where a.is_primary)
    into v_active_count,v_primary_count
    from public.accounts a
   where a.building_id=me.building_id
     and a.unit_no=r.unit_no
     and a.is_active;

  if v_active_count=0 then
    v_make_primary := true;
  elsif v_primary_count=1 then
    v_make_primary := false;
  else
    return jsonb_build_object('ok',false,'error','ابتدا حساب اصلی این واحد را مشخص کنید؛ سپس درخواست را تأیید کنید');
  end if;

  v_start:=substring(r.start_date_jalali from 1 for 4)::integer*100
           +substring(r.start_date_jalali from 6 for 2)::integer;

  insert into public.accounts(
    username,password_hash,unit_no,full_name,phone,email,occupancy,is_admin,
    is_primary,is_active,must_change_password,start_ym,building_id,role,start_date_jalali
  )
  values(
    r.username,r.password_hash,r.unit_no,r.full_name,r.phone,r.email,r.occupancy,
    false,v_make_primary,true,true,v_start,me.building_id,
    case when r.occupancy='مستأجر' then 'tenant'
         when r.occupancy='مالک' then 'owner'
         else 'resident_owner' end,
    r.start_date_jalali
  )
  returning id into v_id;

  update public.units
     set area=r.area,
         persons=case when r.persons is not null then r.persons else persons end,
         occupancy=case when r.occupancy='مالک ساکن' then 'مالک ساکن'
                        when r.occupancy='مستأجر' and occupancy='مالک' then 'مالک'
                        else r.occupancy end,
         updated_at=now()
   where building_id=me.building_id and unit_no=r.unit_no;

  update public.membership_registration_requests
     set status='approved',reviewed_at=now(),reviewed_by=me.id
   where id=r.id;

  select case
    when exists(select 1 from public.accounts where building_id=me.building_id and unit_no=r.unit_no and is_active and occupancy='مستأجر')
     and exists(select 1 from public.accounts where building_id=me.building_id and unit_no=r.unit_no and is_active and occupancy='مالک')
      then 'tenant_occupied'
    when exists(select 1 from public.accounts where building_id=me.building_id and unit_no=r.unit_no and is_active and occupancy='مالک ساکن')
      then 'owner_occupied'
    else 'pending'
  end into v_residency_status;

  update public.units
     set residency_status=v_residency_status,
         occupancy=case v_residency_status when 'tenant_occupied' then 'مستأجر'
                                            when 'owner_occupied' then 'مالک ساکن'
                                            else 'مالک' end,
         residency_confirmed_by=case when v_residency_status='pending' then null else me.id end,
         residency_confirmed_at=case when v_residency_status='pending' then null else now() end,
         updated_at=now()
   where building_id=me.building_id and unit_no=r.unit_no;

  return jsonb_build_object('ok',true,'account_id',v_id,'status','approved','residency_status',v_residency_status);
end
$function$;
