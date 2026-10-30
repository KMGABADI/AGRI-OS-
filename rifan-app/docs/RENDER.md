For the new DigitalOcean PostgreSQL deployment, use [POSTGRES_DIGITALOCEAN.md](POSTGRES_DIGITALOCEAN.md) and `render.postgres.yaml`. This guide retains the earlier SQLite deployment and missing-build repair instructions.

# Render deployment and the missing-server fix

## Confirmed failure

The supplied Render log checks out commit `6cfd693`, runs only `bun install`, reports the install as a successful build, and then runs `bun run start`. The old repository-root start script invokes `node dist/server.cjs`, but no compilation command created that file. Node exits with `MODULE_NOT_FOUND`.

Node is already version 24 in the screenshot. The duplicate Vite dependency is a warning, not the cause of this crash.

## Recommended settings for the existing service

Open the service's **Settings → Build & Deploy** and use:

| Setting | Value |
| --- | --- |
| Runtime | Node |
| Branch | `main` |
| Root Directory | `rifan-app` |
| Build Command | `npm ci --include=dev --no-audit --no-fund && npm run build` |
| Start Command | `npm start` |
| Health Check Path | `/api/health` |
| Node version | `24` (also specified in `.node-version` and package engines) |

Save the settings and choose **Manual Deploy → Clear build cache & deploy** for the latest commit. The healthy start log should say `RIFAN Connect running on port ...`, and the health endpoint should identify `RIFAN Connect`.

Do not set the Start Command to `node dist/server.cjs`. The new production backend is `dist/server.mjs`. Do not use only an install command as the recommended build command.

## Compatibility with the screenshot's existing settings

The repository-root `start`, `build`, `dev`, `lint` and `test` scripts now delegate to `rifan-app`. The original application remains available through explicit `legacy:*` commands.

A Render-only root `postinstall` hook installs the new app with its frozen npm lockfile and builds it. This supports an existing root-directory service still configured with `bun install` and `bun run start`. Normal local root installs do not trigger a second app build. The preferred explicit commands above avoid reliance on a lifecycle hook.

Both a clean Bun 1.4.4 install and a dependency-cached install with production artifacts removed were checked in an isolated source copy. The generated server was started using `bun run start` and responded as RIFAN Connect on the assigned port.

## Persistent farmer database

Attach a **persistent disk** to the web service:

- Mount path: `/var/data`
- Environment variable: `RIFAN_DB_PATH=/var/data/rifan.sqlite`
- Run one instance with this local SQLite database.

The root [`render.yaml`](../../render.yaml) is a complete Blueprint for this arrangement: Node 24, explicit install/build/start, health checks, HTTPS cookies and a 5 GB disk. It selects Render's **paid Starter service and a persistent disk**. Merely adding that file to GitHub does not create the disk or change an existing manually configured service; review the paid configuration before creating a Blueprint.

Free/ephemeral service storage does not retain SQLite accounts, sessions, farmer data or files across deployments. Without a configured persistent path, the app emits a startup warning. Use ephemeral storage only for disposable tests.

Set `COOKIE_SECURE=true` behind Render HTTPS and leave `ENABLE_DEMO=false` for the private deployment. Render's proxy is trusted for one hop, so secure sessions and per-client rate limits work through the proxy. The application honors `PORT` and binds `0.0.0.0`.

## Existing imported records

The 172,743 private farmer records are intentionally not in GitHub. A new Render instance therefore starts with an empty private database until a backup is restored or the source register is uploaded again.

Create a consistent backup using the provided `scripts/backup.py`, transfer it through authenticated private tooling to persistent storage, and restore while the service is stopped. Do not publish the database, bank/identity information, uploaded registers, or transfer credentials in the repository. Preserve the private original files separately if you need them as well as the database's archived source rows.

## Optional integrations

Google and Gemini credentials are not needed for startup. Configure them securely when enabling those integrations. Google OAuth uses `PUBLIC_URL`, or Render's `RENDER_EXTERNAL_URL` when `PUBLIC_URL` is omitted. Register the deployed HTTPS URL plus `/api/google/callback` in the OAuth client. If using a custom domain, set `PUBLIC_URL` to that canonical domain.

## Additional fixes verified

- Asset and default database paths are anchored to the app directory; launching the compiled entry from the repository root no longer serves the old frontend or writes a different default database.
- Missing production assets cause a readable build instruction and a nonzero exit.
- Missing hashed JavaScript files return 404 instead of an HTML page that triggers a browser module/MIME error.
- HTML is revalidated while hashed assets can be cached immutably.
- Graceful production shutdown closes idle HTTP connections and the SQLite database before exit.
- Startup, profile-route refreshes, restart persistence and proxy-aware session behavior have regression tests.

Live Render redeployment and public-URL health have to be checked after the service deploys the new commit. Local reproduction is not a claim that the hosted service has already restarted successfully.
