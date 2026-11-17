begin;
create or replace function public.app_manager_add_unit_and_resident(p_token uuid,p_building_id uuid,p_unit_no integer,p_area numeric,p_resident_count integer,p_full_name text,p_username text,p_password text,p_occupancy text,p_phone text,p_email text,p_joined_at date) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_unit_id uuid; v_account_id uuid; v_member_id uuid; v_limit integer;
begin
 perform public.app_financial_v2_require_manager(p_token,p_building_id);
 select b.unit_count into v_limit from public.buildings b where b.id=p_building_id and b.building_status='active' for update; if not found then raise exception 'ساختمان فعال پیدا نشد'; end if;
 if p_unit_no is null or p_unit_no<1 or p_unit_no>v_limit then raise exception 'شماره واحد نامعتبر است'; end if;
 select u.id into v_unit_id from public.units u where u.building_id=p_building_id and u.unit_no=p_unit_no for update; if v_unit_id is null then raise exception 'این واحد در ساختار ثابت ساختمان وجود ندارد'; end if;
 if p_area is null or p_area<=0 or p_resident_count is null or p_resident_count<1 then raise exception 'متراژ و تعداد ساکنین نامعتبر است'; end if;
 if p_occupancy not in ('owner','owner_resident','tenant') then raise exception 'نوع سکونت نامعتبر است'; end if;
 if p_joined_at is null or p_joined_at>current_date then raise exception 'تاریخ شروع نامعتبر است'; end if;
 if exists(select 1 from public.app_accounts where lower(username)=lower(btrim(p_username))) then raise exception 'نام کاربری تکراری است'; end if;
 if p_occupancy in ('owner','owner_resident') and exists(select 1 from public.building_memberships bm where bm.unit_id=v_unit_id and bm.membership_status='active' and bm.resident_type in ('owner','owner_resident')) then raise exception 'این واحد قبلاً مالک فعال دارد'; end if;
 if p_occupancy='tenant' and exists(select 1 from public.building_memberships bm where bm.unit_id=v_unit_id and bm.membership_status='active' and bm.resident_type='tenant') then raise exception 'این واحد قبلاً مستأجر فعال دارد'; end if;
 if p_occupancy='tenant' and exists(select 1 from public.building_memberships bm where bm.unit_id=v_unit_id and bm.membership_status='active' and bm.resident_type='owner_resident') then raise exception 'واحد دارای مالک ساکن فعال است'; end if;
 if p_occupancy='owner_resident' and exists(select 1 from public.building_memberships bm where bm.unit_id=v_unit_id and bm.membership_status='active' and bm.resident_type='tenant') then raise exception 'واحد دارای مستأجر فعال است'; end if;
 update public.units set area=p_area,resident_count=p_resident_count where id=v_unit_id;
 insert into public.app_accounts(username,password_hash,full_name,phone,email,account_status,must_change_password) values(btrim(p_username),extensions.crypt(p_password,extensions.gen_salt('bf')),btrim(p_full_name),nullif(btrim(p_phone),''),nullif(btrim(p_email),''),'active',true) returning id into v_account_id;
 insert into public.building_memberships(building_id,account_id,unit_id,access_role,resident_type,membership_status,joined_at) values(p_building_id,v_account_id,v_unit_id,'resident',p_occupancy,'active',p_joined_at) returning id into v_member_id;
 perform public.app_recalculate_expense_allocations(p_token,p_building_id);
 return jsonb_build_object('success',true,'unit_id',v_unit_id,'membership_id',v_member_id);
end; $$;

create or replace function public.app_manager_review_resident_request(p_token uuid,p_request_id uuid,p_approve boolean,p_review_note text default null,p_join_date date default current_date,p_opening_debt numeric default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.registration_requests; actor uuid; v_unit_id uuid; v_account_id uuid; v_member_id uuid;
begin
 select * into r from public.registration_requests rr where rr.id=p_request_id for update; if not found or r.request_status<>'pending' then raise exception 'درخواست معتبر نیست'; end if;
 actor:=public.app_financial_v2_require_manager(p_token,r.building_id);
 if not p_approve then update public.registration_requests set request_status='rejected',review_note=p_review_note,reviewed_by=actor,reviewed_at=now() where id=r.id; return jsonb_build_object('success',true); end if;
 if p_join_date is null or p_join_date>current_date or p_opening_debt<0 then raise exception 'تاریخ شروع یا بدهی اولیه نامعتبر است'; end if;
 if exists(select 1 from public.app_accounts where lower(username)=lower(r.username)) then raise exception 'نام کاربری قبلاً استفاده شده است'; end if;
 select u.id into v_unit_id from public.units u where u.building_id=r.building_id and u.unit_no=r.unit_no for update; if v_unit_id is null then raise exception 'واحد انتخاب‌شده در ساختار ساختمان وجود ندارد'; end if;
 if r.area is null or r.area<=0 then raise exception 'متراژ واحد نامعتبر است'; end if;
 if r.requested_role in ('owner','owner_resident') and exists(select 1 from public.building_memberships bm where bm.unit_id=v_unit_id and bm.membership_status='active' and bm.resident_type in ('owner','owner_resident')) then raise exception 'این واحد قبلاً مالک فعال دارد'; end if;
 if r.requested_role='tenant' and exists(select 1 from public.building_memberships bm where bm.unit_id=v_unit_id and bm.membership_status='active' and bm.resident_type='tenant') then raise exception 'این واحد قبلاً مستأجر فعال دارد'; end if;
 if r.requested_role='tenant' and exists(select 1 from public.building_memberships bm where bm.unit_id=v_unit_id and bm.membership_status='active' and bm.resident_type='owner_resident') then raise exception 'واحد دارای مالک ساکن فعال است'; end if;
 if r.requested_role='owner_resident' and exists(select 1 from public.building_memberships bm where bm.unit_id=v_unit_id and bm.membership_status='active' and bm.resident_type='tenant') then raise exception 'واحد دارای مستأجر فعال است'; end if;
 update public.units set area=r.area,resident_count=coalesce(r.resident_count,1) where id=v_unit_id;
 insert into public.app_accounts(username,password_hash,full_name,phone,email,account_status,must_change_password) values(r.username,r.requested_password_hash,r.full_name,r.phone,r.email,'active',true) returning id into v_account_id;
 insert into public.building_memberships(building_id,account_id,unit_id,access_role,resident_type,membership_status,joined_at,opening_debt) values(r.building_id,v_account_id,v_unit_id,'resident',r.requested_role,'active',p_join_date,p_opening_debt) returning id into v_member_id;
 update public.registration_requests set request_status='approved',reviewed_by=actor,reviewed_at=now(),review_note=p_review_note where id=r.id;
 perform public.app_recalculate_expense_allocations(p_token,r.building_id);
 return jsonb_build_object('success',true,'membership_id',v_member_id);
end; $$;
commit;
