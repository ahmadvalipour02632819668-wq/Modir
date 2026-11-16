do $migration$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.payment_requests'::regclass and conname='payment_requests_amount_positive') then
    alter table public.payment_requests add constraint payment_requests_amount_positive check (amount > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.payment_requests'::regclass and conname='payment_requests_receipt_image_safe') then
    alter table public.payment_requests add constraint payment_requests_receipt_image_safe
      check (receipt_image is null or (length(receipt_image) <= 1200000 and receipt_image ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.payment_requests'::regclass and conname='payment_requests_ref_code_length') then
    alter table public.payment_requests add constraint payment_requests_ref_code_length
      check (ref_code is null or length(ref_code) <= 100);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.payment_requests'::regclass and conname='payment_requests_note_length') then
    alter table public.payment_requests add constraint payment_requests_note_length
      check (note is null or length(note) <= 1000);
  end if;
end
$migration$;
