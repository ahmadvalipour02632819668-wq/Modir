
alter table public.building_expenses
  add column if not exists legacy_import_id text,
  add column if not exists legacy_jalali_date text;
alter table public.building_payments
  add column if not exists legacy_import_id text,
  add column if not exists legacy_jalali_date text,
  add column if not exists legacy_category text;
create unique index if not exists building_expenses_legacy_import_uidx
  on public.building_expenses(legacy_import_id) where legacy_import_id is not null;
create unique index if not exists building_payments_legacy_import_uidx
  on public.building_payments(legacy_import_id) where legacy_import_id is not null;

do $$
declare v_building uuid:='9b79d1a8-91cb-4dc9-8e5c-22aaf5c21002'; v_missing integer;
begin
  select count(*) into v_missing from public.legacy_import_records r
  where r.building_id=v_building and r.source_table='transactions' and r.payload->>'tx_type'='درآمد'
    and not exists(select 1 from public.building_memberships bm join public.units u on u.id=bm.unit_id
      where bm.building_id=v_building and bm.membership_status='active'
      and u.unit_no=(r.payload->>'unit_no')::integer
      and bm.resident_type=case r.payload->>'occupancy' when 'مالک' then 'owner' when 'مستأجر' then 'tenant' when 'مالک ساکن' then 'owner_resident' else '?' end);
  if v_missing<>0 then raise exception 'Income membership mapping failed: %',v_missing; end if;

  select count(*) into v_missing from public.legacy_import_records r
  where r.building_id=v_building and r.source_table='transactions' and r.payload->>'tx_type'='هزینه'
    and nullif(r.payload->>'unit_no','') is not null
    and not exists(select 1 from public.building_memberships bm join public.units u on u.id=bm.unit_id
      where bm.building_id=v_building and bm.membership_status='active'
      and u.unit_no=(r.payload->>'unit_no')::integer
      and bm.resident_type=case r.payload->>'occupancy' when 'مالک' then 'owner' when 'مستأجر' then 'tenant' when 'مالک ساکن' then 'owner_resident' else '?' end);
  if v_missing<>0 then raise exception 'Expense membership mapping failed: %',v_missing; end if;

  if exists(select 1 from public.legacy_import_records r where r.building_id=v_building
    and r.source_table='transactions' and ((r.payload->>'amount')::numeric<=0
    or public.legacy_jalali_to_gregorian(r.payload->>'tx_date') is null)) then
    raise exception 'Invalid legacy amount/date';
  end if;
end;
$$;






begin
  select pg_get_functiondef(p.oid) into vdef from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname='public' and p.proname='app_resident_get_financial_summary' limit 1;
  if vdef is null then raise exception 'Financial summary function not found'; end if;

  vdef:=replace(vdef,'and e.expense_status=''active''','and e.expense_status=''active'' and e.legacy_import_id is null');
  vdef:=replace(vdef,'where membership_id=p_membership_id and building_id=p_building_id and status=''approved'';',
    'where membership_id=p_membership_id and building_id=p_building_id and status=''approved'' and legacy_import_id is null;');
  vdef:=replace(vdef,'where membership_id=p_membership_id and building_id=p_building_id and status=''pending'';',
    'where membership_id=p_membership_id and building_id=p_building_id and status=''pending'' and legacy_import_id is null;');
  vdef:=replace(vdef,'where p.membership_id=p_membership_id and p.building_id=p_building_id and p.status=''approved'';',
    'where p.membership_id=p_membership_id and p.building_id=p_building_id and p.status=''approved'' and p.legacy_import_id is null;');
  vdef:=replace(vdef,'and p.membership_id=p_membership_id and p.building_id=p_building_id and p.status=''approved''',
    'and p.membership_id=p_membership_id and p.building_id=p_building_id and p.status=''approved'' and p.legacy_import_id is null');
  vdef:=replace(vdef,'filter(where p.status=''approved'')',
    'filter(where p.status=''approved'' and p.legacy_import_id is null)');
  vdef:=replace(vdef,'and pp.status=''approved''','and pp.status=''approved'' and pp.legacy_import_id is null');
  vdef:=replace(vdef,'from public.building_payments' || chr(10) || '  where membership_id=p_membership_id and building_id=p_building_id',
    'from public.building_payments' || chr(10) || '  where membership_id=p_membership_id and building_id=p_building_id and legacy_import_id is null');

  if position('e.legacy_import_id is null' in vdef)=0 or position('legacy_import_id is null' in vdef)=0 then
    raise exception 'Legacy exclusion filters were not applied';
  end if;
  execute vdef;
end;
$$;

create or replace function public.app_manager_get_transactions(
  p_token uuid,p_building_id uuid,p_year integer default null,p_month integer default null,p_type text default null,p_unit_no integer default null
)
returns jsonb language plpgsql security definer set search_path=''
as $function$
declare v_txs jsonb;
begin
  perform public.app_financial_v2_require_manager(p_token,p_building_id);
  select coalesce(jsonb_agg(t order by (t->>'date')::date desc),'[]'::jsonb) into v_txs
  from (
    select jsonb_build_object(
      'id',e.id,'date',e.expense_date,'description',e.description,'amount',e.amount,'type',e.tx_type,
      'category',e.category,'status','approved','is_legacy',e.legacy_import_id is not null,
      'unit_display',case when e.allocation_method='none' then 'کل ساختمان'
        when (select count(*) from public.building_expense_allocations ea where ea.expense_id=e.id)>1 then 'ساختمان'
        else coalesce((select 'واحد '||u.unit_no from public.building_expense_allocations ea
          join public.building_memberships bm on bm.id=ea.membership_id join public.units u on u.id=bm.unit_id
          where ea.expense_id=e.id limit 1),'ساختمان') end
    ) t
    from public.building_expenses e
    where e.building_id=p_building_id and e.expense_status='active'
      and (p_year is null or extract(year from e.expense_date)=p_year)
      and (p_month is null or extract(month from e.expense_date)=p_month)
      and (p_type is null or e.tx_type=p_type)
      and (p_unit_no is null or exists(select 1 from public.building_expense_allocations ea
        join public.building_memberships bm on bm.id=ea.membership_id join public.units u on u.id=bm.unit_id
        where ea.expense_id=e.id and u.unit_no=p_unit_no))
    union all
    select jsonb_build_object(
      'id',p.id,'date',p.payment_date,'description',coalesce(p.description,'واریز به صندوق'),'amount',p.amount,
      'type',case when p.legacy_import_id is not null then 'درآمد' else 'واریز ساکنین' end,
      'category',case when p.legacy_import_id is not null then coalesce(p.legacy_category,'سایر') else 'پرداخت' end,
      'status',p.status,'is_legacy',p.legacy_import_id is not null,
      'unit_display',(select 'واحد '||u.unit_no from public.building_memberships bm
        join public.units u on u.id=bm.unit_id where bm.id=p.membership_id)
    ) t
    from public.building_payments p
    where p.building_id=p_building_id
      and (p_type is null or (p.legacy_import_id is not null and p_type='درآمد')
        or (p.legacy_import_id is null and p_type='واریز ساکنین'))
      and (p_year is null or extract(year from p.payment_date)=p_year)
      and (p_month is null or extract(month from p.payment_date)=p_month)
      and (p_unit_no is null or exists(select 1 from public.building_memberships bm
        join public.units u on u.id=bm.unit_id where bm.id=p.membership_id and u.unit_no=p_unit_no))
  ) x;
  return v_txs;
end;
$function$;

