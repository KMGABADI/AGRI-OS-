# Validation evidence

Validation was performed in the actual cloud machine using Node.js 24.19.0 and npm 11.9.0. The original AGRI-OS tracked files were left unchanged.

| Check                               | Outcome                                                                                                                                                                                        |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Frozen dependency install, `npm ci` | Passed; new app reduced to its used dependencies                                                                                                                                               |
| Strict TypeScript, `npm run lint`   | Passed                                                                                                                                                                                         |
| API/integration suite, `npm test`   | **30 passed, 0 failed, 0 skipped** (includes the two parent test groups)                                                                                                                       |
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
