import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

// `npm run dev --workspace=apps/backend` (and every other workspace-scoped script) runs
// with cwd = apps/backend, so bare `dotenv/config` (which only ever looks at
// process.cwd()/.env) silently finds nothing there and every value below falls back to
// its default - harmless while those defaults matched the repo-root .env.example, but not
// once DATABASE_URL has to be a real Postgres connection string. Resolve the root .env
// explicitly instead, the same way packages/database/src/index.ts resolves its SQLite
// path regardless of caller cwd. On Vercel, env vars are injected directly into
// process.env and no .env file exists at all - dotenv just no-ops in that case.
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

export const config = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 4000),
  webOrigin: process.env.WEB_ORIGIN ?? "http://localhost:5173",
  authJwtSecret: process.env.AUTH_JWT_SECRET ?? "dev-only-insecure-secret-change-me",
  databaseUrl: process.env.DATABASE_URL ?? "postgresql://hunt:hunt@localhost:5432/hunt",
  ticketProvider: process.env.TICKET_PROVIDER ?? "mock",
  syncIntervalMinutes: Number(process.env.SYNC_INTERVAL_MINUTES ?? 15),
  zendesk: {
    subdomain: process.env.ZENDESK_SUBDOMAIN,
    oauthClientId: process.env.ZENDESK_OAUTH_CLIENT_ID,
    oauthClientSecret: process.env.ZENDESK_OAUTH_CLIENT_SECRET,
    oauthRedirectUri: process.env.ZENDESK_OAUTH_REDIRECT_URI,
    oauthAccessToken: process.env.ZENDESK_OAUTH_ACCESS_TOKEN,
    // Simpler alternative to the OAuth dance: an Admin Center-generated API token, paired
    // with the email of the agent/service account that generated it. No OAuth app needed.
    apiToken: process.env.ZENDESK_API_TOKEN,
    apiTokenEmail: process.env.ZENDESK_API_TOKEN_EMAIL,
    webhookSecret: process.env.ZENDESK_WEBHOOK_SECRET,
  },
  googleSheets: {
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    serviceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    serviceAccountPrivateKey: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY,
  },
  featureFlags: {
    browserCapture: bool(process.env.FEATURE_BROWSER_CAPTURE, false),
    teamEvents: bool(process.env.FEATURE_TEAM_EVENTS, true),
    soundDefaultOn: bool(process.env.FEATURE_SOUND_DEFAULT_ON, false),
  },
};
