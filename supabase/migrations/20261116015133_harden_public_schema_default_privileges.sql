-- Prevent newly created public API functions/tables from being exposed by default.
-- Existing RPC grants are unchanged; intentional client-facing RPCs must be
-- explicitly granted EXECUTE in their migration.
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
