
do $patch$
declare d text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='app_recalculate_expense_allocations';
 if position('if e.tx_type=''درآمد'' and e.allocation_method like ''dynamic_%'' then' in d)=0 then
  raise exception 'بخش بروزرسانی مبلغ تراکنش پویا پیدا نشد';
 end if;
 d:=replace(d,'if e.tx_type=''درآمد'' and e.allocation_method like ''dynamic_%'' then',
              'if e.tx_type in (''درآمد'',''مطالبه'') and e.allocation_method like ''dynamic_%'' then');
 execute d;
end
$patch$;

do $patch$
declare d text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='app_manager_get_fund_summary';
 d:=replace(d,'tx_type<>''درآمد''','tx_type=''هزینه''');
 execute d;
end
$patch$;

do $patch$
declare d text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='app_manager_get_monthly_report';
 d:=replace(d,'tx_type<>''درآمد''','tx_type=''هزینه''');
 d:=replace(d,'and e.expense_date between v_start and v_end;','and e.tx_type=''هزینه'' and e.expense_date between v_start and v_end;');
 execute d;
end
$patch$;

