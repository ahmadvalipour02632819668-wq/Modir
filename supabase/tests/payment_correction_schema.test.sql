\set ON_ERROR_STOP on
SELECT plan(25);

SELECT has_table('public','payment_corrections','audit table exists');
SELECT has_column('public','payment_corrections','original_transaction_id','stores original payment');
SELECT has_column('public','payment_corrections','correction_transaction_id','stores reversal');
SELECT has_column('public','payment_corrections','reason','stores correction reason');
SELECT has_trigger('public','payment_corrections','payment_corrections_immutable','audit rows are immutable');
SELECT ok((SELECT relrowsecurity FROM pg_class WHERE oid='public.payment_corrections'::regclass),'RLS is enabled');
SELECT ok(NOT has_table_privilege('anon','public.payment_corrections','SELECT'),'anon cannot read audit rows');
SELECT ok(NOT has_table_privilege('authenticated','public.payment_corrections','SELECT'),'authenticated cannot read audit rows');
SELECT ok(has_function_privilege('anon','public.app_admin_correct_approved_payment(uuid,bigint,text)','EXECUTE'),'anon can call custom-token RPC');
SELECT ok(NOT has_function_privilege('authenticated','public.app_admin_correct_approved_payment(uuid,bigint,text)','EXECUTE'),'authenticated cannot call RPC directly');
SELECT ok((SELECT coalesce(array_to_string(proconfig,','),'') LIKE '%search_path=""%' FROM pg_proc WHERE oid='public.app_admin_correct_approved_payment(uuid,bigint,text)'::regprocedure),'RPC search_path is empty');

SELECT is(
  (public.app_admin_correct_approved_payment('11111111-1111-4111-8111-111111111111',1,'ثبت اشتباه') ->> 'amount')::bigint,
  500000::bigint,
  'approved payment is reversed for the exact amount'
);
SELECT is((SELECT count(*)::bigint FROM public.payment_corrections WHERE original_transaction_id=1),1::bigint,'one immutable audit record is created');
SELECT is((SELECT count(*)::bigint FROM public.transactions WHERE source='payment_correction' AND amount=500000),1::bigint,'one reversal transaction is created');
SELECT is((SELECT note FROM public.transactions WHERE source='payment_correction' AND amount=500000),'ثبت اشتباه','reason is copied to reversal ledger');
SELECT throws_ok(
  $$SELECT public.app_admin_correct_approved_payment('11111111-1111-4111-8111-111111111111',1,'اصلاح دوباره')$$,
  'P0001','این پرداخت قبلاً اصلاح شده است','duplicate correction is rejected'
);
SELECT throws_ok(
  $$SELECT public.app_admin_correct_approved_payment('11111111-1111-4111-8111-111111111111',2,'پرداخت ساختمان دیگر')$$,
  'P0001','پرداخت پیدا نشد یا متعلق به این ساختمان نیست','cross-building payment correction is rejected'
);
SELECT throws_ok(
  $$SELECT public.app_admin_correct_approved_payment('11111111-1111-4111-8111-111111111111',3,'درخواست در انتظار')$$,
  'P0001','اطلاعات درخواست و تراکنش پرداخت با هم مطابقت ندارد؛ اصلاح متوقف شد','pending request cannot be corrected'
);
SELECT throws_ok(
  $$UPDATE public.payment_corrections SET reason='تغییر' WHERE original_transaction_id=1$$,
  'P0001','سوابق اصلاح پرداخت فقط قابل ثبت هستند و امکان ویرایش یا حذف ندارند','audit record update is blocked'
);
SELECT throws_ok(
  $$DELETE FROM public.payment_corrections WHERE original_transaction_id=1$$,
  'P0001','سوابق اصلاح پرداخت فقط قابل ثبت هستند و امکان ویرایش یا حذف ندارند','audit record deletion is blocked'
);

SELECT throws_ok(
  $SELECT public.app_admin_correct_approved_payment('11111111-1111-4111-8111-111111111111',4,'نه')$,
  'P0001','دلیل اصلاح باید حداقل ۵ و حداکثر ۱۰۰۰ نویسه باشد','short correction reason is rejected'
);
SELECT throws_ok(
  $SELECT public.app_admin_correct_approved_payment('11111111-1111-4111-8111-111111111111',5,'اصلاح منبع نامعتبر')$,
  'P0001','فقط پرداخت تأییدشده و مرتبط با درخواست پرداخت از این مسیر قابل اصلاح است','non-payment source cannot be corrected'
);
SELECT throws_ok(
  $SELECT public.app_admin_correct_approved_payment('11111111-1111-4111-8111-111111111111',6,'اصلاح نوع تراکنش')$,
  'P0001','فقط پرداخت تأییدشده و مرتبط با درخواست پرداخت از این مسیر قابل اصلاح است','non-income transaction cannot be corrected'
);
SELECT throws_ok(
  $SELECT public.app_admin_correct_approved_payment('11111111-1111-4111-8111-111111111111',7,'اصلاح مبلغ مغایر')$,
  'P0001','اطلاعات درخواست و تراکنش پرداخت با هم مطابقت ندارد؛ اصلاح متوقف شد','amount mismatch between request and transaction is rejected'
);
SELECT is(
  (SELECT count(*)::bigint FROM public.transactions WHERE source='payment_correction'),
  1::bigint,
  'rejected edge cases create no reversal transactions'
);
SELECT * FROM finish();
