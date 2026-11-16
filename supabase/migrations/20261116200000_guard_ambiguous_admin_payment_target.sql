-- Prevent clients from directly invoking internal notification dispatch helpers.
-- Edge Functions call these with the service_role key; client-facing APIs use token-checked wrappers.
do $migration$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as signature
      from pg_proc p
      join pg_namespace n on n.oid=p.pronamespace
     where n.nspname='public'
       and p.proname in ('app_claim_bale_dispatch','app_claim_push_dispatch')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.signature);
    execute format('grant execute on function %s to service_role', r.signature);
  end loop;
end
$migration$;
