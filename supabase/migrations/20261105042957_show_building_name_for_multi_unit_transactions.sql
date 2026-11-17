
do $patch$
declare d text;
begin
 select pg_get_functiondef(p.oid) into d from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='app_manager_get_transactions';
 if position('then ''ساختمان''' in d)=0 then raise exception 'عبارت نمایش نام ساختمان پیدا نشد'; end if;
 d:=replace(d,'then ''ساختمان''','then (select b.name from public.buildings b where b.id=e.building_id)');
 execute d;
end
$patch$;

