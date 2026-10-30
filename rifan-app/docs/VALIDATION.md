# Validation evidence

Validation was performed in the actual cloud machine using Node.js 24.19.0 and npm 11.9.0. The original AGRI-OS application source is preserved. The Render follow-up changes repository-root package commands to launch RIFAN Connect, with the original commands retained under `legacy:*`.

| Check                               | Outcome                                                                                                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen dependency install, `npm ci` | Passed; new app reduced to its used dependencies                                                                                                                                               |
| Strict TypeScript, `npm run lint`   | Passed                                                                                                                                                                                         |
| API/integration suite, `npm test`   | **35 passed, 0 failed, 0 skipped** (includes the two parent test groups)                                                                                                                       |
| Frontend + backend production build | Passed                                                                                                                                                                                         |
| Production HTTP service             | Started and responded successfully                                                                                                                                                             |
| Browser route checks                | Passed for registry, membership, cooperatives, warehouses, programmes/monitoring, calendar, data hub, reports, connections, food bank, advisor, alerts, settings, team, audit, account and map |
| Multi-step browser registration     | Passed; uppercase values persisted and profile opened                                                                                                                                          |
| Browser CSV upload                  | Parsed, mapped, previewed, archived invalid source and committed valid member                                                                                                                  |
| Individual ID-card PDF              | Downloaded successfully; one 100 × 64 mm page                                                                                                                                                  |
| Combined bulk ID-card PDF           | Downloaded successfully; two 100 × 64 mm pages                                                                                                                                                 |
| Individual ID-card ZIP              | Two valid individual PDF files; archive verified                                                                                                                                               |
| Direct card printing                | Two cards rendered on one A4 print sheet; browser print invocation verified                                                                                                                           |
| Mobile navigation/layout            | Passed at 390 × 844; no page-wide horizontal overflow                                                                                                                                          |
| Browser runtime errors              | No uncaught page errors in the successful run                                                                                                                                                  |
| Real imported register              | Counts, first/last pages, search, uppercase names, source verification handling and non-sensitive 25-card batch checked                                                                        |
| Consistent SQLite backup            | Backup created and checked separately, without printing record values                                                                                                                          |

## What the integration suite exercises

- Unauthenticated and cross-origin write rejection, first-owner setup and session-based account access.
- Name capitalization, phone/BVN/NIN formats, impossible dates, geographical membership, coordinate pairs/ranges and nonnegative farm data.
- Duplicate phone/identity/member references and organization/programme referential constraints.
- Warehouse capacity and stock boundaries, including attempts to bypass the stock ledger.
- Configured fees, duplicate payment references, pending/verified distinctions and immutable payment records.
- Authenticated durable document reads and false MIME/content rejection.
- Viewer mutation denial, sensitive-field redaction, scoped field-agent queries and writes.
- Disabled public registration and honest unavailable responses for missing external credentials.
- Full-database search/pagination and mutation audit history without identity values.
- CSV and ZIP parsing, a complete generated multi-sheet XLSX, preserved leading-zero identity text, and a damaged XLSX rejection.
- Legacy normalization without inventing a birth-date century or registration day.
- Staged imports, preserved invalid/duplicate originals, commit idempotency and authorized correction.
- Google Sheets source previews, additions/updates, conflict rejection and export through an injected service adapter.
- Member-card batch access and exclusion of BVN/NIN/bank values.
- Isolation between the synthetic demonstration and the private RIFAN workspace.

## Uploaded source evidence

The actual ZIP's 186,353 rows went through the same authenticated staging/commit endpoints used by the browser upload workflow. The private database contains **172,743** imported farmers, **1,229** retained duplicate rows and **12,381** retained invalid rows. The snapshot loads a bounded 1,000-row member window, while reports and totals use all authorized database records.

The first aggregate calculation on the full source was measured at approximately seven seconds before reuse. Summaries are cached and invalidated by local farmer changes or external SQLite connection changes; registry pagination does not transfer all 172,743 profiles to the browser.

All uploaded rows and original files are retained privately; no unverified source row was relabeled valid merely to increase the import count. The supplied incomplete Excel source remains blocked, as detailed in [DATA_IMPORT_REPORT.md](DATA_IMPORT_REPORT.md).

## Reproducing browser checks

The cloud image provides Chromium and `playwright-core`. Start a production build against a **separate test database**, enable only its synthetic demo, then run:

```bash
cd /workspace/AGRI-OS-/rifan-app
npm run build
PORT=3004 ENABLE_DEMO=true RIFAN_DB_PATH=/tmp/rifan-browser-test.sqlite npm start
# In another terminal:
RIFAN_TEST_ORIGIN=http://127.0.0.1:3004 node tests/browser.mjs
```

The browser script writes synthetic records into that test database. Do not point it at the real private workspace. Tests use the Chromium/runtime paths available in this cloud image; install/adjust Playwright and Chromium paths when running outside it.

Synthetic-only screenshots are in `docs/screenshots/`. They do not display the uploaded farmer register.

## Limits of the evidence

- Google OAuth credentials and an authorized account are absent. The implemented Google Sheets/Docs/Forms/Gmail flows have **not** been tested against a live private Google account. Adapter tests are not a substitute for that authorization.
- No Gemini key is configured. AI generation was not called; the unavailable response was verified.
- Map components render; external tile, satellite and weather-provider availability depends on runtime networking. No farm coordinate was fabricated to make a map look populated.
- No fee amount or online payment provider was supplied. Manual ledger behavior is tested; no real money was charged, transferred or settled.
- The public farmer website and self-service farmer accounts are future launch work. The application endpoint is prepared but disabled.
- Browser print invocation and document layout were tested, not a physical printer.
- Configuration draft persistence was confirmed. Environment publication, public app deployment and restoration into a fresh task were not performed.

