-- Residents must not see income/payment rows belonging to another account in the same unit.
-- Legacy rows without account_id are visible only to the matching occupancy.
-- Unit-level expenses remain visible; account-specific expenses remain private.
do $migration$
declare
  v_def text;
  v_new text;
  v_old text := $old$ t.unit_no = me.unit_no
              AND ($old$;
  v_replacement text := $new$ t.unit_no = me.unit_no
              AND (
                (t.tx_type = 'هزینه' AND (t.account_id IS NULL OR t.account_id = me.id))
                OR t.account_id = me.id
                OR (t.account_id IS NULL AND t.occupancy = me.occupancy)
              )
              AND ($new$;
  v_oid oid;
begin
  select p.oid into v_oid
    from pg_proc p
    join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public'
     and p.proname='app_get_transactions'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_year integer, p_month integer, p_unit integer';
  if v_oid is null then raise exception 'تابع app_get_transactions پیدا نشد'; end if;
  v_def := pg_get_functiondef(v_oid);
  if strpos(v_def,v_old)=0 then raise exception 'محل فیلتر واحد در تابع پیدا نشد'; end if;
  if length(v_def)-length(replace(v_def,v_old,'')) <> length(v_old) then
    raise exception 'محل فیلتر واحد در تابع یکتا نیست';
  end if;
  v_new := replace(v_def,v_old,v_replacement);
  execute v_new;
end
$migration$;
