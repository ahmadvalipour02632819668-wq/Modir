alter table public.payment_requests
  drop constraint if exists payment_requests_ref_code_length;
alter table public.payment_requests
  add constraint payment_requests_ref_code_length
  check (ref_code is null or length(ref_code) <= 120);
alter table public.payment_requests
  drop constraint if exists payment_requests_note_length;
alter table public.payment_requests
  add constraint payment_requests_note_length
  check (note is null or length(note) <= 1000);

alter table public.transactions
  drop constraint if exists transactions_ref_code_length;
alter table public.transactions
  add constraint transactions_ref_code_length
  check (ref_code is null or length(ref_code) <= 120);
alter table public.transactions
  drop constraint if exists transactions_note_length;
alter table public.transactions
  add constraint transactions_note_length
  check (note is null or length(note) <= 1000);
alter table public.transactions
  drop constraint if exists transactions_description_length;
alter table public.transactions
  add constraint transactions_description_length
  check (description is null or length(description) <= 1000);
alter table public.transactions
  drop constraint if exists transactions_location_length;
alter table public.transactions
  add constraint transactions_location_length
  check (location is null or length(location) <= 200);
