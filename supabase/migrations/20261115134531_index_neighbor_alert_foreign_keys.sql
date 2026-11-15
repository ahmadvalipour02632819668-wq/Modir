create index if not exists neighbor_alerts_sender_account_fk_idx
  on public.neighbor_alerts(sender_account_id);
create index if not exists neighbor_alerts_acknowledged_by_fk_idx
  on public.neighbor_alerts(acknowledged_by);
