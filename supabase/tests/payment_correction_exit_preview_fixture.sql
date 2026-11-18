-- Minimal stand-in for the account-exit preview function signature.
-- The production migration must rewrite all three payment aggregates.
CREATE OR REPLACE FUNCTION public.app_preview_account_exit(
  p_token uuid,
  p_account_id uuid,
  p_reason text,
  p_exit_date date,
  p_exit_year integer,
  p_exit_month text,
  p_successor_username text,
  p_successor_start_date date,
  p_successor_start_ym integer
) RETURNS bigint
LANGUAGE plpgsql
AS $function$
DECLARE
  paid_total bigint;
  paid_total_2 bigint;
  paid_total_3 bigint;
BEGIN
  SELECT coalesce(sum(t.amount),0) INTO paid_total
  FROM public.transactions t
  WHERE t.account_id=p_account_id AND t.source='payment' AND t.tx_type='درآمد';

  SELECT coalesce(sum(t.amount),0) INTO paid_total_2
  FROM public.transactions t
  WHERE t.account_id=p_account_id AND t.source='payment' AND t.tx_type='درآمد';

  SELECT coalesce(sum(t.amount),0) INTO paid_total_3
  FROM public.transactions t
  WHERE t.account_id=p_account_id AND t.source='payment' AND t.tx_type='درآمد';

  RETURN paid_total;
END;
$function$;
