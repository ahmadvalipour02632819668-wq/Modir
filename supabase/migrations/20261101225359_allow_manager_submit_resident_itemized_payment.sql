CREATE OR REPLACE FUNCTION public.app_submit_itemized_payment(
 p_token uuid,
 p_building_id uuid,
 p_membership_id uuid,
 p_payment_date date,
 p_description text,
 p_allocations jsonb,
 p_total_amount numeric
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
declare
 v_actor public.app_accounts;
 v_payment_id uuid;
 v_item jsonb;
 v_ea uuid;
 v_amount numeric;
 v_sum numeric:=0;
begin
 v_actor:=public.app_require_session(p_token);

 if p_total_amount is null or p_total_amount<=0 then
  raise exception 'مبلغ پرداخت نامعتبر است';
 end if;

 if jsonb_typeof(p_allocations) is distinct from 'array' or jsonb_array_length(p_allocations)=0 then
  raise exception 'حداقل یک ردیف بدهی را انتخاب کنید';
 end if;

 -- عضویت باید فعال و متعلق به همین ساختمان باشد.
 if not exists(
  select 1 from public.building_memberships bm
  where bm.id=p_membership_id
   and bm.building_id=p_building_id
   and bm.membership_status='active'
 ) then
  raise exception 'عضویت فعال در این ساختمان پیدا نشد';
 end if;

 -- ساکن فقط برای خودش پرداخت ثبت می‌کند؛ مدیر مجاز است برای ساکنان فعال همان ساختمان ثبت کند.
 if not exists(
  select 1 from public.building_memberships bm
  where bm.id=p_membership_id
   and bm.building_id=p_building_id
   and bm.account_id=v_actor.id
   and bm.membership_status='active'
 ) then
  perform public.app_financial_v2_require_manager(p_token,p_building_id);
 end if;

 perform pg_catalog.pg_advisory_xact_lock(
  pg_catalog.hashtextextended(
   p_membership_id::text||'|'||p_total_amount::text||'|'||coalesce(p_payment_date,current_date)::text,0
  )
 );

 if exists(
  select 1 from public.building_payments p
  where p.building_id=p_building_id
   and p.membership_id=p_membership_id
   and p.amount=p_total_amount
   and p.payment_date=coalesce(p_payment_date,current_date)
   and p.status='pending'
   and p.created_at>now()-interval '2 minutes'
 ) then
  raise exception 'پرداخت مشابه در انتظار بررسی است؛ از ثبت مجدد خودداری شد';
 end if;

 for v_item in select value from jsonb_array_elements(p_allocations) loop
  if v_item->>'type'<>'expense' then
   raise exception 'نوع ردیف پرداخت پشتیبانی نمی‌شود';
  end if;

  v_ea:=(v_item->>'id')::uuid;
  v_amount:=(v_item->>'amount')::numeric;

  if v_amount is null or v_amount<=0 then
   raise exception 'مبلغ تخصیص نامعتبر است';
  end if;

  if not exists(
   select 1
   from public.building_expense_allocations ea
   join public.building_expenses e on e.id=ea.expense_id
   where ea.id=v_ea
    and ea.membership_id=p_membership_id
    and ea.building_id=p_building_id
    and e.building_id=p_building_id
    and e.expense_status='active'
  ) then
   raise exception 'ردیف بدهی انتخاب‌شده معتبر نیست';
  end if;

  v_sum:=v_sum+v_amount;
 end loop;

 if round(v_sum,2)<>round(p_total_amount,2) then
  raise exception 'جمع ردیف‌ها با مبلغ پرداخت برابر نیست';
 end if;

 insert into public.building_payments(
  building_id,membership_id,amount,payment_date,description,status,created_by
 )
 values(
  p_building_id,p_membership_id,p_total_amount,coalesce(p_payment_date,current_date),
  p_description,'pending',v_actor.id
 )
 returning id into v_payment_id;

 for v_item in select value from jsonb_array_elements(p_allocations) loop
  insert into public.building_payment_item_requests(
   building_id,payment_id,expense_allocation_id,amount
  )
  values(
   p_building_id,v_payment_id,(v_item->>'id')::uuid,(v_item->>'amount')::numeric
  );
 end loop;

 return jsonb_build_object('success',true,'payment_id',v_payment_id);
end;
$function$;
