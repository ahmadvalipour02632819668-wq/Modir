
do $patch$
declare d text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='app_resident_get_financial_summary';
 if position('v_credit_adjustment:=greatest(-coalesce(v_member.opening_debt,0),0)+v_item_overallocated+v_unallocated;' in d)=0 then
  raise exception 'محاسبه اعمال خودکار بستانکاری پیدا نشد';
 end if;
 d:=replace(d,
  'v_credit_adjustment:=greatest(-coalesce(v_member.opening_debt,0),0)+v_item_overallocated+v_unallocated;',
  'v_credit_adjustment:=0;');
 execute d;
end
$patch$;

