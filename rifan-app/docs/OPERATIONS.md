# Connected RIFAN operations

Dashboard now contains Overview, Reports & insights, Season performance, Field validation, Collections and Recommendations. The former reports URL redirects to the Dashboard reports tab. Existing overview charts, report exports and dashboard customization remain available.

## Programme delivery

Create a programme, then a season, then its intervention definitions. Attach warehouses using the season's storage checkboxes. The intervention's **Bulk beneficiaries** action freezes a matching cohort for review, shows eligible and already-enrolled counts, and commits in resumable batches of 500. Criteria include crop, geography, organization, prior programme/season/intervention participation, imported phase and manager-approved field evidence. A repeat submission never creates a duplicate farmer/intervention/season participation. Existing individual delivery records remain historical records; new assignments use cohorts.

Field validation and farm location forms work in the online application on desktop or mobile. GPS capture requires browser permission and a secure HTTPS origin. A farmer must already be visible to the officer before adding evidence. Field agents submit pending evidence; managers approve it. Approved validations and site observations are immutable: record a new observation to preserve changes. Polygons must be closed WGS84 Polygon/MultiPolygon GeoJSON. File layers added on the map are temporary; use the farm observation form to persist evidence.

## Planner, GIS and history

The harvest planner schedules and edits activities with programme, season, intervention, optional farmer/site, officer, warehouse, dates, stage, status and measured yields. Administrators/managers and explicitly approved field officers can plan; other users can view authorized records. Administrators grant officer approval in Team & access. Concurrent changes return a conflict instead of silently overwriting another edit. Calendar export uses inclusive activity end dates converted to exclusive iCalendar end dates.

Connected record pages link parents, beneficiaries, farm observations, validation, activities and payments. Farmer profiles include **Participation & location history**, including multi-state and multi-season participation. Version history starts when this upgrade records or first changes a record; undocumented earlier history is not invented. Old planting/harvest fields remain available without being converted into fictitious tasks.

Farm intelligence shows recorded current and historical locations, fits the map to recorded points and supports OpenStreetMap, Esri and optional NASA imagery. External map providers require network access. Filters restrict the historical observations by programme and season. GIS and local advisor use recorded evidence to flag overdue work, incomplete location evidence, pending validation, soil issues and upcoming harvests. Numeric yield outlooks require at least three completed farmer-season-site harvest observations with actual kilograms and measured hectares. They are descriptive historical estimates with an observed interquartile range, not calibrated future probabilities. Filter to comparable production contexts before interpreting them. Farmer and operational analysis windows are capped at 1,000 matching records per collection and disclosed in the UI. Operational totals and bulk enrolment query the complete authorized dataset.

## Import exception log

Data hub → Review queue → select batch → **Download ALL failed rows and reasons** streams all archived non-imported rows, beyond the review page limit, including source row, status, reason and original source JSON. Export cells are quoted and formula-prefixed values neutralized. This contains sensitive source data and requires an administrator or unrestricted manager reviewer; scoped managers cannot download a whole unscoped original batch. The original archive remains unchanged.

## Email OTP and payment setup on Render

Configure secrets securely in Render's Environment settings; never commit them. Set `PUBLIC_URL` to the deployed HTTPS origin.

For email use either `RESEND_API_KEY` and `EMAIL_FROM` with a verified sending domain, or `SMTP_HOST`, `SMTP_PORT` (587 STARTTLS or 465 TLS), `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM`. The server sends branded OTP mail. My account has optional 2FA with password-plus-OTP confirmation; administrators can enable/require it for users in Team & access, and require it workspace-wide in settings. Enabling a requirement is refused without an email provider. Security changes revoke affected sessions. Codes expire after five minutes, allow five attempts and are single-use. Verify delivery to controlled accounts before requiring 2FA for everyone.

Set the real `PAYSTACK_SECRET_KEY` at runtime. Register `https://YOUR-DOMAIN/api/paystack/webhook` in Paystack. A private-workspace manager can initiate a fee checkout from Members & fees. The server derives NGN amounts from configured fees, validates webhook HMAC signatures and independently verifies reference, successful status, currency and exact amount with Paystack. Replayed notifications do not duplicate the ledger. Automatic verification and admin-verified manual receipts update the same member payment state; pending checkout is never collected revenue. Public farmer registration/payment remains subject to the separate public website launch settings.

Provider tests use injected fixtures only: no real messages are sent and no real payments are charged. Live delivery and checkout require the deployment credentials and provider configuration above. Back up the persistent SQLite file before rollout; do not replace the private database with demo data. Schema additions are applied automatically and synthetic operation samples are seeded only in the isolated demo workspace.
