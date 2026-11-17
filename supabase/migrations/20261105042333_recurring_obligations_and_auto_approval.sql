
create extension if not exists pg_cron with schema pg_catalog;

create table if not exists public.recurring_obligations (
 id uuid primary key default gen_random_uuid(),
 building_id uuid not null references public.buildings(id) on delete cascade,
 title text not null check(length(btrim(title)) between 2 and 180),
 category text not null default 'شارژ ماهیانه',
 starts_on date not null, ends_on date, is_active boolean not null default true,
 created_by uuid references public.app_accounts(id), created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), check(ends_on is null or ends_on>=starts_on)
);
create table if not exists public.recurring_obligation_versions (
 id uuid primary key default gen_random_uuid(),
 obligation_id uuid not null references public.recurring_obligations(id) on delete cascade,
 amount numeric(18,2) not null check(amount>0),
 calculation_method text not null check(calculation_method in ('per_unit','per_meter','per_resident','total_equal')),
 payer_roles text[] not null default array['owner','owner_resident']::text[],
 selected_unit_ids uuid[], effective_from date not null, created_at timestamptz not null default now(),
 unique(obligation_id,effective_from),
 check(coalesce(array_length(payer_roles,1),0)>0),
 check(not ('owner'=any(payer_roles) and 'tenant'=any(payer_roles)))
);
create table if not exists public.recurring_obligation_runs (
 id uuid primary key default gen_random_uuid(),
 obligation_id uuid not null references public.recurring_obligations(id),
 building_id uuid not null references public.buildings(id),
 period_start date not null, period_end date not null,
 status text not null default 'draft' check(status in ('draft','approved','auto_approved','cancelled')),
 review_deadline timestamptz not null, generated_at timestamptz not null default now(),
 approved_at timestamptz, approved_by uuid references public.app_accounts(id),
 expense_id uuid references public.building_expenses(id),
 unique(obligation_id,period_start), check(period_end>=period_start)
);
create table if not exists public.recurring_obligation_items (
 id uuid primary key default gen_random_uuid(),
 run_id uuid not null references public.recurring_obligation_runs(id) on delete cascade,
 unit_id uuid not null references public.units(id),
 membership_id uuid not null references public.building_memberships(id),
 amount numeric(18,2) not null check(amount>=0), covered_days integer not null default 0,
 created_at timestamptz not null default now(), unique(run_id,membership_id)
);
create table if not exists public.manager_financial_notifications (
 id uuid primary key default gen_random_uuid(),
 building_id uuid not null references public.buildings(id) on delete cascade,
 manager_membership_id uuid references public.building_memberships(id),
 run_id uuid references public.recurring_obligation_runs(id) on delete cascade,
 title text not null, body text not null, created_at timestamptz not null default now(), read_at timestamptz
);
create index if not exists idx_recurring_obligations_building_active on public.recurring_obligations(building_id,is_active);
create index if not exists idx_recurring_versions_effective on public.recurring_obligation_versions(obligation_id,effective_from desc);
create index if not exists idx_recurring_runs_deadline on public.recurring_obligation_runs(status,review_deadline);
create index if not exists idx_recurring_items_run on public.recurring_obligation_items(run_id);
create index if not exists idx_manager_financial_notifications_manager on public.manager_financial_notifications(manager_membership_id,read_at,created_at desc);
alter table public.recurring_obligations enable row level security;
alter table public.recurring_obligation_versions enable row level security;
alter table public.recurring_obligation_runs enable row level security;
alter table public.recurring_obligation_items enable row level security;
alter table public.manager_financial_notifications enable row level security;

