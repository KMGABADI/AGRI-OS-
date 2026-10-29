# RIFAN Connect

**Membership & Farm Management for the Rice Farmers Association of Nigeria.**

The new RIFAN Connect application is in [`rifan-app/`](rifan-app/). It includes RIFAN branding and page watermarks, farmer profiles, printable and bulk-exportable ID cards, validated spreadsheet uploads, a separate database, memberships and fees, field operations, food-bank storage, reporting, and Google Sheets integration.

## Deploy on Render

See the [Render deployment guide](rifan-app/docs/RENDER.md) for the confirmed missing-server fix and exact service settings. A [Render Blueprint](render.yaml) is included; it uses paid persistent storage for the SQLite database.

## Run RIFAN Connect

Requires **Node.js 24.x**.

```bash
cd rifan-app
npm ci
npm run dev
```

The app defaults to port **3001**. For a production build:

```bash
cd rifan-app
npm run lint
npm test
npm run build
npm start
```

Create your private workspace administrator account before public exposure. Development includes an isolated demo with synthetic records; there is no default production administrator password.

## Documentation

- [Application guide](rifan-app/README.md)
- [System structure and feature map](rifan-app/docs/SYSTEM_ANALYSIS.md)
- [Configuration and deployment](rifan-app/docs/CONFIGURATION.md)
- [Data import report](rifan-app/docs/DATA_IMPORT_REPORT.md)
- [Validation evidence](rifan-app/docs/VALIDATION.md)

The original AGRI-OS source is preserved outside `rifan-app/` as a reference. Repository-root commands now run RIFAN Connect; use `npm run legacy:dev` or `npm run legacy:build` for the original app. The new application does not use its Firebase database.

## Data and deployment

The imported farmer database, uploaded source files, credentials, dependencies, and build outputs are excluded from Git. The private database prepared in the cloud environment must be backed up and transferred securely to persistent hosting storage; cloning this repository alone does not include the imported farmer records.

RIFAN Connect requires a Node.js server and persistent SQLite storage. GitHub Pages cannot run its backend or database. Publishing this repository is separate from deploying a live website. Google integrations need OAuth configuration; the future public farmer website and online payment collection remain disabled pending their launch configuration.

See [connected operations and security configuration](rifan-app/docs/OPERATIONS.md) for Dashboard, cohorts, planner, history, OTP and Paystack setup.
