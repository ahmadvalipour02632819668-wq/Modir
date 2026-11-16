CREATE OR REPLACE FUNCTION public.app_submit_payment(
  p_token uuid,
  p_year integer,
  p_month integer,
  p_category text,
  p_amount bigint,
  p_ref_code text,
  p_note text,
  p_pay_date text,
  p_receipt_image text,
  p_target_unit integer DEFAULT NULL::integer
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  me public.accounts;
  target public.accounts;
  un integer;
  v_active_count integer := 0;
  v_primary_count integer := 0;
  debt_rows jsonb := '[]'::jsonb;
  account_debts jsonb := '[]'::jsonb;
  outstanding bigint := 0;
BEGIN
  me := public.bm_auth(p_token);

  IF p_amount IS NULL OR p_amount <= 0
     OR p_year IS NULL OR p_year NOT BETWEEN 1300 AND 1600
     OR p_month IS NULL OR p_month NOT BETWEEN 1 AND 12
     OR p_category IS NULL OR (p_category NOT IN ('charge','water','gas','repair','parking','owner_balance_transfer_debt') AND p_category !~ '^expense:[0-9]+$') THEN
    RAISE EXCEPTION 'اطلاعات پرداخت معتبر نیست';
  END IF;

  IF me.is_admin AND p_target_unit IS NOT NULL THEN
    un := p_target_unit;
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
    SELECT *
      INTO target
      FROM public.accounts a
     WHERE a.building_id = me.building_id
       AND a.unit_no = un
       AND a.is_active
     ORDER BY a.is_primary DESC, a.id
     LIMIT 1
     FOR UPDATE;
  ELSE
    un := me.unit_no;
    SELECT *
      INTO target
      FROM public.accounts a
     WHERE a.id = me.id
       AND a.building_id = me.building_id
       AND a.is_active
     FOR UPDATE;
  END IF;

  IF un IS NULL OR target.id IS NULL THEN
    RAISE EXCEPTION 'حساب پرداخت‌کننده معتبر نیست';
  END IF;

  IF p_year NOT BETWEEN 1300 AND 1600 OR p_month NOT BETWEEN 1 AND 12 THEN
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

  IF me.is_admin AND p_target_unit IS NOT NULL THEN
    SELECT coalesce(a.value->'debts','[]'::jsonb)
      INTO account_debts
      FROM jsonb_array_elements(
        public.app_get_unit_account_debts_for_admin(p_token,un,p_year*100+p_month)
      ) AS a(value)
     WHERE a.value->>'account_id'=target.id::text;
    debt_rows := coalesce(account_debts,'[]'::jsonb);
  ELSE
    debt_rows := public.app_get_user_debts(p_token,p_year*100+p_month);
  END IF;

  SELECT coalesce(max((d.value->>'amount')::bigint),0)
    INTO outstanding
    FROM jsonb_array_elements(coalesce(debt_rows,'[]'::jsonb)) AS d(value)
   WHERE d.value->>'category'=p_category
     AND (d.value->>'ym')::integer=p_year*100+p_month;

  IF p_amount > outstanding THEN
    IF p_category LIKE 'expense:%' THEN
      RAISE EXCEPTION 'مبلغ پرداخت از مانده بدهی این هزینه بیشتر است';
    ELSE
      RAISE EXCEPTION 'مبلغ پرداخت از مانده بدهی این مورد بیشتر است';
    END IF;
  END IF;

  INSERT INTO public.payment_requests(
    building_id,account_id,unit_no,year,month,category,amount,
    pay_date,ref_code,note,receipt_image,status
  )
  VALUES(
    me.building_id,target.id,un,p_year,p_month,p_category,p_amount,
    p_pay_date,p_ref_code,p_note,p_receipt_image,'pending'
  );

  RETURN jsonb_build_object('ok',true);
END;
$function$;

CREATE OR REPLACE FUNCTION public.app_admin_submit_account_payment(
  p_token uuid,
  p_account_id uuid,
  p_year integer,
  p_month integer,
  p_category text,
  p_amount bigint,
  p_ref_code text,
  p_note text,
  p_pay_date text,
  p_receipt_image text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  me public.accounts;
  target public.accounts;
  debt_rows jsonb := '[]'::jsonb;
  outstanding bigint := 0;
begin
  me := public.bm_auth(p_token);
  if not me.is_admin then
    raise exception 'دسترسی مدیر لازم است';
  end if;

  select *
    into target
    from public.accounts a
   where a.id = p_account_id
     and a.building_id = me.building_id
     and a.is_active
   for update;

  if not found then
    raise exception 'حساب انتخاب‌شده معتبر نیست';
  end if;

  if p_amount is null or p_amount <= 0
     or p_year is null or p_year not between 1300 and 1600
     or p_month is null or p_month not between 1 and 12
     or p_category is null or (p_category not in ('charge','water','gas','repair','parking','owner_balance_transfer_debt')
         and p_category !~ '^expense:[0-9]+$') then
    raise exception 'اطلاعات پرداخت معتبر نیست';
  end if;

  if p_pay_date is null
     or p_pay_date !~ '^[0-9]{4}/(0?[1-9]|1[0-2])/(0?[1-9]|[12][0-9]|3[01])$'
     or substring(p_pay_date from 1 for 4)::integer not between 1300 and 1600 then
    raise exception 'تاریخ پرداخت معتبر نیست؛ تاریخ را از تقویم انتخاب کنید';
  end if;
  if p_ref_code is not null and length(p_ref_code)>120 then
    raise exception 'کد پیگیری بیش از حد طولانی است';
  end if;
  if p_note is not null and length(p_note)>1000 then
    raise exception 'توضیحات مدیر بیش از حد مجاز است';
  end if;
  if p_receipt_image is not null and (
       length(p_receipt_image)>1200000
       or p_receipt_image !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'
     ) then
    raise exception 'تصویر فیش باید JPEG معتبر و حداکثر ۱٫۲ مگابایت باشد';
  end if;

  select coalesce(a.value->'debts','[]'::jsonb)
    into debt_rows
    from jsonb_array_elements(
      public.app_get_unit_account_debts_for_admin(p_token,target.unit_no,p_year*100+p_month)
    ) AS a(value)
   where a.value->>'account_id'=target.id::text;

  select coalesce(max((d.value->>'amount')::bigint),0)
    into outstanding
    from jsonb_array_elements(coalesce(debt_rows,'[]'::jsonb)) AS d(value)
   where d.value->>'category'=p_category
     and (d.value->>'ym')::integer=p_year*100+p_month;

  if p_amount > outstanding then
    if p_category like 'expense:%' then
      raise exception 'مبلغ پرداخت از مانده بدهی این هزینه بیشتر است';
    else
      raise exception 'مبلغ پرداخت از مانده بدهی این مورد بیشتر است';
    end if;
  end if;

  insert into public.payment_requests(
    building_id,account_id,unit_no,year,month,category,amount,
    pay_date,ref_code,note,receipt_image,status
  )
  values(
    me.building_id,target.id,target.unit_no,p_year,p_month,p_category,p_amount,
    p_pay_date,p_ref_code,p_note,p_receipt_image,'pending'
  );

  return jsonb_build_object('ok',true);
end;
$function$;
