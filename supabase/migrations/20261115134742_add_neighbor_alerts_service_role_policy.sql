create policy neighbor_alerts_service_role_access
on public.neighbor_alerts
for all
to service_role
using (true)
with check (true);