create or replace function public.app_manager_list_recurring_obligations(p_token uuid,p_building_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 perform public.app_financial_v2_require_manager(p_token,p_building_id);
 select coalesce(jsonb_agg(jsonb_build_object('id',o.id,'title',o.title,'category',o.category,'starts_on',o.starts_on,
 'ends_on',o.ends_on,'is_active',o.is_active,'amount',ver.amount,'calculation_method',ver.calculation_method,
 'payer_roles',ver.payer_roles,'selected_unit_ids',ver.selected_unit_ids,'effective_from',ver.effective_from)
 order by o.created_at desc),'[]'::jsonb) into v
 from public.recurring_obligations o
 left join lateral(select x.* from public.recurring_obligation_versions x where x.obligation_id=o.id
 and x.effective_from<=current_date order by x.effective_from desc limit 1) ver on true
 where o.building_id=p_building_id;
 return jsonb_build_object('obligations',v);
end $$;

create or replace function public.app_manager_save_recurring_obligation(
 p_token uuid,p_building_id uuid,p_obligation_id uuid,p_title text,p_category text,p_amount numeric,
 p_calculation_method text,p_payer_roles text[],p_selected_unit_ids uuid[],p_effective_from date,p_ends_on date,p_is_active boolean
) returns jsonb language plpgsql security definer set search_path='' as $$
declare v_actor uuid; v_id uuid;
begin
 v_actor:=public.app_financial_v2_require_manager(p_token,p_building_id);
 if nullif(btrim(p_title),'') is null or p_amount is null or p_amount<=0 then raise exception 'عنوان و مبلغ معتبر الزامی است'; end if;
 if p_calculation_method not in ('per_unit','per_meter','per_resident','total_equal') then raise exception 'روش محاسبه نامعتبر است'; end if;
 if coalesce(array_length(p_payer_roles,1),0)=0 or ('owner'=any(p_payer_roles) and 'tenant'=any(p_payer_roles)) then raise exception 'مسئول پرداخت را به‌درستی انتخاب کنید'; end if;
 if p_effective_from is null or extract(day from p_effective_from)<>1 then raise exception 'تاریخ شروع نرخ باید روز اول ماه باشد'; end if;
 if p_ends_on is not null and p_ends_on<p_effective_from then raise exception 'تاریخ پایان نمی‌تواند قبل از شروع باشد'; end if;
 if p_selected_unit_ids is not null and exists(select 1 from unnest(p_selected_unit_ids) x where not exists(select 1 from public.units u where u.id=x and u.building_id=p_building_id)) then raise exception 'واحد انتخابی متعلق به این ساختمان نیست'; end if;
 if p_obligation_id is null then
  insert into public.recurring_obligations(building_id,title,category,starts_on,ends_on,is_active,created_by)
  values(p_building_id,btrim(p_title),coalesce(nullif(btrim(p_category),''),'سایر'),p_effective_from,p_ends_on,coalesce(p_is_active,true),v_actor)
  returning id into v_id;
 else
  select id into v_id from public.recurring_obligations where id=p_obligation_id and building_id=p_building_id for update;
  if v_id is null then raise exception 'تعهد دوره‌ای پیدا نشد'; end if;
  if exists(select 1 from public.recurring_obligation_runs where obligation_id=v_id and period_start>=p_effective_from and status<>'cancelled') then raise exception 'برای این ماه یا ماه‌های بعد پیش‌نویس/مطالبه صادر شده؛ ابتدا تعیین تکلیف کنید'; end if;
  update public.recurring_obligations set title=btrim(p_title),category=coalesce(nullif(btrim(p_category),''),'سایر'),
   ends_on=p_ends_on,is_active=coalesce(p_is_active,true),updated_at=now() where id=v_id;
 end if;
 insert into public.recurring_obligation_versions(obligation_id,amount,calculation_method,payer_roles,selected_unit_ids,effective_from)
 values(v_id,p_amount,p_calculation_method,p_payer_roles,p_selected_unit_ids,p_effective_from)
 on conflict(obligation_id,effective_from) do update set amount=excluded.amount,calculation_method=excluded.calculation_method,
 payer_roles=excluded.payer_roles,selected_unit_ids=excluded.selected_unit_ids;
 return jsonb_build_object('success',true,'obligation_id',v_id);
end $$;

create or replace function public.app_recurring_generate_for_building(p_building_id uuid,p_period_start date)
returns integer language plpgsql security definer set search_path='' as $$
declare
 o record; ver record; u record; d date; own_id uuid; ten_id uuid; target_id uuid;
 w numeric; den numeric; days_in_month integer; amount_i numeric; total numeric; sum_i numeric;
 last_id uuid; run_id uuid; run_status text; count_i integer:=0; deadline_i timestamptz; manager_id uuid; item_i record;
begin
 if extract(day from p_period_start)<>1 then raise exception 'شروع دوره باید روز اول ماه باشد'; end if;
 days_in_month:=((date_trunc('month',p_period_start::timestamp)+interval '1 month'-interval '1 day')::date-p_period_start)+1;
 deadline_i:=((p_period_start+2)::timestamp at time zone 'Asia/Tehran');
 create temp table if not exists recurring_weight_work(membership_id uuid primary key,unit_id uuid not null,weight numeric not null,covered_days integer not null) on commit drop;
 for o in select * from public.recurring_obligations where building_id=p_building_id and is_active
  and starts_on<=(p_period_start+interval '1 month'-interval '1 day')::date and (ends_on is null or ends_on>=p_period_start)
 loop
  select * into ver from public.recurring_obligation_versions where obligation_id=o.id and effective_from<=p_period_start order by effective_from desc limit 1;
  if not found then continue; end if;
  insert into public.recurring_obligation_runs(obligation_id,building_id,period_start,period_end,status,review_deadline)
  values(o.id,p_building_id,p_period_start,(p_period_start+interval '1 month'-interval '1 day')::date,'draft',deadline_i)
  on conflict(obligation_id,period_start) do nothing returning id into run_id;
  if run_id is null then
   select id,status into run_id,run_status from public.recurring_obligation_runs where obligation_id=o.id and period_start=p_period_start for update;
   if run_status<>'draft' then continue; end if;
   delete from public.recurring_obligation_items where run_id=run_id;
  end if;
  truncate recurring_weight_work;
  for u in select * from public.units where building_id=p_building_id and (ver.selected_unit_ids is null or id=any(ver.selected_unit_ids))
  loop
   for d in select generate_series(p_period_start,(p_period_start+interval '1 month'-interval '1 day')::date,interval '1 day')::date
   loop
    own_id:=null; ten_id:=null; target_id:=null;
    select bm.id into ten_id from public.building_memberships bm where bm.unit_id=u.id and bm.building_id=p_building_id
     and bm.resident_type='tenant' and bm.joined_at::date<=d and (bm.ended_at is null or bm.ended_at::date>=d)
     order by bm.joined_at desc limit 1;
    select bm.id into own_id from public.building_memberships bm where bm.unit_id=u.id and bm.building_id=p_building_id
     and bm.resident_type in ('owner','owner_resident') and bm.joined_at::date<=d and (bm.ended_at is null or bm.ended_at::date>=d)
     order by (bm.resident_type='owner_resident') desc,bm.joined_at desc limit 1;
    if ten_id is not null and 'tenant'=any(ver.payer_roles) then target_id:=ten_id;
    elsif own_id is not null and ('owner'=any(ver.payer_roles) or ('owner_resident'=any(ver.payer_roles) and exists(select 1 from public.building_memberships bm where bm.id=own_id and bm.resident_type='owner_resident'))) then target_id:=own_id;
    elsif ten_id is null and own_id is not null then target_id:=own_id; end if;
    if target_id is null then raise exception 'برای واحد % در تاریخ % مسئول پرداخت فعال ثبت نشده است',u.unit_no,d; end if;
    w:=case when ver.calculation_method='per_meter' then greatest(coalesce(u.area,0),0)
      when ver.calculation_method='per_resident' then greatest(coalesce(u.resident_count,0),0) else 1 end;
    if w<=0 then raise exception 'مبنای محاسبه واحد % صفر یا نامعتبر است',u.unit_no; end if;
    insert into recurring_weight_work values(target_id,u.id,w,1)
    on conflict(membership_id) do update set weight=recurring_weight_work.weight+excluded.weight,covered_days=recurring_weight_work.covered_days+1;
   end loop;
  end loop;
  select coalesce(sum(weight),0) into den from recurring_weight_work;
  if den<=0 then raise exception 'برای تعهد «%» هیچ واحد مشمولی پیدا نشد',o.title; end if;
  total:=case when ver.calculation_method='total_equal' then ver.amount else ver.amount*den/days_in_month end;
  sum_i:=0; last_id:=null;
  for item_i in select * from recurring_weight_work order by membership_id
  loop
   amount_i:=case when ver.calculation_method='total_equal' then round(total*item_i.weight/den,2) else round(ver.amount*item_i.weight/days_in_month,2) end;
   insert into public.recurring_obligation_items(run_id,unit_id,membership_id,amount,covered_days) values(run_id,item_i.unit_id,item_i.membership_id,amount_i,item_i.covered_days);
   sum_i:=sum_i+amount_i; last_id:=item_i.membership_id;
  end loop;
  update public.recurring_obligation_items set amount=amount+(total-sum_i) where recurring_obligation_items.run_id=run_id and membership_id=last_id;
  select current_manager_membership_id into manager_id from public.buildings where id=p_building_id;
  insert into public.manager_financial_notifications(building_id,manager_membership_id,run_id,title,body)
  select p_building_id,manager_id,run_id,'بررسی مطالبات ماهانه',
   'پیش‌نویس «'||o.title||'» برای ماه '||to_char(p_period_start,'YYYY-MM')||' آماده بررسی است. در صورت عدم بررسی تا دو روز، به‌صورت خودکار ثبت می‌شود.'
  where not exists(select 1 from public.manager_financial_notifications n where n.run_id=run_id);
  count_i:=count_i+1;
 end loop;
 return count_i;
end $$;

create or replace function public.app_recurring_finalize_run(p_run_id uuid,p_auto boolean,p_actor uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r record; o record; exp_id uuid; total_i numeric; item_count integer;
begin
 select * into r from public.recurring_obligation_runs where id=p_run_id for update;
 if not found then raise exception 'پیش‌نویس پیدا نشد'; end if;
 if r.status in ('approved','auto_approved') then return jsonb_build_object('success',true,'already_finalized',true,'expense_id',r.expense_id); end if;
 if r.status<>'draft' then raise exception 'این پیش‌نویس قابل ثبت نیست'; end if;
 if p_auto and now()<r.review_deadline then raise exception 'مهلت بررسی مدیر هنوز تمام نشده است'; end if;
 select * into o from public.recurring_obligations where id=r.obligation_id;
 select coalesce(sum(amount),0),count(*) into total_i,item_count from public.recurring_obligation_items where run_id=r.id;
 if item_count=0 or total_i<=0 then raise exception 'پیش‌نویس فاقد ردیف قابل ثبت است'; end if;
 insert into public.building_expenses(building_id,description,amount,input_amount,expense_date,allocation_method,tx_type,category,expense_status,created_by,payer_roles,period_start,period_end)
 values(r.building_id,o.title||' - '||to_char(r.period_start,'YYYY-MM'),total_i,total_i,r.period_start,'manual','مطالبه',o.category,'active',coalesce(p_actor,o.created_by),array['owner','owner_resident']::text[],r.period_start,r.period_end)
 returning id into exp_id;
 insert into public.building_expense_allocations(building_id,expense_id,membership_id,amount)
 select r.building_id,exp_id,i.membership_id,i.amount from public.recurring_obligation_items i where i.run_id=r.id;
 update public.recurring_obligation_runs set status=case when p_auto then 'auto_approved' else 'approved' end,
  approved_at=now(),approved_by=p_actor,expense_id=exp_id where id=r.id;
 return jsonb_build_object('success',true,'expense_id',exp_id,'item_count',item_count,'total_amount',total_i);
end $$;

create or replace function public.app_manager_generate_obligation_drafts(p_token uuid,p_building_id uuid,p_period_start date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_id uuid; n integer;
begin
 actor_id:=public.app_financial_v2_require_manager(p_token,p_building_id);
 if p_period_start is null or extract(day from p_period_start)<>1 then raise exception 'ماه انتخابی معتبر نیست'; end if;
 n:=public.app_recurring_generate_for_building(p_building_id,p_period_start);
 return jsonb_build_object('success',true,'generated_count',n);
end $$;

create or replace function public.app_manager_list_obligation_runs(p_token uuid,p_building_id uuid,p_period_start date default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v jsonb;
begin
 perform public.app_financial_v2_require_manager(p_token,p_building_id);
 select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'obligation_id',r.obligation_id,'title',o.title,
 'period_start',r.period_start,'period_end',r.period_end,'status',r.status,'review_deadline',r.review_deadline,
 'total_amount',coalesce(x.total_amount,0),'item_count',coalesce(x.item_count,0),'items',coalesce(x.items,'[]'::jsonb))
 order by r.period_start desc,o.title),'[]'::jsonb) into v
 from public.recurring_obligation_runs r join public.recurring_obligations o on o.id=r.obligation_id
 left join lateral(select sum(i.amount) total_amount,count(*) item_count,
  jsonb_agg(jsonb_build_object('unit_no',u.unit_no,'membership_id',i.membership_id,'amount',i.amount,'covered_days',i.covered_days) order by u.unit_no) items
  from public.recurring_obligation_items i join public.units u on u.id=i.unit_id where i.run_id=r.id) x on true
 where r.building_id=p_building_id and (p_period_start is null or r.period_start=p_period_start);
 return jsonb_build_object('runs',v);
end $$;

create or replace function public.app_manager_review_obligation_run(p_token uuid,p_building_id uuid,p_run_id uuid,p_approve boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_id uuid; r public.recurring_obligation_runs;
begin
 actor_id:=public.app_financial_v2_require_manager(p_token,p_building_id);
 select * into r from public.recurring_obligation_runs where id=p_run_id and building_id=p_building_id for update;
 if not found or r.status<>'draft' then raise exception 'پیش‌نویس قابل بررسی پیدا نشد'; end if;
 if p_approve then return public.app_recurring_finalize_run(p_run_id,false,actor_id); end if;
 update public.recurring_obligation_runs set status='cancelled',approved_at=now(),approved_by=actor_id where id=p_run_id;
 return jsonb_build_object('success',true,'cancelled',true);
end $$;

create or replace function public.app_manager_list_financial_notifications(p_token uuid,p_building_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_id uuid; member_id uuid; rows_i jsonb;
begin
 actor_id:=public.app_financial_v2_require_manager(p_token,p_building_id);
 select bm.id into member_id from public.building_memberships bm where bm.building_id=p_building_id and bm.account_id=actor_id and bm.membership_status='active' order by (bm.access_role='manager') desc limit 1;
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'run_id',n.run_id,'title',n.title,'body',n.body,'created_at',n.created_at,'read_at',n.read_at) order by n.created_at desc),'[]'::jsonb)
 into rows_i from public.manager_financial_notifications n where n.building_id=p_building_id and (n.manager_membership_id is null or n.manager_membership_id=member_id);
 return jsonb_build_object('notifications',rows_i);
