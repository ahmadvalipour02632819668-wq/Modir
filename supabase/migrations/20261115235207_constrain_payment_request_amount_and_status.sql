
ALTER TABLE public.payment_requests
  ADD CONSTRAINT payment_requests_amount_positive
  CHECK (amount > 0) NOT VALID;

ALTER TABLE public.payment_requests
  ADD CONSTRAINT payment_requests_status_valid
  CHECK (status IN ('pending','approved','rejected')) NOT VALID;

ALTER TABLE public.payment_requests
  VALIDATE CONSTRAINT payment_requests_amount_positive;

ALTER TABLE public.payment_requests
  VALIDATE CONSTRAINT payment_requests_status_valid;

