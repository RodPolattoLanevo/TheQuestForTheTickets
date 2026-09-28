# Setup

## Prerequisites

- Node.js 20+ (tested on Node 24)
- npm 10+
- A Postgres database. Either:
  - `docker compose up -d` at the repo root (needs Docker Desktop) - starts a local
    Postgres matching the connection string in `.env.example`, or
  - a free [Supabase](https://supabase.com) project - simplest if you don't want anything
    running locally; see [`DEPLOYMENT.md`](DEPLOYMENT.md) step 1 for exactly which
    connection strings to copy into `.env`.

## 1. Install dependencies

```bash
npm install
```

This installs every workspace package (`packages/*`, `apps/*`) in one pass via npm
workspaces.

## 2. Configure environment

```bash
cp .env.example .env
cp .env packages/database/.env
```

The defaults work out of the box once your Postgres is running (`TICKET_PROVIDER=mock`,
`DATABASE_URL`/`DIRECT_URL` pointed at the local `docker-compose.yml` Postgres). Leave the
Zendesk/Google Sheets variables blank until you're ready to enable those integrations - the
app works fully without them.

The second copy is needed because the Prisma CLI (`prisma migrate`, `prisma generate`,
`prisma db push`) reads `DATABASE_URL` from an `.env` file relative to its own working
directory (`packages/database`), not from the repo root - `apps/backend` itself loads the
root `.env` directly via `dotenv`, so only the Prisma CLI commands need this second copy.
Keep both files in sync if you change `DATABASE_URL`.

## 3. Set up the database

```bash
npm run db:generate   # generates the Prisma client
npm run db:migrate     # creates apps/backend equivalent dev.db via Prisma migrate
npm run db:seed        # worlds, monsters, items, category rules, achievements, quests, admin/demo accounts
```

`db:migrate` runs `prisma migrate dev` against `packages/database/prisma/schema.prisma`,
writing `dev.db` inside `packages/database/prisma/`. Point `DATABASE_URL` in `.env` (used
by `apps/backend`) at the same file, or run migrate once more with the backend's env
loaded - see the note in `packages/database/package.json` if you relocate the db file.

## 4. Run the backend

```bash
npm run dev:backend
```

Starts on `http://localhost:4000`. Health check: `GET /api/health`.

## 5. Run the web app

```bash
npm run dev:web
```

Starts on `http://localhost:5173`. Copy `apps/web/.env.example` to `apps/web/.env` if you
need to point it at a non-default backend URL (`VITE_API_URL`).

## 6. Log in

- Admin (Game Master): `admin@sacoa.com.br` / `admin123`
- Employee: `demo@sacoa.com.br` / `demo123`

The **first account ever registered** through `/api/auth/register` (or the web app's
"Register" form) automatically becomes an Admin - useful if you'd rather not use the
seeded credentials.

## 7. Try the full loop without Zendesk

1. Log in as the demo employee.
2. On the Dashboard, pick a priority and click "Complete a Ticket" - this calls
   `POST /api/dev/simulate-ticket`, which runs through the exact same reward pipeline a
   real Zendesk sync would use (spec section 25: Mock Mode).
3. Watch XP/coins update - and watch the current monster's HP drop too. There's no
   "Attack" button: closing the ticket automatically lands a hit, sized by your stats and
   gear. Keep completing tickets until it's defeated.
4. Visit World Map → click any unlocked region to "Deploy" there (this is the Helldivers-
   style region map - see `ARCHITECTURE.md` "Regions & shared liberation"). Notice the
   green **Liberation** bar on each region tile: it's shared across every player deployed
   there, not personal - simulate another ticket and watch it climb on the Dashboard too.
5. Visit Shop to spend coins on a cosmetic, then Equip it.
6. Log in as Admin, go to the Admin panel → Category Rules, change a reward amount, then
   go back to the employee dashboard and simulate another ticket of that category - the
   new reward applies immediately.

## 8. Chrome extension (optional)

```
chrome://extensions → Enable Developer Mode → Load unpacked → select apps/extension/
```

The popup shares login state via `chrome.storage.local` - log in there with the same
credentials. If your backend isn't on `localhost:4000`, open the extension's Options page
to override the API/web URLs (also update `host_permissions` in `apps/extension/manifest.json`
for a non-localhost deployment).

**Zendesk sync (on-screen only)**: this build also ships a content script for
`sacoa.zendesk.com`. It's manual and scoped to exactly what's on screen, on purpose - it
does not call Zendesk's API or query your ticket history. Requires the `browserCapture`
feature flag (Admin -> Game Settings -> Feature Flags - already on for this deployment)
and being logged into the extension popup.

To use it: open a Zendesk ticket list or search results tab (whatever view you'd normally
check for your solved tickets), open the extension popup, and click **"🔍 Preview Tickets
On Screen"**. It lists every ticket row it recognized on that page - nothing is submitted
yet. Review the list, then click the **"⚠️ Submit N ticket(s) for reward"** button that
appears below it (with a confirmation dialog) to actually grant rewards for that batch.

If it says "No Zendesk tab open," open one first. If it says "No response from the Zendesk
tab," reload that tab once (content scripts only attach to tabs opened/reloaded *after*
the extension itself was loaded/reloaded) and try again. If it finds 0 tickets, make sure
an actual ticket list/search results table (with Status, ID, Requester, Assignee, Group
columns) is visible on screen, not a single ticket's detail view. See
[`ZENDESK_INTEGRATION.md`](ZENDESK_INTEGRATION.md) Option 3 for the full design, how the
on-screen parsing works, and how to point this at a different subdomain.

## 9. Tests

```bash
npm test
```

See [`TESTING.md`](TESTING.md).

## 10. Deploying so it's always up

Everything above runs on your own machine. To have this running permanently for the whole
team (Vercel + Supabase, no laptop required), see [`DEPLOYMENT.md`](DEPLOYMENT.md).
