-- Keep unit person counts consistent with the 1..30 account person limit.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_old text := 'if coalesce(p_persons,0) not between 0 and 100 then';
  v_new text := 'if coalesce(p_persons,0) not between 0 and 30 then';
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_admin_save_unit';
  if v_oid is null then raise exception 'تابع ذخیره واحد پیدا نشد'; end if;
  v_def:=pg_get_functiondef(v_oid);
  if strpos(v_def,v_old)=0 then raise exception 'محدوده تعداد نفرات واحد پیدا نشد'; end if;
  execute replace(v_def,v_old,v_new);
end
$migration$;
