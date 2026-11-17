
create or replace function public.app_manager_get_member_balances(p_token uuid,p_building_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 v_member record; v_members jsonb:='[]'::jsonb; v_total_exp numeric; v_total_paid numeric;
 v_pending numeric; v_total_allocated numeric; v_item_overallocated numeric;
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
    and p.building_id=p_building_id and p.status='approved'
  ) paid on true
  where ea.building_id=p_building_id and ea.membership_id=v_member.membership_id and e.expense_status='active';

  select coalesce(sum(amount),0) into v_total_paid from public.building_payments
   where building_id=p_building_id and membership_id=v_member.membership_id and status='approved';
  select coalesce(sum(pa.amount),0) into v_total_allocated
   from public.building_payment_allocations pa join public.building_payments p on p.id=pa.payment_id
   where p.building_id=p_building_id and p.membership_id=v_member.membership_id and p.status='approved';
  select coalesce(sum(greatest(paid.paid_amount-ea.amount,0)),0) into v_item_overallocated
  from public.building_expense_allocations ea
  join public.building_expenses e on e.id=ea.expense_id
  left join lateral(
   select coalesce(sum(pa.amount),0) paid_amount
   from public.building_payment_allocations pa
   join public.building_payments p on p.id=pa.payment_id
   where pa.expense_allocation_id=ea.id and p.membership_id=v_member.membership_id
    and p.building_id=p_building_id and p.status='approved'
  ) paid on true
  where ea.building_id=p_building_id and ea.membership_id=v_member.membership_id and e.expense_status='active';
  select coalesce(sum(amount),0) into v_pending from public.building_payments
   where building_id=p_building_id and membership_id=v_member.membership_id and status='pending';

  v_members:=v_members||jsonb_build_array(jsonb_build_object(
   'membership_id',v_member.membership_id,'unit_no',v_member.unit_no,'full_name',v_member.full_name,
   'access_role',v_member.access_role,'resident_type',v_member.resident_type,
   'outstanding_debt',round(v_total_exp,0),
   'credit_balance',round(greatest(-coalesce(v_member.opening_debt,0),0)+greatest(v_total_paid-v_total_allocated,0)+v_item_overallocated,0),
   'pending_payments',v_pending));
 end loop;
 return jsonb_build_object('members',v_members);
end $$;

