-- Validate metadata on both resident and manager-submitted manual payment requests.
-- Prevent malformed dates, oversized notes/reference codes, and oversized/non-JPEG receipts.
do $migration$
declare
  r record;
  v_def text;
  v_new text;
  v_anchor text;
  v_guard text := $guard$  IF p_year IS NULL OR p_year NOT BETWEEN 1300 AND 1600
     OR p_month IS NULL OR p_month NOT BETWEEN 1 AND 12 THEN
    RAISE EXCEPTION 'سال یا ماه پرداخت معتبر نیست';
  END IF;
  IF p_pay_date IS NULL
     OR p_pay_date !~ '^[0-9]{4}/(0?[1-9]|1[0-2])/(0?[1-9]|[12][0-9]|3[01])$'
     OR substring(p_pay_date from 1 for 4)::integer NOT BETWEEN 1300 AND 1600 THEN
    RAISE EXCEPTION 'تاریخ پرداخت معتبر نیست؛ تاریخ را از تقویم انتخاب کنید';
  END IF;
  IF p_ref_code IS NOT NULL AND length(p_ref_code)>120 THEN
    RAISE EXCEPTION 'کد پیگیری بیش از حد طولانی است';
  END IF;
  IF p_note IS NOT NULL AND length(p_note)>1000 THEN
    RAISE EXCEPTION 'توضیحات بیش از حد طولانی است';
  END IF;
  IF p_receipt_image IS NOT NULL AND (
       length(p_receipt_image)>1200000
       OR p_receipt_image !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'
     ) THEN
    RAISE EXCEPTION 'تصویر فیش باید JPEG معتبر و حداکثر ۱٫۲ مگابایت باشد';
  END IF;
$guard$;
begin
  for r in
    select p.oid,p.proname
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public'
       and p.proname in ('app_submit_payment','app_admin_submit_account_payment')
       and p.prokind='f'
  loop
    v_def := pg_get_functiondef(r.oid);
    if position('تاریخ پرداخت معتبر نیست؛ تاریخ را از تقویم انتخاب کنید' in v_def)>0 then
      continue;
    end if;
    if r.proname='app_submit_payment' then
      v_anchor := '  IF p_category ~';
    else
      v_anchor := '  if p_category ~';
    end if;
    if strpos(v_def,v_anchor)=0 then
      raise exception 'محل افزودن اعتبارسنجی در تابع % پیدا نشد',r.proname;
    end if;
    v_new := replace(v_def,v_anchor,v_guard||v_anchor);
    execute v_new;
  end loop;
end
$migration$;
