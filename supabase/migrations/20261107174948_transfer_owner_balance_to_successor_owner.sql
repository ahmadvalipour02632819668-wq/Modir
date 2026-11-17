
create or replace function public.bm_transfer_owner_exit_balance(p_settlement_id uuid, p_target_account_id uuid)
returns bigint
language plpgsql
security definer
set search_path=public
as $$
declare
  s public.account_exit_settlements;
  olda public.accounts;
  target public.accounts;
  v_balance bigint;
  v_transfer bigint;
  v_tx_id bigint;
begin
  select * into s from public.account_exit_settlements where id=p_settlement_id for update;
  if not found or s.status <> 'confirmed' or s.next_occupancy not in ('مالک','مالک ساکن') then return 0; end if;
  select * into olda from public.accounts where id=s.account_id and building_id=s.building_id;
  if not found or olda.occupancy not in ('مالک','مالک ساکن') then return 0; end if;
  select * into target from public.accounts
   where id=p_target_account_id and building_id=s.building_id and unit_no=s.unit_no
     and is_active and occupancy in ('مالک','مالک ساکن')
   for update;
  if not found or target.id=olda.id then return 0; end if;
  if exists(select 1 from public.transactions
    where building_id=s.building_id and source='owner_successor_balance_transfer'
      and description like '%'||s.id::text||'%') then return 0; end if;
  v_balance := coalesce((s.preview->>'balance')::bigint,0);
  v_transfer := -v_balance;
  if v_transfer=0 then return 0; end if;
  insert into public.transactions(
    tx_date,year,month,day,month_name,unit_no,tx_type,description,amount,
    occupancy,category,source,created_by,building_id,account_id
  ) values (
    s.exit_date_jalali,s.exit_ym/100,s.exit_ym%100,s.exit_day,
    public.bm_month_name(s.exit_ym%100),s.unit_no,'انتقال مانده مالک',
    case when v_balance>0
      then 'انتقال بدهی مالک قبلی به مالک جدید'
      else 'انتقال بستانکاری مالک قبلی به مالک جدید' end
      ||' - تسویه '||s.id::text,
    v_transfer,target.occupancy,'owner_balance_transfer',
    'owner_successor_balance_transfer',s.created_by,s.building_id,target.id
  ) returning id into v_tx_id;
  return v_transfer;
end;
$$;

create or replace function public.bm_on_owner_exit_settlement()
returns trigger language plpgsql security definer set search_path=public as $$
declare v_target uuid;
begin
  if new.status='confirmed' and new.next_occupancy in ('مالک','مالک ساکن') then
    select a.id into v_target from public.accounts a
     where a.building_id=new.building_id and a.unit_no=new.unit_no
       and a.id<>new.account_id and a.is_active and a.occupancy in ('مالک','مالک ساکن')
     order by (a.occupancy='مالک ساکن') desc,a.is_primary desc,a.created_at desc limit 1;
    if v_target is not null then perform public.bm_transfer_owner_exit_balance(new.id,v_target); end if;
  end if;
  return new;
end $$;

create or replace function public.bm_on_owner_account_created()
returns trigger language plpgsql security definer set search_path=public as $$
declare s record;
begin
  if new.is_active and new.occupancy in ('مالک','مالک ساکن') then
    for s in
      select x.id from public.account_exit_settlements x
      join public.accounts olda on olda.id=x.account_id
      where x.building_id=new.building_id and x.unit_no=new.unit_no
        and x.status='confirmed' and x.next_occupancy in ('مالک','مالک ساکن')
        and olda.occupancy in ('مالک','مالک ساکن')
        and x.next_start_date is not null
        and (new.start_date_jalali is null or new.start_date_jalali=x.next_start_date_jalali)
      order by x.confirmed_at desc
    loop
      perform public.bm_transfer_owner_exit_balance(s.id,new.id);
      exit;
    end loop;
  end if;
  return new;
end $$;

drop trigger if exists trg_owner_exit_balance_transfer on public.account_exit_settlements;
create trigger trg_owner_exit_balance_transfer
after insert on public.account_exit_settlements
for each row execute function public.bm_on_owner_exit_settlement();

drop trigger if exists trg_owner_account_balance_transfer on public.accounts;
create trigger trg_owner_account_balance_transfer
after insert on public.accounts
for each row execute function public.bm_on_owner_account_created();

do $$
declare d text;
begin
  d:=pg_get_functiondef('public.app_report(uuid,integer,integer)'::regprocedure);
  d:=replace(d, 't.tx_type in (''درآمد'',''انتقال بستانکاری'')',
                't.tx_type in (''درآمد'',''انتقال بستانکاری'',''انتقال مانده مالک'')');
  execute d;

  d:=pg_get_functiondef('public.app_get_unit_account_debts_for_admin(uuid,integer,integer)'::regprocedure);
  d:=replace(d, 'raw_rows := ''[]''::jsonb;'||E'\n    rows := ''[]''::jsonb;',
    'raw_rows := ''[]''::jsonb;'||E'\n    rows := ''[]''::jsonb;'||E'\n    select coalesce(sum(-t.amount),0) into due from public.transactions t where t.building_id=me.building_id and t.account_id=acc.id and t.unit_no=p_unit_no and t.tx_type=''انتقال مانده مالک'' and t.amount<0;'||E'\n    if due>0 then raw_rows:=raw_rows||jsonb_build_array(jsonb_build_object(''ym'',start_ym,''year'',start_ym/100,''month'',start_ym%100,''month_name'',public.bm_month_name(start_ym%100),''category'',''owner_balance_transfer_debt'',''category_name'',''بدهی منتقل‌شده از مالک قبلی'',''amount'',due)); end if;');
  d:=replace(d, 'and t.tx_type in (''درآمد'',''انتقال بستانکاری'')',
                'and t.tx_type in (''درآمد'',''انتقال بستانکاری'',''انتقال مانده مالک'') and (t.tx_type<>''انتقال مانده مالک'' or t.amount>0)');
  execute d;

  d:=pg_get_functiondef('public.app_preview_account_exit(uuid,uuid,text,date,integer,text,text,date,integer)'::regprocedure);
  d:=replace(d, 'v_totals := jsonb_build_object(''charge'',v_charge',
    'select coalesce(sum(t.amount),0) into v_paid from public.transactions t where t.building_id=me.building_id and t.account_id=a.id and t.unit_no=a.unit_no and t.tx_type=''انتقال مانده مالک'';'||E'\n  v_total_paid:=v_total_paid+v_paid;'||E'\n  v_totals := jsonb_build_object(''charge'',v_charge');
  d:=replace(d, 't.tx_type=''درآمد''', 't.tx_type in (''درآمد'',''انتقال بستانکاری'',''انتقال مانده مالک'')');
  execute d;
end $$;

