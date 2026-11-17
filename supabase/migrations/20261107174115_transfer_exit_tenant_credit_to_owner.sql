DO $$
DECLARE d text;
BEGIN
 d := pg_get_functiondef('public.app_confirm_account_exit(uuid,uuid,text,date,integer,text,text,date,integer)'::regprocedure);
 d := replace(d,
   'a.unit_no,''بازپرداخت'',''بازپرداخت به مستأجر - تسویه حساب ''||coalesce(a.full_name,''''),
      v_refund,a.occupancy,''tenant_refund'',''account_exit_refund'',me.id,me.building_id,a.id',
   'a.unit_no,''انتقال بستانکاری'',''انتقال بستانکاری مستأجر خروجی به حساب مالک - مستأجر: ''||coalesce(a.full_name,''''),
      v_refund,''مالک'',''tenant_exit_credit_transfer'',''account_exit_credit_transfer'',me.id,me.building_id,
      (select oa.id from public.accounts oa where oa.building_id=me.building_id and oa.unit_no=a.unit_no and oa.is_active and oa.occupancy in (''مالک'',''مالک ساکن'') order by (oa.occupancy=''مالک ساکن'') desc,oa.is_primary desc limit 1)');
 IF d NOT LIKE '%tenant_exit_credit_transfer%' THEN RAISE EXCEPTION 'Could not safely update exit confirmation function'; END IF;
 EXECUTE d;

 d := pg_get_functiondef('public.app_report(uuid,integer,integer)'::regprocedure);
 d := replace(d, 't.tx_type=''درآمد''', 't.tx_type in (''درآمد'',''انتقال بستانکاری'')');
 EXECUTE d;

 d := pg_get_functiondef('public.app_get_unit_account_debts_for_admin(uuid,integer,integer)'::regprocedure);
 d := replace(d, 't.tx_type = ''درآمد''', 't.tx_type in (''درآمد'',''انتقال بستانکاری'')');
 EXECUTE d;

 UPDATE public.transactions t
    SET tx_type='انتقال بستانکاری',
        description='انتقال بستانکاری مستأجر خروجی به حساب مالک - مستأجر: Ah - بابت تسویه خروج مورخ ۱۴۰۵/۰۸/۰۸',
        occupancy='مالک',
        category='tenant_exit_credit_transfer',
        source='account_exit_credit_transfer',
        account_id='97c99bfb-cd56-4338-8ec4-710fa31ff3e0'::uuid
  WHERE t.id=598
    AND t.building_id=2
    AND t.account_id='f6d588c0-057b-4cc9-a22e-75a50c387f1f'::uuid
    AND t.amount=320595
    AND t.category='tenant_refund';
 IF NOT FOUND THEN RAISE EXCEPTION 'Transaction 598 did not match expected record; no transfer made'; END IF;
END $$;
