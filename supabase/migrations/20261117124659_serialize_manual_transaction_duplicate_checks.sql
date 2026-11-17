-- Serializes identical manual transaction/expense submissions so concurrent

-- requests cannot both pass the duplicate check before either insert commits.

-- The shared advisory-lock namespace covers both manual-save RPC families.



CREATE OR REPLACE FUNCTION public.app_admin_save_expense(p_token uuid, p_id bigint, p_year integer, p_month integer, p_day integer, p_unit_no integer, p_category text, p_location text, p_description text, p_amount bigint, p_expense_scope text, p_expense_kind text, p_allocation_method text, p_payer_occupancies text[], p_excluded_units integer[] DEFAULT '{}'::integer[], p_bill_period_start date DEFAULT NULL::date, p_bill_period_end date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me public.accounts;
  v_unit integer := nullif(p_unit_no,0);
  v_loc text;
  v_desc text;
  v_tx public.transactions;
  v_shares jsonb := '[]'::jsonb;
  v_weight_total numeric := 0;
  v_alloc_total bigint := 0;
  v_left bigint := 0;
begin
  me := public.bm_admin(p_token);
  if p_category is not null and p_category <> '' and p_category !~ '^[a-z0-9_]{1,64}$' then
    raise exception 'دسته‌بندی معتبر نیست';
  end if;
  if coalesce(p_amount,0) <= 0 then raise exception 'مبلغ نامعتبر است'; end if; if (p_bill_period_start is null) <> (p_bill_period_end is null) or (p_bill_period_start is not null and p_bill_period_end < p_bill_period_start) then raise exception 'بازه دوره مصرف قبض معتبر نیست'; end if; if p_category in ('water','gas','electric_bill','waste','other_bill') and p_bill_period_start is null then raise exception 'تاریخ شروع و پایان دوره مصرف قبض الزامی است'; end if;
  if p_year is null or p_year not between 1300 and 1600 or p_month is null or p_month not between 1 and 12 or p_day is null or p_day not between 1 and 31 then raise exception 'تاریخ هزینه معتبر نیست'; end if;
  if p_expense_scope is null or p_expense_scope not in ('building','unit') then raise exception 'محل پرداخت هزینه معتبر نیست'; end if;
  if p_expense_kind is null or p_expense_kind not in ('shared','nonshared') then raise exception 'نوع هزینه معتبر نیست'; end if;
  if p_expense_scope='unit' and v_unit is null then raise exception 'واحد پرداخت‌کننده را انتخاب کنید'; end if;
  if p_expense_scope='building' and v_unit is not null then raise exception 'برای هزینه ساختمان، واحد نباید انتخاب شود'; end if;
  if v_unit is not null and not exists(select 1 from public.units where building_id=me.building_id and unit_no=v_unit) then raise exception 'واحد متعلق به این ساختمان نیست'; end if;
  if coalesce(cardinality(p_payer_occupancies),0) <> 2 or array_position(p_payer_occupancies,null) is not null
     or not ('مالک ساکن'=any(p_payer_occupancies))
     or not (
       ('مستأجر'=any(p_payer_occupancies) and not ('مالک'=any(p_payer_occupancies)))
       or ('مالک'=any(p_payer_occupancies) and not ('مستأجر'=any(p_payer_occupancies)))
     ) then
    raise exception 'ترکیب مسئول پرداخت معتبر نیست';
  end if;
  if p_expense_kind='shared' and p_expense_scope='building'
     and coalesce(p_allocation_method, '') not in ('equal','persons','area') then
    raise exception 'روش تسهیم را انتخاب کنید';
  end if;
  if p_expense_scope='building' and p_expense_kind='shared' then
    if exists(select 1 from unnest(coalesce(p_excluded_units,'{}'::integer[])) x
              where not exists(select 1 from public.units u where u.building_id=me.building_id and u.unit_no=x)) then
      raise exception 'واحد استثناشده متعلق به این ساختمان نیست';
    end if;
  end if;

  v_loc := coalesce(nullif(btrim(p_location),''),public.bm_cat_location(p_category));
  v_desc := coalesce(nullif(btrim(p_description),''),public.bm_cat_desc(p_category));

  if not exists(select 1 from public.accounts a
                where a.building_id=me.building_id and a.is_active
                  and a.occupancy=any(p_payer_occupancies)
                  and (p_expense_scope='building' or a.unit_no=v_unit)) then
    raise exception 'برای این ترکیب مسئول پرداخت، حساب فعال پیدا نشد';
  end if;

  if not exists(select 1 from public.accounts a
                where a.building_id=me.building_id and a.is_active
                  and a.occupancy=any(p_payer_occupancies)
                  and (p_expense_scope='building' or a.unit_no=v_unit)
                  and (p_expense_scope='unit' or p_expense_kind='nonshared'
                       or not (a.unit_no=any(coalesce(p_excluded_units,'{}'::integer[]))))) then
    raise exception 'هیچ واحد مشمولی برای این هزینه باقی نمانده است';
  end if;

  if p_expense_scope='unit' then
    if (select count(*) from public.accounts a
        where a.building_id=me.building_id and a.unit_no=v_unit
          and a.is_active and a.occupancy=any(p_payer_occupancies)) > 1
       and (select count(*) from public.accounts a
            where a.building_id=me.building_id and a.unit_no=v_unit
              and a.is_active and a.is_primary
              and a.occupancy=any(p_payer_occupancies)) <> 1 then
      raise exception 'برای این واحد چند حساب مسئول پرداخت فعال وجود دارد و حساب اصلی یکتا نیست؛ ابتدا حساب اصلی را در تنظیمات واحد مشخص کنید';
    end if;
  elsif p_expense_scope='building' and p_expense_kind='shared' then
    if exists (
      select 1 from public.units u
      join lateral (
        select count(*) as candidate_count, count(*) filter (where a.is_primary) as primary_count
        from public.accounts a
        where a.building_id=u.building_id and a.unit_no=u.unit_no
          and a.is_active and a.occupancy=any(p_payer_occupancies)
      ) c on true
      where u.building_id=me.building_id
        and not (u.unit_no=any(coalesce(p_excluded_units,'{}'::integer[])))
        and c.candidate_count > 1 and c.primary_count <> 1
    ) then
      raise exception 'حداقل یک واحد چند حساب مسئول پرداخت فعال دارد و حساب اصلی یکتایی ندارد؛ ابتدا حساب‌های اصلی واحدها را مشخص کنید';
    end if;
  end if;

  -- Serialize identical manual expenses with the general transaction RPC.
  perform pg_advisory_xact_lock(hashtextextended(
    'manual-transaction:' || me.building_id::text || ':' ||
    p_year::text || ':' || p_month::text || ':' || p_day::text || ':' ||
    coalesce(v_unit::text,'<null>') || ':' ||
    coalesce(public.bm_norm('هزینه'),'<null>') || ':' ||
    coalesce(public.bm_norm(v_loc),'<null>') || ':' ||
    coalesce(public.bm_norm(v_desc),'<null>') || ':' ||
    p_amount::text,
    0
  ));
  if exists(
    select 1 from public.transactions x
    where x.building_id=me.building_id and x.year=p_year and x.month=p_month
      and x.day=coalesce(p_day,1) and x.unit_no is not distinct from v_unit
      and x.tx_type='هزینه' and x.location is not distinct from public.bm_norm(v_loc)
      and x.description is not distinct from public.bm_norm(v_desc) and x.amount=p_amount
      and (p_id is null or x.id<>p_id)
  ) then
    return jsonb_build_object('ok',false,'duplicate',true,'error','به علت تکراری بودن، داده‌ای ثبت نشد!');
  end if;

  if p_id is null then
    insert into public.transactions(building_id,year,month,day,unit_no,tx_type,location,description,amount,occupancy,category,source,created_by)
    values(me.building_id,p_year,p_month,p_day,v_unit,'هزینه',v_loc,v_desc,p_amount,null,nullif(p_category,''),'manual',me.id)
    returning * into v_tx;
  else
    update public.transactions
       set year=p_year,month=p_month,day=p_day,unit_no=v_unit,tx_type='هزینه',
           location=v_loc,description=v_desc,amount=p_amount,occupancy=null,
           category=nullif(p_category,''),account_id=null
     where id=p_id and building_id=me.building_id and tx_type='هزینه'
     returning * into v_tx;
    if not found then raise exception 'تراکنش هزینه پیدا نشد'; end if;
  end if;

  if p_expense_scope='unit' then
    select jsonb_build_array(jsonb_build_object(
      'unit_no',v_unit,'account_id',a.id,'occupancy',a.occupancy,'amount',p_amount
    ))
    into v_shares
    from public.accounts a
    where a.building_id=me.building_id and a.unit_no=v_unit
      and a.is_active and a.occupancy=any(p_payer_occupancies)
    order by a.is_primary desc, a.created_at, a.id
    limit 1;
  elsif p_expense_scope='building' and p_expense_kind='shared' then
    with eligible as (
      select distinct on (u.unit_no)
        u.unit_no,a.id as account_id,a.occupancy,
        case p_allocation_method
          when 'persons' then greatest(coalesce(u.persons,1),1)::numeric
          when 'area' then greatest(coalesce(u.area,0),0)::numeric
          else 1::numeric
        end as weight
      from public.units u
      join public.accounts a on a.building_id=u.building_id and a.unit_no=u.unit_no
      where u.building_id=me.building_id and a.is_active
        and a.occupancy=any(p_payer_occupancies)
        and not (u.unit_no=any(coalesce(p_excluded_units,'{}'::integer[])))
      order by u.unit_no,a.is_primary desc,a.created_at,a.id
    ), weighted as (
      select *,sum(weight) over() as total_weight,
             row_number() over(order by unit_no) as rn
      from eligible
      where weight>0
    ), rounded as (
      select *,floor(p_amount*weight/nullif(total_weight,0))::bigint as base_amount
      from weighted
    ), final_shares as (
      select unit_no,account_id,occupancy,
             base_amount + case when rn=1 then p_amount-sum(base_amount) over() else 0 end as share_amount
      from rounded
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'unit_no',unit_no,'account_id',account_id,'occupancy',occupancy,'amount',share_amount
    ) order by unit_no),'[]'::jsonb)
    into v_shares
    from final_shares;
    if jsonb_array_length(v_shares)=0 then raise exception 'هیچ واحد واجد شرایطی برای تسهیم وجود ندارد'; end if;
  end if;

  update public.transactions
     set expense_scope=p_expense_scope,
         expense_kind=p_expense_kind,
         allocation_method=case when p_expense_kind='shared' then p_allocation_method else null end,
         payer_occupancies=p_payer_occupancies,
         excluded_units=case when p_expense_scope='building' and p_expense_kind='shared'
                             then coalesce(p_excluded_units,'{}'::integer[]) else '{}'::integer[] end,
         expense_shares=v_shares, bill_period_start=p_bill_period_start, bill_period_end=p_bill_period_end
   where id=v_tx.id and building_id=me.building_id;

  return jsonb_build_object('ok',true,'transaction_id',v_tx.id,'expense_shares',v_shares);
