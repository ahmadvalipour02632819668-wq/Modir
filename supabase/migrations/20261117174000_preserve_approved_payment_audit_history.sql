-- Preserve approved payment requests and their linked income ledger rows as audit history.
CREATE OR REPLACE FUNCTION public.app_admin_delete_transaction(p_token uuid, p_id bigint)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  me public.accounts;
  tx public.transactions;
BEGIN
  me := public.bm_admin(p_token);
  SELECT * INTO tx
    FROM public.transactions
   WHERE id=p_id AND building_id=me.building_id
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'تراکنش پیدا نشد'; END IF;
  IF tx.source='payment' OR tx.payment_request_id IS NOT NULL THEN
    RAISE EXCEPTION 'حذف مستقیم پرداخت تأییدشده مجاز نیست؛ سابقه پرداخت باید حفظ شود و اصلاح آن از مسیر برگشت/اصلاح مالی انجام شود';
  END IF;
  DELETE FROM public.transactions WHERE id=p_id AND building_id=me.building_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'حذف تراکنش انجام نشد'; END IF;
  RETURN jsonb_build_object('ok',true);
END;
$function$;
