create or replace function public.app_submit_member_registration(
 p_building_id integer,p_unit_no integer,p_occupancy text,p_username text,p_password text,
 p_full_name text,p_phone text,p_email text,p_area numeric,p_persons integer,p_start_date_jalali text
) returns jsonb
language plpgsql security definer
set search_path to 'pg_catalog','public','extensions'
as $function$
declare v_id bigint; v_units integer;
begin
 if p_occupancy not in ('مالک ساکن','مالک','مستأجر') then
  return jsonb_build_object('ok',false,'error','نوع ثبت‌نام نامعتبر است');
 end if;
 if p_username !~ '^[A-Za-z][A-Za-z0-9_]{2,31}$' or p_password !~ '^[0-9]{4,8}$' then
  return jsonb_build_object('ok',false,'error','نام کاربری یا رمز عبور با قواعد سامانه مطابقت ندارد');
 end if;
 if coalesce(trim(p_full_name),'')='' or coalesce(trim(p_phone),'')='' or coalesce(trim(p_email),'')=''
  or trim(p_email) !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  or coalesce(p_area,0)<=0
  or p_start_date_jalali !~ '^[0-9]{4}/(0[1-9]|1[0-2])/([0-2][0-9]|3[01])$' then
  return jsonb_build_object('ok',false,'error','اطلاعات ضروری یا تاریخ شمسی معتبر نیست');
 end if;
 if p_occupancy<>'مالک' and coalesce(p_persons,0) not between 1 and 30 then
  return jsonb_build_object('ok',false,'error','تعداد ساکنان باید بین ۱ تا ۳۰ نفر باشد');
 end if;
 if p_building_id is null or p_unit_no is null then
  return jsonb_build_object('ok',false,'error','ساختمان و شماره واحد الزامی است');
 end if;
 select count(*) into v_units from public.units where building_id=p_building_id;
 if not exists(select 1 from public.buildings where id=p_building_id and status='active')
  or p_unit_no not between 1 and v_units then
  return jsonb_build_object('ok',false,'error','ساختمان یا شماره واحد معتبر نیست');
 end if;

 perform pg_advisory_xact_lock(hashtextextended(lower(p_username),0));
 if exists(select 1 from public.superadmin_accounts where lower(username)=lower(p_username))
  or exists(select 1 from public.accounts where lower(username)=lower(p_username))
  or exists(select 1 from public.registration_requests where lower(username)=lower(p_username) and status='pending')
  or exists(select 1 from public.membership_registration_requests where lower(username)=lower(p_username) and status='pending') then
  return jsonb_build_object('ok',false,'error','این نام کاربری قبلاً استفاده شده یا در انتظار تأیید است');
 end if;

 perform pg_advisory_xact_lock(hashtextextended('membership:'||p_building_id::text||':'||p_unit_no::text,0));
 if (p_occupancy='مالک ساکن' and exists(select 1 from public.accounts where building_id=p_building_id and unit_no=p_unit_no))
  or (p_occupancy='مالک' and exists(select 1 from public.accounts where building_id=p_building_id and unit_no=p_unit_no and occupancy in ('مالک','مالک ساکن')))
  or (p_occupancy='مستأجر' and exists(select 1 from public.accounts where building_id=p_building_id and unit_no=p_unit_no and occupancy in ('مستأجر','مالک ساکن'))) then
  return jsonb_build_object('ok',false,'error','با توجه به ترکیب مالک و مستأجر موجود در این واحد، این ثبت‌نام مجاز نیست');
 end if;
 if (p_occupancy='مالک ساکن' and exists(select 1 from public.membership_registration_requests where building_id=p_building_id and unit_no=p_unit_no and status='pending'))
  or (p_occupancy='مالک' and exists(select 1 from public.membership_registration_requests where building_id=p_building_id and unit_no=p_unit_no and status='pending' and occupancy in ('مالک','مالک ساکن')))
  or (p_occupancy='مستأجر' and exists(select 1 from public.membership_registration_requests where building_id=p_building_id and unit_no=p_unit_no and status='pending' and occupancy in ('مستأجر','مالک ساکن'))) then
  return jsonb_build_object('ok',false,'error','برای این واحد درخواست متعارضی در انتظار بررسی است');
 end if;

 insert into public.membership_registration_requests(building_id,unit_no,occupancy,username,password_hash,full_name,phone,email,area,persons,start_date_jalali)
 values(p_building_id,p_unit_no,p_occupancy,trim(p_username),extensions.crypt(p_password,extensions.gen_salt('bf')),
  trim(p_full_name),nullif(trim(p_phone),''),nullif(trim(p_email),''),p_area,
  case when p_occupancy='مالک' then null else p_persons end,p_start_date_jalali)
 returning id into v_id;
 return jsonb_build_object('ok',true,'request_id',v_id,'message','درخواست عضویت برای تأیید مدیر ساختمان ارسال شد');
