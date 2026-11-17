
create table if not exists public.building_announcements (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  title text not null,
  content text not null,
  announcement_type text not null default 'general',
  created_by uuid references public.app_accounts(id) on delete set null,
  created_at timestamptz not null default now(),
  legacy_import_id text,
  legacy_created_at timestamptz
);
create unique index if not exists building_announcements_legacy_uidx
  on public.building_announcements(building_id,legacy_import_id)
  where legacy_import_id is not null;
create index if not exists building_announcements_building_date_idx
  on public.building_announcements(building_id,created_at desc);

alter table public.building_requests
  add column if not exists legacy_import_id text,
  add column if not exists legacy_created_at timestamptz;
create unique index if not exists building_requests_legacy_uidx
  on public.building_requests(building_id,legacy_import_id)
  where legacy_import_id is not null;

alter table public.building_announcements enable row level security;
revoke all on public.building_announcements from public,anon,authenticated;
revoke all on public.building_requests from public,anon,authenticated;





create or replace function public.app_manager_list_building_announcements(p_token uuid,p_building_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_items jsonb;
begin
  perform public.app_financial_v2_require_manager(p_token,p_building_id);
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'title',a.title,'content',a.content,'announcement_type',a.announcement_type,
    'created_at',a.created_at,'is_legacy',a.legacy_import_id is not null
  ) order by a.created_at desc),'[]'::jsonb)
  into v_items from public.building_announcements a where a.building_id=p_building_id;
  return jsonb_build_object('announcements',v_items);
end; $$;

create or replace function public.app_resident_list_building_announcements(p_token uuid,p_building_id uuid,p_membership_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor public.app_accounts; v_items jsonb;
begin
  v_actor:=public.app_require_session(p_token);
  if not exists(select 1 from public.building_memberships bm where bm.id=p_membership_id
    and bm.building_id=p_building_id and bm.account_id=v_actor.id and bm.membership_status='active') then
    raise exception 'دسترسی به اطلاعیه‌های این ساختمان ندارید';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',a.id,'title',a.title,'content',a.content,'announcement_type',a.announcement_type,
    'created_at',a.created_at,'is_legacy',a.legacy_import_id is not null
  ) order by a.created_at desc),'[]'::jsonb)
  into v_items from public.building_announcements a where a.building_id=p_building_id;
  return jsonb_build_object('announcements',v_items);
end; $$;

create or replace function public.app_manager_create_building_announcement(
  p_token uuid,p_building_id uuid,p_title text,p_content text
)
returns jsonb language plpgsql security definer set search_path=''
as $$
declare v_actor public.app_accounts; v_id uuid;
begin
  perform public.app_financial_v2_require_manager(p_token,p_building_id);
  v_actor:=public.app_require_session(p_token);
  if nullif(btrim(p_title),'') is null or nullif(btrim(p_content),'') is null then
    raise exception 'عنوان و متن اطلاعیه الزامی است';
  end if;
  insert into public.building_announcements(building_id,title,content,created_by)
  values(p_building_id,btrim(p_title),btrim(p_content),v_actor.id)
  returning id into v_id;
  return jsonb_build_object('success',true,'id',v_id);
end; $$;

revoke all on function public.app_manager_list_building_announcements(uuid,uuid) from public,anon;
revoke all on function public.app_resident_list_building_announcements(uuid,uuid,uuid) from public,anon;
revoke all on function public.app_manager_create_building_announcement(uuid,uuid,text,text) from public,anon;
grant execute on function public.app_manager_list_building_announcements(uuid,uuid) to authenticated;
grant execute on function public.app_resident_list_building_announcements(uuid,uuid,uuid) to authenticated;
grant execute on function public.app_manager_create_building_announcement(uuid,uuid,text,text) to authenticated;

