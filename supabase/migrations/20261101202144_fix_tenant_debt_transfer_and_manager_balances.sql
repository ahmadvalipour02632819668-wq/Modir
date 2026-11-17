begin;

create or replace function public.app_reconcile_inactive_tenant_debts(
 p_token uuid,p_building_id uuid
) returns jsonb
language plpgsql security definer set search_path=''
as $function$
declare
 v_actor uuid; t record; owner_id uuid; a record; due numeric; paid numeric; transfer numeric:=0; opening numeric:=0; n integer:=0;
begin
 v_actor:=public.app_financial_v2_require_manager(p_token,p_building_id);
 for t in
  select bm.id,bm.unit_id,bm.opening_debt,bm.ended_at
  from public.building_memberships bm
  where bm.building_id=p_building_id and bm.resident_type='tenant' and bm.membership_status='inactive'
 loop
  select bm.id into owner_id
  from public.building_memberships bm
  where bm.building_id=p_building_id and bm.unit_id=t.unit_id
    and bm.resident_type in ('owner','owner_resident') and bm.membership_status='active'
  order by (bm.resident_type='owner_resident') desc,bm.joined_at desc limit 1;
  if owner_id is null then continue; end if;

  for a in
   select ea.id,ea.expense_id,ea.amount,e.description
   from public.building_expense_allocations ea
   join public.building_expenses e on e.id=ea.expense_id
   where ea.building_id=p_building_id and ea.membership_id=t.id and e.expense_status='active'
     and not exists(select 1 from public.building_expense_allocations x
                    where x.building_id=p_building_id and x.expense_id=ea.expense_id
                      and x.membership_id=owner_id and x.original_membership_id=t.id)
  loop
   select coalesce(sum(pa.amount),0) into paid
   from public.building_payment_allocations pa where pa.expense_allocation_id=a.id;
   due:=greatest(a.amount-paid,0);
   if due>0 then
    insert into public.building_expense_allocations(building_id,expense_id,membership_id,amount,original_membership_id,transfer_note)
    values(p_building_id,a.expense_id,owner_id,due,t.id,'انتقال بدهی مستأجر قبلی به مالک');
    transfer:=transfer+due;
   end if;
  end loop;

  if coalesce(t.opening_debt,0)>0 then
   opening:=opening+t.opening_debt;
   update public.building_memberships set opening_debt=0 where id=t.id;
   update public.building_memberships set opening_debt=coalesce(opening_debt,0)+t.opening_debt where id=owner_id;
  end if;
  n:=n+1;
 end loop;

 for t in select id from public.building_memberships where building_id=p_building_id loop
  perform public.app_reallocate_member_payments(p_building_id,t.id);
 end loop;
 return jsonb_build_object('success',true,'processed_memberships',n,'transferred_allocations',transfer,'transferred_opening_debt',opening);
end;$function$;

create or replace function public.app_manager_get_member_balances(p_token uuid,p_building_id uuid)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_member record;v_members jsonb:='[]'::jsonb;v_total_exp numeric;v_total_paid numeric;v_pending numeric;
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
  select coalesce(v_member.opening_debt,0)+coalesce(sum(ea.amount),0) into v_total_exp
  from public.building_expense_allocations ea
  join public.building_expenses e on e.id=ea.expense_id
  where ea.building_id=p_building_id and ea.membership_id=v_member.membership_id and e.expense_status='active';
  select coalesce(sum(amount),0) into v_total_paid from public.building_payments
   where building_id=p_building_id and membership_id=v_member.membership_id and status='approved';
  select coalesce(sum(amount),0) into v_pending from public.building_payments
   where building_id=p_building_id and membership_id=v_member.membership_id and status='pending';
  v_members:=v_members||jsonb_build_array(jsonb_build_object(
   'membership_id',v_member.membership_id,'unit_no',v_member.unit_no,'full_name',v_member.full_name,
   'access_role',v_member.access_role,'resident_type',v_member.resident_type,
   'outstanding_debt',round(greatest(v_total_exp-v_total_paid,0),0),
   'credit_balance',round(greatest(v_total_paid-v_total_exp,0),0),'pending_payments',v_pending));
 end loop;
 return jsonb_build_object('members',v_members);
end;$function$;

revoke execute on function public.app_reconcile_inactive_tenant_debts(uuid,uuid) from public,anon,authenticated;
revoke execute on function public.app_manager_get_member_balances(uuid,uuid) from public,authenticated;
grant execute on function public.app_manager_get_member_balances(uuid,uuid) to anon;

commit;
