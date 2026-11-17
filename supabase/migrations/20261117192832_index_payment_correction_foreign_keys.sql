CREATE INDEX IF NOT EXISTS payment_corrections_building_id_idx
  ON public.payment_corrections (building_id);
CREATE INDEX IF NOT EXISTS payment_corrections_building_account_idx
  ON public.payment_corrections (building_id, account_id);
CREATE INDEX IF NOT EXISTS payment_corrections_created_by_idx
  ON public.payment_corrections (created_by);
