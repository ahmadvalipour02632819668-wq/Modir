CREATE OR REPLACE FUNCTION public.app_process_payment_fifo(
  p_token uuid,
  p_total_amount bigint,
  p_pay_date text,
  p_ref_code text,
  p_note text,
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
  cur integer;
  stop_ym integer;
  d record;
  paid bigint;
  pending_paid bigint;
  due bigint;
  remain bigint := p_total_amount;
  chunk bigint;
  c text;
  cats text[] := ARRAY['charge','water','gas','repair','parking'];
  inserted integer := 0;
BEGIN
  me := public.bm_auth(p_token);

  IF p_total_amount IS NULL OR p_total_amount <= 0 THEN
    RETURN jsonb_build_object('ok',false,'error','مبلغ نامعتبر است');
  END IF;

  IF me.is_admin AND p_target_unit IS NOT NULL THEN
    un := p_target_unit;
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
    target := me;
    un := me.unit_no;
    SELECT *
      INTO target
      FROM public.accounts a
     WHERE a.id = me.id
       AND a.building_id = me.building_id
       AND a.is_active
     FOR UPDATE;
  END IF;

  IF un IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','کاربر واحد ندارد');
  END IF;
  IF target.id IS NULL THEN
    RETURN jsonb_build_object('ok',false,'error','حساب پرداخت‌کننده معتبر نیست');
  END IF;

  IF p_pay_date ~ '^[0-9]{4}/(0?[1-9]|1[0-2])/(0?[1-9]|[12][0-9]|3[01])$' THEN
    stop_ym := split_part(p_pay_date,'/',1)::integer * 100
             + split_part(p_pay_date,'/',2)::integer;
  ELSE
    stop_ym := 140508;
  END IF;

  cur := coalesce(target.start_ym,140406);

  WHILE cur <= stop_ym AND remain > 0 LOOP
    SELECT *
      INTO d
      FROM public.bm2_account_month_due(me.building_id,target.id,cur);

    FOREACH c IN ARRAY cats LOOP
      EXIT WHEN remain <= 0;

      due := CASE c
        WHEN 'charge' THEN coalesce(d.charge,0)
        WHEN 'water' THEN coalesce(d.water,0)
        WHEN 'gas' THEN coalesce(d.gas,0)
        WHEN 'repair' THEN coalesce(d.repair,0)
        ELSE coalesce(d.parking,0)
      END;

      SELECT coalesce(sum(t.amount),0)
        INTO paid
        FROM public.transactions t
       WHERE t.building_id = me.building_id
         AND t.unit_no = un
         AND t.tx_type = 'درآمد'
         AND t.occupancy = target.occupancy
         AND t.ym = cur
         AND t.category = c;

      SELECT coalesce(sum(pr.amount),0)
        INTO pending_paid
        FROM public.payment_requests pr
       WHERE pr.building_id = me.building_id
         AND pr.account_id = target.id
         AND pr.unit_no = un
         AND pr.year = cur / 100
         AND pr.month = cur % 100
         AND pr.category = c
         AND pr.status = 'pending';

      due := greatest(due - paid - pending_paid,0);

      IF due > 0 THEN
        chunk := least(due,remain);
        INSERT INTO public.payment_requests(
          building_id,account_id,unit_no,year,month,category,amount,
          pay_date,ref_code,note,receipt_image,status
        )
        VALUES(
          me.building_id,target.id,un,cur/100,cur%100,c,chunk,
          p_pay_date,p_ref_code,p_note,p_receipt_image,'pending'
        );
        remain := remain - chunk;
        inserted := inserted + 1;
      END IF;
    END LOOP;

    cur := public.bm_next_ym(cur);
  END LOOP;

  IF remain > 0 THEN
    INSERT INTO public.payment_requests(
      building_id,account_id,unit_no,year,month,category,amount,
      pay_date,ref_code,note,receipt_image,status
    )
    VALUES(
      me.building_id,target.id,un,stop_ym/100,stop_ym%100,'charge',remain,
      p_pay_date,p_ref_code,coalesce(p_note,'') || ' (بستانکاری)',
      p_receipt_image,'pending'
    );
    inserted := inserted + 1;
  END IF;

  RETURN jsonb_build_object('ok',true,'inserted_count',inserted,'remaining_money',0);
END;
$function$;

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
BEGIN
  me := public.bm_auth(p_token);

  IF p_amount IS NULL OR p_amount <= 0
     OR p_year IS NULL OR p_month IS NULL OR p_month NOT BETWEEN 1 AND 12
     OR p_category NOT IN ('charge','water','gas','repair','parking') THEN
    RAISE EXCEPTION 'اطلاعات پرداخت معتبر نیست';
  END IF;

  IF me.is_admin AND p_target_unit IS NOT NULL THEN
    un := p_target_unit;
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
