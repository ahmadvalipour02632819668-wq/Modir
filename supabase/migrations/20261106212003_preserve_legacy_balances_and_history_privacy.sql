update public.building_memberships bm set opening_debt=v.opening_debt
from (values
 ('abcf621b-f322-45bc-843d-eb8aa14e4ba7'::uuid,0::numeric),
 ('5b5951c8-d666-4497-9ac4-d45015991c48'::uuid,-411000::numeric),
 ('6fcce0e1-07cf-4de4-b973-55e9fe819101'::uuid,0::numeric),
 ('f9e96105-e5ed-47e4-a0ae-249021a7de4c'::uuid,0::numeric),
 ('b7df0d71-98bb-453f-b250-d0b7b21138ee'::uuid,0::numeric),
 ('f82dcdc1-edec-4ed9-a0ed-f8736318e29d'::uuid,0::numeric),
 ('395240bc-37f3-4e40-9d9a-cd01e1adc89c'::uuid,0::numeric),
 ('193fe677-12e3-432b-8a07-7194d5c48970'::uuid,0::numeric),
 ('e3c4eb72-86d0-448c-afaa-fca2e398f0e2'::uuid,89000::numeric),
 ('2904ee56-2861-43c5-a73c-4b12010682b3'::uuid,0::numeric),
 ('66204dc3-3ec4-4574-8497-3512fa930a9a'::uuid,5478000::numeric),
 ('d4587987-f7ae-402d-9ab0-3d3c9b856fbc'::uuid,5434000::numeric)
) v(account_id,opening_debt)
where bm.account_id=v.account_id and bm.building_id='9b79d1a8-91cb-4dc9-8e5c-22aaf5c21002'::uuid;

