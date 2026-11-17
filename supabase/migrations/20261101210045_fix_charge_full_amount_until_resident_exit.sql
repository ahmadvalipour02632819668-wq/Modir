CREATE OR REPLACE FUNCTION public.app_recalculate_expense_allocations(p_token uuid, p_building_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
 e record;u record;m record;d date;v_start date;v_end date;v_days integer;
 v_owner uuid;v_tenant uuid;v_target uuid;v_weight numeric;v_den numeric;
 v_total numeric;v_share numeric;v_sum numeric;v_last uuid;
begin
 perform public.app_financial_v2_require_manager(p_token,p_building_id);
 delete from public.building_payment_allocations pa
 where pa.payment_id in(select p.id from public.building_payments p where p.building_id=p_building_id);

 for e in select * from public.building_expenses where building_id=p_building_id
  and expense_status='active' and allocation_method<>'manual'
 loop
  if e.allocation_method='none' then continue; end if;
  v_start:=coalesce(e.period_start,e.expense_date);v_end:=coalesce(e.period_end,e.expense_date);
  v_days:=(v_end-v_start)+1;
  if v_days<1 then raise exception 'بازه زمانی هزینه نامعتبر است'; end if;
  if exists(select 1 from public.building_expense_allocations where expense_id=e.id and original_membership_id is not null) then continue; end if;
  delete from public.building_expense_allocations where expense_id=e.id;
  create temp table if not exists v2_weights(membership_id uuid primary key,weight numeric not null) on commit drop;
  truncate v2_weights;

  for u in select * from public.units where building_id=p_building_id
   and (e.selected_unit_ids is null or id=any(e.selected_unit_ids))
  loop
   for d in select generate_series(v_start,v_end,interval '1 day')::date loop
    v_owner:=null;v_tenant:=null;v_target:=null;
    select bm.id into v_owner from public.building_memberships bm
    where bm.unit_id=u.id and bm.building_id=p_building_id
     and bm.resident_type in ('owner','owner_resident')
     and (bm.membership_status='active' or bm.ended_at is not null)
     and (
       (bm.membership_status='active' and d=v_start)
       or
       (bm.membership_status<>'active' and bm.joined_at::date<=d and (bm.ended_at is null or bm.ended_at::date>=d))
     )
    order by (bm.resident_type='owner_resident') desc,bm.joined_at desc limit 1;

    select bm.id into v_tenant from public.building_memberships bm
    where bm.unit_id=u.id and bm.building_id=p_building_id and bm.resident_type='tenant'
     and (bm.membership_status='active' or bm.ended_at is not null)
     and (
       (bm.membership_status='active' and d=v_start)
       or
       (bm.membership_status<>'active' and bm.joined_at::date<=d and (bm.ended_at is null or bm.ended_at::date>=d))
     )
    order by bm.joined_at desc limit 1;

    if v_tenant is not null and 'tenant'=any(e.payer_roles) then v_target:=v_tenant;
    elsif v_owner is not null and ('owner'=any(e.payer_roles) or 'owner_resident'=any(e.payer_roles)) then v_target:=v_owner;
    elsif v_tenant is null then v_target:=v_owner;
    end if;
    if v_target is null then continue; end if;

    v_weight:=case
     when e.allocation_method in ('area','dynamic_per_meter') then greatest(coalesce(u.area,0),0)
     when e.allocation_method in ('residents','dynamic_per_resident') then greatest(coalesce(u.resident_count,0),0)
     else 1 end;

    -- Active memberships receive the full-period weight even if their join date is later.
    -- Inactive memberships retain day-based weight, so proration occurs on exit only.
    if exists(select 1 from public.building_memberships bm
              where bm.id=v_target and bm.membership_status='active') then
      v_weight:=v_weight*v_days;
    end if;

    insert into v2_weights values(v_target,v_weight)
    on conflict(membership_id) do update set weight=v2_weights.weight+excluded.weight;
   end loop;
  end loop;

  select coalesce(sum(weight),0) into v_den from v2_weights;
  if v_den=0 then continue; end if;
  v_total:=case when e.allocation_method in ('dynamic_per_unit','dynamic_per_meter','dynamic_per_resident')
   then coalesce(e.input_amount,e.amount)*v_den/v_days else coalesce(e.input_amount,e.amount) end;
  v_sum:=0;v_last:=null;
  for m in select * from v2_weights order by membership_id loop
   v_share:=round(v_total*m.weight/v_den,2);
   insert into public.building_expense_allocations(building_id,expense_id,membership_id,amount)
   values(p_building_id,e.id,m.membership_id,v_share);
   v_sum:=v_sum+v_share;v_last:=m.membership_id;
  end loop;
  update public.building_expense_allocations set amount=amount+(v_total-v_sum) where expense_id=e.id and membership_id=v_last;
  if e.tx_type='درآمد' and e.allocation_method like 'dynamic_%' then update public.building_expenses set amount=v_total where id=e.id; end if;
 end loop;
 for m in select id from public.building_memberships where building_id=p_building_id loop
  perform public.app_reallocate_member_payments(p_building_id,m.id);
 end loop;
end;
$function$;

CREATE OR REPLACE FUNCTION public.app_manager_delete_resident_account(p_token uuid, p_building_id uuid, p_membership_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare target public.building_memberships;
begin
 perform public.app_financial_v2_require_manager(p_token,p_building_id);
 select * into target from public.building_memberships
 where id=p_membership_id and building_id=p_building_id for update;
 if not found then raise exception 'عضویت در این ساختمان پیدا نشد'; end if;
 if target.access_role='manager' then raise exception 'حذف حساب مدیر از این مسیر مجاز نیست'; end if;

 update public.building_memberships
 set membership_status='inactive',ended_at=coalesce(ended_at,current_date)
 where id=p_membership_id;

 -- Rebuild charge allocations: active residents keep full charges; exited residents are prorated.
 perform public.app_recalculate_expense_allocations(p_token,p_building_id);

 if target.account_id is not null and not exists(
   select 1 from public.building_memberships
   where account_id=target.account_id and membership_status='active'
 ) then
   update public.app_accounts set account_status='inactive' where id=target.account_id;
   delete from public.app_sessions where account_id=target.account_id;
 end if;
 return jsonb_build_object('success',true);
end;
$function$;
