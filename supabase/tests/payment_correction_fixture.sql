\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgtap;
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $roles$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN; END IF;
END
$roles$;

CREATE TABLE public.buildings (id integer PRIMARY KEY);
CREATE TABLE public.accounts (
  id uuid PRIMARY KEY,
  building_id integer NOT NULL REFERENCES public.buildings(id),
  admin_token uuid UNIQUE,
  UNIQUE (building_id,id)
);
CREATE TABLE public.transactions (
  id bigserial PRIMARY KEY,
  building_id integer NOT NULL REFERENCES public.buildings(id),
  year integer NOT NULL,
  month integer NOT NULL,
  day integer,
  unit_no integer NOT NULL,
  account_id uuid,
  tx_type text,
  category text,
  location text,
  description text,
  amount bigint,
  occupancy text,
  source text,
  created_by uuid,
  pay_date date,
  ref_code text,
  note text,
  receipt_image text,
  payment_request_id bigint
);
CREATE TABLE public.payment_requests (
  id bigint PRIMARY KEY,
  building_id integer NOT NULL REFERENCES public.buildings(id),
  status text NOT NULL,
  account_id uuid NOT NULL,
  unit_no integer NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  category text NOT NULL,
  amount bigint NOT NULL
);

CREATE OR REPLACE FUNCTION public.bm_admin(p_token uuid)
RETURNS public.accounts
LANGUAGE plpgsql
AS $$
DECLARE v public.accounts;
BEGIN
  SELECT * INTO v FROM public.accounts WHERE admin_token=p_token;
  IF NOT FOUND THEN RAISE EXCEPTION 'manager session required'; END IF;
  RETURN v;
END;
$$;

-- Apply the payment-correction DDL and RPC from the production migration
-- against this disposable, minimal schema.
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
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $function$
BEGIN
  RAISE EXCEPTION 'سوابق اصلاح پرداخت فقط قابل ثبت هستند و امکان ویرایش یا حذف ندارند';
END;
$function$;
CREATE TRIGGER payment_corrections_immutable
BEFORE UPDATE OR DELETE ON public.payment_corrections
FOR EACH ROW EXECUTE FUNCTION public.bm_payment_corrections_reject_mutation();

CREATE OR REPLACE FUNCTION public.app_admin_correct_approved_payment(
  p_token uuid, p_id bigint, p_reason text
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = ''
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

REVOKE ALL ON FUNCTION public.app_admin_correct_approved_payment(uuid,bigint,text) FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_correct_approved_payment(uuid,bigint,text) TO anon;
ALTER FUNCTION public.bm_payment_corrections_reject_mutation() SET search_path = '';
REVOKE ALL ON FUNCTION public.bm_payment_corrections_reject_mutation() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bm_payment_corrections_reject_mutation() TO service_role;

INSERT INTO public.buildings(id) VALUES (101),(202);
INSERT INTO public.accounts(id,building_id,admin_token) VALUES
('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',101,'11111111-1111-4111-8111-111111111111'),
('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',202,'22222222-2222-4222-8222-222222222222');
INSERT INTO public.payment_requests(id,building_id,status,account_id,unit_no,year,month,category,amount) VALUES
(9001,101,'approved','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,1405,8,'شارژ',500000),
(9002,202,'approved','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',2,1405,8,'شارژ',300000),
(9003,101,'pending','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',1,1405,8,'شارژ',200000);
INSERT INTO public.transactions(building_id,year,month,day,unit_no,account_id,tx_type,category,amount,occupancy,source,created_by,payment_request_id)
VALUES
(101,1405,8,10,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','درآمد','شارژ',500000,'owner','payment','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',9001),
(202,1405,8,11,2,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','درآمد','شارژ',300000,'owner','payment','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',9002),
(101,1405,8,12,1,'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','درآمد','شارژ',200000,'owner','payment','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',9003);