end
$function$
;

CREATE OR REPLACE FUNCTION public.app_admin_save_expense(p_token uuid, p_id bigint, p_year integer, p_month integer, p_day integer, p_unit_no integer, p_category text, p_location text, p_description text, p_amount bigint, p_expense_scope text, p_expense_kind text, p_allocation_method text, p_payer_occupancies text[], p_excluded_units integer[] DEFAULT '{}'::integer[])
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  me public.accounts;
  v_unit integer := nullif(p_unit_no,0);
  v_loc text;
  v_desc text;
  v_tx public.transactions;
  v_shares jsonb := '[]'::jsonb;
  v_weight_total numeric := 0;
  v_alloc_total bigint := 0;
  v_left bigint := 0;
begin
  me := public.bm_admin(p_token);
  if p_category is not null and p_category <> '' and p_category !~ '^[a-z0-9_]{1,64}$' then
    raise exception 'دسته‌بندی معتبر نیست';
  end if;
  if coalesce(p_amount,0) <= 0 then raise exception 'مبلغ نامعتبر است'; end if;
  if p_year is null or p_year not between 1300 and 1600 or p_month is null or p_month not between 1 and 12 or p_day is null or p_day not between 1 and 31 then raise exception 'تاریخ هزینه معتبر نیست'; end if;
  if p_expense_scope is null or p_expense_scope not in ('building','unit') then raise exception 'محل پرداخت هزینه معتبر نیست'; end if;
  if p_expense_kind is null or p_expense_kind not in ('shared','nonshared') then raise exception 'نوع هزینه معتبر نیست'; end if;
  if p_expense_scope='unit' and v_unit is null then raise exception 'واحد پرداخت‌کننده را انتخاب کنید'; end if;
  if p_expense_scope='building' and v_unit is not null then raise exception 'برای هزینه ساختمان، واحد نباید انتخاب شود'; end if;
  if v_unit is not null and not exists(select 1 from public.units where building_id=me.building_id and unit_no=v_unit) then raise exception 'واحد متعلق به این ساختمان نیست'; end if;
  if coalesce(cardinality(p_payer_occupancies),0) <> 2 or array_position(p_payer_occupancies,null) is not null
     or not ('مالک ساکن'=any(p_payer_occupancies))
     or not (
       ('مستأجر'=any(p_payer_occupancies) and not ('مالک'=any(p_payer_occupancies)))
       or ('مالک'=any(p_payer_occupancies) and not ('مستأجر'=any(p_payer_occupancies)))
     ) then
    raise exception 'ترکیب مسئول پرداخت معتبر نیست';
  end if;
  if p_expense_kind='shared' and p_expense_scope='building'
     and coalesce(p_allocation_method, '') not in ('equal','persons','area') then
    raise exception 'روش تسهیم را انتخاب کنید';
  end if;
  if p_expense_scope='building' and p_expense_kind='shared' then
    if exists(select 1 from unnest(coalesce(p_excluded_units,'{}'::integer[])) x
              where not exists(select 1 from public.units u where u.building_id=me.building_id and u.unit_no=x)) then
      raise exception 'واحد استثناشده متعلق به این ساختمان نیست';
    end if;
  end if;

  v_loc := coalesce(nullif(btrim(p_location),''),public.bm_cat_location(p_category));
  v_desc := coalesce(nullif(btrim(p_description),''),public.bm_cat_desc(p_category));

  if not exists(select 1 from public.accounts a
                where a.building_id=me.building_id and a.is_active
                  and a.occupancy=any(p_payer_occupancies)
                  and (p_expense_scope='building' or a.unit_no=v_unit)) then
    raise exception 'برای این ترکیب مسئول پرداخت، حساب فعال پیدا نشد';
  end if;

  if not exists(select 1 from public.accounts a
                where a.building_id=me.building_id and a.is_active
                  and a.occupancy=any(p_payer_occupancies)
                  and (p_expense_scope='building' or a.unit_no=v_unit)
                  and (p_expense_scope='unit' or p_expense_kind='nonshared'
                       or not (a.unit_no=any(coalesce(p_excluded_units,'{}'::integer[]))))) then
    raise exception 'هیچ واحد مشمولی برای این هزینه باقی نمانده است';
  end if;

  if p_expense_scope='unit' then
    if (select count(*) from public.accounts a
        where a.building_id=me.building_id and a.unit_no=v_unit
          and a.is_active and a.occupancy=any(p_payer_occupancies)) > 1
       and (select count(*) from public.accounts a
            where a.building_id=me.building_id and a.unit_no=v_unit
              and a.is_active and a.is_primary
              and a.occupancy=any(p_payer_occupancies)) <> 1 then
      raise exception 'برای این واحد چند حساب مسئول پرداخت فعال وجود دارد و حساب اصلی یکتا نیست؛ ابتدا حساب اصلی را در تنظیمات واحد مشخص کنید';
    end if;
  elsif p_expense_scope='building' and p_expense_kind='shared' then
    if exists (
      select 1 from public.units u
      join lateral (
        select count(*) as candidate_count, count(*) filter (where a.is_primary) as primary_count
        from public.accounts a
        where a.building_id=u.building_id and a.unit_no=u.unit_no
          and a.is_active and a.occupancy=any(p_payer_occupancies)
      ) c on true
      where u.building_id=me.building_id
        and not (u.unit_no=any(coalesce(p_excluded_units,'{}'::integer[])))
        and c.candidate_count > 1 and c.primary_count <> 1
    ) then
      raise exception 'حداقل یک واحد چند حساب مسئول پرداخت فعال دارد و حساب اصلی یکتایی ندارد؛ ابتدا حساب‌های اصلی واحدها را مشخص کنید';
    end if;
  end if;

  -- Serialize identical manual expenses with the general transaction RPC.
  perform pg_advisory_xact_lock(hashtextextended(
    'manual-transaction:' || me.building_id::text || ':' ||
    p_year::text || ':' || p_month::text || ':' || p_day::text || ':' ||
    coalesce(v_unit::text,'<null>') || ':' ||
    coalesce(public.bm_norm('هزینه'),'<null>') || ':' ||
    coalesce(public.bm_norm(v_loc),'<null>') || ':' ||
    coalesce(public.bm_norm(v_desc),'<null>') || ':' ||
    p_amount::text,
    0
  ));
  if exists(
    select 1 from public.transactions x
    where x.building_id=me.building_id and x.year=p_year and x.month=p_month
      and x.day=coalesce(p_day,1) and x.unit_no is not distinct from v_unit
      and x.tx_type='هزینه' and x.location is not distinct from public.bm_norm(v_loc)
      and x.description is not distinct from public.bm_norm(v_desc) and x.amount=p_amount
      and (p_id is null or x.id<>p_id)
  ) then
    return jsonb_build_object('ok',false,'duplicate',true,'error','به علت تکراری بودن، داده‌ای ثبت نشد!');
  end if;

  if p_id is null then
    insert into public.transactions(building_id,year,month,day,unit_no,tx_type,location,description,amount,occupancy,category,source,created_by)
    values(me.building_id,p_year,p_month,p_day,v_unit,'هزینه',v_loc,v_desc,p_amount,null,nullif(p_category,''),'manual',me.id)
    returning * into v_tx;
  else
    update public.transactions
       set year=p_year,month=p_month,day=p_day,unit_no=v_unit,tx_type='هزینه',
           location=v_loc,description=v_desc,amount=p_amount,occupancy=null,
           category=nullif(p_category,''),account_id=null
     where id=p_id and building_id=me.building_id and tx_type='هزینه'
     returning * into v_tx;
    if not found then raise exception 'تراکنش هزینه پیدا نشد'; end if;
  end if;

  if p_expense_scope='unit' then
    select jsonb_build_array(jsonb_build_object(
      'unit_no',v_unit,'account_id',a.id,'occupancy',a.occupancy,'amount',p_amount
    ))
    into v_shares
    from public.accounts a
    where a.building_id=me.building_id and a.unit_no=v_unit
      and a.is_active and a.occupancy=any(p_payer_occupancies)
    order by a.is_primary desc, a.created_at, a.id
    limit 1;
  elsif p_expense_scope='building' and p_expense_kind='shared' then
    with eligible as (
      select distinct on (u.unit_no)
        u.unit_no,a.id as account_id,a.occupancy,
        case p_allocation_method
          when 'persons' then greatest(coalesce(u.persons,1),1)::numeric
          when 'area' then greatest(coalesce(u.area,0),0)::numeric
          else 1::numeric
        end as weight
      from public.units u
      join public.accounts a on a.building_id=u.building_id and a.unit_no=u.unit_no
      where u.building_id=me.building_id and a.is_active
        and a.occupancy=any(p_payer_occupancies)
        and not (u.unit_no=any(coalesce(p_excluded_units,'{}'::integer[])))
      order by u.unit_no,a.is_primary desc,a.created_at,a.id
    ), weighted as (
      select *,sum(weight) over() as total_weight,
             row_number() over(order by unit_no) as rn
      from eligible
      where weight>0
    ), rounded as (
      select *,floor(p_amount*weight/nullif(total_weight,0))::bigint as base_amount
      from weighted
    ), final_shares as (
      select unit_no,account_id,occupancy,
             base_amount + case when rn=1 then p_amount-sum(base_amount) over() else 0 end as share_amount
      from rounded
    )
    select coalesce(jsonb_agg(jsonb_build_object(
      'unit_no',unit_no,'account_id',account_id,'occupancy',occupancy,'amount',share_amount
    ) order by unit_no),'[]'::jsonb)
    into v_shares
    from final_shares;
    if jsonb_array_length(v_shares)=0 then raise exception 'هیچ واحد واجد شرایطی برای تسهیم وجود ندارد'; end if;
  end if;

  update public.transactions
     set expense_scope=p_expense_scope,
         expense_kind=p_expense_kind,
         allocation_method=case when p_expense_kind='shared' then p_allocation_method else null end,
         payer_occupancies=p_payer_occupancies,
         excluded_units=case when p_expense_scope='building' and p_expense_kind='shared'
                             then coalesce(p_excluded_units,'{}'::integer[]) else '{}'::integer[] end,
         expense_shares=v_shares
   where id=v_tx.id and building_id=me.building_id;

  return jsonb_build_object('ok',true,'transaction_id',v_tx.id,'expense_shares',v_shares);
