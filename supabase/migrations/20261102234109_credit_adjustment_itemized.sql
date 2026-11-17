-- Preserve gross item balances. Carry negative opening_debt as a credit adjustment
-- applied once to the final payable total, never by zeroing individual charge rows.
begin;

-- Opening balance is signed: negative values represent resident credit.
alter table public.building_memberships drop constraint if exists financial_v2_opening_debt_check;

CREATE OR REPLACE FUNCTION public.app_resident_get_financial_summary(
 p_token uuid, p_building_id uuid, p_membership_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
 v_actor public.app_accounts;
 v_building record;
 v_member record;
 v_total_exp numeric:=0;
 v_total_paid numeric:=0;
 v_total_allocated numeric:=0;
 v_overallocated numeric:=0;
 v_unallocated numeric:=0;
 v_credit_adjustment numeric:=0;
 v_item_outstanding numeric:=0;
 v_item_overallocated numeric:=0;
 v_pending numeric:=0;
 v_debt numeric:=0;
 v_credit numeric:=0;
 v_net_balance numeric:=0;
 v_payments jsonb:='[]'::jsonb;
 v_charges jsonb:='[]'::jsonb;
begin
 v_actor:=public.app_require_session(p_token);
 select * into v_building from public.buildings where id=p_building_id;
 if not found then raise exception 'ساختمان پیدا نشد'; end if;

 select bm.*,u.unit_no,u.area,u.resident_count
 into v_member
 from public.building_memberships bm
 join public.units u on u.id=bm.unit_id
 where bm.id=p_membership_id and bm.building_id=p_building_id
   and bm.membership_status='active';
 if not found then raise exception 'عضویت فعال در این ساختمان پیدا نشد'; end if;

 if v_member.account_id<>v_actor.id then
  perform public.app_financial_v2_require_manager(p_token,p_building_id);
 end if;

 v_total_exp:=coalesce(v_member.opening_debt,0);
 select v_total_exp+coalesce(sum(ea.amount),0) into v_total_exp
 from public.building_expense_allocations ea
 join public.building_expenses e on e.id=ea.expense_id
 where ea.membership_id=p_membership_id and ea.building_id=p_building_id
   and e.building_id=p_building_id and e.expense_status='active';

 select coalesce(sum(amount),0) into v_total_paid
 from public.building_payments
 where membership_id=p_membership_id and building_id=p_building_id and status='approved';

 select coalesce(sum(amount),0) into v_pending
 from public.building_payments
 where membership_id=p_membership_id and building_id=p_building_id and status='pending';

 select coalesce(sum(pa.amount),0) into v_total_allocated
 from public.building_payment_allocations pa
 join public.building_payments p on p.id=pa.payment_id
 where p.membership_id=p_membership_id and p.building_id=p_building_id and p.status='approved';

 select coalesce(sum(greatest(x.paid_amount-x.charge_amount,0)),0)
 into v_overallocated
 from (
  select ea.id,ea.amount charge_amount,coalesce(sum(pa.amount),0) paid_amount
  from public.building_expense_allocations ea
  left join public.building_payment_allocations pa on pa.expense_allocation_id=ea.id
  left join public.building_payments p on p.id=pa.payment_id
    and p.membership_id=p_membership_id and p.building_id=p_building_id and p.status='approved'
  where ea.membership_id=p_membership_id and ea.building_id=p_building_id
  group by ea.id,ea.amount
 ) x;


 select coalesce(sum(greatest(z.paid_amount-z.charge_amount,0)),0)
 into v_item_overallocated
 from (
  select ea.id,ea.amount charge_amount,
   coalesce(sum(pa.amount) filter(where p.status='approved'),0) paid_amount
  from public.building_expense_allocations ea
  left join public.building_payment_allocations pa on pa.expense_allocation_id=ea.id
  left join public.building_payments p on p.id=pa.payment_id
   and p.membership_id=p_membership_id and p.building_id=p_building_id
  where ea.membership_id=p_membership_id and ea.building_id=p_building_id
  group by ea.id,ea.amount
 ) z;
 v_unallocated:=greatest(v_total_paid-v_total_allocated,0);
 v_credit_adjustment:=greatest(-coalesce(v_member.opening_debt,0),0)+v_item_overallocated+v_unallocated;
 v_net_balance:=round(v_total_exp-v_total_paid,0);
 v_debt:=greatest(v_net_balance,0);
 v_credit:=greatest(-v_net_balance,0);

 select coalesce(jsonb_agg(to_jsonb(x) order by x.payment_date desc),'[]'::jsonb)
 into v_payments
 from (
  select id,amount,payment_date,description,status
  from public.building_payments
  where membership_id=p_membership_id and building_id=p_building_id
 ) x;

 select coalesce(jsonb_agg(to_jsonb(x) order by x.item_date asc,x.created_at asc),'[]'::jsonb)
 into v_charges
 from (
  select q.*,
   least(q.outstanding_amount,greatest(v_credit_adjustment-coalesce(
    sum(q.outstanding_amount) over(order by q.item_date asc,q.created_at asc,q.id asc
     rows between unbounded preceding and 1 preceding),0),0)) credit_applied,
   greatest(q.outstanding_amount-least(q.outstanding_amount,greatest(v_credit_adjustment-coalesce(
    sum(q.outstanding_amount) over(order by q.item_date asc,q.created_at asc,q.id asc
     rows between unbounded preceding and 1 preceding),0),0)),0) payable_amount
  from (
   select ea.id,e.description,ea.amount,
    coalesce(paid.paid_amount,0) paid_amount,
    greatest(ea.amount-coalesce(paid.paid_amount,0),0) outstanding_amount,
    e.expense_date item_date,e.created_at,'expense'::text item_type,ea.transfer_note
   from public.building_expense_allocations ea
   join public.building_expenses e on e.id=ea.expense_id
   left join lateral (
    select coalesce(sum(pa.amount),0) paid_amount
    from public.building_payment_allocations pa
    join public.building_payments pp on pp.id=pa.payment_id
    where pa.expense_allocation_id=ea.id and pa.building_id=p_building_id
     and pp.membership_id=p_membership_id and pp.building_id=p_building_id and pp.status='approved'
   ) paid on true
   where ea.membership_id=p_membership_id and ea.building_id=p_building_id
    and e.building_id=p_building_id and e.expense_status='active'
  ) q
 ) x;

 select coalesce(sum((item->>'outstanding_amount')::numeric),0)
 into v_item_outstanding from jsonb_array_elements(v_charges) item;

 return jsonb_build_object(
  'success',true,'building_id',p_building_id,'building_name',v_building.name,
  'membership_id',p_membership_id,'unit_no',v_member.unit_no,
  'resident_type',v_member.resident_type,
  'debt_balance',v_debt,'credit_balance',v_credit,
  'credit_adjustment',v_credit_adjustment,
  'gross_outstanding',v_item_outstanding,
  'account_balance',v_net_balance,'net_balance',v_net_balance,
  'pending_payments',v_pending,'payments',v_payments,'charges',v_charges,
  'opening_debt',coalesce(v_member.opening_debt,0)
 );
end;
$function$;
