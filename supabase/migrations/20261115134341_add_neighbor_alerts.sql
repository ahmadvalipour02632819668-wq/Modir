create table if not exists public.neighbor_alerts (
  id bigint generated always as identity primary key,
  building_id integer not null references public.buildings(id) on delete cascade,
  sender_account_id uuid not null references public.accounts(id) on delete restrict,
  target_unit_no integer not null,
  category text not null check (category in ('noise','quiet_hours','common_areas','other')),
  status text not null default 'pending' check (status in ('pending','acknowledged')),
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.accounts(id) on delete set null
);

create index if not exists neighbor_alerts_target_recent_idx
  on public.neighbor_alerts(building_id, target_unit_no, created_at desc);
create index if not exists neighbor_alerts_sender_recent_idx
  on public.neighbor_alerts(building_id, sender_account_id, created_at desc);

alter table public.neighbor_alerts enable row level security;
revoke all on table public.neighbor_alerts from public, anon, authenticated;
grant all on table public.neighbor_alerts to service_role;

create or replace function public.app_neighbor_alert_submit(
  p_token uuid, p_target_unit_no integer, p_category text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare
  me public.accounts;
  v_id bigint;
  v_now timestamptz := now();
begin
  me := public.bm_auth(p_token);
  if p_target_unit_no is null or p_target_unit_no < 1 then
    raise exception 'واحد مقصد معتبر نیست';
  end if;
  if p_category not in ('noise','quiet_hours','common_areas','other') then
    raise exception 'موضوع هشدار معتبر نیست';
  end if;
  if me.unit_no is not null and me.unit_no = p_target_unit_no then
    raise exception 'نمی‌توانید برای واحد خودتان هشدار بفرستید';
  end if;
  if not exists (select 1 from public.units u
    where u.building_id=me.building_id and u.unit_no=p_target_unit_no) then
    raise exception 'واحد انتخاب‌شده در این ساختمان وجود ندارد';
  end if;
  if not exists (select 1 from public.accounts a
    where a.building_id=me.building_id and a.unit_no=p_target_unit_no and a.is_active) then
    raise exception 'برای این واحد حساب فعال ثبت نشده است';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('neighbor_sender:'||me.id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('neighbor_target:'||me.building_id::text||':'||p_target_unit_no::text,0));

  if (select count(*) from public.neighbor_alerts
      where building_id=me.building_id and sender_account_id=me.id
        and created_at > v_now - interval '24 hours') >= 3 then
    raise exception 'محدودیت ارسال: در هر ۲۴ ساعت حداکثر ۳ هشدار می‌توانید ارسال کنید';
  end if;
  if exists (select 1 from public.neighbor_alerts
      where building_id=me.building_id and sender_account_id=me.id
        and target_unit_no=p_target_unit_no and category=p_category
        and created_at > v_now - interval '6 hours') then
    raise exception 'برای همین موضوع و واحد، تا ۶ ساعت امکان ارسال مجدد ندارید';
  end if;
  if (select count(*) from public.neighbor_alerts
      where building_id=me.building_id and target_unit_no=p_target_unit_no
        and created_at > v_now - interval '24 hours') >= 5 then
    raise exception 'برای حفظ آرامش، تعداد هشدارهای این واحد در ۲۴ ساعت به سقف مجاز رسیده است';
  end if;

  insert into public.neighbor_alerts(building_id,sender_account_id,target_unit_no,category)
  values(me.building_id,me.id,p_target_unit_no,p_category)
  returning id into v_id;

  return jsonb_build_object('ok',true,'alert_id',v_id,'building_id',me.building_id,
    'target_unit_no',p_target_unit_no,'category',p_category);
end
$function$;

revoke all on function public.app_neighbor_alert_submit(uuid,integer,text) from public, anon, authenticated;
grant execute on function public.app_neighbor_alert_submit(uuid,integer,text) to service_role;

create or replace function public.app_neighbor_alert_units(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare me public.accounts;
begin
  me := public.bm_auth(p_token);
  return coalesce((
    select jsonb_agg(u.unit_no order by u.unit_no)
    from public.units u
    where u.building_id=me.building_id
      and (me.unit_no is null or u.unit_no<>me.unit_no)
      and exists (select 1 from public.accounts a
        where a.building_id=u.building_id and a.unit_no=u.unit_no and a.is_active)
  ),'[]'::jsonb);
end
$function$;

create or replace function public.app_neighbor_alert_list(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare me public.accounts;
begin
  me := public.bm_auth(p_token);
  if me.unit_no is null then return '[]'::jsonb; end if;
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.created_at desc)
    from (
      select id,category,status,created_at,acknowledged_at
      from public.neighbor_alerts
      where building_id=me.building_id and target_unit_no=me.unit_no
        and created_at > now()-interval '30 days'
      order by created_at desc
      limit 20
    ) x
  ),'[]'::jsonb);
end
$function$;

create or replace function public.app_neighbor_alert_ack(p_token uuid,p_alert_id bigint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $function$
declare me public.accounts; v_id bigint;
begin
  me := public.bm_auth(p_token);
  if me.unit_no is null then raise exception 'حساب شما به واحدی متصل نیست'; end if;
  update public.neighbor_alerts
     set status='acknowledged', acknowledged_at=now(), acknowledged_by=me.id
   where id=p_alert_id and building_id=me.building_id
     and target_unit_no=me.unit_no and status='pending'
   returning id into v_id;
  if v_id is not null then return jsonb_build_object('ok',true,'updated',true); end if;
  if exists(select 1 from public.neighbor_alerts where id=p_alert_id
      and building_id=me.building_id and target_unit_no=me.unit_no
      and status='acknowledged') then
    return jsonb_build_object('ok',true,'updated',false);
  end if;
  raise exception 'هشدار موردنظر پیدا نشد';
end
$function$;

create or replace function public.app_manager_neighbor_alert_summary(p_token uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $function$
declare me public.accounts;
begin
  me := public.bm_admin(p_token);
  return coalesce((
    select jsonb_agg(to_jsonb(x) order by x.target_unit_no,x.category)
    from (
      select target_unit_no,category,count(*)::integer as total,
        count(*) filter (where status='pending')::integer as pending,
        max(created_at) as last_at
      from public.neighbor_alerts
      where building_id=me.building_id and created_at > now()-interval '30 days'
      group by target_unit_no,category
    ) x
  ),'[]'::jsonb);
end
$function$;

revoke all on function public.app_neighbor_alert_units(uuid) from public;
revoke all on function public.app_neighbor_alert_list(uuid) from public;
revoke all on function public.app_neighbor_alert_ack(uuid,bigint) from public;
revoke all on function public.app_manager_neighbor_alert_summary(uuid) from public;
grant execute on function public.app_neighbor_alert_units(uuid) to anon, authenticated;
grant execute on function public.app_neighbor_alert_list(uuid) to anon, authenticated;
grant execute on function public.app_neighbor_alert_ack(uuid,bigint) to anon, authenticated;
grant execute on function public.app_manager_neighbor_alert_summary(uuid) to anon, authenticated;
