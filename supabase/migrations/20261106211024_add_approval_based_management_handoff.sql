create table if not exists public.management_transfer_requests(
 id uuid primary key default gen_random_uuid(),
 building_id uuid not null references public.buildings(id) on delete cascade,
 requested_by_membership_id uuid not null references public.building_memberships(id),
 target_membership_id uuid not null references public.building_memberships(id),
 status text not null default 'pending' check(status in ('pending','accepted','rejected','cancelled')),
 created_at timestamptz not null default now(),
 responded_at timestamptz,
 constraint management_transfer_not_self check(requested_by_membership_id<>target_membership_id)
);
create unique index if not exists management_transfer_one_pending_per_building
 on public.management_transfer_requests(building_id) where status='pending';
create index if not exists management_transfer_target_pending_idx
 on public.management_transfer_requests(target_membership_id,status);
alter table public.management_transfer_requests enable row level security;
revoke all on public.management_transfer_requests from anon,authenticated;

create or replace function public.app_management_transfer_info(p_token uuid,p_building_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_account public.app_accounts; v_membership public.building_memberships; v_outgoing jsonb:=null; v_incoming jsonb:=null; v_candidates jsonb:='[]'::jsonb;
begin
 v_account:=public.app_require_session(p_token);
 select * into v_membership from public.building_memberships where account_id=v_account.id and building_id=p_building_id and membership_status='active' limit 1;
 if not found then raise exception 'عضویت فعال ساختمان پیدا نشد'; end if;
 if v_membership.access_role='manager' then
  select jsonb_build_object('id',r.id,'status',r.status,'created_at',r.created_at,'target_membership_id',r.target_membership_id,'target_name',coalesce(a.full_name,a.username),'target_unit',u.unit_no)
   into v_outgoing
   from public.management_transfer_requests r
   join public.building_memberships tm on tm.id=r.target_membership_id
   join public.app_accounts a on a.id=tm.account_id
   left join public.units u on u.id=tm.unit_id
   where r.building_id=p_building_id and r.requested_by_membership_id=v_membership.id and r.status='pending'
   order by r.created_at desc limit 1;
  select coalesce(jsonb_agg(jsonb_build_object('membership_id',bm.id,'account_id',bm.account_id,'full_name',coalesce(a.full_name,a.username),'username',a.username,'unit_no',u.unit_no,'resident_type',bm.resident_type) order by u.unit_no,a.full_name),'[]'::jsonb)
   into v_candidates
   from public.building_memberships bm
   join public.app_accounts a on a.id=bm.account_id
   left join public.units u on u.id=bm.unit_id
   where bm.building_id=p_building_id and bm.membership_status='active' and bm.access_role='resident' and a.account_status='active' and bm.account_id<>v_account.id;
 else
  select jsonb_build_object('id',r.id,'created_at',r.created_at,'manager_name',coalesce(a.full_name,a.username),'manager_unit',u.unit_no)
   into v_incoming
   from public.management_transfer_requests r
   join public.building_memberships mm on mm.id=r.requested_by_membership_id
   join public.app_accounts a on a.id=mm.account_id
   left join public.units u on u.id=mm.unit_id
   where r.building_id=p_building_id and r.target_membership_id=v_membership.id and r.status='pending'
   order by r.created_at desc limit 1;
 end if;
 return jsonb_build_object('is_manager',v_membership.access_role='manager','outgoing',v_outgoing,'incoming',v_incoming,'candidates',v_candidates);
end; $$;

create or replace function public.app_management_transfer_create(p_token uuid,p_building_id uuid,p_target_membership_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_manager public.building_memberships; v_target public.building_memberships; v_id uuid;
begin
 v_actor:=public.app_financial_v2_require_manager(p_token,p_building_id);
 select * into v_manager from public.building_memberships where account_id=v_actor and building_id=p_building_id and access_role='manager' and membership_status='active' for update;
 if not found then raise exception 'عضویت مدیر فعلی پیدا نشد'; end if;
 select * into v_target from public.building_memberships where id=p_target_membership_id and building_id=p_building_id and access_role='resident' and membership_status='active' for update;
 if not found or v_target.account_id=v_actor then raise exception 'جانشین انتخاب‌شده معتبر نیست'; end if;
 if not exists(select 1 from public.app_accounts where id=v_target.account_id and account_status='active') then raise exception 'حساب ساکن مقصد فعال نیست'; end if;
 insert into public.management_transfer_requests(building_id,requested_by_membership_id,target_membership_id)
 values(p_building_id,v_manager.id,v_target.id) returning id into v_id;
 return jsonb_build_object('success',true,'request_id',v_id);
exception when unique_violation then raise exception 'یک درخواست انتقال مدیریت در حال بررسی است';
end; $$;

create or replace function public.app_management_transfer_cancel(p_token uuid,p_building_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_mid uuid; v_id uuid;
begin
 v_actor:=public.app_financial_v2_require_manager(p_token,p_building_id);
 select id into v_mid from public.building_memberships where account_id=v_actor and building_id=p_building_id and access_role='manager' and membership_status='active';
 update public.management_transfer_requests set status='cancelled',responded_at=now()
 where building_id=p_building_id and requested_by_membership_id=v_mid and status='pending' returning id into v_id;
 if v_id is null then raise exception 'درخواست در حال انتظاری برای لغو وجود ندارد'; end if;
 return jsonb_build_object('success',true);
end; $$;

create or replace function public.app_management_transfer_respond(p_token uuid,p_building_id uuid,p_request_id uuid,p_accept boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_account public.app_accounts; v_target public.building_memberships; v_req public.management_transfer_requests; v_manager public.building_memberships;
begin
 v_account:=public.app_require_session(p_token);
 perform 1 from public.buildings where id=p_building_id for update;
 select * into v_target from public.building_memberships where account_id=v_account.id and building_id=p_building_id and membership_status='active' limit 1 for update;
 if not found then raise exception 'عضویت فعال مقصد پیدا نشد'; end if;
 select * into v_req from public.management_transfer_requests where id=p_request_id and building_id=p_building_id and target_membership_id=v_target.id and status='pending' for update;
 if not found then raise exception 'درخواست معتبر یا در حال انتظاری برای شما وجود ندارد'; end if;
 if v_target.access_role='manager' then raise exception 'مدیر فعلی نمی‌تواند درخواست جانشینی را بپذیرد'; end if;
 if not p_accept then
  update public.management_transfer_requests set status='rejected',responded_at=now() where id=v_req.id;
  return jsonb_build_object('success',true,'status','rejected');
 end if;
 select * into v_manager from public.building_memberships where id=v_req.requested_by_membership_id and building_id=p_building_id and access_role='manager' and membership_status='active' for update;
 if not found then raise exception 'مدیر فعلی تغییر کرده است؛ انتقال انجام نشد'; end if;
 update public.building_memberships set access_role='resident' where id=v_manager.id;
 update public.building_memberships set access_role='manager' where id=v_target.id;
 update public.buildings set current_manager_membership_id=v_target.id where id=p_building_id;
 update public.management_transfer_requests set status='accepted',responded_at=now() where id=v_req.id;
 return jsonb_build_object('success',true,'status','accepted','new_manager_membership_id',v_target.id,'old_manager_membership_id',v_manager.id);
end; $$;

revoke all on function public.app_management_transfer_info(uuid,uuid) from public;
revoke all on function public.app_management_transfer_create(uuid,uuid,uuid) from public;
revoke all on function public.app_management_transfer_cancel(uuid,uuid) from public;
revoke all on function public.app_management_transfer_respond(uuid,uuid,uuid,boolean) from public;
grant execute on function public.app_management_transfer_info(uuid,uuid) to anon,authenticated;
grant execute on function public.app_management_transfer_create(uuid,uuid,uuid) to anon,authenticated;
grant execute on function public.app_management_transfer_cancel(uuid,uuid) to anon,authenticated;
grant execute on function public.app_management_transfer_respond(uuid,uuid,uuid,boolean) to anon,authenticated;
