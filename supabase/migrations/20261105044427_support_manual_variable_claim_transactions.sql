
do $patch$
declare d text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='app_financial_v2_create_transaction';
 if position('p_tx_type not in (''درآمد'',''هزینه'')' in d)=0 then raise exception 'اعتبارسنجی نوع تراکنش پیدا نشد'; end if;
 d:=replace(d,'p_tx_type not in (''درآمد'',''هزینه'')','p_tx_type not in (''درآمد'',''هزینه'',''مطالبه'')');
 execute d;
end
$patch$;

do $patch$
declare d text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='app_manager_get_transactions';
 d:=replace(d,
  '''category'',e.category,''status'',''approved'',''is_legacy'',e.legacy_import_id is not null,',
  '''category'',e.category,''status'',''approved'',''is_legacy'',e.legacy_import_id is not null,' ||
  E'\n      ''is_recurring'',exists(select 1 from public.recurring_obligation_runs rr where rr.expense_id=e.id),');
 if position('is_recurring' in d)=0 then raise exception 'نشانگر مطالبه دوره‌ای به فهرست تراکنش‌ها اضافه نشد'; end if;
 execute d;
end
$patch$;

