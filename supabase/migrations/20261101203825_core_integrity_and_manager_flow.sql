begin;

alter table public.buildings add column if not exists address text, add column if not exists floor_count integer;
alter table public.registration_requests add column if not exists new_building_address text, add column if not exists new_building_floor_count integer;

alter table public.buildings drop constraint if exists buildings_unit_count_check;
alter table public.buildings add constraint buildings_unit_count_check check (unit_count between 1 and 1000);
alter table public.buildings drop constraint if exists buildings_floor_count_check;
alter table public.buildings add constraint buildings_floor_count_check check (floor_count is null or floor_count between 1 and 200);
alter table public.units drop constraint if exists units_unit_no_check;
alter table public.units add constraint units_unit_no_check check (unit_no >= 1);
alter table public.units drop constraint if exists units_area_check;
alter table public.units add constraint units_area_check check (area is null or area > 0);
alter table public.units drop constraint if exists units_resident_count_check;
alter table public.units add constraint units_resident_count_check check (resident_count is null or resident_count >= 1);
alter table public.building_memberships drop constraint if exists memberships_date_order_check;
alter table public.building_memberships add constraint memberships_date_order_check check (ended_at is null or ended_at >= joined_at);

create unique index if not exists ux_buildings_name_ci on public.buildings (lower(name));
create unique index if not exists ux_active_owner_per_unit on public.building_memberships(unit_id) where membership_status='active' and resident_type in ('owner','owner_resident');
create unique index if not exists ux_active_tenant_per_unit on public.building_memberships(unit_id) where membership_status='active' and resident_type='tenant';
create unique index if not exists ux_active_manager_per_building on public.building_memberships(building_id) where membership_status='active' and access_role='manager';

create or replace function public.app_login(p_username text,p_password text) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_acc public.app_accounts; v_token uuid; v_memberships jsonb;
begin
 select * into v_acc from public.app_accounts where lower(username)=lower(btrim(p_username)) and account_status='active' and password_hash=extensions.crypt(p_password,password_hash);
 if not found then return jsonb_build_object('success',false,'error','نام کاربری یا رمز عبور اشتباه است'); end if;
 v_token:=gen_random_uuid();
 insert into public.app_sessions(token_hash,account_id) values(encode(extensions.digest(v_token::text,'sha256'),'hex'),v_acc.id);
 select coalesce(jsonb_agg(jsonb_build_object('membership_id',bm.id,'building_id',b.id,'building_name',b.name,'unit_no',u.unit_no,'access_role',bm.access_role,'resident_type',bm.resident_type,'membership_status',bm.membership_status,'building_status',b.building_status,'address',b.address,'floor_count',b.floor_count) order by b.created_at desc),'[]'::jsonb) into v_memberships from public.building_memberships bm join public.buildings b on b.id=bm.building_id left join public.units u on u.id=bm.unit_id where bm.account_id=v_acc.id and bm.membership_status='active';
 return jsonb_build_object('success',true,'token',v_token,'account_id',v_acc.id,'username',v_acc.username,'full_name',v_acc.full_name,'is_superadmin',v_acc.is_superadmin,'must_change_password',v_acc.must_change_password,'memberships',v_memberships);
end; $$;

