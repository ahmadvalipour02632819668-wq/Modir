
do $$
declare d text;
begin
  d:=pg_get_functiondef('public.app_admin_submit_account_payment(uuid,uuid,integer,integer,text,bigint,text,text,text,text)'::regprocedure);
  d:=replace(d, 'p_category not in (''charge'',''water'',''gas'',''repair'',''parking'')',
                'p_category not in (''charge'',''water'',''gas'',''repair'',''parking'',''owner_balance_transfer_debt'')');
  execute d;

  d:=pg_get_functiondef('public.app_submit_payment(uuid,integer,integer,text,bigint,text,text,text,text,integer)'::regprocedure);
  d:=replace(d, 'p_category NOT IN (''charge'',''water'',''gas'',''repair'',''parking'')',
                'p_category NOT IN (''charge'',''water'',''gas'',''repair'',''parking'',''owner_balance_transfer_debt'')');
  execute d;

  d:=pg_get_functiondef('public.app_get_unit_account_debts_for_admin(uuid,integer,integer)'::regprocedure);
  d:=replace(d, 'and (t.tx_type<>''انتقال مانده مالک'' or t.amount>0)',
                'and (t.tx_type<>''انتقال مانده مالک'' or t.amount>0) and t.category<>''owner_balance_transfer_debt''');
  d:=replace(d, 'select coalesce(sum(-t.amount),0) into due from public.transactions t where t.building_id=me.building_id and t.account_id=acc.id and t.unit_no=p_unit_no and t.tx_type=''انتقال مانده مالک'' and t.amount<0;',
    'select greatest(coalesce(sum(-t.amount),0)-coalesce((select sum(x.amount) from public.transactions x where x.building_id=me.building_id and x.account_id=acc.id and x.unit_no=p_unit_no and x.tx_type=''درآمد'' and x.category=''owner_balance_transfer_debt''),0)-coalesce((select sum(pr.amount) from public.payment_requests pr where pr.building_id=me.building_id and pr.account_id=acc.id and pr.unit_no=p_unit_no and pr.category=''owner_balance_transfer_debt'' and pr.status=''pending''),0),0) into due from public.transactions t where t.building_id=me.building_id and t.account_id=acc.id and t.unit_no=p_unit_no and t.tx_type=''انتقال مانده مالک'' and t.amount<0;');
  execute d;

  d:=pg_get_functiondef('public.app_get_user_debts(uuid,integer)'::regprocedure);
  d:=replace(d, 'select coalesce(sum(-t.amount),0) into paid from public.transactions t where t.building_id=me.building_id and t.account_id=me.id and t.unit_no=me.unit_no and t.tx_type=''انتقال مانده مالک'' and t.amount<0;',
    'select greatest(coalesce(sum(-t.amount),0)-coalesce((select sum(x.amount) from public.transactions x where x.building_id=me.building_id and x.account_id=me.id and x.unit_no=me.unit_no and x.tx_type=''درآمد'' and x.category=''owner_balance_transfer_debt''),0)-coalesce((select sum(pr.amount) from public.payment_requests pr where pr.building_id=me.building_id and pr.account_id=me.id and pr.unit_no=me.unit_no and pr.category=''owner_balance_transfer_debt'' and pr.status=''pending''),0),0) into paid from public.transactions t where t.building_id=me.building_id and t.account_id=me.id and t.unit_no=me.unit_no and t.tx_type=''انتقال مانده مالک'' and t.amount<0;');
  execute d;

  d:=pg_get_functiondef('public.app_get_unit_debts_for_admin(uuid,integer,integer)'::regprocedure);
  d:=replace(d, 'select coalesce(sum(-t.amount),0) into paid from public.transactions t where t.building_id=me.building_id and t.account_id=target.id and t.unit_no=p_unit_no and t.tx_type=''انتقال مانده مالک'' and t.amount<0;',
    'select greatest(coalesce(sum(-t.amount),0)-coalesce((select sum(x.amount) from public.transactions x where x.building_id=me.building_id and x.account_id=target.id and x.unit_no=p_unit_no and x.tx_type=''درآمد'' and x.category=''owner_balance_transfer_debt''),0)-coalesce((select sum(pr.amount) from public.payment_requests pr where pr.building_id=me.building_id and pr.account_id=target.id and pr.unit_no=p_unit_no and pr.category=''owner_balance_transfer_debt'' and pr.status=''pending''),0),0) into paid from public.transactions t where t.building_id=me.building_id and t.account_id=target.id and t.unit_no=p_unit_no and t.tx_type=''انتقال مانده مالک'' and t.amount<0;');
  execute d;

  d:=pg_get_functiondef('public.app_preview_account_exit(uuid,uuid,text,date,integer,text,text,date,integer)'::regprocedure);
  d:=replace(d,
    'v_total_paid:=v_total_paid+v_paid;',
    'v_total_paid:=v_total_paid+v_paid;'||E'\n  select coalesce(sum(t.amount),0) into v_paid from public.transactions t where t.building_id=me.building_id and t.account_id=a.id and t.unit_no=a.unit_no and t.tx_type=''درآمد'' and t.category=''owner_balance_transfer_debt'';'||E'\n  v_total_paid:=v_total_paid+v_paid;');
  execute d;
end $$;

