-- Prevent manager payment submissions from being assigned to an arbitrary account
-- when a unit has multiple active accounts. Reject ambiguous targets instead.
do $migration$
declare
  v_oid oid;
  v_def text;
  v_new text;
  v_old text;
  v_replacement text;
begin
  select p.oid into v_oid
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname='public' and p.proname='app_submit_payment'
     and pg_get_function_identity_arguments(p.oid)='p_token uuid, p_year integer, p_month integer, p_category text, p_amount bigint, p_ref_code text, p_note text, p_pay_date text, p_receipt_image text, p_target_unit integer';
  if v_oid is null then raise exception 'تابع app_submit_payment پیدا نشد'; end if;
  v_def := pg_get_functiondef(v_oid);

  v_old := '  un integer;' || E'\n';
  v_replacement := '  un integer;' || E'\n' ||
                   '  v_active_count integer := 0;' || E'\n' ||
                   '  v_primary_count integer := 0;' || E'\n';
  if strpos(v_def,v_old)=0 then raise exception 'محل تعریف متغیرهای پرداخت پیدا نشد'; end if;
  v_new := replace(v_def,v_old,v_replacement);

  v_old := $old$    un := p_target_unit;
    SELECT *$old$;
  v_replacement := $new$    un := p_target_unit;
    SELECT count(*), count(*) FILTER (WHERE a.is_primary)
      INTO v_active_count, v_primary_count
      FROM public.accounts a
     WHERE a.building_id = me.building_id
       AND a.unit_no = un
       AND a.is_active;
    IF v_active_count = 0 THEN
      RAISE EXCEPTION 'حساب فعال برای این واحد پیدا نشد';
    END IF;
    IF v_active_count > 1 AND v_primary_count <> 1 THEN
      RAISE EXCEPTION 'حساب پرداخت‌کننده این واحد مبهم است؛ ابتدا حساب اصلی را مشخص کنید';
    END IF;
    SELECT *$new$;
  if strpos(v_new,v_old)=0 then raise exception 'محل انتخاب حساب مقصد پیدا نشد'; end if;
  v_new := replace(v_new,v_old,v_replacement);

  v_old := '     OR p_year IS NULL OR p_month IS NULL OR p_month NOT BETWEEN 1 AND 12';
  v_replacement := '     OR p_year IS NULL OR p_year NOT BETWEEN 1300 AND 1600' ||
                   E'\n' || '     OR p_month IS NULL OR p_month NOT BETWEEN 1 AND 12';
  if strpos(v_new,v_old)=0 then raise exception 'محل اعتبارسنجی سال و ماه پیدا نشد'; end if;
  v_new := replace(v_new,v_old,v_replacement);

  execute v_new;
end
$migration$;
