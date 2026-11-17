# Resident Manager — Frontend Architecture

## Runtime model

The frontend currently uses **ordered classic scripts**, not native ES modules. This is intentional for compatibility: the application still has shared runtime state and legacy functions that are referenced across files and from UI event handlers.

Do not add `type="module"`, add `defer`, or reorder the scripts without first migrating and testing every cross-file dependency.

## Load order

The order in `index.html` is part of the runtime contract:

1. `core.js` — shared foundation: Supabase client/configuration, session and application state, API helpers, common formatting and date utilities.
2. `alert-ui.js` — local read/unread alert tracking and prefix-based seen-state helpers.
15. `sms.js` — isolated SMS link/button helpers used by dashboard and finance.
15. `media.js` — isolated image compression helper used by community uploads.
15. `pwa.js` — isolated PWA installation prompt, install tile and service-worker registration.
15. `assistant.js` — isolated AI assistant UI and interaction controller.
15. `shell.js` — login/shell rendering, global UI, navigation dispatch, shared interaction helpers and alert UI.
15. `account-ui.js` — shared account-state notices, including the forced password-change banner.
15. `period-ui.js` — shared month/year/unit selectors and period-picker binding helpers.
15. `dashboard-ui.js` — dashboard-only balance visibility and count-up animation helpers.
15. `dashboard.js` — dashboard cards, summaries, request table and dashboard view.
15. `community.js` — announcements, neighbor alerts, requests and payment-related community views.
15. `finance.js` — transactions and financial reports.
15. `management.js` — units, rates, settings, activity/profile views and Jalali date helpers.
15. `navigation.js` — browser back-button/history handling.

All fifteen application scripts are loaded synchronously at the end of the document body. This allows each later file to use APIs registered by earlier files.

## Public cross-file APIs

Files that have been isolated behind an IIFE expose a deliberately small frozen API on `window`:

| Owner | Public API | Intended consumers |
| --- | --- | --- |
| `pwa.js` | `window.ModirPwa` | shell, dashboard |
| `sms.js` | `window.ModirSms` | dashboard, finance |
| `dashboard-ui.js` | `window.ModirDashboardUi` | dashboard |
| `period-ui.js` | `window.ModirPeriodUi` | dashboard, finance, management |
| `media.js` | `window.ModirMedia` | community |
| `assistant.js` | `window.ModirAssistant` | shell |
| `dashboard.js` | `window.ModirDashboard` | shell, community |
| `community.js` | `window.ModirCommunity` | shell, dashboard |
| `finance.js` | `window.ModirFinance` | shell |
| `management.js` | `window.ModirManagement` | shell, core, finance |

Only add a function to one of these public objects when another file genuinely needs it. Keep implementation helpers private inside the owning IIFE.

`core.js` and `shell.js` are still shared classic-script scopes. They are high-coupling legacy foundations and have **not** yet been converted to isolated modules. `navigation.js` is self-contained in an IIFE.

## Cross-file dependency guard

The structure checker also verifies the shared identifiers that are currently consumed outside their owning file. These are compatibility contracts, not a recommendation to keep the current coupling forever.

- Core-owned shared runtime: `sb`, `S`, `T`, DOM/format helpers, date helpers, push helpers and PWA install helpers.
- Shell-owned shared runtime: modal/navigation/render functions, period selectors, icon helpers, alert-seen helpers and the password-change banner.

When reducing coupling, migrate one contract at a time: move the implementation behind an explicit frozen API, update every consumer, then remove that identifier from the checker contract in the same commit. Do not simply delete or rename a shared identifier.

## Shared runtime contract

The application still relies on shared values and helpers, including the Supabase client, session/application state, API dispatcher, DOM helpers and formatting utilities (for example `sb`, `S`, `T`, `$`, `$$`, `esc`, and `fmt`). Treat changes to these as cross-application changes.

Before renaming, moving, or hiding a shared identifier:
- Search every frontend file for its reads, writes and calls.
- Check UI callbacks and dynamically generated handlers, not only direct function calls.
- Update all consumers in the same change.
- Run the repository validation workflows and manually test login, navigation, dashboard, community, finance and management views.

## Change-safety rules

1. Fetch the latest default-branch version before editing; never work from a stale local copy.
2. Keep changes focused and commit related changes together where practical.
3. Preserve current UI, building data and Supabase schema unless a change explicitly requires otherwise.
4. Do not change script order casually.
5. Do not convert classic scripts to ES modules as a mechanical cleanup. First map dependencies and migrate one low-coupling area at a time.
6. Run `node --check` for every JavaScript file and keep the asset/load-order validation green.
7. A successful syntax/CI check is not a browser runtime test. After changes to navigation or shared APIs, manually verify the deployed app on a real device.

## Current migration status

- CSS is separated into `app.css`.
- Main frontend code is split into eight ordered JavaScript files.
- PWA installation behavior, SMS links, image compression, dashboard UI helpers, assistant, dashboard, community, finance and management implementations are wrapped in IIFEs with explicit public APIs.
- Navigation state is private to `navigation.js`.
- Core and shell remain intentionally unwrapped until their shared dependencies can be safely reduced.
