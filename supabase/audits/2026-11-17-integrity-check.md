# Read-only data integrity audit — 2026-11-17

Project: `fvhzshtgtkqzrgmblczh` (Resident Manager / Modir)

No application rows were inserted, updated, or deleted during this audit. Queries were read-only.

## Checks that passed

| Invariant | Violations |
|---|---:|
| Current building manager points to an active manager account in that building | 0 |
| Transaction account/building/unit consistency | 0 |
| Pending payment request points to a matching current account/unit | 0 |
| Session account/building consistency | 0 |
| Push subscription account/building consistency | 0 |
| Non-positive transaction amounts | 0 |
| Non-positive payment request amounts | 0 |
| Invalid payment request statuses | 0 |
| Duplicate pending payment requests for the same account/month/category | 0 |
| Duplicate primary accounts within the same unit and occupancy | 0 |
| Accounts with more than two active device sessions | 0 |
| Duplicate manual transactions under the current duplicate key | 0 |

## Historical records retained

Three **approved** payment requests refer to accounts whose current unit number differs from the unit recorded on the historical request. No pending request has this mismatch. These records may reflect a later account/unit move; they were not changed because the historical unit snapshot should not be rewritten without reviewing the move history.

## Scope and limitations

- The checks validate current relational consistency for the listed invariants; they do not prove every financial balance is mathematically correct for every historical month.
- No production payment, transaction, account, building, or resident data was changed.
- Do not treat the approved historical unit differences as errors until their account-move history is reviewed.
