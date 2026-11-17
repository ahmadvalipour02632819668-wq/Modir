
create unique index if not exists transactions_one_opening_balance_per_account_uidx
on public.transactions (building_id, account_id)
where source = 'opening_balance' and account_id is not null;

create or replace function public.app_admin_register_opening_balance(
  p_token uuid,
  p_account_id uuid,
  p_balance_type text,
  p_amount bigint,
  p_year integer,
  p_month integer,
  p_day integer,
  p_note text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  me public.accounts;
  a public.accounts;
  v_type text;
  v_category text;
  v_amount bigint;
  v_desc text;
  v_tx public.transactions;
begin
  me := public.bm_admin(p_token);

  if p_balance_type not in ('debit','credit') then
    raise exception 'نوع مانده اولیه معتبر نیست';
  end if;
  if coalesce(p_amount,0) <= 0 then
    raise exception 'مبلغ باید بیشتر از صفر باشد';
  end if;
  if p_year not between 1300 and 1600 or p_month not between 1 and 12 or p_day not between 1 and 31 then
    raise exception 'تاریخ مانده اولیه معتبر نیست';
  end if;

  select * into a
    from public.accounts
   where id=p_account_id and building_id=me.building_id
   for update;
  if not found then
    raise exception 'حساب انتخاب‌شده متعلق به این ساختمان نیست';
  end if;

  if exists (
    select 1 from public.transactions
     where building_id=me.building_id
       and account_id=a.id
       and source='opening_balance'
  ) then
    raise exception 'برای این حساب قبلاً مانده اولیه ثبت شده است؛ برای اصلاح، با پشتیبانی تماس بگیرید';
  end if;

  if p_balance_type='debit' then
    v_type := 'انتقال مانده مالک';
    v_category := 'owner_balance_transfer_debt';
    v_amount := -p_amount;
    v_desc := 'ثبت بدهی پیشین حساب' || case when nullif(btrim(p_note),'') is not null then ' - '||btrim(p_note) else '' end;
  else
    v_type := 'انتقال بستانکاری';
    v_category := 'opening_balance_credit';
    v_amount := p_amount;
    v_desc := 'ثبت بستانکاری پیشین حساب' || case when nullif(btrim(p_note),'') is not null then ' - '||btrim(p_note) else '' end;
  end if;

  insert into public.transactions(
    tx_date,year,month,day,ym,month_name,unit_no,tx_type,description,amount,
    occupancy,category,source,created_by,building_id,account_id
  ) values (
    p_year::text||'/'||lpad(p_month::text,2,'0')||'/'||lpad(p_day::text,2,'0'),
    p_year,p_month,p_day,p_year*100+p_month,public.bm_month_name(p_month),
    a.unit_no,v_type,v_desc,v_amount,a.occupancy,v_category,'opening_balance',me.id,me.building_id,a.id
  ) returning * into v_tx;

  return jsonb_build_object('ok',true,'transaction_id',v_tx.id,'amount',p_amount,'balance_type',p_balance_type);
end;
$function$;

revoke all on function public.app_admin_register_opening_balance(uuid,uuid,text,bigint,integer,integer,integer,text) from public;
grant execute on function public.app_admin_register_opening_balance(uuid,uuid,text,bigint,integer,integer,integer,text) to anon, authenticated;

create or replace function public.app_report(p_token uuid, p_year integer, p_month integer)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
 me public.accounts;
 v_ym int:=p_year*100+p_month;
 v_prev int;
 v_start int;
 a record;
 d record;
 rows jsonb:='[]'::jsonb;
 due_cur bigint;
 due_prev bigint;
 expense_due_cur bigint;
 expense_due_prev bigint;
 paid_prev bigint;
 paid_cur bigint;
 pcharge bigint;
 pwater bigint;
 pgas bigint;
 prepair bigint;
 pparking bigint;
 owner_transfer_debt bigint;
 expense_items jsonb;
 water_total bigint;
 gas_total bigint;
 missing jsonb:='[]'::jsonb;
 m int;
 rate_row jsonb;
begin
 me:=public.bm_auth(p_token);
 v_prev:=public.bm_prev_ym(v_ym);
 select coalesce(value,'140406')::int into v_start from public.settings where building_id=me.building_id and key='start_ym';
 select coalesce(sum(amount),0) into water_total from public.transactions where building_id=me.building_id and ym=v_ym and unit_no is null and tx_type='هزینه' and category='water';
 select coalesce(sum(amount),0) into gas_total from public.transactions where building_id=me.building_id and ym=v_ym and unit_no is null and tx_type='هزینه' and category='gas';
 m:=v_start;
 while m<=v_ym loop
  if not exists(select 1 from public.rates where building_id=me.building_id and year=m/100 and month=m%100) then
   missing:=missing||to_jsonb((m/100)::text||'/'||lpad((m%100)::text,2,'0'));
  end if;
  m:=public.bm_next_ym(m);
 end loop;

 for a in
  select * from public.accounts x
   where x.building_id=me.building_id and x.is_active and (me.is_admin or x.id=me.id)
   order by x.unit_no,x.is_primary desc
 loop
  select * into d from public.bm2_account_month_due(me.building_id,a.id,v_ym);

  select coalesce(sum(-t.amount),0) into owner_transfer_debt
    from public.transactions t
   where t.building_id=me.building_id and t.account_id=a.id and t.unit_no=a.unit_no
     and t.tx_type='انتقال مانده مالک' and t.amount<0
     and t.source in ('owner_successor_balance_transfer','opening_balance');

  due_cur:=coalesce(d.charge,0)+coalesce(d.repair,0)+coalesce(d.parking,0)+coalesce(d.water,0)+coalesce(d.gas,0)+owner_transfer_debt;

  select coalesce(sum((sh->>'amount')::bigint),0) into expense_due_cur
    from public.transactions t cross join lateral jsonb_array_elements(coalesce(t.expense_shares,'[]'::jsonb)) sh
   where t.building_id=me.building_id and t.tx_type='هزینه' and t.year*100+t.month=v_ym
     and sh->>'account_id'=a.id::text;
  due_cur:=due_cur+expense_due_cur;

  if v_prev>=greatest(v_start,coalesce(a.start_ym,v_start)) then
   select coalesce(sum((x.charge+x.repair+x.parking+x.water+x.gas)),0) into due_prev
    from generate_series(greatest(v_start,coalesce(a.start_ym,v_start)),v_prev) g(ym)
    cross join lateral public.bm2_account_month_due(me.building_id,a.id,g.ym) x;
  else
   due_prev:=0;
  end if;

  select coalesce(sum((sh->>'amount')::bigint),0) into expense_due_prev
    from public.transactions t cross join lateral jsonb_array_elements(coalesce(t.expense_shares,'[]'::jsonb)) sh
   where t.building_id=me.building_id and t.tx_type='هزینه'
     and t.year*100+t.month between greatest(v_start,coalesce(a.start_ym,v_start)) and v_prev
     and sh->>'account_id'=a.id::text;
  due_prev:=due_prev+expense_due_prev;

  select coalesce(sum(amount),0) into paid_prev
    from public.transactions t
   where t.building_id=me.building_id and t.unit_no=a.unit_no
     and t.tx_type in ('درآمد','انتقال بستانکاری','انتقال مانده مالک')
     and (t.account_id=a.id or (t.account_id is null and t.occupancy=a.occupancy))
     and (t.tx_type<>'انتقال مانده مالک' or t.amount>0) and t.ym<=v_prev;

  select coalesce(sum(amount),0) into paid_cur
    from public.transactions t
   where t.building_id=me.building_id and t.unit_no=a.unit_no
     and t.tx_type in ('درآمد','انتقال بستانکاری','انتقال مانده مالک')
     and (t.account_id=a.id or (t.account_id is null and t.occupancy=a.occupancy))
     and (t.tx_type<>'انتقال مانده مالک' or t.amount>0) and t.ym=v_ym;

  select coalesce(sum(amount) filter(where category='charge'),0),
         coalesce(sum(amount) filter(where category='water'),0),
         coalesce(sum(amount) filter(where category='gas'),0),
         coalesce(sum(amount) filter(where category='repair'),0),
         coalesce(sum(amount) filter(where category='parking'),0)
    into pcharge,pwater,pgas,prepair,pparking
    from public.transactions t
   where t.building_id=me.building_id and t.unit_no=a.unit_no
     and t.tx_type in ('درآمد','انتقال بستانکاری','انتقال مانده مالک')
     and (t.account_id=a.id or (t.account_id is null and t.occupancy=a.occupancy))
     and (t.tx_type<>'انتقال مانده مالک' or t.amount>0) and t.ym=v_ym;

  select coalesce(jsonb_agg(jsonb_build_object(
      'transaction_id',t.id,
      'description',coalesce(nullif(t.description,''),'هزینه تسهیمی'),
      'category_name',coalesce(nullif(t.category,''),'هزینه'),
      'amount',greatest((sh->>'amount')::bigint
        - coalesce((select sum(x.amount) from public.transactions x where x.building_id=me.building_id and x.account_id=a.id and x.unit_no=a.unit_no and x.tx_type='درآمد' and x.category='expense:'||t.id::text and x.year=t.year and x.month=t.month),0)
        - coalesce((select sum(pr.amount) from public.payment_requests pr where pr.building_id=me.building_id and pr.account_id=a.id and pr.unit_no=a.unit_no and pr.category='expense:'||t.id::text and pr.year=t.year and pr.month=t.month and pr.status='pending'),0),0)
    ) order by t.year,t.month,t.id), '[]'::jsonb)
    into expense_items
    from public.transactions t
    cross join lateral jsonb_array_elements(coalesce(t.expense_shares,'[]'::jsonb)) sh
   where t.building_id=me.building_id and t.tx_type='هزینه'
     and t.year*100+t.month between greatest(v_start,coalesce(a.start_ym,v_start)) and v_ym
     and sh->>'account_id'=a.id::text
     and greatest((sh->>'amount')::bigint
       - coalesce((select sum(x.amount) from public.transactions x where x.building_id=me.building_id and x.account_id=a.id and x.unit_no=a.unit_no and x.tx_type='درآمد' and x.category='expense:'||t.id::text and x.year=t.year and x.month=t.month),0)
       - coalesce((select sum(pr.amount) from public.payment_requests pr where pr.building_id=me.building_id and pr.account_id=a.id and pr.unit_no=a.unit_no and pr.category='expense:'||t.id::text and pr.year=t.year and pr.month=t.month and pr.status='pending'),0),0)>0;

  rows:=rows||jsonb_build_object(
   'account_id',a.id,'unit_no',a.unit_no,
   'persons',(select u.persons from public.units u where u.building_id=me.building_id and u.unit_no=a.unit_no),
   'occupancy',a.occupancy,'full_name',a.full_name,'phone',a.phone,
   'charge',coalesce(d.charge,0),'water',coalesce(d.water,0),'gas',coalesce(d.gas,0),'repair',coalesce(d.repair,0),'parking',coalesce(d.parking,0),
   'ok_charge',pcharge>=coalesce(d.charge,0),'ok_water',pwater>=coalesce(d.water,0),'ok_gas',pgas>=coalesce(d.gas,0),'ok_repair',prepair>=coalesce(d.repair,0),'ok_parking',pparking>=coalesce(d.parking,0),
   'expenses',coalesce(expense_items,'[]'::jsonb),'exempt_gas',public.bm_exempt(me.building_id,a.unit_no,'gas'),
   'current_due',due_cur,'prev_debt',due_prev-paid_prev,
   'total_payable',due_prev-paid_prev+due_cur,'paid_this_month',paid_cur,
   'remaining',due_prev-paid_prev+due_cur-paid_cur
  );
 end loop;

 select to_jsonb(r) into rate_row from public.rates r where r.building_id=me.building_id and r.year=p_year and r.month=p_month;
 return jsonb_build_object('year',p_year,'month',p_month,'month_name',public.bm_month_name(p_month),
   'water_total',water_total,'gas_total',gas_total,'rate',rate_row,'missing_rates',missing,'rows',rows);
end
$function$;

