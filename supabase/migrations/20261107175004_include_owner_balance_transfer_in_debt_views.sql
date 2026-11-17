
do $$
declare d text;
begin
  d:=pg_get_functiondef('public.app_get_user_debts(uuid,integer)'::regprocedure);
  d:=replace(d,
    'and t.tx_type=''درآمد'' and (t.account_id=me.id or (t.account_id is null and t.occupancy=me.occupancy)) and t.ym=cur and t.category=c;',
    'and t.tx_type in (''درآمد'',''انتقال بستانکاری'',''انتقال مانده مالک'') and (t.account_id=me.id or (t.account_id is null and t.occupancy=me.occupancy)) and t.ym=cur and (t.category=c or (c=''charge'' and t.category=''owner_balance_transfer'' and t.amount>0));');
  d:=replace(d,
    ' return out_rows;'||E'\nend',
    ' select coalesce(sum(-t.amount),0) into paid from public.transactions t where t.building_id=me.building_id and t.account_id=me.id and t.unit_no=me.unit_no and t.tx_type=''انتقال مانده مالک'' and t.amount<0;'||E'\n if paid>0 then out_rows:=out_rows||jsonb_build_object(''ym'',stop_ym,''year'',stop_ym/100,''month'',stop_ym%100,''month_name'',public.bm_month_name(stop_ym%100),''category'',''owner_balance_transfer_debt'',''category_name'',''بدهی منتقل‌شده از مالک قبلی'',''amount'',paid); end if;'||E'\n return out_rows;'||E'\nend');
  execute d;

  d:=pg_get_functiondef('public.app_get_unit_debts_for_admin(uuid,integer,integer)'::regprocedure);
  d:=replace(d,
    'and t.tx_type=''درآمد'' and (t.account_id=target.id or (t.account_id is null and t.occupancy=target.occupancy)) and t.ym=cur and t.category=c;',
    'and t.tx_type in (''درآمد'',''انتقال بستانکاری'',''انتقال مانده مالک'') and (t.account_id=target.id or (t.account_id is null and t.occupancy=target.occupancy)) and t.ym=cur and (t.category=c or (c=''charge'' and t.category=''owner_balance_transfer'' and t.amount>0));');
  d:=replace(d,
    ' return out_rows;'||E'\nend',
    ' select coalesce(sum(-t.amount),0) into paid from public.transactions t where t.building_id=me.building_id and t.account_id=target.id and t.unit_no=p_unit_no and t.tx_type=''انتقال مانده مالک'' and t.amount<0;'||E'\n if paid>0 then out_rows:=out_rows||jsonb_build_object(''ym'',stop_ym,''year'',stop_ym/100,''month'',stop_ym%100,''month_name'',public.bm_month_name(stop_ym%100),''category'',''owner_balance_transfer_debt'',''category_name'',''بدهی منتقل‌شده از مالک قبلی'',''amount'',paid); end if;'||E'\n return out_rows;'||E'\nend');
  execute d;
end $$;