end $$;

create or replace function public.app_manager_mark_financial_notification_read(p_token uuid,p_building_id uuid,p_notification_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_id uuid; member_id uuid;
begin
 actor_id:=public.app_financial_v2_require_manager(p_token,p_building_id);
 select id into member_id from public.building_memberships where building_id=p_building_id and account_id=actor_id and membership_status='active' order by (access_role='manager') desc limit 1;
 update public.manager_financial_notifications set read_at=now() where id=p_notification_id and building_id=p_building_id and (manager_membership_id is null or manager_membership_id=member_id);
 return jsonb_build_object('success',true);
end $$;

create or replace function public.app_recurring_obligations_scheduler()
returns jsonb language plpgsql security definer set search_path='' as $$
declare today_i date; b record; r record; generated_i integer:=0; finalized_i integer:=0;
begin
 today_i:=(now() at time zone 'Asia/Tehran')::date;
 if extract(day from today_i)=1 then
  for b in select id from public.buildings where building_status='active' loop
   generated_i:=generated_i+public.app_recurring_generate_for_building(b.id,date_trunc('month',today_i::timestamp)::date);
  end loop;
 end if;
 for r in select id from public.recurring_obligation_runs where status='draft'
  and (now() at time zone 'Asia/Tehran')::date>=period_start+2 for update
 loop
  perform public.app_recurring_finalize_run(r.id,true,null); finalized_i:=finalized_i+1;
 end loop;
 return jsonb_build_object('success',true,'generated',generated_i,'auto_finalized',finalized_i,'local_date',today_i);
end $$;

do $$ begin
 if not exists(select 1 from cron.job where jobname='recurring-obligations-daily') then
  perform cron.schedule('recurring-obligations-daily','45 20 * * *','select public.app_recurring_obligations_scheduler();');
 end if;
end $$;

revoke all on public.recurring_obligations,public.recurring_obligation_versions,public.recurring_obligation_runs,public.recurring_obligation_items,public.manager_financial_notifications from anon,authenticated;
revoke all on function public.app_recurring_generate_for_building(uuid,date) from public,anon,authenticated;
revoke all on function public.app_recurring_finalize_run(uuid,boolean,uuid) from public,anon,authenticated;
revoke all on function public.app_recurring_obligations_scheduler() from public,anon,authenticated;
grant execute on function public.app_manager_list_recurring_obligations(uuid,uuid) to anon,authenticated;
grant execute on function public.app_manager_save_recurring_obligation(uuid,uuid,uuid,text,text,numeric,text,text[],uuid[],date,date,boolean) to anon,authenticated;
grant execute on function public.app_manager_generate_obligation_drafts(uuid,uuid,date) to anon,authenticated;
grant execute on function public.app_manager_list_obligation_runs(uuid,uuid,date) to anon,authenticated;
grant execute on function public.app_manager_review_obligation_run(uuid,uuid,uuid,boolean) to anon,authenticated;
grant execute on function public.app_manager_list_financial_notifications(uuid,uuid) to anon,authenticated;
grant execute on function public.app_manager_mark_financial_notification_read(uuid,uuid,uuid) to anon,authenticated;

