-- Clamp debt calculations to the configured building start month without changing stored account history.
CREATE OR REPLACE FUNCTION public.app_get_unit_account_debts_for_admin(p_token uuid, p_unit_no integer, p_today_ym integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me public.accounts;
  acc public.accounts;
  cur int;
  stop_ym int;
  start_ym int;
  building_start_ym int;
  d record;
  due bigint;
  total_paid bigint;
  remaining_credit bigint;
  rem bigint;
  c text;
  cats text[] := array['charge','water','gas','repair','parking'];
  raw_rows jsonb;
  rows jsonb;
  accounts_json jsonb := '[]'::jsonb;
begin
  me := public.bm_admin(p_token);
  select coalesce((select coalesce(nullif(left(regexp_replace(value,'[^0-9]','','g'),6),'')::int,140406) from public.settings where building_id=me.building_id and key='start_ym'),140406) into building_start_ym;
  stop_ym := coalesce(p_today_ym,140508);

  -- Include a manager account when the manager is also a resident of this unit.
  for acc in
    select *
      from public.accounts a
     where a.building_id = me.building_id
       and a.unit_no = p_unit_no
       and a.is_active
     order by a.is_primary desc, a.created_at, a.id
  loop
    raw_rows := '[]'::jsonb;
    rows := '[]'::jsonb;
    start_ym := greatest(building_start_ym,coalesce(acc.start_ym,building_start_ym));
    select greatest(coalesce(sum(-t.amount),0)-coalesce((select sum(x.amount) from public.transactions x where x.building_id=me.building_id and x.account_id=acc.id and x.unit_no=p_unit_no and x.tx_type='درآمد' and x.category='owner_balance_transfer_debt'),0)-coalesce((select sum(pr.amount) from public.payment_requests pr where pr.building_id=me.building_id and pr.account_id=acc.id and pr.unit_no=p_unit_no and pr.category='owner_balance_transfer_debt' and pr.status='pending'),0),0) into due from public.transactions t where t.building_id=me.building_id and t.account_id=acc.id and t.unit_no=p_unit_no and t.tx_type='انتقال مانده مالک' and t.amount<0;
    if due>0 then raw_rows:=raw_rows||jsonb_build_array(jsonb_build_object('ym',start_ym,'year',start_ym/100,'month',start_ym%100,'month_name',public.bm_month_name(start_ym%100),'category','owner_balance_transfer_debt','category_name','بدهی منتقل‌شده از مالک قبلی','amount',due)); end if;
    cur := start_ym;

    -- Build the same gross obligations used by app_report.
    if stop_ym is null
       or stop_ym / 100 not between 1300 and 1600
       or stop_ym % 100 not between 1 and 12
       or cur / 100 not between 1300 and 1600
       or cur % 100 not between 1 and 12 then
    raise exception 'بازه ماهانه گزارش معتبر نیست';
  end if;
  if stop_ym >= cur
     and ((stop_ym / 100) * 12 + (stop_ym % 100))
         - ((cur / 100) * 12 + (cur % 100)) > 240 then
    raise exception 'بازه گزارش نمی‌تواند بیش از ۲۴۰ ماه باشد';
  end if;
  if stop_ym < cur then
    accounts_json := accounts_json || jsonb_build_array(jsonb_build_object(
      'account_id',acc.id,'full_name',acc.full_name,'occupancy',acc.occupancy,
      'debts','[]'::jsonb,'total',0
    ));
    continue;
  end if;
  while cur <= stop_ym loop
      select * into d
        from public.bm2_account_month_due(me.building_id,acc.id,cur);

      foreach c in array cats loop
        due := case c
          when 'charge' then coalesce(d.charge,0)
          when 'water' then coalesce(d.water,0)
          when 'gas' then coalesce(d.gas,0)
          when 'repair' then coalesce(d.repair,0)
          else coalesce(d.parking,0)
        end;

        if due > 0 then
          raw_rows := raw_rows || jsonb_build_array(jsonb_build_object(
            'ym',cur,'year',cur/100,'month',cur%100,
            'month_name',public.bm_month_name(cur%100),
            'category',c,
            'category_name',case c
              when 'charge' then 'شارژ'
              when 'water' then 'آب'
              when 'gas' then 'گاز'
              when 'repair' then 'پس‌انداز'
              else 'پارکینگ'
            end,
            'amount',due
          ));
        end if;
      end loop;

      cur := public.bm_next_ym(cur);
    end loop;

    for d in
      select t.id,t.year,t.month,t.description,
             (sh->>'amount')::bigint as share_amount
        from public.transactions t
        cross join lateral jsonb_array_elements(coalesce(t.expense_shares,'[]'::jsonb)) sh
       where t.building_id = me.building_id
         and t.tx_type = 'هزینه'
         and t.year*100+t.month between start_ym and stop_ym
         and sh->>'account_id' = acc.id::text
       order by t.year,t.month,t.id
    loop
      if d.share_amount > 0 then
        raw_rows := raw_rows || jsonb_build_array(jsonb_build_object(
          'ym',d.year*100+d.month,'year',d.year,'month',d.month,
          'month_name',public.bm_month_name(d.month),
          'category','expense:'||d.id::text,
          'category_name',coalesce(nullif(d.description,''),'هزینه تسهیمی'),
          'amount',d.share_amount
        ));
      end if;
    end loop;

    -- Match app_report: all income for this unit/occupancy offsets the
    -- account's combined obligations, including overpayments in one category.
    select coalesce(sum(t.amount),0)
      into total_paid
      from public.transactions t
     where t.building_id = me.building_id
       and t.unit_no = p_unit_no
       and t.tx_type in ('درآمد','انتقال بستانکاری','انتقال مانده مالک') and (t.tx_type<>'انتقال مانده مالک' or t.amount>0) and t.category<>'owner_balance_transfer_debt'
       and (t.account_id = acc.id or (t.account_id is null and t.occupancy = acc.occupancy))
       and t.ym <= stop_ym;

    remaining_credit := total_paid;

    -- Allocate collected payments to the oldest obligations first.
    for d in
      select value
        from jsonb_array_elements(raw_rows) as e(value)
       order by (value->>'ym')::int,
                case value->>'category'
                  when 'charge' then 1
                  when 'water' then 2
                  when 'gas' then 3
                  when 'repair' then 4
                  when 'parking' then 5
                  else 6
                end,
                value->>'category'
    loop
      due := (d.value->>'amount')::bigint;
      rem := greatest(due - remaining_credit,0);
      remaining_credit := greatest(remaining_credit - due,0);

      if rem > 0 then
        rows := rows || jsonb_build_array(
          jsonb_set(jsonb_set(jsonb_set(d.value,'{amount}',to_jsonb(rem)),'{original_amount}',to_jsonb(due)),'{credit_applied}',to_jsonb(due-rem))
        );
      end if;
    end loop;

    accounts_json := accounts_json || jsonb_build_array(jsonb_build_object(
      'account_id',acc.id,
      'full_name',acc.full_name,
      'occupancy',acc.occupancy,
      'debts',rows,
      'total',coalesce((select sum((x->>'amount')::bigint) from jsonb_array_elements(rows) x),0)
    ));
  end loop;

  return accounts_json;
end
$function$
;

CREATE OR REPLACE FUNCTION public.app_get_user_debts(p_token uuid, p_today_ym integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me public.accounts;
  cur int;
  stop_ym int;
  start_ym int;
  building_start_ym int;
  d record;
  due bigint;
  total_paid bigint;
  remaining_credit bigint;
  rem bigint;
  c text;
  cats text[] := array['charge','water','gas','repair','parking'];
  raw_rows jsonb;
  out_rows jsonb := '[]'::jsonb;
begin
  me := public.bm_auth(p_token);
  select coalesce((select coalesce(nullif(left(regexp_replace(value,'[^0-9]','','g'),6),'')::int,140406) from public.settings where building_id=me.building_id and key='start_ym'),140406) into building_start_ym;
  if me.unit_no is null then return '[]'::jsonb; end if;
  stop_ym := coalesce(p_today_ym,140508);
  start_ym := greatest(building_start_ym,coalesce(me.start_ym,building_start_ym));
  raw_rows := '[]'::jsonb;

  -- Opening debt transferred from the previous owner/account.
  select greatest(
    coalesce(sum(-t.amount),0)
    - coalesce((select sum(x.amount) from public.transactions x
       where x.building_id=me.building_id and x.account_id=me.id
         and x.unit_no=me.unit_no and x.tx_type='درآمد'
         and x.category='owner_balance_transfer_debt'),0)
    - coalesce((select sum(pr.amount) from public.payment_requests pr
       where pr.building_id=me.building_id and pr.account_id=me.id
         and pr.unit_no=me.unit_no and pr.category='owner_balance_transfer_debt'
         and pr.status='pending'),0),0)
    into due
  from public.transactions t
  where t.building_id=me.building_id and t.account_id=me.id
    and t.unit_no=me.unit_no and t.tx_type='انتقال مانده مالک' and t.amount<0;
  if due>0 then
    raw_rows:=raw_rows||jsonb_build_array(jsonb_build_object(
      'ym',start_ym,'year',start_ym/100,'month',start_ym%100,
      'month_name',public.bm_month_name(start_ym%100),
      'category','owner_balance_transfer_debt',
      'category_name','بدهی منتقل‌شده از مالک قبلی','amount',due));
  end if;

  cur := start_ym;
  if stop_ym is null
       or stop_ym / 100 not between 1300 and 1600
       or stop_ym % 100 not between 1 and 12
       or cur / 100 not between 1300 and 1600
       or cur % 100 not between 1 and 12 then
    raise exception 'بازه ماهانه گزارش معتبر نیست';
  end if;
  if stop_ym >= cur
     and ((stop_ym / 100) * 12 + (stop_ym % 100))
         - ((cur / 100) * 12 + (cur % 100)) > 240 then
    raise exception 'بازه گزارش نمی‌تواند بیش از ۲۴۰ ماه باشد';
  end if;
  if stop_ym < cur then
    return '[]'::jsonb;
  end if;
  while cur <= stop_ym loop
    select * into d from public.bm2_account_month_due(me.building_id,me.id,cur);
    foreach c in array cats loop
      due := case c
        when 'charge' then coalesce(d.charge,0)
        when 'water' then coalesce(d.water,0)
        when 'gas' then coalesce(d.gas,0)
        when 'repair' then coalesce(d.repair,0)
        else coalesce(d.parking,0)
      end;
      if due>0 then
        raw_rows:=raw_rows||jsonb_build_array(jsonb_build_object(
          'ym',cur,'year',cur/100,'month',cur%100,
          'month_name',public.bm_month_name(cur%100),
          'category',c,
          'category_name',case c when 'charge' then 'شارژ' when 'water' then 'آب'
            when 'gas' then 'گاز' when 'repair' then 'پس‌انداز' else 'پارکینگ' end,
          'amount',due));
      end if;
    end loop;
    cur:=public.bm_next_ym(cur);
  end loop;

  -- Include individually allocated expenses.
  for d in
    select t.id,t.year,t.month,t.description,(sh->>'amount')::bigint as share_amount
    from public.transactions t
    cross join lateral jsonb_array_elements(coalesce(t.expense_shares,'[]'::jsonb)) sh
    where t.building_id=me.building_id and t.tx_type='هزینه'
      and t.year*100+t.month between start_ym and stop_ym
      and sh->>'account_id'=me.id::text
    order by t.year,t.month,t.id
  loop
    if d.share_amount>0 then
      raw_rows:=raw_rows||jsonb_build_array(jsonb_build_object(
        'ym',d.year*100+d.month,'year',d.year,'month',d.month,
        'month_name',public.bm_month_name(d.month),
        'category','expense:'||d.id::text,
        'category_name',coalesce(nullif(d.description,''),'هزینه تسهیمی'),
        'amount',d.share_amount));
    end if;
  end loop;

  -- Apply all account credits to the oldest obligations first.
  select coalesce(sum(t.amount),0) into total_paid
  from public.transactions t
  where t.building_id=me.building_id and t.unit_no=me.unit_no
    and t.tx_type in ('درآمد','انتقال بستانکاری','انتقال مانده مالک')
    and (t.tx_type<>'انتقال مانده مالک' or t.amount>0)
    and t.category<>'owner_balance_transfer_debt'
    and (t.account_id=me.id or (t.account_id is null and t.occupancy=me.occupancy))
    and t.ym<=stop_ym;

  remaining_credit:=total_paid;
  for d in
    select value from jsonb_array_elements(raw_rows) as e(value)
    order by (value->>'ym')::int,
      case value->>'category' when 'charge' then 1 when 'water' then 2
        when 'gas' then 3 when 'repair' then 4 when 'parking' then 5 else 6 end,
      value->>'category'
  loop
    due:=(d.value->>'amount')::bigint;
    rem:=greatest(due-remaining_credit,0);
    remaining_credit:=greatest(remaining_credit-due,0);
    if rem>0 then
      out_rows:=out_rows||jsonb_build_array(
        jsonb_set(
          jsonb_set(
            jsonb_set(d.value,'{amount}',to_jsonb(rem)),
            '{original_amount}',to_jsonb(due)),
          '{credit_applied}',to_jsonb(due-rem)
        )
      );
    end if;
  end loop;
  return out_rows;
end
$function$
;
-- Synchronize announcements identity with existing rows after the stale sequence caused duplicate primary keys.
select setval(pg_get_serial_sequence('public.announcements','id'),coalesce((select max(id) from public.announcements),0),true);
