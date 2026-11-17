BEGIN;

CREATE EXTENSION IF NOT EXISTS pgtap WITH SCHEMA extensions;

SELECT plan(19);

SELECT has_table('public', 'payment_corrections',
  'payment correction audit table exists');

SELECT has_column('public', 'payment_corrections', 'original_transaction_id',
  'audit table stores the original transaction');
SELECT has_column('public', 'payment_corrections', 'correction_transaction_id',
  'audit table stores the reversal transaction');
SELECT has_column('public', 'payment_corrections', 'reason',
  'audit table stores the correction reason');

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.payment_corrections'::regclass
      AND c.contype = 'u'
      AND a.attname = 'original_transaction_id'
  ),
  'an original transaction can be corrected only once'
);

SELECT ok(
  EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid
     AND a.attnum = ANY(c.conkey)
    WHERE c.conrelid = 'public.payment_corrections'::regclass
      AND c.contype = 'u'
      AND a.attname = 'correction_transaction_id'
  ),
  'a reversal transaction can belong to only one correction'
);

SELECT has_trigger('public', 'payment_corrections', 'payment_corrections_immutable',
  'correction audit records have an immutability trigger');

SELECT ok(
  (SELECT relrowsecurity FROM pg_class
   WHERE oid = 'public.payment_corrections'::regclass),
  'row level security is enabled on the audit table'
);

SELECT ok(NOT has_table_privilege('anon', 'public.payment_corrections', 'SELECT'),
  'anonymous clients cannot read correction audit rows');
SELECT ok(NOT has_table_privilege('anon', 'public.payment_corrections', 'INSERT'),
  'anonymous clients cannot insert correction audit rows');
SELECT ok(NOT has_table_privilege('authenticated', 'public.payment_corrections', 'SELECT'),
  'authenticated clients cannot read correction audit rows');
SELECT ok(NOT has_table_privilege('authenticated', 'public.payment_corrections', 'UPDATE'),
  'authenticated clients cannot update correction audit rows');

SELECT ok(
  has_function_privilege(
    'anon',
    'public.app_admin_correct_approved_payment(uuid,bigint,text)',
    'EXECUTE'
  ),
  'custom-token correction RPC remains callable by anon clients'
);
SELECT ok(
  NOT has_function_privilege(
    'authenticated',
    'public.app_admin_correct_approved_payment(uuid,bigint,text)',
    'EXECUTE'
  ),
  'authenticated role cannot bypass the custom-token RPC boundary'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = 'public.app_admin_correct_approved_payment(uuid,bigint,text)'::regprocedure
      AND coalesce(array_to_string(p.proconfig, ','), '') LIKE '%search_path=%'
      AND coalesce(array_to_string(p.proconfig, ','), '') LIKE '%search_path=""%'
  ),
  'correction RPC uses an empty search_path'
);

SELECT ok(
  EXISTS (
    SELECT 1 FROM pg_proc p
    WHERE p.oid = 'public.bm_payment_corrections_reject_mutation()'::regprocedure
      AND coalesce(array_to_string(p.proconfig, ','), '') LIKE '%search_path=""%'
  ),
  'immutability trigger function uses an empty search_path'
);

SELECT ok(position('payment_corrections' IN
  pg_get_functiondef('public.app_get_user_debts(uuid,integer)'::regprocedure)) > 0,
  'resident debt calculation accounts for audited corrections');
SELECT ok(position('payment_corrections' IN
  pg_get_functiondef('public.app_get_unit_account_debts_for_admin(uuid,integer,integer)'::regprocedure)) > 0,
  'manager account debt calculation accounts for audited corrections');
SELECT ok(position('payment_corrections' IN
  pg_get_functiondef('public.app_process_payment_fifo(uuid,bigint,text,text,text,text,integer)'::regprocedure)) > 0,
  'FIFO payment allocation accounts for audited corrections');
SELECT ok(position('payment_corrections' IN
  pg_get_functiondef('public.app_report(uuid,integer,integer)'::regprocedure)) > 0,
  'financial reports account for audited corrections');

SELECT * FROM finish();
ROLLBACK;