## Render regression follow-up

The supplied screenshots confirmed that Render only installed dependencies and then tried to run an unbuilt legacy `dist/server.cjs`. The fix was checked using **Bun 1.4.4**, matching the supplied logs, in an isolated source copy with no private database or prior artifacts. Both a clean install and an unchanged dependency-cache install rebuilt the new production files, and `bun run start` returned RIFAN Connect health on the assigned port.

The application suite now reports **35 passing tests**. An additional **6 production deployment tests** verify startup from repository/app/unrelated directories, Render port binding, frontend route refreshes, immutable asset caching and missing-asset 404s, users/sessions surviving a restart on the same database, actionable missing-build errors and the root/app start scripts. Render-specific checks cover secure proxy cookies, configured external origins and per-client rate limits.

See [RENDER.md](RENDER.md) for exact dashboard settings, persistent storage and the optional paid Blueprint. Hosted Render health still requires verification after the new commit is deployed; these local results do not claim a live redeployment.

## Data-quality follow-up — 29 October 2026

- TypeScript and **54 automated tests** pass, including phone equivalence, non-lossy normalization, preserved custom mappings, repeat-safe rechecks, accurate import counts, source permissions and Google Sheets rejected-row archival/row numbers.
- Whole-registry validation checked all **172,743 private farmers** successfully; **12,381 rejected source rows** were rechecked with no fabricated replacements. SQLite integrity, duplicate-group and imported-source-link checks passed.
- The new Data quality screen passed browser tests for complete auditing, repeated rechecks, aggregate-report downloads, mobile layout and absence of uncaught errors. The existing route/registration/card/export/import browser regression suite also passed against isolated synthetic data.
- Private source files, farmer data, reports and the pre-maintenance backup remain excluded from GitHub.

## Google connection follow-up — 29 October 2026

TypeScript and 63 automated tests pass, including safe missing-configuration responses, in-app redirect recovery, PKCE, hashed/user-bound/expiring/single-use state, cancelled authorization, lost RIFAN sessions, callback token failures, refresh-token preservation, refresh rotation, revoked grants, optional Gmail permission and non-destructive disconnect. Provider fixtures make no live Google requests or email sends. Real sign-in remains dependent on a Google Cloud OAuth Web client and matching Render environment settings.

The production build and six deployment checks also pass. Browser checks verified missing-setting diagnostics, a disabled unconfigured Connect action, the exact copyable callback URI, legacy connect URL recovery, failed-callback recovery, mobile layout without overflow, and no uncaught errors. The existing registration/import/card/export route regression suite passed against separate synthetic data. These checks do not claim that live Render credentials or a real Google account have been configured.

## PostgreSQL and persistent access — 30 October 2026

- Frozen dependency installation, TypeScript, production build and six deployment checks passed. The full environment installation script was rerun successfully.
- **79 PostgreSQL tests passed**, with no failures or skips. These run on actual PostgreSQL 17, using separate databases per fixture. The SQLite compatibility suite also passed, with PostgreSQL-only checks explicitly skipped there.
- Tests cover six parallel sessions across two app instances, two different user accounts, isolated logout, database-backed login limits, stable cross-instance registry versions, concurrent identity uniqueness, stale edit rejection, warehouse receipt balances, payment idempotency and one-time OTP verification under contention.
- Initial administrator tests verify first-login password rotation, preserved email/password across reseeding/restart and no recreation of a second default account after the email changes.
- The complete private migration rehearsal passed count and SHA-256 verification for 172,864 records across both workspaces (including all 172,743 private farmers), 186,353 archived source rows, the available users/sessions/audit data and bootstrap metadata. Source SQLite remains intact; a consistent backup and private migration report were saved.
- Production browser checks passed with a restricted PostgreSQL application role that cannot create tables. Initial credential rotation, two simultaneous real user contexts, both sessions surviving an app restart, logout isolation and the existing full registration/import/card/export/mobile regression suite all passed.
- DigitalOcean provisioning has **not** run: the actual apply command stopped before creating resources because `DIGITALOCEAN_ACCESS_TOKEN` is absent. Required secure settings and the concrete provisioning plan have been saved; trusted Render/migration IPs must also be supplied. Cloud connectivity and provider TLS have not been claimed as tested.

The saved cloud install/start instructions were updated and the complete installation script was executed successfully, including frozen installs, both database test modes, the production build and deployment checks. Environment requirements were saved without supplying or inventing provider credentials. DigitalOcean's missing-token preflight failure was confirmed; no cloud resources were created by that command.

A second full-source import verification reported `alreadyMigrated: true` with matching digests and counts. Empty/unrelated SQLite inputs are rejected before connecting to a target. Provisioning fixtures cover both reusing and creating a new DigitalOcean cluster, including a database-user password returned only at creation.

The cohort preview now freezes matching IDs using an in-database insert/select instead of one remote insert per farmer. A separate PostgreSQL clone previewed all 172,743 private farmers, froze the complete cohort and returned only a 25-row sample in 696 ms locally. The clone was removed afterward; no canonical farmer records changed. This local measurement is not a promise of hosted-network latency.
