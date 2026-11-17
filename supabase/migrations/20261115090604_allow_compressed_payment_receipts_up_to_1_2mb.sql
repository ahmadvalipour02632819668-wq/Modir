
alter table public.payment_requests
  drop constraint if exists payment_requests_receipt_image_safe;
alter table public.payment_requests
  add constraint payment_requests_receipt_image_safe
  check (
    receipt_image is null or
    (length(receipt_image) <= 1200000 and
     receipt_image ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')
  );

