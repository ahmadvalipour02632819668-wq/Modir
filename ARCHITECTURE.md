# Resident Manager — Frontend Architecture

## Runtime model

The frontend currently uses **ordered classic scripts**, not native ES modules. This is intentional for compatibility: the application still has shared runtime state and legacy functions that are referenced across files and from UI event handlers.

Do not add `type="module"`, remove `defer`, or reorder the scripts without first migrating and testing every cross-file dependency.

## Load order

The order in `index.html` is part of the runtime contract:

1. `core.js` — shared foundation: Supabase client/configuration, session and application state, API helpers, common formatting and date utilities.
2. `icons.js` — shared immutable SVG icon catalog and icon lookup helper used by shell, dashboard and management.
3. `theme-ui.js` — isolated theme selection and persistence, exposed through `window.ModirTheme`.
4. `timing.js` — shared debounce utility exposed through `window.ModirTiming`.
5. `menu-ui.js` — role-aware menu definitions for the services grid and bottom navigation.
6. `alert-ui.js` — local read/unread alert tracking and prefix-based seen-state helpers.
7. `alert-center.js` — alert collection, unread center rendering and badge refresh.
8. `sms.js` — isolated SMS link/button helpers used by dashboard and finance.
9. `media.js` — isolated image compression helper used by community uploads.
10. `pwa.js` — isolated PWA installation prompt, install tile and service-worker registration.
11. `assistant.js` — isolated AI assistant UI and interaction controller.
12. `modal-ui.js` — modal creation, dismissal and browser-history lifecycle, exposed through `window.ModirModal`.
13. `shell.js` — login/shell rendering, global UI, navigation dispatch, shared interaction helpers.
14. `account-ui.js` — shared account-state notices, including the forced password-change banner.
15. `period-ui.js` — shared month/year/unit selectors and period-picker binding helpers.
16. `dashboard-ui.js` — dashboard-only balance visibility and count-up animation helpers.
17. `dashboard.js` — dashboard cards, summaries, request table and dashboard view.
18. `community.js` — announcements, neighbor alerts, requests and payment-related community views.
19. `finance.js` — transactions and financial reports.
20. `jalali-date.js` — Jalali/Gregorian conversion and Jalali month-length helpers.
21. `management.js` — units, rates, settings, activity and profile views.
22. `navigation.js` — browser back-button/history handling.

All twenty-two application scripts are loaded with `defer` at the end of the document body. Deferred scripts execute in document order after parsing, so later files can use APIs registered by earlier files.

## Public cross-file APIs

Files that have been isolated behind an IIFE expose a deliberately small frozen API on `window`:

| Owner | Public API | Intended consumers |
| --- | --- | --- |
| `icons.js` | `window.ModirIcons` | shell, dashboard, management |
| `modal-ui.js` | `window.ModirModal` | core, shell, management, finance |
| `theme-ui.js` | `window.ModirTheme` | shell, management |
| `timing.js` | `window.ModirTiming` | shell, finance |
| `pwa.js` | `window.ModirPwa` | shell, dashboard |
| `alert-center.js` | `window.ModirAlertCenter` | shell |
| `sms.js` | `window.ModirSms` | dashboard, finance |
| `dashboard-ui.js` | `window.ModirDashboardUi` | dashboard |
| `period-ui.js` | `window.ModirPeriodUi` | dashboard, finance, management |
| `media.js` | `window.ModirMedia` | community |
| `assistant.js` | `window.ModirAssistant` | shell |
| `dashboard.js` | `window.ModirDashboard` | shell, community |
| `community.js` | `window.ModirCommunity` | shell, dashboard |
| `finance.js` | `window.ModirFinance` | shell |
| `jalali-date.js` | `window.ModirJalaliDate` | core, management |
| `management.js` | `window.ModirManagement` | shell, core, finance |

Only add a function to one of these public objects when another file genuinely needs it. Keep implementation helpers private inside the owning IIFE.

`core.js` and `shell.js` are still shared classic-script scopes. They are high-coupling legacy foundations and have **not** yet been converted to isolated modules. `navigation.js` is self-contained in an IIFE. The structure checker also verifies public APIs for `menu-ui.js`, `alert-ui.js` and `account-ui.js`.

## Cross-file dependency guard

The structure checker verifies shared identifiers that are currently consumed outside their owning file. These are compatibility contracts, not a recommendation to keep the current coupling forever.

- Core-owned shared runtime: `sb`, `S`, `T`, DOM/format helpers, date helpers and push helpers.
- Shell-owned shared runtime: modal/navigation/render functions, icon helpers and other shell-level UI helpers.

When reducing coupling, migrate one contract at a time: move the implementation behind an explicit frozen API, update every consumer, then remove that identifier from the checker contract in the same commit. Do not simply delete or rename a shared identifier.

## Shared runtime contract

The application still relies on shared values and helpers, including the Supabase client, session/application state, API dispatcher, DOM helpers and formatting utilities (for example `sb`, `S`, `T`, `$`, `$$`, `esc`, and `fmt`). Treat changes to these as cross-application changes.

Before renaming, moving, or hiding a shared identifier:
- Search every frontend file for its reads, writes and calls.
- Check UI callbacks and dynamically generated handlers, not only direct function calls.
- Update all consumers in the same change.
- Run the repository validation workflows and manually test login, navigation, dashboard, community, finance and management views.

## Maintainability hotspots and refactor order

The largest frontend files are currently `management.js`, `community.js`, `shell.js`, `finance.js` and `dashboard.js`. Their size alone is not a defect, but it increases review and regression cost when unrelated responsibilities change together.

Refactor these incrementally, in this order:
1. Extract cohesive, low-coupling helpers from the largest view files into small IIFE modules with frozen public APIs.
2. Keep each extracted module responsible for one domain and expose only the functions actually used by other files.
3. Reduce the shared global surface of `shell.js` and `core.js` only after call sites and dynamic event handlers have been inventoried.
4. Add focused tests for each extracted module before deleting the old implementation.
5. Avoid a large rewrite or a framework migration as a prerequisite for maintainability improvements.

Do not split a file solely to meet an arbitrary line-count target. A change is worthwhile only when it reduces coupling or gives a responsibility a clear owner.

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
- The frontend is split into twenty-two ordered JavaScript files.
- shared icons, modal lifecycle, PWA installation behavior, alert tracking and alert-center rendering, SMS links, image compression, dashboard UI helpers, account notices, period controls, assistant, dashboard, community, finance and management implementations expose explicit public APIs.
- Navigation state is private to `navigation.js`.
- Core and shell remain intentionally unwrapped until their shared dependencies can be safely reduced.
