# Database migration history recovery

## Recovery result

- The live Supabase project contained 188 applied migration versions.
- The public repository now contains 188 migration files with an exact one-to-one match of version and name.
- 99 previously missing migration files were recovered from the database's `supabase_migrations.schema_migrations.statements` history.
- One previously mismatched filename was aligned with the applied database version.
- A new migration, `20261117123314_revoke_authenticated_login_rpc_execute.sql`, was applied and checked into the repository.

## Privacy-preserving adjustments

This repository is public. Three historical migrations were made safe for a clean, data-free deployment rather than publishing Negin 2 resident data:

1. `20261102234235_import_negin2_approved_building.sql` is intentionally a documented no-op. The original applied SQL contains resident names, phone numbers, password hashes, and account identifiers. Those records must not be published.
2. `20261103090851_import_negin2_transactions_to_financial_v2.sql` retains schema and function changes but omits the legacy resident transaction/expense import statements.
3. `20261103122113_restore_negin2_announcements_and_requests.sql` retains schema and function changes but omits imports of historical resident announcements and requests.

The original statements for those already-applied migrations remain in the live database migration history. The repository intentionally does not contain the private seed records. If historical Negin 2 data must be restored in a separate environment, use a separately protected backup and never commit that data to this public repository.

## Safe operating rules

- Do not run `db reset` against the production project.
- Do not replay the recovered historical migrations against the already-provisioned production database.
- Do not use `db push` as a shortcut to reconcile the history.
- For a new environment, review the migration sequence on an isolated database first. The public migration history is data-neutral with respect to the Negin 2 resident seed and legacy imports.
- Keep production data exports, resident records, credentials, and password hashes outside this public repository.

## Verification

Migration reconciliation compares the exact `version_name` key in the live Supabase migration registry with the SQL filenames in `supabase/migrations`. The expected result is zero missing and zero extra files. This comparison verifies history coverage, not that a fresh database replay has been fully integration-tested.
