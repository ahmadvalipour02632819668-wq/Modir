-- Validate rate payer arrays before they are rendered by the client.
-- Only the three supported occupancy labels are accepted; null means all,
-- an empty array means none, and duplicates or null elements are rejected.
create or replace function public.bm_valid_payer_array(p_values text[])
returns boolean
language sql
immutable
set search_path = pg_catalog, public
as $function$
  select p_values is null
      or (
        cardinality(p_values) <= 3
        and not exists (
          select 1
            from unnest(p_values) as x(value)
           where x.value is null
              or x.value not in ('مالک ساکن','مالک','مستأجر')
        )
        and cardinality(p_values) = (
          select count(distinct x.value)
            from unnest(p_values) as x(value)
        )
      );
$function$;

create or replace function public.app_admin_save_rate(
  p_token uuid,
  p_year integer,
  p_month integer,
  p_charge bigint,
  p_repair bigint,
  p_parking bigint,
  p_payer_charge text[],
  p_payer_water text[],
  p_payer_gas text[],
  p_payer_repair text[],
  p_payer_parking text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  me public.accounts;
begin
  me := public.bm_admin(p_token);

  if p_year is null or p_year not between 1300 and 1600
     or p_month is null or p_month not between 1 and 12 then
    raise exception 'ماه و سال معتبر نیست';
  end if;

  if coalesce(p_charge,0)<0 or coalesce(p_repair,0)<0 or coalesce(p_parking,0)<0 then
    raise exception 'مبلغ نرخ‌ها نمی‌تواند منفی باشد';
  end if;

  if not public.bm_valid_payer_array(p_payer_charge)
     or not public.bm_valid_payer_array(p_payer_water)
     or not public.bm_valid_payer_array(p_payer_gas)
     or not public.bm_valid_payer_array(p_payer_repair)
     or not public.bm_valid_payer_array(p_payer_parking) then
    raise exception 'فهرست پرداخت‌کنندگان معتبر نیست';
  end if;

  insert into public.rates(
    building_id,year,month,charge,repair,parking,
    payer_charge,payer_water,payer_gas,payer_repair,payer_parking
  )
  values(
    me.building_id,p_year,p_month,coalesce(p_charge,0),coalesce(p_repair,0),coalesce(p_parking,0),
    p_payer_charge,p_payer_water,p_payer_gas,p_payer_repair,p_payer_parking
  )
  on conflict(building_id,year,month) do update set
    charge=excluded.charge,
    repair=excluded.repair,
    parking=excluded.parking,
    payer_charge=excluded.payer_charge,
    payer_water=excluded.payer_water,
    payer_gas=excluded.payer_gas,
    payer_repair=excluded.payer_repair,
    payer_parking=excluded.payer_parking;
end
$function$;
