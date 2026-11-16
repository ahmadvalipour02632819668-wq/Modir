-- Reject NULL elements in payer occupancy arrays. SQL ANY/NOT IN can otherwise
-- evaluate to NULL and accidentally bypass the intended two-role validation.
do $migration$
declare
  r record;
  v_def text;
  v_old text := 'if coalesce(cardinality(p_payer_occupancies),0) <> 2';
  v_new text := 'if coalesce(cardinality(p_payer_occupancies),0) <> 2 or array_position(p_payer_occupancies,null) is not null';
begin
  for r in
    select p.oid
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public' and p.proname='app_admin_save_expense'
       and p.prokind='f'
  loop
    v_def:=pg_get_functiondef(r.oid);
    if strpos(v_def,v_old)>0 then
      execute replace(v_def,v_old,v_new);
    elsif strpos(v_def,v_new)=0 then
      raise exception 'محل اعتبارسنجی فهرست پرداخت‌کنندگان پیدا نشد';
    end if;
  end loop;
end
$migration$;
