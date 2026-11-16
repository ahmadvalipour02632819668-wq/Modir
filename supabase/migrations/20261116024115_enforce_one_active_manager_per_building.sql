-- Enforce one active manager per building at the database level.
-- Manager handoff updates the outgoing manager to false before enabling the new one.
create unique index if not exists accounts_one_active_manager_per_building_uidx
  on public.accounts(building_id)
  where is_active is true and is_admin is true;
