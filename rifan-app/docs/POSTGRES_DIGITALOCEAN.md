# PostgreSQL on DigitalOcean and persistent administrator access

The application now supports native PostgreSQL with pooled asynchronous queries. SQLite remains a local/legacy compatibility option; setting `DATABASE_PROVIDER=postgres` requires a PostgreSQL URL, and a failed PostgreSQL connection never falls back to a new empty SQLite file. Existing Render deployments should retain their current configuration until the migration has verified.

## Provision a new managed database

The reviewed default plan is `.do/database.json`: PostgreSQL 17, London (`lon1`), `db-s-1vcpu-2gb`, one node. This is a billable managed database. Choose `DO_DATABASE_REGION`, `DO_DATABASE_SIZE` and `DO_DATABASE_NODES` deliberately for the deployment's workload and availability needs. A single node does not provide standby-node high availability; DigitalOcean can scale the plan and add standbys later.

1. Supply `DIGITALOCEAN_ACCESS_TOKEN` through secure environment settings. It needs managed-database read, create and update permissions; no destroy operation is implemented.
2. Set `DO_DATABASE_TRUSTED_CIDRS` to approved IPs/CIDRs, including the web service's outbound IP ranges shown in Render and the host performing migration. The provisioning command rejects unrestricted network ranges. It does not infer or invent Render outbound IPs. Remove a temporary migration host after cutover.
3. Run `npm run db:plan` from `rifan-app` to review the concrete request. This creates nothing.
4. Run `npm run db:provision` to create or reuse the named cluster. It configures trusted sources before waiting for the new database to come online, verifies the provider's CA certificate, creates the `rifan` database and `rifan_app` user, initializes the schema with the migration administrator and grants the application only schema usage, CRUD and sequence usage. The web service does not need the migration account.
5. Connection secrets are saved privately in `.data/digitalocean/postgres.env`, with the CA in `database-ca.crt`. Nothing sensitive is printed or committed. Preserve these files securely. Do not copy the privileged `DATABASE_MIGRATION_URL` into the web service.

Repeat provisioning reuses a matching database rather than creating another one. A name/engine/region mismatch stops the operation. An existing cluster must also carry the RIFAN management tag before its firewall or users can be changed. Missing credentials or trusted sources stop before resource creation. Actual provisioning, firewall connectivity and live TLS remain unverified until the deployment owner's credential and network configuration are supplied.

## Transfer existing data before pointing the web app at PostgreSQL

Keep the source application in a maintenance/write-freeze window for the final snapshot. A database copied from another workspace does not include subsequent writes in Render's separate SQLite file. If Render already has additional users or records, export and reconcile that source before cutover; do not replace it blindly with an older workspace copy.

The cloud workspace's prepared SQLite source contains all 172,743 private farmers and 186,353 archived source rows. Its initial administrator is already seeded privately. The migration preserves stable farmer/member IDs, users and password hashes, sessions, audit history, binary attachments, source JSON and source row numbers, field/season/history records and bootstrap metadata. Original upload files under `.data/source/` remain in private storage/backups; the row archive and database attachments are transferred to PostgreSQL.

From `rifan-app`:

```bash
# DATABASE_MIGRATION_URL is the privileged target connection; its real value is
# supplied through the private environment file, never through a command literal.
RIFAN_ENV_FILE=.data/digitalocean/postgres.env npm run db:migration:plan
RIFAN_ENV_FILE=.data/digitalocean/postgres.env npm run db:migrate
```

`RIFAN_SQLITE_SOURCE` selects a different source SQLite file. The apply command creates a consistent private backup, imports in bounded batches inside a PostgreSQL transaction, restores sequences and verifies row counts plus canonical SHA-256 digests before committing. Source JSON text and identity strings remain intact. It refuses nonempty or unrelated targets. A previously completed identical migration can be rerun for verification; it does not duplicate records. A different source fingerprint stops for deliberate reconciliation.

Back up PostgreSQL with managed backups/PITR and a verified restoration procedure. Use `pg_dump` through secure configuration when an independent export is required. Keep the original SQLite backup until the new deployment and recovery process have been checked.

## Point Render at the migrated database

`render.postgres.yaml` is a PostgreSQL deployment template; the existing `render.yaml` remains available for the current SQLite deployment until cutover. Set these in Render Environment and redeploy the application:

- `DATABASE_PROVIDER=postgres`
- `DATABASE_URL`: the restricted `rifan_app` connection, not `doadmin`
- `DATABASE_CA_CERT`: the verified CA PEM, including its begin/end lines
- `DATABASE_AUTO_MIGRATE=false`: initialize/change schema with the migration administrator, not the web account
- `DATABASE_POOL_MAX=10`: budget this per application replica against the database's connection limit
- `COOKIE_SECURE=true`, `ENABLE_DEMO=false`
- `PUBLIC_URL`: the HTTPS address users actually sign in on, if different from Render's default address

Remote PostgreSQL uses verified TLS; disabling TLS is only accepted for loopback test servers. Avoid connection options that disable certificate checks. Health checks query the selected database and report `storage: postgres` after cutover.

Database-backed sessions and login-attempt counters are shared across instances. Different users and multiple browsers can remain signed in simultaneously. Logging out a session ends only that session; password changes and 2FA policy changes intentionally revoke the affected user's sessions. Roles, organization/state assignments and approved officer privileges remain enforced by the application. Concurrent identity creation has database uniqueness protection; optimistic edits, warehouse balances, payment verification and OTP consumption are guarded against races.

## Default administrator without repeated account creation

The nonsecret default administrator email is `admin@rifan.local`. Its password is not embedded in public source. `BOOTSTRAP_ADMIN_PASSWORD` securely seeds the initial account once in an empty database; use at least 16 characters. `BOOTSTRAP_ADMIN_EMAIL` can specify a real association-controlled email instead. An existing account's password, email and role are never reset by redeployment.

For operator-generated initial credentials, run `npm run admin:bootstrap` against the intended database. It generates a strong password when none is supplied and saves it to a private `initial-admin-credentials*.txt` file under `.data`. The prepared source's file is `.data/initial-admin-credentials.txt`; its account is included in the verified migration rehearsal. Keep that file private and deliver it only to the intended administrator.

The first successful login requires a password change and lets the administrator replace the placeholder email. Subsequent logins use that account normally. Changing its email does not recreate a second default account at the next deployment. Team & access creates additional named users with their own roles and passwords. Administrator credentials and private migration artifacts are excluded from GitHub.

## Validation and maintenance

A real PostgreSQL 17 integration suite runs with `RIFAN_TEST_POSTGRES_URL` pointing to a disposable local test server. Each fixture gets a separate database. CI runs both the SQLite compatibility suite and PostgreSQL suite. Provider and payment tests use fixtures; they do not provision a real cloud account, send messages or take payment.

`npm run data:check` and `npm run data:recheck` select PostgreSQL when `DATABASE_URL` is supplied; the latter only rechecks rejected source metadata and retains original rows. The Data hub UI supports the same database-backed quality workflow. Use the managed backup/restore process before operational maintenance.

The full private rehearsal verified 172,864 document records across both workspaces, including 172,743 private farmers, all 186,353 original source rows, the persistent administrator and the available audit/session metadata. This is evidence of a local PostgreSQL migration, not evidence that a DigitalOcean database has already been provisioned.
