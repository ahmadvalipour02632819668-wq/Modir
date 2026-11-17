
create or replace function public.app_recurring_generate_for_building(p_building_id uuid,p_period_start date)
returns integer language plpgsql security definer set search_path='' as $$
declare
 o record; ver record; u record; d date; own_id uuid; ten_id uuid; target_id uuid;
 w numeric; den numeric; days_in_month integer; amount_i numeric; total numeric; sum_i numeric;
 last_id uuid; v_run_id uuid; run_status text; count_i integer:=0; deadline_i timestamptz; manager_id uuid; item_i record;
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
  v_run_id:=null;
  insert into public.recurring_obligation_runs(obligation_id,building_id,period_start,period_end,status,review_deadline)
  values(o.id,p_building_id,p_period_start,(p_period_start+interval '1 month'-interval '1 day')::date,'draft',deadline_i)
  on conflict(obligation_id,period_start) do nothing returning id into v_run_id;
  if v_run_id is null then
   select id,status into v_run_id,run_status from public.recurring_obligation_runs where obligation_id=o.id and period_start=p_period_start for update;
   if run_status<>'draft' then continue; end if;
   delete from public.recurring_obligation_items i where i.run_id=v_run_id;
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
   insert into public.recurring_obligation_items(run_id,unit_id,membership_id,amount,covered_days)
   values(v_run_id,item_i.unit_id,item_i.membership_id,amount_i,item_i.covered_days);
   sum_i:=sum_i+amount_i; last_id:=item_i.membership_id;
  end loop;
  update public.recurring_obligation_items set amount=amount+(total-sum_i)
  where recurring_obligation_items.run_id=v_run_id and membership_id=last_id;
  select current_manager_membership_id into manager_id from public.buildings where id=p_building_id;
  insert into public.manager_financial_notifications(building_id,manager_membership_id,run_id,title,body)
  select p_building_id,manager_id,v_run_id,'بررسی مطالبات ماهانه',
   'پیش‌نویس «'||o.title||'» برای ماه '||to_char(p_period_start,'YYYY-MM')||' آماده بررسی است. در صورت عدم بررسی تا دو روز، به‌صورت خودکار ثبت می‌شود.'
  where not exists(select 1 from public.manager_financial_notifications n where n.run_id=v_run_id);
  count_i:=count_i+1;
 end loop;
 return count_i;
end $$;

