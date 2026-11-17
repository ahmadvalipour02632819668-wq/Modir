
do $patch$
declare d text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='app_resident_get_financial_summary';
 d:=replace(d,
  'v_net_balance:=round(v_total_exp-v_total_paid,0);' || E'\n v_debt:=greatest(v_net_balance,0);' || E'\n v_credit:=greatest(-v_net_balance,0);',
  'v_net_balance:=0; v_debt:=0; v_credit:=0;');
 d:=replace(d,
  'into v_item_outstanding from jsonb_array_elements(v_charges) item;',
  'into v_item_outstanding from jsonb_array_elements(v_charges) item;' || E'\n v_debt:=greatest(coalesce(v_member.opening_debt,0),0)+v_item_outstanding;' ||
  E'\n v_credit:=greatest(-coalesce(v_member.opening_debt,0),0)+v_item_overallocated+v_unallocated;' ||
  E'\n v_net_balance:=v_debt-v_credit;');
 if position('v_debt:=greatest(coalesce(v_member.opening_debt,0),0)+v_item_outstanding;' in d)=0 then
  raise exception 'محاسبه مستقل بدهی و بستانکاری اعمال نشد';
 end if;
 execute d;
end
$patch$;

