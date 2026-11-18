create table if not exists private.superadmin_audit_logs (
  id bigint generated always as identity primary key,
  superadmin_id uuid references public.superadmin_accounts(id) on delete set null,
  action text not null check (action in ('building_approved','building_rejected','building_suspended','building_activated','building_deleted')),
  building_id integer,
  building_name text not null default '',
  details text not null default '',
  created_at timestamptz not null default now()
);
create index if not exists superadmin_audit_logs_created_idx on private.superadmin_audit_logs(created_at desc);
create index if not exists superadmin_audit_logs_building_idx on private.superadmin_audit_logs(building_id, created_at desc);
alter table private.superadmin_audit_logs enable row level security;
revoke all on private.superadmin_audit_logs from public, anon, authenticated;

create or replace function public.app_superadmin_overview(p_token uuid)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare v_admin uuid; v_started timestamptz := clock_timestamp(); v_result jsonb;
begin
  v_admin := public.bm_superadmin_auth(p_token);
  select jsonb_build_object(
    'building_count',(select count(*) from public.buildings),
    'active_building_count',(select count(*) from public.buildings where status='active'),
    'suspended_building_count',(select count(*) from public.buildings where status='suspended'),
    'unit_count',(select count(*) from public.units),
    'account_count',(select count(*) from public.accounts where role <> 'superadmin'),
    'active_account_count',(select count(*) from public.accounts where role <> 'superadmin' and is_active),
    'manager_count',(select count(*) from public.buildings b join public.accounts a on a.id=b.current_manager_account_id and a.building_id=b.id),
    'pending_request_count',(select count(*) from public.registration_requests where status='pending'),
    'active_session_count',(select count(*) from public.sessions where revoked_at is null and expires_at>now()),
    'database_status','connected',
    'database_checked_at',now(),
    'database_elapsed_ms',greatest(0,(extract(epoch from (clock_timestamp()-v_started))*1000)::integer),
    'backup_status','not_configured',
    'monthly_buildings',coalesce((select jsonb_agg(jsonb_build_object('month',to_char(m,'YYYY-MM'),'count',c) order by m) from (
      select date_trunc('month',created_at) m,count(*) c from public.buildings where created_at >= now()-interval '6 months' group by 1
    ) q),'[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

create or replace function public.app_superadmin_list_managers(p_token uuid)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public
as $$
declare v_admin uuid; v_result jsonb;
begin
  v_admin := public.bm_superadmin_auth(p_token);
  select coalesce(jsonb_agg(jsonb_build_object(
    'building_id',b.id,'building_name',b.name,'building_status',b.status,
    'manager_id',a.id,'manager_name',a.full_name,'username',a.username,
    'is_active',a.is_active,'must_change_password',a.must_change_password,
    'locked_until',a.locked_until,'created_at',a.created_at
  ) order by b.name),'[]'::jsonb)
  into v_result from public.buildings b
  left join public.accounts a on a.id=b.current_manager_account_id and a.building_id=b.id;
  return v_result;
end;
$$;

create or replace function public.app_superadmin_list_audit_logs(p_token uuid,p_limit integer default 100)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare v_admin uuid; v_result jsonb;
begin
  v_admin := public.bm_superadmin_auth(p_token);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',l.id,'action',l.action,'building_id',l.building_id,
    'building_name',l.building_name,'details',l.details,'created_at',l.created_at,
    'actor_name',coalesce(sa.full_name,'سوپرادمین')
  ) order by l.created_at desc),'[]'::jsonb)
  into v_result from (
    select * from private.superadmin_audit_logs order by created_at desc limit greatest(1,least(coalesce(p_limit,100),250))
  ) l left join public.superadmin_accounts sa on sa.id=l.superadmin_id;
  return v_result;
end;
$$;

create or replace function public.app_superadmin_record_audit(
  p_token uuid,p_action text,p_building_id integer,p_building_name text default '',p_details text default ''
)
returns jsonb language plpgsql security definer
set search_path = pg_catalog, public, private
as $$
declare v_admin uuid; v_name text;
begin
  v_admin := public.bm_superadmin_auth(p_token);
  if p_action not in ('building_approved','building_rejected','building_suspended','building_activated','building_deleted') then
    raise exception 'INVALID_AUDIT_ACTION';
  end if;
  select name into v_name from public.buildings where id=p_building_id;
  insert into private.superadmin_audit_logs(superadmin_id,action,building_id,building_name,details)
  values(v_admin,p_action,p_building_id,coalesce(nullif(v_name,''),left(coalesce(p_building_name,''),160)),left(coalesce(p_details,''),500));
  return jsonb_build_object('ok',true);
end;
$$;

revoke all on function public.app_superadmin_overview(uuid) from public,authenticated;
revoke all on function public.app_superadmin_list_managers(uuid) from public,authenticated;
revoke all on function public.app_superadmin_list_audit_logs(uuid,integer) from public,authenticated;
revoke all on function public.app_superadmin_record_audit(uuid,text,integer,text,text) from public,authenticated;
grant execute on function public.app_superadmin_overview(uuid) to anon,service_role;
grant execute on function public.app_superadmin_list_managers(uuid) to anon,service_role;
grant execute on function public.app_superadmin_list_audit_logs(uuid,integer) to anon,service_role;
grant execute on function public.app_superadmin_record_audit(uuid,text,integer,text,text) to anon,service_role;
