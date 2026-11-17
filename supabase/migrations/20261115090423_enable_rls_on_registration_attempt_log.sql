alter table public.registration_attempt_log enable row level security; revoke all on public.registration_attempt_log from public, anon, authenticated;
