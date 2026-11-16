-- Defense in depth: the private schema is not exposed to anon/authenticated,
-- but internal tables should still have RLS enabled.
-- Existing SECURITY DEFINER owners and service_role bypass RLS as designed.
do $migration$
declare r record;
begin
  for r in
    select c.oid::regclass as rel
      from pg_class c
      join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='private'
       and c.relkind in ('r','p')
       and not c.relrowsecurity
  loop
    execute format('alter table %s enable row level security',r.rel);
  end loop;
end
$migration$;
