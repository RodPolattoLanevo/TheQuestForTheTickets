# The Hunt for the Tickets

An internal RPG gamification platform for the support team. Employees earn XP and Coins
for Zendesk tickets they close, level up an original RPG character, fight monsters across
a configurable world map, buy cosmetics, chase achievements/quests, and compete on a
(configurable, opt-in) leaderboard.

Zendesk admin/API access is **not required** to run this. See [`ARCHITECTURE.md`](docs/ARCHITECTURE.md)
for the pluggable `TicketDataProvider` design that makes Mock and CSV import fully
functional on day one, with Zendesk API/webhook/Google Sheets/browser-capture providers
ready to enable later without touching game logic.

## Project layout

```
apps/
  backend/     Express + TypeScript API, reward pipeline, sync engine, admin routes
  web/         React + Vite + TypeScript dashboard (the full game UI)
  extension/   Chrome (Manifest V3) toolbar popup
packages/
  database/    Prisma schema + migrations + seed data (Postgres - Supabase in prod)
  game-engine/ Pure game logic: leveling curve, reward rules, combat, achievements
  providers/   TicketDataProvider implementations (mock, csv, zendesk-*, sheets, browser)
  shared/      Shared TypeScript types/DTOs
docs/          SETUP, ARCHITECTURE, integrations, admin guide, security, testing
```

## Quick start

```bash
npm install
cp .env.example .env
docker compose up -d   # local Postgres - or point .env at a Supabase project instead
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev:backend    # http://localhost:4000
npm run dev:web        # http://localhost:5173 (separate terminal)
```

Log in with the seeded accounts:
- Admin (Game Master): `admin@sacoa.com.br` / `admin123`
- Employee: `demo@sacoa.com.br` / `demo123`

Full walkthrough, including the Chrome extension and running without Zendesk access at
all, is in [`docs/SETUP.md`](docs/SETUP.md).

## Testing

```bash
npm test
```

Runs the game-engine unit tests (leveling curve, reward-rule matching, combat math,
achievement criteria) and the backend integration test suite (Vitest + Supertest against a
real, isolated Postgres schema - see prerequisites in [`docs/SETUP.md`](docs/SETUP.md)),
including one full end-to-end test of the entire gameplay loop: simulate a ticket → reward
granted → level computed → combat → victory → loot → achievement unlocked. See
[`docs/TESTING.md`](docs/TESTING.md).

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - system design, provider architecture, data model
- [`docs/SETUP.md`](docs/SETUP.md) - local setup, environment variables, running each app
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) - deploying to Vercel (web + backend) + Supabase (Postgres)
- [`docs/ZENDESK_INTEGRATION.md`](docs/ZENDESK_INTEGRATION.md) - OAuth API + webhook integration
- [`docs/GOOGLE_SHEETS_INTEGRATION.md`](docs/GOOGLE_SHEETS_INTEGRATION.md) - spreadsheet fallback provider
- [`docs/CSV_IMPORT.md`](docs/CSV_IMPORT.md) - manual CSV ticket import
- [`docs/ADMIN_GUIDE.md`](docs/ADMIN_GUIDE.md) - everything configurable from the Admin panel
- [`docs/SECURITY.md`](docs/SECURITY.md) - auth model, server authority, secrets handling
- [`docs/TESTING.md`](docs/TESTING.md) - what's covered and how to run it

## Status / scope of this build

This is a working Phase 1-3 implementation (see spec section 41): auth, characters,
XP/coins/leveling, mock + CSV ticket providers with an idempotent reward pipeline, combat,
shop, achievements, quests, leaderboard, team events, full admin panel, and audit log -
all server-authoritative and persisted. The Zendesk OAuth API, Zendesk webhook, and Google
Sheets providers are implemented against real APIs but need real credentials to activate
(there is nothing to fake - see the integration docs above for exactly what to configure
when those become available). The Chrome extension ships a working popup + background
polling/notifications; a future Zendesk App Framework sidebar can reuse the same REST API.
