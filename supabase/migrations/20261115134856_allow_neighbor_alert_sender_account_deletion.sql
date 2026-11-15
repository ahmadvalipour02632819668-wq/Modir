alter table public.neighbor_alerts
  alter column sender_account_id drop not null;
alter table public.neighbor_alerts
  drop constraint if exists neighbor_alerts_sender_account_id_fkey;
alter table public.neighbor_alerts
  add constraint neighbor_alerts_sender_account_id_fkey
  foreign key (sender_account_id) references public.accounts(id) on delete set null;
