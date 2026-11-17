CREATE TABLE IF NOT EXISTS public.payment_corrections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  building_id integer NOT NULL REFERENCES public.buildings(id) ON DELETE RESTRICT,
  original_transaction_id bigint NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE RESTRICT,
  correction_transaction_id bigint NOT NULL UNIQUE REFERENCES public.transactions(id) ON DELETE RESTRICT,
  account_id uuid NOT NULL,
  amount bigint NOT NULL CHECK (amount > 0),
  reason text NOT NULL CHECK (length(btrim(reason)) BETWEEN 5 AND 1000),
  created_by uuid NOT NULL REFERENCES public.accounts(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_corrections_building_account_fk
    FOREIGN KEY (building_id, account_id)
    REFERENCES public.accounts(building_id, id) ON DELETE RESTRICT
);

ALTER TABLE public.payment_corrections ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.payment_corrections FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.bm_payment_corrections_reject_mutation()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'سوابق اصلاح پرداخت فقط قابل ثبت هستند و امکان ویرایش یا حذف ندارند';
END;
$function$;

DROP TRIGGER IF EXISTS payment_corrections_immutable ON public.payment_corrections;
CREATE TRIGGER payment_corrections_immutable
BEFORE UPDATE OR DELETE ON public.payment_corrections
FOR EACH ROW EXECUTE FUNCTION public.bm_payment_corrections_reject_mutation();

