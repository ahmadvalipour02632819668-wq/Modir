do $migration$
begin
  if not exists (select 1 from pg_constraint where conrelid='public.transactions'::regclass and conname='transactions_amount_positive') then
    alter table public.transactions add constraint transactions_amount_positive check (amount > 0);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.transactions'::regclass and conname='transactions_year_valid') then
    alter table public.transactions add constraint transactions_year_valid check (year between 1300 and 1600);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.transactions'::regclass and conname='transactions_month_valid') then
    alter table public.transactions add constraint transactions_month_valid check (month between 1 and 12);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.transactions'::regclass and conname='transactions_day_valid') then
    alter table public.transactions add constraint transactions_day_valid check (day between 1 and 31);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.transactions'::regclass and conname='transactions_receipt_image_safe') then
    alter table public.transactions add constraint transactions_receipt_image_safe
      check (receipt_image is null or (length(receipt_image) <= 1200000 and receipt_image ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'));
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.payment_requests'::regclass and conname='payment_requests_year_valid') then
    alter table public.payment_requests add constraint payment_requests_year_valid check (year between 1300 and 1600);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.payment_requests'::regclass and conname='payment_requests_month_valid') then
    alter table public.payment_requests add constraint payment_requests_month_valid check (month between 1 and 12);
  end if;
  if not exists (select 1 from pg_constraint where conrelid='public.payment_requests'::regclass and conname='payment_requests_pay_date_valid') then
    alter table public.payment_requests add constraint payment_requests_pay_date_valid
      check (pay_date is not null and pay_date ~ '^[0-9]{4}/(0?[1-9]|1[0-2])/(0?[1-9]|[12][0-9]|3[01])$');
  end if;
end
$migration$;
