-- Remove PostgreSQL's built-in global default EXECUTE privilege on new functions.
-- This complements the schema-local revokes in 20261116015133.
alter default privileges for role postgres
  revoke execute on functions from public;
