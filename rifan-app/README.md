# RIFAN Connect

**Membership & Farm Management for the Rice Farmers Association of Nigeria.**

A new application in `rifan-app/`, built from the AGRI-OS feature inventory. The original application outside this directory is unchanged. RIFAN Connect uses its own database and never connects to the original Firebase project.

## Render deployment

See [the Render guide](docs/RENDER.md) for exact settings and the missing `dist/server.cjs` failure. The repo-root `render.yaml` provides an optional paid persistent-disk Blueprint.

## Start

Requires Node.js 24 or later (`node:sqlite`).

```bash
cd /workspace/AGRI-OS-/rifan-app
npm ci --cache /workspace/.npm
npm run dev
```

The application serves on port **3001**. Open it through your hosting platform's supported app access. This onboarding environment does not provide a localhost preview link.

- **Explore the demo workspace** opens 84 synthetic records, isolated from real data.
- **First time here? Create your workspace** initializes the private workspace administrator. Use your own email and a strong password. No default administrator password exists.
- The supplied farmer register is already in the private workspace; it is not visible in the demo.
- Do not expose a fresh instance publicly before initializing its owner account.

```bash
npm run lint   # strict TypeScript
npm test       # API, validation, upload, Excel and Sheets-adapter tests
npm run build
npm start      # production build; port 3001 unless PORT is set
```

Live processes must restart in new environments. Dependencies, source, built assets and the SQLite files can be retained in the environment snapshot. Setup does not deploy or publish this app.

## What's included

- Forest-green, harvest-gold and white RIFAN branding, locally bundled fonts, responsive navigation and page watermarks.
- Farmer registration, full profiles, portraits, documents, geography, production, resources and interventions.
- Database-wide search, filters, pagination, aggregate reports, CSV/Excel exports and configurable chart widgets.
- Individual farmer ID cards, direct browser printing, combined bulk-card PDFs and ZIPs of individual PDFs. Card batches support **up to 500 profiles** and can be prepared from a filtered registry range. Cards contain no BVN, NIN or bank details. QR codes encode member references, not a claim of independently verified identity.
- Cooperative and programme management; warehouses; capacity-checked receipts and dispatches; persistent audit history.
- CSV, Excel and zipped-register uploads with reusable column mappings, validation, source preservation, duplicate detection and a correction queue.
- Google Sheets register synchronization, exports to a dedicated `RIFAN Registry` worksheet, connected workbooks, Google Docs reports, registration forms and authorized alert email delivery.
- Harvest planning, recorded-location maps, heatmaps, actual uploaded farm boundaries, optional satellite layers, external weather forecasts and an optional AI agronomy advisor.
- Membership applications, configurable registration/annual membership fees, recorded/verified payment states and watermarked receipts.

External Google, AI, weather and map services need their credentials or network access. Implemented adapters and local tests do not establish that an unconfigured live external service works.

## Supplied data

| Source                                                                | Result                                                                                                                                                                                                             |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RIFAN_ERG_WET_SEASON_2020_Imported.zip`                              | **186,353 source rows preserved**: **172,743 unique farmers imported**, **1,229 duplicates**, **12,381 invalid rows** retained for review.                                                                         |
| `aminu RIFAN VALIDATED BVN WITH all parameters from NIBSS-final.xlsx` | Preserved unchanged; import blocked because the archive is incomplete and its shared strings / ZIP directory are missing. Re-save the original workbook to a complete XLSX, or export it to CSV, and upload again. |

Use **Data hub → Export & history → Review source rows** to inspect diagnostics. Authorized managers/administrators can correct invalid rows; the source original remains unchanged. A duplicate's matching member can be opened for review.

Original files and raw source rows are private, in `.data/`, excluded from Git. No identity values appear in the public import report. Do not delete this directory when reinstalling dependencies. A fresh Git clone alone does not include the imported register.

See [the data import report](docs/DATA_IMPORT_REPORT.md), [system analysis](docs/SYSTEM_ANALYSIS.md), [configuration and deployment](docs/CONFIGURATION.md), and [validation evidence](docs/VALIDATION.md).

## Google Sheets as a register source

1. Configure Google OAuth as described in [CONFIGURATION.md](docs/CONFIGURATION.md).
2. Sign in to the private RIFAN workspace, then **Connections → Connect Google account**.
3. Link a workbook. A `gid` in its URL selects that worksheet; without one, the connector prefers `RIFAN Registry` if present, otherwise the first worksheet.
4. **Synchronize → Read & preview** shows additions, matches and invalid rows. Applying the preview creates/updates valid members. The application refuses to overwrite members changed since preview.
5. Export writes into the dedicated **RIFAN Registry** worksheet in batches, preserving original source worksheets. It excludes BVN, NIN and bank details.
6. For custom headings or file uploads, use **Data hub → Google Sheets** and the mapping interface.

Synchronization is an explicitly reviewed action, not a background claim of continuous replication. The SQLite database retains payments, accounts, audit history and source provenance. The connected Sheet is a member-register source, rather than a place to store authentication credentials or the payment ledger. Sheet previews accept up to 250,000 rows; larger registers must be split by worksheet. Live Google authorization remains outstanding in this environment.

## Future farmer website and payment collection

The future public website can submit consented applications to `POST /api/public/applications`. This creates a pending member/application and returns the configured fee schedule. The endpoint remains disabled until both the workspace setting and `ENABLE_PUBLIC_REGISTRATION=true` are set.

The public website, farmer self-service accounts, live online charging, payment-provider webhooks and provider reconciliation must be implemented/configured before launch. No fee amount or payment provider was invented. Current payments are manual ledger entries, counted only after administrator verification; this application does not charge an account or transfer money.

See [connected operations and security configuration](docs/OPERATIONS.md) for Dashboard, cohorts, planner, history, OTP and Paystack setup.
