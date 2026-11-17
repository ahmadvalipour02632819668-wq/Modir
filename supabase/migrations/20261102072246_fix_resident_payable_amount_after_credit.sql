create or replace function public.app_resident_get_financial_summary(p_token uuid, p_building_id uuid, p_membership_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
 v_actor public.app_accounts;
 v_building record;
 v_member record;
 v_total_exp numeric := 0;
 v_total_paid numeric := 0;
 v_pending numeric := 0;
 v_debt numeric := 0;
 v_credit numeric := 0;
 v_payments jsonb := '[]'::jsonb;
 v_charges jsonb := '[]'::jsonb;
begin
 v_actor := public.app_require_session(p_token);

 select * into v_building
 from public.buildings
 where id=p_building_id;
 if not found then raise exception 'ساختمان پیدا نشد'; end if;

 select bm.*,u.unit_no,u.area,u.resident_count
 into v_member
 from public.building_memberships bm
 join public.units u on u.id=bm.unit_id
 where bm.id=p_membership_id
   and bm.building_id=p_building_id
   and bm.membership_status='active';

 if not found then
  raise exception 'عضویت فعال در این ساختمان پیدا نشد';
 end if;

 if v_member.account_id <> v_actor.id then
  perform public.app_financial_v2_require_manager(p_token,p_building_id);
 end if;

 v_total_exp := coalesce(v_member.opening_debt,0);
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

 v_debt := greatest(0,round(v_total_exp-v_total_paid,0));
 v_credit := greatest(0,round(v_total_paid-v_total_exp,0));

 select coalesce(jsonb_agg(to_jsonb(x) order by x.payment_date desc),'[]'::jsonb)
 into v_payments
 from (
   select id,amount,payment_date,description,status
   from public.building_payments
   where membership_id=p_membership_id and building_id=p_building_id
 ) x;

 /*
  * amount = مبلغ اصلی هر بدهی
  * payable_amount = مانده واقعی قابل پرداخت پس از کسر پرداخت‌های قبلی و
  *                  بستانکاری باقی‌مانده. بستانکاری از قدیمی‌ترین بدهی
  *                  به جدیدترین بدهی اعمال می‌شود.
  */
 select coalesce(jsonb_agg(to_jsonb(x) order by x.item_date desc),'[]'::jsonb)
 into v_charges
 from (
   select
     q.id,
     q.description,
     q.amount,
     q.payable_amount,
     q.item_date,
     q.item_type,
     q.transfer_note
   from (
     select
       b.id,
       b.description,
       b.amount,
       b.item_date,
       b.item_type,
       b.transfer_note,
       greatest(
         least(
           b.outstanding_amount,
           greatest(
             v_credit - coalesce(
               sum(b.outstanding_amount) over (
                 order by b.item_date asc, b.created_at asc, b.id asc
                 rows between unbounded preceding and 1 preceding
               ),0
             ),
             0
           )
         ),
         0
       ) as credit_applied,
       greatest(
         b.outstanding_amount - greatest(
           least(
             b.outstanding_amount,
             greatest(
               v_credit - coalesce(
                 sum(b.outstanding_amount) over (
                   order by b.item_date asc, b.created_at asc, b.id asc
                   rows between unbounded preceding and 1 preceding
                 ),0
               ),
               0
             )
           ),
           0
         ),
         0
       ) as payable_amount
     from (
       select
         ea.id,
         e.description,
         ea.amount,
         e.expense_date as item_date,
         e.created_at,
         'expense'::text as item_type,
         ea.transfer_note,
         greatest(
           ea.amount - coalesce((
             select sum(pa.amount)
             from public.building_payment_allocations pa
             join public.building_payments pp on pp.id=pa.payment_id
             where pa.expense_allocation_id=ea.id
               and pa.building_id=p_building_id
               and pp.membership_id=p_membership_id
               and pp.building_id=p_building_id
               and pp.status='approved'
           ),0),
           0
         ) as outstanding_amount
       from public.building_expense_allocations ea
       join public.building_expenses e on e.id=ea.expense_id
       where ea.membership_id=p_membership_id
         and ea.building_id=p_building_id
         and e.building_id=p_building_id
         and e.expense_status='active'
     ) b
   ) q
 ) x;

 return jsonb_build_object(
   'success',true,'building_id',p_building_id,'building_name',v_building.name,
   'membership_id',p_membership_id,'unit_no',v_member.unit_no,
   'resident_type',v_member.resident_type,'debt_balance',v_debt,
   'credit_balance',v_credit,'pending_payments',v_pending,
   'payments',v_payments,'charges',v_charges,
   'opening_debt',coalesce(v_member.opening_debt,0)
 );
end;
$function$;

create or replace function public.app_submit_itemized_payment(p_token uuid, p_building_id uuid, p_membership_id uuid, p_payment_date date, p_description text, p_allocations jsonb, p_total_amount numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
 v_actor public.app_accounts;
 v_payment_id uuid;
 v_item jsonb;
 v_ea uuid;
 v_amount numeric;
 v_sum numeric:=0;
 v_total_exp numeric:=0;
 v_total_paid numeric:=0;
 v_current_debt numeric:=0;
 v_due_remaining numeric:=0;
begin
 v_actor:=public.app_require_session(p_token);

 if p_total_amount is null or p_total_amount<=0 then
  raise exception 'مبلغ پرداخت نامعتبر است';
 end if;
 if jsonb_typeof(p_allocations) is distinct from 'array' or jsonb_array_length(p_allocations)=0 then
  raise exception 'حداقل یک ردیف بدهی را انتخاب کنید';
 end if;
 if not exists(
  select 1 from public.building_memberships bm
  where bm.id=p_membership_id and bm.building_id=p_building_id and bm.membership_status='active'
 ) then raise exception 'عضویت فعال در این ساختمان پیدا نشد'; end if;
 if not exists(
  select 1 from public.building_memberships bm
  where bm.id=p_membership_id and bm.building_id=p_building_id
    and bm.account_id=v_actor.id and bm.membership_status='active'
 ) then perform public.app_financial_v2_require_manager(p_token,p_building_id); end if;

 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
  p_membership_id::text||'|'||p_total_amount::text||'|'||coalesce(p_payment_date,current_date)::text,0
 ));

 select coalesce(bm.opening_debt,0) into v_total_exp
 from public.building_memberships bm
 where bm.id=p_membership_id and bm.building_id=p_building_id;
 select v_total_exp+coalesce(sum(ea.amount),0) into v_total_exp
 from public.building_expense_allocations ea
 join public.building_expenses e on e.id=ea.expense_id
 where ea.membership_id=p_membership_id and ea.building_id=p_building_id
   and e.building_id=p_building_id and e.expense_status='active';
 select coalesce(sum(amount),0) into v_total_paid
 from public.building_payments
 where membership_id=p_membership_id and building_id=p_building_id and status='approved';
 v_current_debt:=greatest(0,round(v_total_exp-v_total_paid,0));
 if round(p_total_amount,0)>round(v_current_debt,0) then
  raise exception 'مبلغ پرداخت بیشتر از مانده واقعی بدهی است؛ مانده قابل پرداخت: % تومان', round(v_current_debt,0);
 end if;

 if exists(
  select 1 from public.building_payments p
  where p.building_id=p_building_id and p.membership_id=p_membership_id
   and p.amount=p_total_amount and p.payment_date=coalesce(p_payment_date,current_date)
   and p.status='pending' and p.created_at>now()-interval '2 minutes'
 ) then raise exception 'پرداخت مشابه در انتظار بررسی است؛ از ثبت مجدد خودداری شد'; end if;

 for v_item in select value from jsonb_array_elements(p_allocations) loop
  if v_item->>'type'<>'expense' then raise exception 'نوع ردیف پرداخت پشتیبانی نمی‌شود'; end if;
  v_ea:=(v_item->>'id')::uuid;
  v_amount:=(v_item->>'amount')::numeric;
  if v_amount is null or v_amount<=0 then raise exception 'مبلغ تخصیص نامعتبر است'; end if;

  select greatest(
    ea.amount-coalesce((select sum(pa.amount)
      from public.building_payment_allocations pa
      join public.building_payments pp on pp.id=pa.payment_id
      where pa.expense_allocation_id=ea.id
        and pp.membership_id=p_membership_id and pp.building_id=p_building_id
        and pp.status='approved'),0),0)
  into v_due_remaining
  from public.building_expense_allocations ea
  join public.building_expenses e on e.id=ea.expense_id
  where ea.id=v_ea and ea.membership_id=p_membership_id and ea.building_id=p_building_id
    and e.building_id=p_building_id and e.expense_status='active';
  if v_due_remaining is null then raise exception 'ردیف بدهی انتخاب‌شده معتبر نیست'; end if;
  if v_amount>v_due_remaining then
   raise exception 'مبلغ پرداخت این ردیف بیشتر از مانده خود بدهی است';
  end if;
  v_sum:=v_sum+v_amount;
 end loop;

 if round(v_sum,2)<>round(p_total_amount,2) then raise exception 'جمع ردیف‌ها با مبلغ پرداخت برابر نیست'; end if;

 insert into public.building_payments(building_id,membership_id,amount,payment_date,description,status,created_by)
 values(p_building_id,p_membership_id,p_total_amount,coalesce(p_payment_date,current_date),p_description,'pending',v_actor.id)
 returning id into v_payment_id;

 for v_item in select value from jsonb_array_elements(p_allocations) loop
  insert into public.building_payment_item_requests(building_id,payment_id,expense_allocation_id,amount)
  values(p_building_id,v_payment_id,(v_item->>'id')::uuid,(v_item->>'amount')::numeric);
 end loop;
 return jsonb_build_object('success',true,'payment_id',v_payment_id);
end;
$function$;
