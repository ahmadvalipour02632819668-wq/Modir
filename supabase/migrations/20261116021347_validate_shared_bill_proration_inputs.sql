-- Validate the period and payer list before prorating shared water/gas bills.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old text := 'begin
  if p_category not in (''water'',''gas'')
     or not (''مستأجر''=any(coalesce(p_payers,''{}''::text[]))) then';
  v_new text := 'begin
  if p_ym is null or p_ym/100 not between 1300 and 1600 or p_ym%100 not between 1 and 12 then
    raise exception ''دوره قبض معتبر نیست'';
  end if;
  if not public.bm_valid_payer_array(p_payers) then
    raise exception ''فهرست پرداخت‌کنندگان قبض معتبر نیست'';
  end if;
  if p_category is null or p_category not in (''water'',''gas'')
     or not (''مستأجر''=any(coalesce(p_payers,''{}''::text[]))) then';
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='bm2_prorate_shared_bill_shares'
     and pg_get_function_identity_arguments(p.oid)='p_building_id integer, p_ym integer, p_category text, p_payers text[], p_shares jsonb';
  if v_oid is null then raise exception 'تابع تسهیم قبض پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  if strpos(v_def,v_old)>0 then
    execute replace(v_def,v_old,v_new);
  elsif strpos(v_def,'p_ym is null or p_ym/100 not between 1300 and 1600')=0 then
    raise exception 'محل اعتبارسنجی دوره قبض پیدا نشد';
  end if;
end
$migration$;
