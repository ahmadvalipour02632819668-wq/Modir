create unique index if not exists payment_requests_one_pending_per_account_period_category_uidx
on public.payment_requests(building_id,account_id,year,month,category)
where status='pending' and account_id is not null;
