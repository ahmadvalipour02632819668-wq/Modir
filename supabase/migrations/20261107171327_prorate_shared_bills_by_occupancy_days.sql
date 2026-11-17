
create or replace function public.bm2_prorate_shared_bill_shares(
  p_building_id integer,
  p_ym integer,
  p_category text,
  p_payers text[],
  p_shares jsonb
) returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_days integer := case when p_ym % 100 between 1 and 6 then 31 when p_ym % 100 between 7 and 11 then 30 else 29 end;
  v_unit record;
  v_day integer;
  v_tenant record;
  v_owner uuid;
  v_original_total bigint;
  v_day_counts jsonb;
  v_account record;
  v_alloc jsonb := '[]'::jsonb;
  v_new_amount bigint;
  v_used bigint;
  v_max_account uuid;
  v_max_days integer;
  v_total_days integer;
  v_start_day integer;
  v_end_day integer;
  v_tenant_days integer;
  v_changed boolean;
  v_result jsonb := '[]'::jsonb;
  v_item jsonb;
begin
  if p_category not in ('water','gas') or not ('مستأجر'=any(coalesce(p_payers,'{}'::text[])))
     or not ('مالک'=any(coalesce(p_payers,'{}'::text[]))) then
    return coalesce(p_shares,'[]'::jsonb);
  end if;

  for v_unit in
    select distinct (x->>'unit_no')::integer as unit_no
    from jsonb_array_elements(coalesce(p_shares,'[]'::jsonb)) x
    where x ? 'unit_no'
  loop
    select coalesce(sum((x->>'amount')::bigint),0)
      into v_original_total
    from jsonb_array_elements(coalesce(p_shares,'[]'::jsonb)) x
    where (x->>'unit_no')::integer=v_unit.unit_no;

    if v_original_total<=0 then continue; end if;

    select a.id into v_owner
    from public.accounts a
    where a.building_id=p_building_id and a.unit_no=v_unit.unit_no
      and a.occupancy='مالک'
    order by a.is_primary desc,a.created_at,a.id
    limit 1;

    v_day_counts := '{}'::jsonb;
    v_total_days := 0;
    v_tenant_days := 0;

    for v_day in 1..v_days loop
      select a.id,a.start_ym,a.start_date_jalali,
             coalesce(s.exit_ym,
               case when a.exit_date_jalali ~ '^[0-9]{4}/[0-9]{1,2}/[0-9]{1,2}$'
                    then split_part(a.exit_date_jalali,'/',1)::int*100+split_part(a.exit_date_jalali,'/',2)::int end) as exit_ym,
             coalesce(s.exit_day,
               case when a.exit_date_jalali ~ '^[0-9]{4}/[0-9]{1,2}/[0-9]{1,2}$'
                    then split_part(a.exit_date_jalali,'/',3)::int end) as exit_day
        into v_tenant
      from public.accounts a
      left join lateral (
        select es.exit_ym,es.exit_day
        from public.account_exit_settlements es
        where es.account_id=a.id and es.building_id=p_building_id
          and es.status='confirmed'
        order by es.confirmed_at desc nulls last,es.created_at desc
        limit 1
      ) s on true
      where a.building_id=p_building_id and a.unit_no=v_unit.unit_no
        and a.occupancy='مستأجر'
        and coalesce(a.start_ym,140406)<=p_ym
        and (coalesce(s.exit_ym,
             case when a.exit_date_jalali ~ '^[0-9]{4}/[0-9]{1,2}/[0-9]{1,2}$'
                  then split_part(a.exit_date_jalali,'/',1)::int*100+split_part(a.exit_date_jalali,'/',2)::int end) is null
             or coalesce(s.exit_ym,
             case when a.exit_date_jalali ~ '^[0-9]{4}/[0-9]{1,2}/[0-9]{1,2}$'
                  then split_part(a.exit_date_jalali,'/',1)::int*100+split_part(a.exit_date_jalali,'/',2)::int end)>=p_ym)
        and (
          coalesce(a.start_ym,140406)<p_ym
          or case
               when not a.is_active and coalesce(s.exit_day,
                 case when a.exit_date_jalali ~ '^[0-9]{4}/[0-9]{1,2}/[0-9]{1,2}$'
                      then split_part(a.exit_date_jalali,'/',3)::int end) is not null
                    and split_part(coalesce(a.start_date_jalali,''),'/',3) ~ '^[0-9]+$'
                    and split_part(a.start_date_jalali,'/',3)::int >
                        coalesce(s.exit_day,split_part(a.exit_date_jalali,'/',3)::int)
                 then 1
               when split_part(coalesce(a.start_date_jalali,''),'/',3) ~ '^[0-9]+$'
                 then split_part(a.start_date_jalali,'/',3)::int
               else 1
             end <= v_day
        )
        and v_day <= coalesce(s.exit_day,
             case when a.exit_date_jalali ~ '^[0-9]{4}/[0-9]{1,2}/[0-9]{1,2}$'
                  then split_part(a.exit_date_jalali,'/',3)::int end,v_days)
      order by coalesce(a.start_ym,140406) desc,a.created_at desc
      limit 1;

      if found and 'مستأجر'=any(coalesce(p_payers,'{}'::text[])) then
        v_day_counts := jsonb_set(v_day_counts,array[v_tenant.id::text],
          to_jsonb(coalesce((v_day_counts->>v_tenant.id::text)::int,0)+1),true);
        v_tenant_days := v_tenant_days+1;
      elsif v_owner is not null and 'مالک'=any(coalesce(p_payers,'{}'::text[])) then
        v_day_counts := jsonb_set(v_day_counts,array[v_owner::text],
          to_jsonb(coalesce((v_day_counts->>v_owner::text)::int,0)+1),true);
      end if;
    end loop;

    select coalesce(sum((value)::int),0) into v_total_days
    from jsonb_each_text(v_day_counts);

    if v_total_days=0 or v_tenant_days=0 then
      continue;
    end if;

    select key::uuid, value::int into v_max_account,v_max_days
    from jsonb_each_text(v_day_counts)
    order by value::int desc,key
    limit 1;

    v_used:=0;
    v_alloc:='[]'::jsonb;
    for v_account in
      select a.id,a.occupancy, (e.value)::int as days
      from jsonb_each_text(v_day_counts) e
      join public.accounts a on a.id=e.key::uuid
      order by a.unit_no,a.occupancy,a.id
    loop
      v_new_amount:=floor(v_original_total::numeric*v_account.days/v_total_days)::bigint;
      v_used:=v_used+v_new_amount;
      v_alloc:=v_alloc||jsonb_build_array(jsonb_build_object(
        'unit_no',v_unit.unit_no,'account_id',v_account.id,
        'occupancy',v_account.occupancy,'amount',v_new_amount
      ));
    end loop;

    if v_original_total-v_used>0 then
      select jsonb_agg(
        case when (x->>'account_id')=v_max_account::text
             then jsonb_set(x,'{amount}',to_jsonb((x->>'amount')::bigint+v_original_total-v_used))
             else x end
      ) into v_alloc
      from jsonb_array_elements(v_alloc) x;
    end if;

    v_result:=v_result||v_alloc;
  end loop;

  -- Keep untouched unit allocations as-is.
  for v_item in select x from jsonb_array_elements(coalesce(p_shares,'[]'::jsonb)) x
  loop
    if not exists (
      select 1 from jsonb_array_elements(v_result) z
      where (z->>'unit_no')=(v_item->>'unit_no')
    ) then
      v_result:=v_result||jsonb_build_array(v_item);
    end if;
  end loop;

  return v_result;
end;
$$;

create or replace function public.bm2_apply_shared_bill_proration()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.tx_type='هزینه'
     and new.expense_scope='building'
     and new.expense_kind='shared'
     and new.category in ('water','gas')
     and new.expense_shares is not null
     and jsonb_typeof(new.expense_shares)='array' then
    new.expense_shares:=public.bm2_prorate_shared_bill_shares(
      new.building_id,new.ym,new.category,new.payer_occupancies,new.expense_shares
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_bm2_prorate_shared_bills on public.transactions;
create trigger trg_bm2_prorate_shared_bills
before insert or update of expense_shares on public.transactions
for each row execute function public.bm2_apply_shared_bill_proration();