end
$function$
;

CREATE OR REPLACE FUNCTION public.app_admin_save_transaction(p_token uuid, p_id bigint, p_year integer, p_month integer, p_day integer, p_unit_no integer, p_tx_type text, p_category text, p_location text, p_description text, p_amount bigint, p_occupancy text DEFAULT NULL::text, p_force boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare me public.accounts; v_unit int:=nullif(p_unit_no,0); v_occ text; v_loc text; v_desc text; t public.transactions;
begin
 me:=public.bm_admin(p_token);
 if p_category is not null and p_category <> '' and p_category !~ '^[a-z0-9_]{1,64}$' then
   raise exception 'دسته‌بندی معتبر نیست';
 end if;
 if p_tx_type is null or p_tx_type not in ('درآمد','هزینه') then raise exception 'نوع تراکنش معتبر نیست'; end if;
 if p_year is null or p_year not between 1300 and 1600 or p_month is null or p_month not between 1 and 12 or p_day is null or p_day not between 1 and 31 then raise exception 'تاریخ تراکنش معتبر نیست'; end if;
 if p_occupancy is not null and p_occupancy not in ('مالک','مالک ساکن','مستأجر') then raise exception 'نوع سکونت معتبر نیست'; end if;
 if coalesce(p_amount,0)<=0 then raise exception 'مبلغ نامعتبر است'; end if;
 if v_unit is not null and not exists(select 1 from public.units where building_id=me.building_id and unit_no=v_unit) then raise exception 'واحد متعلق به این ساختمان نیست'; end if;
 v_loc:=coalesce(nullif(btrim(p_location),''),public.bm_cat_location(p_category));
 v_desc:=coalesce(nullif(btrim(p_description),''),public.bm_cat_desc(p_category));
 v_occ:=coalesce(nullif(btrim(p_occupancy),''),(select occupancy from public.units where building_id=me.building_id and unit_no=v_unit));
 if p_tx_type='درآمد' and v_unit is not null then
  if (select count(*) from public.accounts a where a.building_id=me.building_id and a.unit_no=v_unit and a.occupancy=v_occ and a.is_active)>1
     and (select count(*) from public.accounts a where a.building_id=me.building_id and a.unit_no=v_unit and a.occupancy=v_occ and a.is_active and a.is_primary)<>1 then
    raise exception 'برای ثبت درآمد، حساب فعال این نوع سکونت در واحد باید به‌صورت یکتا مشخص شده باشد';
  end if;
 end if;
 if not coalesce(p_force,false) then
  -- Share the same lock namespace as app_admin_save_expense.
  perform pg_advisory_xact_lock(hashtextextended(
    'manual-transaction:' || me.building_id::text || ':' ||
    p_year::text || ':' || p_month::text || ':' || p_day::text || ':' ||
    coalesce(v_unit::text,'<null>') || ':' ||
    coalesce(public.bm_norm(p_tx_type),'<null>') || ':' ||
    coalesce(public.bm_norm(v_loc),'<null>') || ':' ||
    coalesce(public.bm_norm(v_desc),'<null>') || ':' ||
    p_amount::text,
    0
  ));
 end if;
 if not coalesce(p_force,false) and exists(select 1 from public.transactions x where x.building_id=me.building_id and x.year=p_year and x.month=p_month and x.day=coalesce(p_day,1) and x.unit_no is not distinct from v_unit and x.tx_type=public.bm_norm(p_tx_type) and x.location is not distinct from public.bm_norm(v_loc) and x.description is not distinct from public.bm_norm(v_desc) and x.amount=p_amount and (p_id is null or x.id<>p_id)) then
  return jsonb_build_object('ok',false,'duplicate',true,'error','به علت تکراری بودن، داده‌ای ثبت نشد!');
 end if;
 if p_id is null then
  insert into public.transactions(building_id,year,month,day,unit_no,tx_type,location,description,amount,occupancy,category,source,created_by,account_id)
  values(me.building_id,p_year,p_month,p_day,v_unit,p_tx_type,v_loc,v_desc,p_amount,v_occ,nullif(p_category,''),'manual',me.id,
    case when p_tx_type='درآمد' and v_unit is not null then (select a.id from public.accounts a where a.building_id=me.building_id and a.unit_no=v_unit and a.occupancy=v_occ and a.is_active order by a.is_primary desc limit 1) else null end) returning * into t;
 else
  update public.transactions set year=p_year,month=p_month,day=p_day,unit_no=v_unit,tx_type=p_tx_type,location=v_loc,description=v_desc,amount=p_amount,occupancy=v_occ,category=nullif(p_category,''),
    account_id=case when p_tx_type='درآمد' and v_unit is not null then (select a.id from public.accounts a where a.building_id=me.building_id and a.unit_no=v_unit and a.occupancy=v_occ and a.is_active order by a.is_primary desc limit 1) else null end
  where id=p_id and building_id=me.building_id returning * into t;
  if not found then raise exception 'تراکنش پیدا نشد'; end if;
 end if;
 return jsonb_build_object('ok',true,'transaction',to_jsonb(t),'phone',(select a.phone from public.accounts a where a.building_id=me.building_id and a.unit_no=t.unit_no and a.is_active order by a.is_primary desc,(a.occupancy='مالک') limit 1));
end $function$
;