end
$function$;

create or replace function public.app_admin_review_membership_registration(p_token uuid,p_request_id bigint,p_decision text)
returns jsonb
language plpgsql security definer
set search_path to 'public','extensions'
as $function$
declare me public.accounts; r public.membership_registration_requests; v_start integer; v_id uuid;
begin
 me:=public.bm_admin(p_token);
 if p_decision not in ('approve','reject') then return jsonb_build_object('ok',false,'error','تصمیم نامعتبر است'); end if;
 select * into r from public.membership_registration_requests
 where id=p_request_id and building_id=me.building_id and status='pending' for update;
 if not found then return jsonb_build_object('ok',false,'error','درخواست پیدا نشد یا قبلاً بررسی شده است'); end if;
 if p_decision='reject' then
  update public.membership_registration_requests set status='rejected',reviewed_at=now(),reviewed_by=me.id where id=r.id;
  return jsonb_build_object('ok',true,'status','rejected');
 end if;
 perform pg_advisory_xact_lock(hashtextextended('membership:'||r.building_id::text||':'||r.unit_no::text,0));
 if exists(select 1 from public.superadmin_accounts where lower(username)=lower(r.username))
  or exists(select 1 from public.accounts where lower(username)=lower(r.username)) then
  return jsonb_build_object('ok',false,'error','این نام کاربری در این فاصله استفاده شده است');
 end if;
 if (r.occupancy='مالک ساکن' and exists(select 1 from public.accounts where building_id=me.building_id and unit_no=r.unit_no))
  or (r.occupancy='مالک' and exists(select 1 from public.accounts where building_id=me.building_id and unit_no=r.unit_no and occupancy in ('مالک','مالک ساکن')))
  or (r.occupancy='مستأجر' and exists(select 1 from public.accounts where building_id=me.building_id and unit_no=r.unit_no and occupancy in ('مستأجر','مالک ساکن'))) then
  return jsonb_build_object('ok',false,'error','شرایط ظرفیت واحد هنگام تأیید تغییر کرده است');
 end if;
 v_start:=substring(r.start_date_jalali from 1 for 4)::integer*100+substring(r.start_date_jalali from 6 for 2)::integer;
 insert into public.accounts(username,password_hash,unit_no,full_name,phone,email,occupancy,is_admin,is_primary,is_active,must_change_password,start_ym,building_id,role,start_date_jalali)
 values(r.username,r.password_hash,r.unit_no,r.full_name,r.phone,r.email,r.occupancy,false,r.occupancy='مالک ساکن',true,true,v_start,me.building_id,
  case when r.occupancy='مستأجر' then 'tenant' when r.occupancy='مالک' then 'owner' else 'resident_owner' end,r.start_date_jalali)
 returning id into v_id;
 update public.units set area=r.area,persons=case when r.persons is not null then r.persons else persons end,
  occupancy=case when r.occupancy='مالک ساکن' then 'مالک ساکن' when r.occupancy='مستأجر' and occupancy='مالک' then 'مالک' else r.occupancy end,
  updated_at=now()
 where building_id=me.building_id and unit_no=r.unit_no;
 update public.membership_registration_requests set status='approved',reviewed_at=now(),reviewed_by=me.id where id=r.id;
 return jsonb_build_object('ok',true,'account_id',v_id,'status','approved');
end
$function$;