create or replace function public.app_manager_get_member_balances(p_token uuid,p_building_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_member record; v_members jsonb:='[]'::jsonb;
 v_total_exp numeric; v_total_paid numeric; v_pending numeric;
 v_total_allocated numeric; v_item_overallocated numeric;
begin
 perform public.app_financial_v2_require_manager(p_token,p_building_id);
 perform public.app_reconcile_inactive_tenant_debts(p_token,p_building_id);
 for v_member in
  select bm.id membership_id,bm.opening_debt,u.unit_no,a.full_name,bm.resident_type,bm.access_role
  from public.building_memberships bm
  left join public.app_accounts a on a.id=bm.account_id
  left join public.units u on u.id=bm.unit_id
  where bm.building_id=p_building_id and bm.membership_status='active'
 loop
  select greatest(coalesce(v_member.opening_debt,0),0)+coalesce(sum(greatest(ea.amount-coalesce(paid.paid_amount,0),0)),0)
  into v_total_exp
  from public.building_expense_allocations ea
  join public.building_expenses e on e.id=ea.expense_id
  left join lateral(
   select coalesce(sum(pa.amount),0) paid_amount
   from public.building_payment_allocations pa
   join public.building_payments p on p.id=pa.payment_id
   where pa.expense_allocation_id=ea.id and p.membership_id=v_member.membership_id
    and p.building_id=p_building_id and p.status='approved' and p.legacy_import_id is null
  ) paid on true
  where ea.building_id=p_building_id and ea.membership_id=v_member.membership_id
   and e.expense_status='active' and e.legacy_import_id is null;

  select coalesce(sum(amount),0) into v_total_paid from public.building_payments
   where building_id=p_building_id and membership_id=v_member.membership_id
    and status='approved' and legacy_import_id is null;
  select coalesce(sum(pa.amount),0) into v_total_allocated
   from public.building_payment_allocations pa
   join public.building_payments p on p.id=pa.payment_id
   where p.building_id=p_building_id and p.membership_id=v_member.membership_id
    and p.status='approved' and p.legacy_import_id is null;
  select coalesce(sum(greatest(paid.paid_amount-ea.amount,0)),0) into v_item_overallocated
  from public.building_expense_allocations ea
  join public.building_expenses e on e.id=ea.expense_id
  left join lateral(
   select coalesce(sum(pa.amount),0) paid_amount
   from public.building_payment_allocations pa
   join public.building_payments p on p.id=pa.payment_id
   where pa.expense_allocation_id=ea.id and p.membership_id=v_member.membership_id
    and p.building_id=p_building_id and p.status='approved' and p.legacy_import_id is null
  ) paid on true
  where ea.building_id=p_building_id and ea.membership_id=v_member.membership_id
   and e.expense_status='active' and e.legacy_import_id is null;
  select coalesce(sum(amount),0) into v_pending from public.building_payments
   where building_id=p_building_id and membership_id=v_member.membership_id
    and status='pending' and legacy_import_id is null;
  v_members:=v_members||jsonb_build_array(jsonb_build_object(
   'membership_id',v_member.membership_id,'unit_no',v_member.unit_no,'full_name',v_member.full_name,
   'access_role',v_member.access_role,'resident_type',v_member.resident_type,
   'outstanding_debt',round(v_total_exp,0),
   'credit_balance',round(greatest(-coalesce(v_member.opening_debt,0),0)+greatest(v_total_paid-v_total_allocated,0)+v_item_overallocated,0),
   'pending_payments',v_pending));
 end loop;
 return jsonb_build_object('members',v_members);
end; $$;

create or replace function public.app_resident_get_legacy_history(p_token uuid,p_building_id uuid,p_membership_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_actor public.app_accounts;
 v_member record;
 v_transactions jsonb:='[]'::jsonb;
 v_requests jsonb:='[]'::jsonb;
 v_announcements jsonb:='[]'::jsonb;
 v_resident_requests jsonb:='[]'::jsonb;
 v_rates jsonb:='[]'::jsonb;
 v_exemptions jsonb:='[]'::jsonb;
 v_occupancy text;
begin
 v_actor:=public.app_require_session(p_token);
 select bm.account_id,u.unit_no,bm.resident_type into v_member
 from public.building_memberships bm join public.units u on u.id=bm.unit_id
 where bm.id=p_membership_id and bm.building_id=p_building_id and bm.membership_status='active';
 if not found then raise exception 'عضویت فعال پیدا نشد'; end if;
 if v_member.account_id<>v_actor.id then raise exception 'دسترسی به سوابق مالی سایر واحدها مجاز نیست'; end if;
 v_occupancy:=case v_member.resident_type when 'owner_resident' then 'مالک ساکن' when 'owner' then 'مالک' when 'tenant' then 'مستأجر' else null end;
 select coalesce(jsonb_agg(payload order by coalesce(payload->>'tx_date',payload->>'created_at') desc,legacy_id desc),'[]'::jsonb)
 into v_transactions from public.legacy_import_records
 where building_id=p_building_id and source_table='transactions'
  and payload->>'unit_no'=v_member.unit_no::text
  and (v_occupancy is null or payload->>'occupancy'=v_occupancy);
 select coalesce(jsonb_agg(payload order by coalesce(payload->>'created_at',payload->>'pay_date') desc,legacy_id desc),'[]'::jsonb)
 into v_requests from public.legacy_import_records
 where building_id=p_building_id and source_table='payment_requests'
  and payload->>'unit_no'=v_member.unit_no::text
  and payload->>'account_id'=v_actor.id::text;
 select coalesce(jsonb_agg(payload order by legacy_id),'[]'::jsonb) into v_announcements
 from public.legacy_import_records where building_id=p_building_id and source_table='announcements';
 select coalesce(jsonb_agg(payload order by legacy_id),'[]'::jsonb) into v_resident_requests
 from public.legacy_import_records where building_id=p_building_id and source_table='resident_requests'
  and payload->>'account_id'=v_actor.id::text;
 select coalesce(jsonb_agg(payload order by legacy_id),'[]'::jsonb) into v_rates
 from public.legacy_import_records where building_id=p_building_id and source_table='rates';
 select coalesce(jsonb_agg(payload order by legacy_id),'[]'::jsonb) into v_exemptions
 from public.legacy_import_records where building_id=p_building_id and source_table='exemptions';
 return jsonb_build_object('transactions',v_transactions,'payment_requests',v_requests,
  'announcements',v_announcements,'resident_requests',v_resident_requests,
  'rates',v_rates,'exemptions',v_exemptions);
end; $$;

revoke all on function public.app_manager_get_member_balances(uuid,uuid) from public;
grant execute on function public.app_manager_get_member_balances(uuid,uuid) to anon,authenticated;
revoke all on function public.app_resident_get_legacy_history(uuid,uuid,uuid) from public;
grant execute on function public.app_resident_get_legacy_history(uuid,uuid,uuid) to anon,authenticated;
