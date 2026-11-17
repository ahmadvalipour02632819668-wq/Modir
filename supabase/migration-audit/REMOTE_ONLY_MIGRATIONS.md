# Supabase migration history audit

> Audit snapshot only. This file is not executable SQL and does not recreate, repair, or mark migrations as applied.

- Project: `fvhzshtgtkqzrgmblczh` (Resident Manager / Modir)
- Audited: 2026-11-17
- Remote migration history entries: **188**
- SQL migration files in this repository: **97**
- Remote entries without a matching local SQL file: **91**
- Local SQL files without a matching remote version: **0**

## Why this is recorded

The production database reports applied migration versions that are not represented by SQL files in this repository. The entries below are metadata read from Supabase's migration history. Their original SQL bodies were not available from the migration-history API and must not be guessed or recreated from their names.

Do not run `db reset`, bulk `migration repair`, or replay these entries against production to resolve this discrepancy. First recover the original SQL from the historical source of truth or reconstruct and validate a baseline in a separate disposable database. Compare schema, policies, functions, triggers, indexes, and data assumptions before any production action.

## Remote-only migration metadata

| Version | Name |
|---|---|
| `20261101210045` | `fix_charge_full_amount_until_resident_exit` |
| `20261101210903` | `enforce_registration_role_and_unit_conflicts` |
| `20261101225359` | `allow_manager_submit_resident_itemized_payment` |
| `20261101231308` | `add_secure_web_push_subscriptions` |
| `20261102072246` | `fix_resident_payable_amount_after_credit` |
| `20261102234109` | `credit_adjustment_itemized` |
| `20261102234235` | `import_negin2_approved_building` |
| `20261102235014` | `legacy_history_archive` |
| `20261102235448` | `legacy_history_full_archive` |
| `20261103001354` | `restrict_legacy_history_to_own_membership` |
| `20261103001635` | `restrict_legacy_history_to_own_membership` |
| `20261103090602` | `add_legacy_jalali_date_converter` |
| `20261103090657` | `fix_legacy_jalali_date_converter` |
| `20261103090851` | `import_negin2_transactions_to_financial_v2` |
| `20261103091252` | `fix_building_wide_legacy_transaction_filter` |
| `20261103122113` | `restore_negin2_announcements_and_requests` |
| `20261103122856` | `grant_anon_rpc_for_custom_session_announcements` |
| `20261103125800` | `add_building_polls_to_announcements` |
| `20261103142145` | `restore_announcement_and_poll_management` |
| `20261103142309` | `add_resident_group_announcement` |
| `20261103143654` | `announcement_types_and_resident_group_messages` |
| `20261105042333` | `recurring_obligations_and_auto_approval` |
| `20261105042456` | `recurring_obligation_units_rpc` |
| `20261105042507` | `fix_recurring_generator_variable_scope` |
| `20261105042620` | `link_recurring_claims_to_dynamic_allocations` |
| `20261105042626` | `exclude_claims_from_cash_reports` |
| `20261105042957` | `show_building_name_for_multi_unit_transactions` |
| `20261105043415` | `preserve_credit_against_future_claims` |
| `20261105043611` | `keep_resident_credit_separate` |
| `20261105043718` | `separate_debt_and_credit_balances` |
| `20261105043755` | `separate_manager_member_debt_credit` |
| `20261105043917` | `index_recurring_foreign_keys` |
| `20261105044147` | `snapshot_resident_count_per_membership` |
| `20261105044427` | `support_manual_variable_claim_transactions` |
| `20261106210228` | `restore_profile_avatars_and_sync_source_accounts` |
| `20261106211024` | `add_approval_based_management_handoff` |
| `20261106212003` | `preserve_legacy_balances_and_history_privacy` |
| `20261106212152` | `snapshot_legacy_member_balances_and_isolate_new_ledger` |
| `20261106224433` | `create_multibuilding_foundation` |
| `20261106224900` | `secure_core_auth_and_registration` |
| `20261107060542` | `complete_registration_workflow` |
| `20261107060714` | `tighten_registration_username_and_legacy_limit` |
| `20261107060754` | `hide_registration_password_hash_from_admin_list` |
| `20261107060903` | `enforce_global_usernames_across_roles` |
| `20261107060906` | `serialize_global_username_guard` |
| `20261107060949` | `restrict_registration_rpc_execute_grants` |
| `20261107061021` | `require_email_on_registration_requests` |
| `20261107061723` | `allow_member_occupancy_roles` |
| `20261107061803` | `serialize_unit_membership_registration` |
| `20261107102326` | `protect_payment_approval_idempotency` |
| `20261107111045` | `align_payment_account_and_fifo` |
| `20261107120003` | `support_legacy_account_save_signature` |
| `20261107171327` | `prorate_shared_bills_by_occupancy_days` |
| `20261107174115` | `transfer_exit_tenant_credit_to_owner` |
| `20261107174948` | `transfer_owner_balance_to_successor_owner` |
| `20261107175004` | `include_owner_balance_transfer_in_debt_views` |
| `20261107175021` | `allow_owner_transfer_without_known_start_date` |
| `20261107175052` | `make_owner_balance_debt_payable` |
| `20261107213945` | `add_account_opening_balance` |
| `20261107214134` | `validate_opening_balance_inputs` |
| `20261108032323` | `fix_opening_balance_generated_ym` |
| `20261108103819` | `per_building_bale_integration` |
| `20261108103835` | `secure_bale_config_lookup` |
| `20261109125813` | `sync_resident_requests_identity_sequence` |
| `20261111202356` | `block_rate_changes_until_unit_residency_confirmed` |
| `20261113202630` | `count_active_sessions_by_device` |
| `20261113220000` | `secure_password_recovery_until_verified_flow` |
| `20261113220409` | `increase_manager_building_units_limit_to_40` |
| `20261115074259` | `revoke_public_schema_create_from_client_roles` |
| `20261115074629` | `add_superadmin_login_lockout` |
| `20261115080023` | `enforce_session_account_building_match` |
| `20261115080111` | `use_cryptographic_random_password_reset` |
| `20261115080722` | `throttle_public_registration_requests` |
| `20261115090012` | `registration_rate_limits_and_safe_image_data` |
| `20261115090315` | `secure_rotated_vapid_private_key_in_vault` |
| `20261115090336` | `point_vapid_secret_rpc_to_active_key` |
| `20261115090423` | `enable_rls_on_registration_attempt_log` |
| `20261115090547` | `align_avatar_rpc_validation_with_storage_constraint` |
| `20261115090604` | `allow_compressed_payment_receipts_up_to_1_2mb` |
| `20261115230602` | `progressive_login_lockout_delays` |
| `20261115233135` | `enforce_financial_account_building_integrity` |
| `20261115233236` | `index_financial_account_building_relations` |
| `20261115233331` | `index_transactions_account_foreign_key` |
| `20261115233723` | `track_one_time_push_dispatches` |
| `20261115234549` | `add_server_side_push_dispatch_rate_limit` |
| `20261115234622` | `add_bale_dispatch_rate_limit` |
| `20261115234709` | `add_assistant_request_rate_limit` |
| `20261115235207` | `constrain_payment_request_amount_and_status` |
| `20261115235421` | `harden_push_subscription_endpoint_and_ownership` |
| `20261116013845` | `validate_manager_account_identity_fields` |
| `20261116024334` | `prevent_account_superadmin_username_collisions` |

## Reconciliation rule

A future reconciliation must preserve the current production schema and data, retain every existing applied version, and establish a reproducible clean-install path. This audit file is documentation only; it intentionally does not insert rows into `supabase_migrations.schema_migrations`.
