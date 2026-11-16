alter table public.activity_logs
  add column if not exists push_dispatched_at timestamptz;
alter table public.resident_requests
  add column if not exists push_dispatched_at timestamptz;
alter table public.payment_requests
  add column if not exists push_dispatched_at timestamptz;

create index if not exists activity_logs_login_push_claim_idx
  on public.activity_logs (account_id, created_at desc)
  where action='ورود' and push_dispatched_at is null;
create index if not exists resident_requests_push_claim_idx
  on public.resident_requests (account_id, created_at desc)
  where push_dispatched_at is null;
create index if not exists payment_requests_push_claim_idx
  on public.payment_requests (account_id, created_at desc)
  where status='pending' and push_dispatched_at is null;
