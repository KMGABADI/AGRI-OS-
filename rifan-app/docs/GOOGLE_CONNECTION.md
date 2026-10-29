# Google Workspace connection on Render

The Connections page requires a Google Cloud **OAuth Web application client**. A Google API key, Firebase project configuration or service-account key cannot replace it. The application code does not create or invent Google credentials.

1. Open your Google Cloud project → **Google Auth Platform**. Configure Branding and Audience. If publishing status is **Testing**, add each account that will connect as a test user. An Internal audience permits only accounts in that Google Workspace organization.
2. Enable **Google Sheets API**, **Google Drive API**, **Google Docs API** and **Google Forms API** for the features you use. Enable Gmail API only when using Gmail alerts.
3. Under **Clients**, create a client of type **Web application**.
4. Deploy the latest RIFAN code and open **Connections** on your actual Render/custom domain. Copy the displayed **Authorized redirect URI** into the OAuth client's authorized redirect URIs. It must match exactly, including `https://` and `/api/google/callback`.
5. In **Render → your service → Environment**, set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` from that OAuth Web client. Set `PUBLIC_URL` to the HTTPS origin users actually sign in on, for example `https://YOUR-SERVICE.onrender.com`, without a page path. On Render's default address the app can use `RENDER_EXTERNAL_URL` automatically. Keep the client secret out of chat, screenshots, GitHub and frontend build variables.
6. Save the Render environment changes and redeploy. Open Connections, click **Check configuration**, then **Connect Google account** from a private RIFAN account. Shared demo accounts cannot retain real Google authorization.
7. Sign in to the Google account that can access the register and grant the requested permissions. After returning to Connections, preview an authorized workbook before applying synchronization.

For email alerts, open **Google permissions and setup help → Authorize Gmail alerts** after the base connection is established. Gmail authorization is optional; it is no longer requested for a normal register/document connection. Sending an alert remains a separate explicit user action.

## Troubleshooting

- **Missing configuration:** Connections lists the unset environment variable names. A disabled Connect button prevents leaving the app for an unconfigured API route.
- **Site address differs:** Set `PUBLIC_URL` to the address in the browser, register that callback URI in Google Cloud, and redeploy. Connecting from a different domain can lose the RIFAN session cookie on return.
- **redirect_uri_mismatch:** Copy the exact URI displayed in Connections into the same OAuth client used by `GOOGLE_CLIENT_ID`. Do not use a Desktop client or add the callback URI only to JavaScript origins.
- **Access blocked / app not verified:** Check the consent-screen audience, test-user list, publishing status and any Google verification requirements. Code cannot bypass Google's account/consent controls.
- **Authorization cancelled:** Retry if authorization was intended. Existing authorization is retained when a reconnect is cancelled.
- **Expired or used link:** Start a new connection. Authorization state is user-bound, expires after ten minutes and is single-use; PKCE binds the token exchange to the original request.
- **Session expired:** Sign back in to RIFAN and start a new connection. The app returns to the Connections flow instead of showing a raw API JSON page.
- **Token refresh revoked/expired:** Reconnect the account. Refreshed/rotated credentials are persisted server-side; transient provider failures retain the saved connection and return a retry message.
- **Workbook access denied:** Check the Google account's sharing permissions and enabled APIs. Drive's `drive.file` scope lists only app-authorized Drive files/folders; it is not unrestricted Drive access.

Disconnect removes this user's saved authorization from RIFAN and pending authorization states, without deleting farmer or workbook records. Google-side app permission can separately be removed in Google Account → Security → Third-party access.

OAuth tests use an injected provider fixture and do not authorize a real Google account or send email. Deployment credentials, Google consent approval and live account permission must still be supplied/tested by the deployment owner.