create or replace function public.app_admin_review_manager_request(p_token uuid,p_request_id uuid,p_approve boolean,p_review_note text default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.app_accounts; r public.registration_requests; bid uuid; aid uuid; mid uuid; uid uuid;
begin
 v_actor:=public.app_require_session(p_token); if not v_actor.is_superadmin then raise exception 'دسترسی غیرمجاز'; end if;
 select * into r from public.registration_requests where id=p_request_id for update;
 if not found or r.request_status<>'pending' or r.requested_role<>'building_manager' then raise exception 'درخواست مدیر معتبر نیست'; end if;
 if not p_approve then update public.registration_requests set request_status='rejected',reviewed_by=v_actor.id,reviewed_at=now(),review_note=p_review_note where id=r.id; return jsonb_build_object('success',true); end if;
 if r.new_building_name is not null then
  if r.new_building_unit_count is null or r.new_building_unit_count<1 or r.new_building_unit_count>1000 then raise exception 'تعداد واحد ساختمان نامعتبر است'; end if;
  if exists(select 1 from public.buildings where lower(name)=lower(btrim(r.new_building_name))) then raise exception 'نام ساختمان تکراری است'; end if;
  insert into public.buildings(name,address,floor_count,unit_count,building_status) values(btrim(r.new_building_name),nullif(btrim(r.new_building_address),''),r.new_building_floor_count,r.new_building_unit_count,'active') returning id into bid;
  insert into public.units(building_id,unit_no,area,resident_count) select bid,g,case when g=r.unit_no then r.area else 1 end,case when g=r.unit_no then coalesce(r.resident_count,1) else 1 end from generate_series(1,r.new_building_unit_count) g;
 else
  bid:=r.building_id; if bid is null or not exists(select 1 from public.buildings where id=bid and building_status='active') then raise exception 'ساختمان معتبر پیدا نشد'; end if;
 end if;
 if exists(select 1 from public.app_accounts where lower(username)=lower(r.username)) then raise exception 'نام کاربری قبلاً استفاده شده است'; end if;
 insert into public.app_accounts(username,password_hash,full_name,phone,email,account_status) values(btrim(r.username),r.requested_password_hash,r.full_name,r.phone,r.email,'active') returning id into aid;
 if r.unit_no is not null then
  select id into uid from public.units where building_id=bid and unit_no=r.unit_no for update;
  if uid is null then raise exception 'واحد مدیر در ساختمان وجود ندارد'; end if;
  if r.area is null or r.area<=0 then raise exception 'متراژ واحد مدیر الزامی است'; end if;
  update public.units set area=r.area,resident_count=coalesce(r.resident_count,1) where id=uid;
  insert into public.building_memberships(building_id,account_id,unit_id,access_role,resident_type,membership_status,joined_at) values(bid,aid,uid,'manager','owner_resident','active',current_date) returning id into mid;
 else
  insert into public.building_memberships(building_id,account_id,access_role,resident_type,membership_status,joined_at) values(bid,aid,'manager','owner','active',current_date) returning id into mid;
 end if;
 update public.buildings set current_manager_membership_id=mid where id=bid;
 update public.registration_requests set request_status='approved',reviewed_by=v_actor.id,reviewed_at=now(),review_note=p_review_note,building_id=bid where id=r.id;
 return jsonb_build_object('success',true,'building_id',bid,'membership_id',mid);
end; $$;

create or replace function public.app_manager_add_unit_and_resident(p_token uuid,p_building_id uuid,p_unit_no integer,p_area numeric,p_resident_count integer,p_full_name text,p_username text,p_password text,p_occupancy text,p_phone text,p_email text,p_joined_at date) returns jsonb language plpgsql security definer set search_path='' as $$
declare unit_id uuid; account_id uuid; member_id uuid; lim integer;
begin
 perform public.app_financial_v2_require_manager(p_token,p_building_id);
 select unit_count into lim from public.buildings where id=p_building_id and building_status='active' for update; if not found then raise exception 'ساختمان فعال پیدا نشد'; end if;
 if p_unit_no is null or p_unit_no<1 or p_unit_no>lim then raise exception 'شماره واحد نامعتبر است'; end if;
 select id into unit_id from public.units where building_id=p_building_id and unit_no=p_unit_no for update; if unit_id is null then raise exception 'این واحد در ساختار ثابت ساختمان وجود ندارد'; end if;
 if p_area is null or p_area<=0 or p_resident_count is null or p_resident_count<1 then raise exception 'متراژ و تعداد ساکنین نامعتبر است'; end if;
 if p_occupancy not in ('owner','owner_resident','tenant') then raise exception 'نوع سکونت نامعتبر است'; end if;
 if p_joined_at is null or p_joined_at>current_date then raise exception 'تاریخ شروع نامعتبر است'; end if;
 if exists(select 1 from public.app_accounts where lower(username)=lower(btrim(p_username))) then raise exception 'نام کاربری تکراری است'; end if;
 if p_occupancy in ('owner','owner_resident') and exists(select 1 from public.building_memberships where unit_id=unit_id and membership_status='active' and resident_type in ('owner','owner_resident')) then raise exception 'این واحد قبلاً مالک فعال دارد'; end if;
 if p_occupancy='tenant' and exists(select 1 from public.building_memberships where unit_id=unit_id and membership_status='active' and resident_type='tenant') then raise exception 'این واحد قبلاً مستأجر فعال دارد'; end if;
 if p_occupancy='tenant' and exists(select 1 from public.building_memberships where unit_id=unit_id and membership_status='active' and resident_type='owner_resident') then raise exception 'واحد دارای مالک ساکن فعال است'; end if;
 if p_occupancy='owner_resident' and exists(select 1 from public.building_memberships where unit_id=unit_id and membership_status='active' and resident_type='tenant') then raise exception 'واحد دارای مستأجر فعال است'; end if;
 update public.units set area=p_area,resident_count=p_resident_count where id=unit_id;
 insert into public.app_accounts(username,password_hash,full_name,phone,email,account_status,must_change_password) values(btrim(p_username),extensions.crypt(p_password,extensions.gen_salt('bf')),btrim(p_full_name),nullif(btrim(p_phone),''),nullif(btrim(p_email),''),'active',true) returning id into account_id;
 insert into public.building_memberships(building_id,account_id,unit_id,access_role,resident_type,membership_status,joined_at) values(p_building_id,account_id,unit_id,'resident',p_occupancy,'active',p_joined_at) returning id into member_id;
 perform public.app_recalculate_expense_allocations(p_token,p_building_id);
 return jsonb_build_object('success',true,'unit_id',unit_id,'membership_id',member_id);
end; $$;

create or replace function public.app_manager_review_resident_request(p_token uuid,p_request_id uuid,p_approve boolean,p_review_note text default null,p_join_date date default current_date,p_opening_debt numeric default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.registration_requests; actor uuid; unit_id uuid; account_id uuid; member_id uuid;
begin
 select * into r from public.registration_requests where id=p_request_id for update; if not found or r.request_status<>'pending' then raise exception 'درخواست معتبر نیست'; end if;
 actor:=public.app_financial_v2_require_manager(p_token,r.building_id);
 if not p_approve then update public.registration_requests set request_status='rejected',review_note=p_review_note,reviewed_by=actor,reviewed_at=now() where id=r.id; return jsonb_build_object('success',true); end if;
 if p_join_date is null or p_join_date>current_date or p_opening_debt<0 then raise exception 'تاریخ شروع یا بدهی اولیه نامعتبر است'; end if;
 if exists(select 1 from public.app_accounts where lower(username)=lower(r.username)) then raise exception 'نام کاربری قبلاً استفاده شده است'; end if;
 select id into unit_id from public.units where building_id=r.building_id and unit_no=r.unit_no for update; if unit_id is null then raise exception 'واحد انتخاب‌شده در ساختار ساختمان وجود ندارد'; end if;
 if r.area is null or r.area<=0 then raise exception 'متراژ واحد نامعتبر است'; end if;
 if r.requested_role in ('owner','owner_resident') and exists(select 1 from public.building_memberships where unit_id=unit_id and membership_status='active' and resident_type in ('owner','owner_resident')) then raise exception 'این واحد قبلاً مالک فعال دارد'; end if;
 if r.requested_role='tenant' and exists(select 1 from public.building_memberships where unit_id=unit_id and membership_status='active' and resident_type='tenant') then raise exception 'این واحد قبلاً مستأجر فعال دارد'; end if;
 if r.requested_role='tenant' and exists(select 1 from public.building_memberships where unit_id=unit_id and membership_status='active' and resident_type='owner_resident') then raise exception 'واحد دارای مالک ساکن فعال است'; end if;
 if r.requested_role='owner_resident' and exists(select 1 from public.building_memberships where unit_id=unit_id and membership_status='active' and resident_type='tenant') then raise exception 'واحد دارای مستأجر فعال است'; end if;
 update public.units set area=r.area,resident_count=coalesce(r.resident_count,1) where id=unit_id;
 insert into public.app_accounts(username,password_hash,full_name,phone,email,account_status,must_change_password) values(r.username,r.requested_password_hash,r.full_name,r.phone,r.email,'active',true) returning id into account_id;
 insert into public.building_memberships(building_id,account_id,unit_id,access_role,resident_type,membership_status,joined_at,opening_debt) values(r.building_id,account_id,unit_id,'resident',r.requested_role,'active',p_join_date,p_opening_debt) returning id into member_id;
 update public.registration_requests set request_status='approved',reviewed_by=actor,reviewed_at=now(),review_note=p_review_note where id=r.id;
 perform public.app_recalculate_expense_allocations(p_token,r.building_id);
 return jsonb_build_object('success',true,'membership_id',member_id);
end; $$;

create or replace function public.app_manager_update_member_profile(p_token uuid,p_building_id uuid,p_membership_id uuid,p_full_name text,p_phone text,p_email text,p_resident_type text,p_resident_count integer,p_joined_at date) returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.building_memberships;
begin
 perform public.app_financial_v2_require_manager(p_token,p_building_id); select * into target from public.building_memberships where id=p_membership_id and building_id=p_building_id for update; if not found then raise exception 'عضویت در این ساختمان پیدا نشد'; end if;
 if target.access_role='manager' and p_resident_type<>'owner_resident' then raise exception 'مدیر فعلی باید مالک ساکن باقی بماند؛ ابتدا انتقال مدیریت انجام دهید'; end if;
 if p_resident_type not in ('owner','owner_resident','tenant') or p_joined_at is null or p_joined_at>current_date or p_resident_count is null or p_resident_count<1 then raise exception 'اطلاعات سکونت نامعتبر است'; end if;
 if p_resident_type in ('owner','owner_resident') and exists(select 1 from public.building_memberships where unit_id=target.unit_id and id<>target.id and membership_status='active' and resident_type in ('owner','owner_resident')) then raise exception 'این واحد مالک فعال دیگری دارد'; end if;
 if p_resident_type='tenant' and exists(select 1 from public.building_memberships where unit_id=target.unit_id and id<>target.id and membership_status='active' and resident_type='tenant') then raise exception 'این واحد مستأجر فعال دیگری دارد'; end if;
 if p_resident_type='tenant' and exists(select 1 from public.building_memberships where unit_id=target.unit_id and id<>target.id and membership_status='active' and resident_type='owner_resident') then raise exception 'واحد دارای مالک ساکن فعال است'; end if;
 update public.building_memberships set resident_type=p_resident_type,joined_at=p_joined_at where id=p_membership_id;
 update public.units set resident_count=p_resident_count where id=target.unit_id and building_id=p_building_id;
 update public.app_accounts set full_name=p_full_name,phone=p_phone,email=p_email where id=target.account_id;
 perform public.app_recalculate_expense_allocations(p_token,p_building_id); return jsonb_build_object('success',true);
end; $$;

create or replace function public.app_financial_v2_close_tenant(p_token uuid,p_building_id uuid,p_membership_id uuid,p_end_date date) returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.building_memberships; owner_id uuid; a record; paid numeric; due numeric; new_id uuid; total numeric:=0; total_paid numeric; total_alloc numeric; credit numeric;
begin
 perform public.app_financial_v2_require_manager(p_token,p_building_id); select * into t from public.building_memberships where id=p_membership_id and building_id=p_building_id for update;
 if not found or t.resident_type<>'tenant' or t.membership_status<>'active' then raise exception 'مستأجر فعال پیدا نشد'; end if;
 if p_end_date<t.joined_at::date or p_end_date>current_date then raise exception 'تاریخ خروج نامعتبر است'; end if;
 select id into owner_id from public.building_memberships where unit_id=t.unit_id and building_id=p_building_id and resident_type in ('owner','owner_resident') and membership_status='active' order by (resident_type='owner_resident') desc,joined_at desc limit 1; if owner_id is null then raise exception 'ابتدا مالک واحد را ثبت کنید'; end if;
 update public.building_memberships set ended_at=p_end_date,membership_status='inactive' where id=p_membership_id; perform public.app_recalculate_expense_allocations(p_token,p_building_id);
 for a in select ea.*,e.description from public.building_expense_allocations ea join public.building_expenses e on e.id=ea.expense_id where ea.building_id=p_building_id and ea.membership_id=p_membership_id and e.expense_status='active' loop
  select coalesce(sum(pa.amount),0) into paid from public.building_payment_allocations pa where pa.expense_allocation_id=a.id; due:=greatest(a.amount-paid,0);
  if due>0 then update public.building_expense_allocations set amount=paid where id=a.id; insert into public.building_expense_allocations(building_id,expense_id,membership_id,amount,original_membership_id,transfer_note) values(p_building_id,a.expense_id,owner_id,due,p_membership_id,'انتقال بدهی مستأجر قبلی به مالک') returning id into new_id; total:=total+due; end if;
 end loop;
 select coalesce(sum(amount),0) into total_paid from public.building_payments where building_id=p_building_id and membership_id=p_membership_id and status='approved';
 select coalesce(sum(pa.amount),0) into total_alloc from public.building_payment_allocations pa join public.building_payments p on p.id=pa.payment_id where p.building_id=p_building_id and p.membership_id=p_membership_id and p.status='approved';
 credit:=greatest(total_paid-total_alloc,0); due:=greatest(coalesce(t.opening_debt,0)-credit,0);
 if due>0 then update public.building_memberships set opening_debt=coalesce(opening_debt,0)+due where id=owner_id; update public.building_memberships set opening_debt=greatest(opening_debt-due,0) where id=p_membership_id; total:=total+due; end if;
 perform public.app_reallocate_member_payments(p_building_id,owner_id); return jsonb_build_object('success',true,'transferred_amount',total,'tenant_membership_id',p_membership_id,'owner_membership_id',owner_id);
end; $$;

create or replace function public.app_manager_delete_resident_account(p_token uuid,p_building_id uuid,p_membership_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare target public.building_memberships;
begin
 perform public.app_financial_v2_require_manager(p_token,p_building_id); select * into target from public.building_memberships where id=p_membership_id and building_id=p_building_id for update; if not found then raise exception 'عضویت در این ساختمان پیدا نشد'; end if;
 if target.access_role='manager' then raise exception 'حذف حساب مدیر از این مسیر مجاز نیست'; end if;
 update public.building_memberships set membership_status='inactive',ended_at=coalesce(ended_at,current_date) where id=p_membership_id;
 if target.account_id is not null and not exists(select 1 from public.building_memberships where account_id=target.account_id and membership_status='active') then update public.app_accounts set account_status='inactive' where id=target.account_id; delete from public.app_sessions where account_id=target.account_id; end if;
 return jsonb_build_object('success',true);
end; $$;

create or replace function public.app_submit_building_request(p_token uuid,p_building_id uuid,p_membership_id uuid,p_request_type text,p_title text,p_description text) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor public.app_accounts;
begin
 actor:=public.app_require_session(p_token); if not exists(select 1 from public.building_memberships where id=p_membership_id and building_id=p_building_id and account_id=actor.id and membership_status='active') then raise exception 'عضویت فعال برای ثبت درخواست پیدا نشد'; end if;
 if p_request_type not in ('repair','criticism','suggestion','complaint','other') then raise exception 'نوع درخواست نامعتبر است'; end if;
 if nullif(btrim(p_title),'') is null or nullif(btrim(p_description),'') is null then raise exception 'عنوان و شرح درخواست الزامی است'; end if;
 insert into public.building_requests(building_id,membership_id,request_type,title,description,request_status) values(p_building_id,p_membership_id,p_request_type,btrim(p_title),btrim(p_description),'pending'); return jsonb_build_object('success',true);
end; $$;

create or replace function public.app_manager_transfer_management(p_token uuid,p_building_id uuid,p_target_membership_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid; current_mid uuid; target public.building_memberships;
begin
 actor:=public.app_financial_v2_require_manager(p_token,p_building_id);
 select id into current_mid from public.building_memberships where account_id=actor and building_id=p_building_id and access_role='manager' and membership_status='active' for update;
 if current_mid is null then raise exception 'عضویت مدیر فعلی پیدا نشد'; end if;
 select * into target from public.building_memberships where id=p_target_membership_id and building_id=p_building_id and access_role='resident' and membership_status='active' for update;
 if not found then raise exception 'ساکن مقصد معتبر نیست'; end if;
 update public.building_memberships set access_role='resident' where id=current_mid;
 update public.building_memberships set access_role='manager' where id=target.id;
 update public.buildings set current_manager_membership_id=target.id where id=p_building_id;
 return jsonb_build_object('success',true,'new_manager_membership_id',target.id,'old_manager_membership_id',current_mid);
end; $$;

revoke execute on function public.app_manager_transfer_management(uuid,uuid,uuid) from public,authenticated,anon;
grant execute on function public.app_manager_transfer_management(uuid,uuid,uuid) to anon;
commit;
