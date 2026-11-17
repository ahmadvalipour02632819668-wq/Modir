REVOKE EXECUTE ON FUNCTION public.app_admin_correct_approved_payment(uuid,bigint,text) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.app_admin_correct_approved_payment(uuid,bigint,text) TO anon;

DROP POLICY IF EXISTS payment_corrections_service_role_only ON public.payment_corrections;
CREATE POLICY payment_corrections_service_role_only
ON public.payment_corrections
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);
