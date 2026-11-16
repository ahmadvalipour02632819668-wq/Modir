create unique index if not exists management_transfer_one_pending_per_building_uidx
on public.management_transfer_requests (building_id)
where status='pending';

create or replace function public.app_management_transfer_create(p_token uuid, p_target_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me public.accounts;
  rid bigint;
  v_current_manager_id uuid;
begin
  me:=public.bm_admin(p_token);

  perform pg_advisory_xact_lock(hashtextextended('management-transfer:'||me.building_id::text,0));

  select current_manager_account_id
    into v_current_manager_id
    from public.buildings
   where id=me.building_id and status='active'
   for update;

  if not found or v_current_manager_id is distinct from me.id then
    raise exception 'حساب شما مدیر فعلی این ساختمان نیست';
  end if;

  if p_target_account_id is null
     or p_target_account_id=me.id
     or not exists(
       select 1 from public.accounts a
        where a.id=p_target_account_id
          and a.building_id=me.building_id
          and a.is_active
     ) then
    raise exception 'حساب مقصد معتبر نیست';
  end if;

  if exists(
    select 1 from public.management_transfer_requests
     where building_id=me.building_id and status='pending'
  ) then
    raise exception 'درخواست انتقال مدیریت در انتظار پاسخ وجود دارد';
  end if;

  insert into public.management_transfer_requests(building_id,requested_by,target_account_id,status)
  values(me.building_id,me.id,p_target_account_id,'pending')
  returning id into rid;

  return jsonb_build_object('ok',true,'request_id',rid);
end
$function$;

create or replace function public.app_management_transfer_respond(p_token uuid, p_request_id bigint, p_accept boolean)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me public.accounts;
  r public.management_transfer_requests;
  v_building_id integer;
  v_current_manager_id uuid;
begin
  me:=public.bm_auth(p_token);

  select building_id
    into v_building_id
    from public.management_transfer_requests
   where id=p_request_id and target_account_id=me.id;

  if not found then
    raise exception 'درخواست معتبر نیست';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('management-transfer:'||v_building_id::text,0));

  select *
    into r
    from public.management_transfer_requests
   where id=p_request_id
     and building_id=v_building_id
     and target_account_id=me.id
     and status='pending'
   for update;

  if not found then
    raise exception 'درخواست معتبر نیست یا قبلاً تعیین تکلیف شده است';
  end if;

  select current_manager_account_id
    into v_current_manager_id
    from public.buildings
   where id=me.building_id and status='active'
   for update;

  if not found or v_current_manager_id is distinct from r.requested_by then
    raise exception 'این درخواست دیگر از طرف مدیر فعلی ساختمان معتبر نیست';
  end if;

  if not exists(
    select 1 from public.accounts a
     where a.id=r.requested_by
       and a.building_id=me.building_id
       and a.is_active
       and a.is_admin
  ) or not exists(
    select 1 from public.accounts a
     where a.id=me.id
       and a.building_id=me.building_id
       and a.is_active
  ) then
    raise exception 'وضعیت حساب‌های درخواست انتقال معتبر نیست';
  end if;

  if coalesce(p_accept,false) then
    update public.accounts
       set is_admin=false
     where id=r.requested_by and building_id=me.building_id;

    update public.accounts
       set is_admin=true
     where id=me.id and building_id=me.building_id;

    update public.buildings
       set current_manager_account_id=me.id
     where id=me.building_id;

    update public.management_transfer_requests
       set status='approved',responded_at=now()
     where id=r.id;
  else
    update public.management_transfer_requests
       set status='rejected',responded_at=now()
     where id=r.id;
  end if;

  return jsonb_build_object('ok',true,'accepted',coalesce(p_accept,false));
end
$function$;

create or replace function public.app_management_transfer_cancel(p_token uuid)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me public.accounts;
begin
  me:=public.bm_admin(p_token);

  perform pg_advisory_xact_lock(hashtextextended('management-transfer:'||me.building_id::text,0));

  update public.management_transfer_requests
     set status='cancelled',responded_at=now()
   where building_id=me.building_id
     and requested_by=me.id
     and status='pending';

  return jsonb_build_object('ok',true);
end
$function$;
