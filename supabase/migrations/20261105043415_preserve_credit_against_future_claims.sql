
create or replace function public.app_reallocate_member_payments(p_building_id uuid,p_membership_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare
 v_payment record; v_due record; v_req record; v_remaining numeric; v_take numeric; v_allocated numeric;
begin
 delete from public.building_payment_allocations pa
 where pa.payment_id in (select p.id from public.building_payments p
  where p.building_id=p_building_id and p.membership_id=p_membership_id);

 for v_payment in
  select p.id,p.amount,p.created_at from public.building_payments p
  where p.building_id=p_building_id and p.membership_id=p_membership_id and p.status='approved'
  order by p.payment_date,p.created_at,p.id
 loop
  v_remaining:=v_payment.amount;
  for v_req in
   select r.expense_allocation_id,r.amount,ea.amount as due_amount
   from public.building_payment_item_requests r
   join public.building_expense_allocations ea on ea.id=r.expense_allocation_id
   join public.building_expenses e on e.id=ea.expense_id
   where r.payment_id=v_payment.id and r.building_id=p_building_id
    and ea.membership_id=p_membership_id and e.expense_status='active'
    and e.created_at<=v_payment.created_at
   order by r.created_at
  loop
   select greatest(v_req.due_amount-coalesce(sum(pa.amount),0),0) into v_allocated
   from public.building_payment_allocations pa where pa.expense_allocation_id=v_req.expense_allocation_id;
   v_take:=least(v_req.amount,v_allocated,v_remaining);
   if v_take>0 then
    insert into public.building_payment_allocations(building_id,payment_id,expense_allocation_id,amount)
    values(p_building_id,v_payment.id,v_req.expense_allocation_id,v_take);
    v_remaining:=v_remaining-v_take;
   end if;
   exit when v_remaining<=0;
  end loop;
  if v_remaining>0 then
   for v_due in
    select ea.id,ea.amount,e.expense_date,e.created_at
    from public.building_expense_allocations ea
    join public.building_expenses e on e.id=ea.expense_id
    where ea.building_id=p_building_id and ea.membership_id=p_membership_id
      and e.expense_status='active' and e.created_at<=v_payment.created_at
    order by e.expense_date,e.created_at,ea.id
   loop
    select greatest(v_due.amount-coalesce(sum(pa.amount),0),0) into v_allocated
    from public.building_payment_allocations pa where pa.expense_allocation_id=v_due.id;
    v_take:=least(v_allocated,v_remaining);
    if v_take>0 then
     insert into public.building_payment_allocations(building_id,payment_id,expense_allocation_id,amount)
     values(p_building_id,v_payment.id,v_due.id,v_take);
     v_remaining:=v_remaining-v_take;
    end if;
    exit when v_remaining<=0;
   end loop;
  end if;
 end loop;
end $$;

