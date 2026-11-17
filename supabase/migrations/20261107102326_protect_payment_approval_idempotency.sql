CREATE UNIQUE INDEX IF NOT EXISTS transactions_payment_request_id_uidx
ON public.transactions (payment_request_id)
WHERE payment_request_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.app_admin_review_payment(
  p_token uuid,
  p_id bigint,
  p_approve boolean,
  p_amount bigint DEFAULT NULL::bigint,
  p_admin_note text DEFAULT NULL::text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  me public.accounts;
  pr public.payment_requests;
  occ text;
  final_amount bigint;
BEGIN
  me := public.bm_admin(p_token);

  SELECT *
    INTO pr
    FROM public.payment_requests
   WHERE id = p_id
     AND building_id = me.building_id
   FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'درخواست پرداخت یافت نشد یا متعلق به این ساختمان نیست';
  END IF;

  IF pr.status <> 'pending' THEN
    RAISE EXCEPTION 'این درخواست قبلاً بررسی شده است';
  END IF;

  IF p_approve THEN
    final_amount := COALESCE(p_amount, pr.amount);
    IF final_amount IS NULL OR final_amount <= 0 THEN
      RAISE EXCEPTION 'مبلغ پرداخت معتبر نیست';
    END IF;

    SELECT a.occupancy
      INTO occ
      FROM public.accounts a
     WHERE a.id = pr.account_id
       AND a.building_id = me.building_id;

    IF NOT FOUND OR occ IS NULL THEN
      RAISE EXCEPTION 'حساب پرداخت‌کننده معتبر نیست';
    END IF;

    INSERT INTO public.transactions (
      building_id, year, month, unit_no, tx_type, category, description,
      amount, occupancy, source, payment_request_id, created_by,
      pay_date, ref_code, note, receipt_image
    )
    VALUES (
      me.building_id, pr.year, pr.month, pr.unit_no, 'درآمد', pr.category,
      'تایید پرداخت: ' || COALESCE(pr.note, ''),
      final_amount, occ, 'payment', pr.id, me.id,
      pr.pay_date, pr.ref_code, pr.note, pr.receipt_image
    );

    UPDATE public.payment_requests
       SET status = 'approved',
           reviewed_by = me.id,
           reviewed_at = now(),
           admin_note = p_admin_note
     WHERE id = p_id
       AND building_id = me.building_id
       AND status = 'pending';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'وضعیت درخواست همزمان تغییر کرده است';
    END IF;
  ELSE
    UPDATE public.payment_requests
       SET status = 'rejected',
           reviewed_by = me.id,
           reviewed_at = now(),
           admin_note = p_admin_note
     WHERE id = p_id
       AND building_id = me.building_id
       AND status = 'pending';

    IF NOT FOUND THEN
      RAISE EXCEPTION 'وضعیت درخواست همزمان تغییر کرده است';
    END IF;
  END IF;
END;
$function$;
