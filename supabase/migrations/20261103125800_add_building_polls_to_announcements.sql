create table if not exists public.building_polls (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references public.buildings(id) on delete cascade,
  question text not null,
  description text,
  is_active boolean not null default true,
  ends_at timestamptz,
  created_by uuid references public.app_accounts(id),
  created_at timestamptz not null default now()
);
create table if not exists public.building_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.building_polls(id) on delete cascade,
  option_text text not null,
  sort_order integer not null default 0
);
create table if not exists public.building_poll_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.building_polls(id) on delete cascade,
  option_id uuid not null references public.building_poll_options(id) on delete cascade,
  membership_id uuid not null references public.building_memberships(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(poll_id,membership_id)
);
create index if not exists building_polls_building_created_idx on public.building_polls(building_id,created_at desc);
create index if not exists building_poll_options_poll_idx on public.building_poll_options(poll_id,sort_order);
create index if not exists building_poll_votes_poll_idx on public.building_poll_votes(poll_id);
alter table public.building_polls enable row level security;
alter table public.building_poll_options enable row level security;
alter table public.building_poll_votes enable row level security;
revoke all on public.building_polls,public.building_poll_options,public.building_poll_votes from anon,authenticated;
create or replace function public.app_manager_list_building_polls(p_token uuid,p_building_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_items jsonb;
begin
 perform public.app_financial_v2_require_manager(p_token,p_building_id);
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',p.id,'question',p.question,'description',p.description,'is_active',p.is_active,'ends_at',p.ends_at,'created_at',p.created_at,
  'options',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'option_text',o.option_text,'sort_order',o.sort_order) order by o.sort_order,o.id),'[]'::jsonb) from public.building_poll_options o where o.poll_id=p.id),
  'votes',(select count(*) from public.building_poll_votes v where v.poll_id=p.id),
  'results',(select coalesce(jsonb_agg(jsonb_build_object('option_id',o.id,'option_text',o.option_text,'votes',(select count(*) from public.building_poll_votes v where v.option_id=o.id)) order by o.sort_order,o.id),'[]'::jsonb) from public.building_poll_options o where o.poll_id=p.id)
 ) order by p.created_at desc),'[]'::jsonb) into v_items from public.building_polls p where p.building_id=p_building_id;
 return jsonb_build_object('polls',v_items);
end; $$;
create or replace function public.app_manager_create_building_poll(p_token uuid,p_building_id uuid,p_question text,p_description text,p_options text[],p_ends_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.app_accounts; v_poll uuid; v_option text; v_count int:=0;
begin
 perform public.app_financial_v2_require_manager(p_token,p_building_id);
 v_actor:=public.app_require_session(p_token);
 if nullif(btrim(p_question),'') is null then raise exception 'متن نظرسنجی الزامی است'; end if;
 if p_options is null then raise exception 'حداقل دو گزینه لازم است'; end if;
 select count(*) into v_count from unnest(p_options) x where nullif(btrim(x),'') is not null;
 if v_count<2 or v_count>10 then raise exception 'نظرسنجی باید بین ۲ تا ۱۰ گزینه داشته باشد'; end if;
 insert into public.building_polls(building_id,question,description,ends_at,created_by)
 values(p_building_id,btrim(p_question),nullif(btrim(p_description),''),p_ends_at,v_actor.id) returning id into v_poll;
 for v_option in select distinct btrim(x) from unnest(p_options) x where nullif(btrim(x),'') is not null loop
  insert into public.building_poll_options(poll_id,option_text,sort_order) values(v_poll,v_option,(select count(*) from public.building_poll_options where poll_id=v_poll));
 end loop;
 return jsonb_build_object('success',true,'id',v_poll);
end; $$;
create or replace function public.app_resident_list_building_polls(p_token uuid,p_building_id uuid,p_membership_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.app_accounts; v_items jsonb;
begin
 v_actor:=public.app_require_session(p_token);
 if not exists(select 1 from public.building_memberships bm where bm.id=p_membership_id and bm.building_id=p_building_id and bm.account_id=v_actor.id and bm.membership_status='active') then raise exception 'دسترسی به نظرسنجی‌های این ساختمان ندارید'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
  'id',p.id,'question',p.question,'description',p.description,'is_active',p.is_active,'ends_at',p.ends_at,'created_at',p.created_at,
  'my_vote',(select v.option_id from public.building_poll_votes v where v.poll_id=p.id and v.membership_id=p_membership_id),
  'options',(select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'option_text',o.option_text,'votes',(select count(*) from public.building_poll_votes v where v.option_id=o.id)) order by o.sort_order,o.id),'[]'::jsonb) from public.building_poll_options o where o.poll_id=p.id)
 ) order by p.created_at desc),'[]'::jsonb) into v_items from public.building_polls p where p.building_id=p_building_id;
 return jsonb_build_object('polls',v_items);
end; $$;
create or replace function public.app_resident_vote_building_poll(p_token uuid,p_building_id uuid,p_membership_id uuid,p_poll_id uuid,p_option_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor public.app_accounts; v_poll public.building_polls;
begin
 v_actor:=public.app_require_session(p_token);
 if not exists(select 1 from public.building_memberships bm where bm.id=p_membership_id and bm.building_id=p_building_id and bm.account_id=v_actor.id and bm.membership_status='active') then raise exception 'دسترسی به این نظرسنجی ندارید'; end if;
 select * into v_poll from public.building_polls where id=p_poll_id and building_id=p_building_id and is_active=true and (ends_at is null or ends_at>now());
 if not found then raise exception 'این نظرسنجی فعال نیست'; end if;
 if not exists(select 1 from public.building_poll_options where id=p_option_id and poll_id=p_poll_id) then raise exception 'گزینه انتخابی معتبر نیست'; end if;
 insert into public.building_poll_votes(poll_id,option_id,membership_id) values(p_poll_id,p_option_id,p_membership_id);
 return jsonb_build_object('success',true);
exception when unique_violation then raise exception 'قبلاً در این نظرسنجی رأی داده‌اید';
end; $$;
grant execute on function public.app_manager_list_building_polls(uuid,uuid) to anon,authenticated;
grant execute on function public.app_manager_create_building_poll(uuid,uuid,text,text,text[],timestamptz) to anon,authenticated;
grant execute on function public.app_resident_list_building_polls(uuid,uuid,uuid) to anon,authenticated;
grant execute on function public.app_resident_vote_building_poll(uuid,uuid,uuid,uuid,uuid) to anon,authenticated;
