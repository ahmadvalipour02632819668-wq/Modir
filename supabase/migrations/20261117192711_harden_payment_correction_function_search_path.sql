-- Harden the approved-payment correction endpoint without changing its custom-token API.
ALTER FUNCTION public.app_admin_correct_approved_payment(uuid,bigint,text)
  SET search_path = '';

REVOKE ALL ON FUNCTION public.app_admin_correct_approved_payment(uuid,bigint,text)
  FROM PUBLIC, authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_correct_approved_payment(uuid,bigint,text)
  TO anon;

-- This trigger function has no object references; an empty search path removes
-- unnecessary name resolution from the trigger execution context.
ALTER FUNCTION public.bm_payment_corrections_reject_mutation()
  SET search_path = '';
REVOKE ALL ON FUNCTION public.bm_payment_corrections_reject_mutation()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.bm_payment_corrections_reject_mutation()
  TO service_role;
