
CREATE UNIQUE INDEX IF NOT EXISTS accounts_building_id_id_uidx
  ON public.accounts (building_id, id);

ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_building_account_fkey
  FOREIGN KEY (building_id, account_id)
  REFERENCES public.accounts (building_id, id)
  ON DELETE SET NULL (account_id)
  NOT VALID;

ALTER TABLE public.payment_requests
  ADD CONSTRAINT payment_requests_building_account_fkey
  FOREIGN KEY (building_id, account_id)
  REFERENCES public.accounts (building_id, id)
  ON DELETE SET NULL (account_id)
  NOT VALID;

ALTER TABLE public.transactions
  VALIDATE CONSTRAINT transactions_building_account_fkey;

ALTER TABLE public.payment_requests
  VALIDATE CONSTRAINT payment_requests_building_account_fkey;

