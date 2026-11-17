
CREATE INDEX IF NOT EXISTS transactions_building_account_idx
  ON public.transactions (building_id, account_id);

CREATE INDEX IF NOT EXISTS payment_requests_building_account_idx
  ON public.payment_requests (building_id, account_id);

