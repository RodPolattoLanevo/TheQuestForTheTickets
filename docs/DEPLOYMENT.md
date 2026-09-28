# Deployment (Vercel + Supabase)

Goal: the web app and API are always up, without anyone's laptop needing to be running
`npm run dev:backend`. Two Vercel projects (web, backend) + one Supabase project (Postgres)
in the same account/org. Nothing here needs Zendesk credentials - the browser-capture flow
(the extension) works the same against a deployed backend as it does against localhost.

## Why two Vercel projects, not one

This is an npm-workspaces monorepo with two independently deployable apps (`apps/web` -
static SPA, `apps/backend` - API). Vercel deploys each with its own **Root Directory**,
build, env vars and domain. Trying to serve both from one Vercel project fights the
platform; two projects pointed at the same git repo is the supported pattern for a
monorepo like this one.

## 0. Prerequisites

- This project pushed to a git repo (GitHub/GitLab/Bitbucket) - Vercel deploys from git.
  This repo has no git remote yet; running `git init`, committing, and pushing to a new
  GitHub repo is the first step and is entirely up to you (Claude did not do this for you -
  creating hosted accounts/repos and pushing code are actions you should drive yourself).
- A [Supabase](https://supabase.com) account and a [Vercel](https://vercel.com) account.

## 1. Supabase: create the database

1. New project in the Supabase dashboard. Pick a strong database password (generate one -
   you won't type it again, it goes straight into an env var).
2. **Project Settings -> Database -> Connection string**. Copy two URLs:
   - **Transaction pooler** (port `6543`, has `?pgbouncer=true`) -> this is `DATABASE_URL`.
     The backend runs as short-lived Vercel serverless functions; without pgbouncer they'd
     exhaust Postgres' direct connection limit under any real concurrent traffic.
   - **Session / direct connection** (port `5432`) -> this is `DIRECT_URL`. Only
     `prisma migrate` uses it - pgbouncer's transaction-pooling mode can't run DDL.
3. From your machine, with those two values in `packages/database/.env` (and `.env` at the
   repo root), run once:
   ```bash
   npm run db:generate
   npm run db:migrate      # first time only - creates the initial migration, see
                            # packages/database/prisma/migrations/README.md
   npm run db:seed
   ```
   This creates every table and seeds the worlds/monsters/items/category rules/admin+demo
   accounts directly on Supabase. Commit the migration folder `db:migrate` generates.
4. For every deploy after this first one, `db:migrate:deploy` (`prisma migrate deploy`) is
   what applies new migrations - it doesn't prompt and doesn't generate new migration
   files, so it's safe to run from CI or by hand after `git pull`. There's no automatic
   "run migrations on deploy" hook wired up yet (Vercel has no post-deploy step by default);
   run `npm run db:migrate:deploy` yourself after pulling a change that touches
   `schema.prisma`, before or right after that deploy goes out.

## 2. Vercel: backend project

1. Import the git repo as a new Vercel project. **Root Directory**: `apps/backend`.
   Framework preset: "Other". Vercel auto-detects the npm-workspaces root from the repo's
   `package.json` and installs from there, so workspace packages (`@hunt/database` etc.)
   resolve correctly even with Root Directory set below the repo root.
2. Environment variables (Project Settings -> Environment Variables), Production **and**
   Preview:
   ```
   DATABASE_URL       = <Supabase transaction pooler URL>
   DIRECT_URL         = <Supabase session/direct URL>
   AUTH_JWT_SECRET     = <openssl rand -hex 32 - a real secret, not the dev default>
   WEB_ORIGIN          = https://<your-web-project>.vercel.app
   NODE_ENV            = production
   FEATURE_BROWSER_CAPTURE = true
   ```
   Leave the Zendesk/Google Sheets vars unset unless you're enabling those providers too -
   your actual sync path is the extension's browser-capture flow, which only needs
   `FEATURE_BROWSER_CAPTURE=true` (this flag also toggles live in Admin -> Game Settings,
   so the env var above is really just "what it starts as").
3. Deploy. `apps/backend/api/index.ts` is the serverless entrypoint (the Express app from
   `src/app.ts`, exported directly - Vercel invokes it as the handler for every request);
   `apps/backend/vercel.json` rewrites every path to it. Health check once live:
   `https://<backend-project>.vercel.app/api/health`.
4. **What doesn't run here**: `src/server.ts`'s `startScheduledSync` (a `setInterval` polling
   loop) never runs in serverless - there's no long-lived process for it to run in. That's
   fine for the real deployment: ticket ingestion is the extension's manual, on-screen
   browser-capture, not a poller. It only mattered for the `zendesk-api`/`google-sheets`
   polling providers, neither of which this team uses. If that ever changes, the fix is a
   [Vercel Cron Job](https://vercel.com/docs/cron-jobs) (add a `crons` entry to
   `apps/backend/vercel.json`) hitting a small `/api/admin/sync` route on a schedule instead
   of an in-process timer - not implemented, since nothing needs it yet.

## 3. Vercel: web project

1. Import the **same** git repo as a second Vercel project. **Root Directory**: `apps/web`.
   Framework preset: Vite (auto-detected).
2. Environment variable, Production and Preview:
   ```
   VITE_API_URL = https://<backend-project>.vercel.app
   ```
3. Deploy. `apps/web/vercel.json` handles client-side routing (React Router) by rewriting
   every path to `index.html`.
4. Go back to the **backend** project's `WEB_ORIGIN` env var and make sure it matches this
   project's real URL exactly (comma-separate multiple origins if you later add a custom
   domain) - CORS will reject the frontend otherwise. Redeploy the backend after changing it.

## 4. Point the Chrome extension at the deployed backend

Already done for this deployment: `apps/extension/config.js`'s `DEFAULT_API_URL`/
`DEFAULT_WEB_URL` point at `the-hunt-for-the-tickets-backend.vercel.app` /
`the-hunt-for-the-tickets.vercel.app`, and `host_permissions` in
`apps/extension/manifest.json` includes the backend URL (Chrome enforces this for the
popup/background service worker's own `fetch()` calls). Everyone who loads the extension
unpacked from this repo gets the production URLs by default - no per-person setup needed.
The `localhost` entries stay in both files too, for local dev against `npm run dev:backend`
(override via the extension's Options page).

If you ever point this at a different Vercel deployment (a new project, a custom domain),
update those same two spots - `DEFAULT_API_URL`/`DEFAULT_WEB_URL` in `config.js` and the
matching entry in `host_permissions` - then everyone picks up the change next time they
reload the extension (`chrome://extensions` -> reload), no reinstall needed.

## 5. Custom domain (optional)

Add it under the web project's Settings -> Domains. If you also want a clean API domain
(e.g. `api.yourteam.com`) instead of the default `*.vercel.app` one, add it to the backend
project the same way, then update both `VITE_API_URL` (web project) and `WEB_ORIGIN`
(backend project) to match, and redeploy both.

## Rolling back a bad deploy

Vercel keeps every previous deployment - "Instant Rollback" in the dashboard repoints the
production domain at a prior build with no rebuild needed. A bad *migration* is different:
Prisma migrations aren't auto-reversible, so undo those by writing a new migration that
reverts the change, the same way you'd fix forward any other schema mistake.
