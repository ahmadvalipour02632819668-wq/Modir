# Supabase migration history audit

**Status: reconciled**
- Project: `fvhzshtgtkqzrgmblczh` (Resident Manager / Modir)
- Audited: 2026-11-17
- Repository tree snapshot: `db8f4a21a5615ad330faef27ff8cb9befd73f713`
- Applied migration entries in Supabase: **189**
- SQL migration files in repository: **189**
- Remote versions missing locally: **0**
- Local versions absent remotely: **0**
- Version/name mismatches or duplicate local versions: **0**

## Result

At this snapshot, every applied Supabase migration has a corresponding SQL file in the repository, and every repository migration version is present in the database history. Version/name matching is exact. The earlier migration-history gap has been reconciled by restoring the missing SQL files to GitHub. The additional manual-duplicate serialization migration is also present in both the repository and production migration history.

## Safe operating rule

Do not run `db reset` or replay already-applied migrations against production. For future schema changes, add a new timestamped SQL migration to the repository, review it, apply it through the normal migration workflow, and verify the resulting version in Supabase. Keep production data intact.

## Verification details

- Comparison uses the pinned Git tree SHA above and the Supabase migration history read during this audit.
- A new audit should be run before each deployment because the branch and database can change independently.
