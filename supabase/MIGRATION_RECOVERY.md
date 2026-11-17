# Database migration history recovery

## Recovery result

- The live Supabase project contained 189 applied migration versions.
- The public repository now contains 189 migration files with an exact one-to-one match of version and name.
- 99 previously missing migration files were recovered from the database's `supabase_migrations.schema_migrations.statements` history.
- One previously mismatched filename was aligned with the applied database version.
- Two new migrations are present in the live registry and repository: `20261117123314_revoke_authenticated_login_rpc_execute.sql` and `20261117124659_serialize_manual_transaction_duplicate_checks.sql`.

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

## Important live-schema drift warning

A separate read-only inspection found that the migration registry and current schema need a deeper reconciliation before any clean replay:

- The migration history contains older statements referring to `public.app_accounts` and `public.building_memberships`.
- Those relations are absent from the current live database schema.
- The current live schema instead contains the multi-building `public.accounts`, `public.buildings`, and `public.units` model.
- No explicit drop/rename migration for those older relation names was found in the recorded migration statements.

This may reflect an earlier architecture transition or out-of-band schema change. It is not safe to infer the intended transition from the migration registry alone. Therefore, even though migration version/name coverage is now 189/189, a fresh-database replay is **not yet certified**. Do not reset, push, or replay migrations against production. The next step is a schema-diff review against the current live schema and the historical SQL before declaring reproducible deployment.
