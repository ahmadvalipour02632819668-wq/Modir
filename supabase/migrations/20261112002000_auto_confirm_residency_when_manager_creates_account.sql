create or replace function public.app_admin_create_account(
 p_token uuid, p_unit_no integer, p_occupancy text, p_username text, p_password text,
 p_full_name text, p_phone text, p_email text, p_area numeric, p_persons integer,
 p_start_date_jalali text
) returns jsonb
language plpgsql
security definer
set search_path to 'public','extensions'
as $function$
declare
 me public.accounts;
 u public.units;
 v_id uuid;
 v_start integer;
 v_residency_status text;
begin
 me:=public.bm_admin(p_token);
 if p_occupancy not in ('مالک ساکن','مالک','مستأجر') then raise exception 'نوع عضویت نامعتبر است'; end if;
 if p_username !~ '^[A-Za-z][A-Za-z0-9_]{2,31}$' then raise exception 'نام کاربری باید با حروف انگلیسی شروع شود و فقط شامل حروف، اعداد و زیرخط باشد'; end if;
 if p_password !~ '^[0-9]{4,8}$' then raise exception 'رمز عبور باید ۴ تا ۸ رقم باشد'; end if;
 if coalesce(trim(p_full_name),'')='' or coalesce(trim(p_phone),'')='' or coalesce(p_area,0)<=0 then raise exception 'نام، موبایل و متراژ الزامی است'; end if;
 if p_occupancy <> 'مالک' and coalesce(p_persons,0) not between 1 and 30 then raise exception 'تعداد نفرات باید بین ۱ تا ۳۰ باشد'; end if;
 if p_start_date_jalali !~ '^[0-9]{4}/(0[1-9]|1[0-2])/([0-2][0-9]|3[01])$' then raise exception 'تاریخ شمسی معتبر نیست'; end if;
 perform pg_advisory_xact_lock(hashtextextended('membership:'||me.building_id::text||':'||p_unit_no::text,0));
 select * into u from public.units where building_id=me.building_id and unit_no=p_unit_no for update;
 if not found then raise exception 'واحد انتخاب‌شده وجود ندارد'; end if;
 if exists(select 1 from public.superadmin_accounts where lower(username)=lower(p_username)) or exists(select 1 from public.accounts where lower(username)=lower(p_username)) then raise exception 'این نام کاربری قبلاً استفاده شده است'; end if;
 if (p_occupancy='مالک ساکن' and exists(select 1 from public.accounts where building_id=me.building_id and unit_no=p_unit_no and is_active))
  or (p_occupancy='مالک' and exists(select 1 from public.accounts where building_id=me.building_id and unit_no=p_unit_no and is_active and occupancy in ('مالک','مالک ساکن')))
  or (p_occupancy='مستأجر' and exists(select 1 from public.accounts where building_id=me.building_id and unit_no=p_unit_no and is_active and occupancy in ('مستأجر','مالک ساکن'))) then
  raise exception 'با توجه به ترکیب مالک و مستأجر موجود در این واحد، افزودن این عضویت مجاز نیست';
 end if;
 if (p_occupancy='مالک ساکن' and exists(select 1 from public.membership_registration_requests where building_id=me.building_id and unit_no=p_unit_no and status='pending'))
  or (p_occupancy='مالک' and exists(select 1 from public.membership_registration_requests where building_id=me.building_id and unit_no=p_unit_no and status='pending' and occupancy in ('مالک','مالک ساکن')))
  or (p_occupancy='مستأجر' and exists(select 1 from public.membership_registration_requests where building_id=me.building_id and unit_no=p_unit_no and status='pending' and occupancy in ('مستأجر','مالک ساکن'))) then
  raise exception 'برای این واحد درخواست ثبت‌نام متعارضی در انتظار بررسی است';
 end if;
 v_start:=substring(p_start_date_jalali from 1 for 4)::integer*100+substring(p_start_date_jalali from 6 for 2)::integer;
 insert into public.accounts(username,password_hash,unit_no,full_name,phone,email,occupancy,is_admin,is_primary,is_active,must_change_password,start_ym,building_id,role,start_date_jalali,persons_at_start)
 values(trim(p_username),extensions.crypt(p_password,extensions.gen_salt('bf')),p_unit_no,trim(p_full_name),trim(p_phone),nullif(trim(p_email),''),p_occupancy,false,p_occupancy='مالک ساکن',true,true,v_start,me.building_id,
 case when p_occupancy='مستأجر' then 'tenant' when p_occupancy='مالک' then 'owner' else 'resident_owner' end,p_start_date_jalali,case when p_occupancy='مالک' then 0 else p_persons end)
 returning id into v_id;
 update public.units set area=p_area,persons=case when p_occupancy='مالک' then 0 when p_persons is not null then p_persons else persons end,
 occupancy=case when p_occupancy='مالک ساکن' then 'مالک ساکن' when p_occupancy='مستأجر' and occupancy='مالک' then 'مالک' else p_occupancy end,
 updated_at=now()
 where building_id=me.building_id and unit_no=p_unit_no;

 -- Manager-created membership is the manager's recorded confirmation of the unit's occupancy.
 select case
   when exists(select 1 from public.accounts where building_id=me.building_id and unit_no=p_unit_no and is_active and occupancy='مستأجر')
        and exists(select 1 from public.accounts where building_id=me.building_id and unit_no=p_unit_no and is_active and occupancy='مالک')
     then 'tenant_occupied'
   when exists(select 1 from public.accounts where building_id=me.building_id and unit_no=p_unit_no and is_active and occupancy='مالک ساکن')
     then 'owner_occupied'
   when exists(select 1 from public.accounts where building_id=me.building_id and unit_no=p_unit_no and is_active and occupancy='مالک')
     then 'vacant_confirmed'
   else 'pending'
 end into v_residency_status;

 update public.units
    set residency_status=v_residency_status,
        residency_confirmed_by=case when v_residency_status='pending' then null else me.id end,
        residency_confirmed_at=case when v_residency_status='pending' then null else now() end,
        updated_at=now()
  where building_id=me.building_id and unit_no=p_unit_no;

 return jsonb_build_object('ok',true,'account_id',v_id,'residency_status',v_residency_status);
end;
$function$;
