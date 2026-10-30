# Configuration and deployment

For Render, follow [RENDER.md](RENDER.md). It covers the install-without-build failure, service settings, paid persistent storage, and importing the private database.

## Runtime

For PostgreSQL production and persistent user accounts, follow [POSTGRES_DIGITALOCEAN.md](POSTGRES_DIGITALOCEAN.md). `DATABASE_URL` selects PostgreSQL; the SQLite path below remains a local/legacy option.

Use Node.js 24.x and run commands from `rifan-app/`. The main service defaults to port 3001. `npm run dev` serves Express + Vite; `npm run build` prepares assets and `dist/server.mjs`; `npm start` serves the production build.

| Variable                          | Purpose                                                                                  |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| `PORT`                            | HTTP port; default 3001                                                                  |
| `HOST`                            | Bind address; default 0.0.0.0                                                            |
| `RIFAN_DB_PATH`                   | Persistent private SQLite file; default `.data/rifan.sqlite`                             |
| `COOKIE_SECURE=true`              | Use secure cookies behind production HTTPS                                               |
| `ENABLE_DEMO=true`                | Opt in to a separate demo workspace in production; development enables it by default     |
| `ENABLE_PUBLIC_REGISTRATION=true` | Deployment opt-in for the future application API; workspace setting must also be enabled |
| `GEMINI_API_KEY`                  | Optional Gemini advisor key, supplied securely                                           |
| `GEMINI_MODEL`                    | Optional model; default `gemini-2.5-flash`                                               |
| `GOOGLE_CLIENT_ID`                | Google OAuth Web application client ID                                                   |
| `GOOGLE_CLIENT_SECRET`            | OAuth client secret, supplied securely                                                   |
| `PUBLIC_URL`                      | Deployed HTTPS base URL for OAuth; falls back to Render’s `RENDER_EXTERNAL_URL`                             |

Copy `.env.example` to an ignored local `.env` only when needed; do not put secrets in source, screenshots or chat. Check existing environment bindings before creating new requirements. The current environment has no Google OAuth client configuration or Gemini key, so those live services were not authenticated.

## Google Workspace setup

See [the connection troubleshooting guide](GOOGLE_CONNECTION.md) for Render settings, exact callback matching, consent/test-user setup and recovery from the raw JSON error.

1. Create/use a Google Cloud project controlled by RIFAN. Enable Google Sheets, Drive, Docs and Forms APIs as needed. Gmail is optional and authorized separately for alerts.
2. Configure an OAuth consent screen and a **Web application** OAuth client.
3. Register the exact redirect URI `https://YOUR-DEPLOYED-HOST/api/google/callback`.
4. Set `PUBLIC_URL`, `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` securely.
5. Sign in to the private RIFAN workspace and connect the desired Google account in Connections.
6. Authorize the requested capabilities. The app uses Drive's `drive.file` scope; folder/file availability follows the user's authorization, rather than a claim of unrestricted Drive access.
7. Test an authorized workbook's read preview and a dedicated export worksheet before using it as an operational source.

Cookies are HttpOnly, expiring and SameSite=Lax so the cross-site OAuth return can retain the RIFAN session. OAuth state is random, user-bound, expiring and single-use. Cross-origin write requests are rejected. Use HTTPS and secure cookies in production; preserve the public Host header when proxying.

Tokens stay in the private server database. They are not returned by the snapshot API, logged, embedded in frontend builds or placed in source files. Missing/expired/revoked grants must be resolved by reconnecting; an adapter test does not prove live account authorization.

Sheets sync respects worksheet `gid`, supports reviewed mappings and rejects concurrent overwrite conflicts. Exports write in chunks to a dedicated **RIFAN Registry** worksheet and preserve source worksheets. The export tab is replaced with the current authorized registry view; choose a dedicated workbook when different users have different organization scopes.

## Required network destinations

Preserve existing package-manager presets and any existing custom policy. Add the destinations needed for enabled features:

- Google authorization/token exchange: `accounts.google.com`, `oauth2.googleapis.com`.
- Google APIs: `sheets.googleapis.com`, `docs.googleapis.com`, `forms.googleapis.com`, `drive.googleapis.com`, `gmail.googleapis.com`, `www.googleapis.com`.
- Gemini: `generativelanguage.googleapis.com`.
- Forecasts: `api.open-meteo.com`.
- Optional map layers: `*.tile.openstreetmap.org`, `server.arcgisonline.com`, `gibs.earthdata.nasa.gov`.

Fonts and logos are local assets; no external font CDN is needed.

## Database, backups and restoration

The private SQLite database contains real uploaded farmer information and the raw source archive. It is ignored by Git. Keep it on persistent storage; publishing application source alone does not publish/import that private database.

Use a consistent SQLite backup rather than copying only an active `.sqlite` file while ignoring its WAL:

```bash
cd /workspace/AGRI-OS-/rifan-app
python3 scripts/backup.py /workspace/private-backups/rifan.sqlite
```

The backup tool refuses to overwrite an existing file. Store backups privately and restore/test them before changing hosting. The environment snapshot can retain the prepared database, dependencies and files; live processes and external account sessions still need appropriate startup/runtime access. Fresh-task restoration and publication are platform operations and have not been independently verified here.

This implementation is a single service with a local SQLite database. Multiple independent application replicas need a shared durable database design and coordinated migrations; do not copy diverging SQLite files between replicas.

## Membership fee and farmer-website launch

No registration or membership amount is assumed. Set association-approved fees in **Settings → Membership fees**. Record only payments already received; verify them against bank/cash records. The app never labels an unconfirmed provider call as paid.

Public application example (future website; disabled by default):

```http
POST /api/public/applications
Content-Type: application/json

{
  "firstName": "Amina",
  "lastName": "Bello",
  "gender": "Female",
  "primaryPhone": "08012345678",
  "country": "Nigeria",
  "state": "Kebbi",
  "lga": "Birnin Kebbi",
  "crop": "Rice",
  "farmSize": 2.5,
  "consent": true
}
```

The result contains an application ID, member reference, pending review status, configured NGN fees, and `paymentCollectionEnabled: false`. It creates neither a verified identity nor a payment charge. Self-service farmer sign-in, the public website, payment checkout, signed webhook verification, duplicate-event handling, settlement reconciliation and receipt/email policies remain launch work.

Initialize the private workspace owner before public exposure, select actual fees/provider/terms, deploy behind HTTPS, configure backup/restore, authorize external integrations, and test the future public journey before enabling registrations. The owner account has not been invented or assigned a default password.

## Branding assets

The current logo is a cleaned reproduction based on the supplied RIFAN image. Replace it in Settings with the official master if available. Page watermarks and generated card/certificate/receipt watermarks follow that configured asset.

PDFs embed DejaVu Sans for Nigerian/Unicode names; font license attribution is in `public/fonts/DEJAVU-LICENSE.txt`. Web fonts are locally packaged DM Sans and Manrope. Print card sheets at 100% scale on A4; individual PDF cards are 100 × 64 mm. Direct-print tests validate invocation and layout, not a physical printer.