CREATE OR REPLACE FUNCTION public.app_admin_correct_approved_payment(
  p_token uuid, p_id bigint, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  me public.accounts;
  tx public.transactions;
  pr public.payment_requests;
  correction_id uuid;
  reversal_id bigint;
  reason_text text := nullif(btrim(coalesce(p_reason,'')),'');
BEGIN
  me := public.bm_admin(p_token);
  IF p_id IS NULL THEN RAISE EXCEPTION 'شناسه پرداخت معتبر نیست'; END IF;
  IF reason_text IS NULL OR length(reason_text) < 5 OR length(reason_text) > 1000 THEN
    RAISE EXCEPTION 'دلیل اصلاح باید حداقل ۵ و حداکثر ۱۰۰۰ نویسه باشد';
  END IF;

  SELECT * INTO tx FROM public.transactions
   WHERE id=p_id AND building_id=me.building_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'پرداخت پیدا نشد یا متعلق به این ساختمان نیست'; END IF;
  IF tx.source IS DISTINCT FROM 'payment'
     OR tx.payment_request_id IS NULL
     OR tx.tx_type IS DISTINCT FROM 'درآمد'
     OR tx.amount IS NULL OR tx.amount <= 0
     OR tx.account_id IS NULL THEN
    RAISE EXCEPTION 'فقط پرداخت تأییدشده و مرتبط با درخواست پرداخت از این مسیر قابل اصلاح است';
  END IF;

  SELECT * INTO pr FROM public.payment_requests
   WHERE id=tx.payment_request_id AND building_id=me.building_id FOR UPDATE;
  IF NOT FOUND OR pr.status IS DISTINCT FROM 'approved'
     OR pr.account_id IS DISTINCT FROM tx.account_id
     OR pr.unit_no IS DISTINCT FROM tx.unit_no
     OR pr.year IS DISTINCT FROM tx.year
     OR pr.month IS DISTINCT FROM tx.month
     OR pr.category IS DISTINCT FROM tx.category
     OR pr.amount IS DISTINCT FROM tx.amount THEN
    RAISE EXCEPTION 'اطلاعات درخواست و تراکنش پرداخت با هم مطابقت ندارد؛ اصلاح متوقف شد';
  END IF;

  IF EXISTS (SELECT 1 FROM public.payment_corrections pc
              WHERE pc.original_transaction_id=tx.id AND pc.building_id=me.building_id) THEN
    RAISE EXCEPTION 'این پرداخت قبلاً اصلاح شده است';
  END IF;

  INSERT INTO public.transactions (
    building_id,year,month,day,unit_no,account_id,tx_type,category,location,
    description,amount,occupancy,source,created_by,pay_date,ref_code,note,receipt_image
  ) VALUES (
    tx.building_id,tx.year,tx.month,tx.day,tx.unit_no,tx.account_id,
    'بازپرداخت',tx.category,tx.location,
    'سند اصلاح پرداخت اشتباه شماره '||tx.id::text,
    tx.amount,tx.occupancy,'payment_correction',me.id,
    tx.pay_date,tx.ref_code,reason_text,NULL
  ) RETURNING id INTO reversal_id;

  INSERT INTO public.payment_corrections (
    building_id,original_transaction_id,correction_transaction_id,
    account_id,amount,reason,created_by
  ) VALUES (
    me.building_id,tx.id,reversal_id,tx.account_id,tx.amount,reason_text,me.id
  ) RETURNING id INTO correction_id;

  RETURN jsonb_build_object('ok',true,'correction_id',correction_id,
    'correction_transaction_id',reversal_id,'original_transaction_id',tx.id,'amount',tx.amount);
END;
$function$;

REVOKE ALL ON FUNCTION public.app_admin_correct_approved_payment(uuid,bigint,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.app_admin_correct_approved_payment(uuid,bigint,text) TO anon, authenticated;

DO $patch$
DECLARE
  v text;
  old_v text;
  net_t text := 't.amount - coalesce((select sum(pc.amount) from public.payment_corrections pc where pc.original_transaction_id=t.id),0)';
  net_x text := 'x.amount - coalesce((select sum(pc.amount) from public.payment_corrections pc where pc.original_transaction_id=x.id),0)';
BEGIN
  SELECT pg_get_functiondef('public.app_get_user_debts(uuid,integer)'::regprocedure) INTO v;
  IF position('payment_corrections' in v)=0 THEN
    old_v:=v; v:=replace(v,'sum(t.amount)','sum('||net_t||')'); v:=replace(v,'sum(x.amount)','sum('||net_x||')');
    IF v=old_v THEN RAISE EXCEPTION 'Debt patch failed: app_get_user_debts'; END IF; EXECUTE v;
  END IF;

  SELECT pg_get_functiondef('public.app_get_unit_account_debts_for_admin(uuid,integer,integer)'::regprocedure) INTO v;
  IF position('payment_corrections' in v)=0 THEN
    old_v:=v; v:=replace(v,'sum(t.amount)','sum('||net_t||')'); v:=replace(v,'sum(x.amount)','sum('||net_x||')');
    IF v=old_v THEN RAISE EXCEPTION 'Debt patch failed: app_get_unit_account_debts_for_admin'; END IF; EXECUTE v;
  END IF;

  SELECT pg_get_functiondef('public.app_get_unit_debts_for_admin(uuid,integer,integer)'::regprocedure) INTO v;
  IF position('payment_corrections' in v)=0 THEN
    old_v:=v; v:=replace(v,'sum(t.amount)','sum('||net_t||')'); v:=replace(v,'sum(x.amount)','sum('||net_x||')');
    IF v=old_v THEN RAISE EXCEPTION 'Debt patch failed: app_get_unit_debts_for_admin'; END IF; EXECUTE v;
  END IF;

  SELECT pg_get_functiondef('public.app_process_payment_fifo(uuid,bigint,text,text,text,text,integer)'::regprocedure) INTO v;
  IF position('payment_corrections' in v)=0 THEN
    old_v:=v; v:=replace(v,'sum(t.amount)','sum('||net_t||')'); v:=replace(v,'sum(x.amount)','sum('||net_x||')');
    IF v=old_v THEN RAISE EXCEPTION 'Payment FIFO patch failed'; END IF; EXECUTE v;
  END IF;

  SELECT pg_get_functiondef('public.app_report(uuid,integer,integer)'::regprocedure) INTO v;
  IF position('payment_corrections' in v)=0 THEN
    old_v:=v;
    v:=replace(v,'sum(amount),0) into paid_prev','sum('||net_t||'),0) into paid_prev');
    v:=replace(v,'sum(amount),0) into paid_cur','sum('||net_t||'),0) into paid_cur');
    v:=replace(v,'sum(amount) filter(where category=','sum('||net_t||') filter(where category=');
    IF v=old_v THEN RAISE EXCEPTION 'Monthly report patch failed'; END IF; EXECUTE v;
  END IF;

  SELECT pg_get_functiondef('public.app_admin_save_transaction(uuid,bigint,integer,integer,integer,integer,text,text,text,text,bigint,text,boolean)'::regprocedure) INTO v;
  IF position('payment_correction' in v)=0 THEN
    old_v:=v;
    v:=regexp_replace(v,'x\.source\s*=\s*''payment''\s+OR\s+x\.payment_request_id\s+IS\s+NOT\s+NULL',
      '(x.source IN (''payment'',''payment_correction'') OR x.payment_request_id IS NOT NULL)','g');
    IF v=old_v THEN RAISE EXCEPTION 'Transaction edit guard patch failed'; END IF; EXECUTE v;
  END IF;

  SELECT pg_get_functiondef('public.app_admin_delete_transaction(uuid,bigint)'::regprocedure) INTO v;
  IF position('payment_correction' in v)=0 THEN
    old_v:=v;
    v:=regexp_replace(v,'tx\.source\s*=\s*''payment''\s+OR\s+tx\.payment_request_id\s+IS\s+NOT\s+NULL',
      '(tx.source IN (''payment'',''payment_correction'') OR tx.payment_request_id IS NOT NULL)','g');
    IF v=old_v THEN RAISE EXCEPTION 'Transaction delete guard patch failed'; END IF; EXECUTE v;
  END IF;

  SELECT pg_get_functiondef('public.app_get_transactions(uuid,integer,integer,integer)'::regprocedure) INTO v;
  IF position('payment_corrected' in v)=0 THEN
    old_v:=v;
    v:=replace(v,'ELSE to_jsonb(t) - ''created_by''',
      'ELSE (to_jsonb(t) - ''created_by'') || jsonb_build_object(''payment_corrected'', EXISTS (SELECT 1 FROM public.payment_corrections pc WHERE pc.original_transaction_id=t.id))');
    IF v=old_v THEN RAISE EXCEPTION 'Transaction listing patch failed'; END IF; EXECUTE v;
  END IF;
END;
$patch$;
