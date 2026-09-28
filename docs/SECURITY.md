# Security

This is an internal company application; the model below assumes it runs on internal
infrastructure/VPN, not directly on the public internet without a reverse proxy/TLS in
front of it.

## Authentication

- Passwords hashed with bcrypt (10 rounds), never stored or logged in plaintext.
- Auth is a signed JWT (`AUTH_JWT_SECRET`, 7-day expiry) sent as `Authorization: Bearer`.
  Set `AUTH_JWT_SECRET` to a long random value in production
  (`openssl rand -hex 32`) - the `.env.example` default is explicitly insecure and only
  meant for first boot.
- The first account ever registered becomes `ADMIN` automatically; every account after
  that defaults to `EMPLOYEE`. Admins can promote further accounts via Admin → Employees.
- `requireAuth` / `requireAdmin` middleware (`apps/backend/src/auth/middleware.ts`) gate
  every route except `/api/auth/*`, `/api/health`, and the Zendesk webhook endpoint (which
  has its own shared-secret check instead of a user session, since it's called by
  Zendesk, not a logged-in user).

## Server authority

The client (web app, extension) is never trusted for game state. XP, coins, inventory,
stats, level, and achievements are only ever written by backend code under
`apps/backend/src/engine/`, inside database transactions:

- `grantReward()` is the *only* function that changes XP/coins, used by the ticket reward
  pipeline, combat victories, quest claims, achievement unlocks, and admin grants alike -
  one audited code path, no per-feature currency logic to get wrong differently.
- Coin balances are clamped to a minimum of 0 (`Math.max(0, ...)`) - no negative-currency
  exploit via an admin "remove" larger than the balance, or a purchase race.
- Shop purchases re-validate level requirement and coin balance server-side even though
  the UI already disables the button - the UI check is a convenience, not the guard.
- Combat damage/crit/loot rolls are computed server-side (`packages/game-engine/src/combat.ts`)
  from the character's stored stats + equipped item bonuses; the client only ever sees the
  result of an attack it triggered, never sends numbers the server uses.
- `POST /api/browser-capture/ingest` (the Chrome extension's Zendesk auto-sync,
  `apps/backend/src/routes/browserCapture.ts`) never trusts the request body for *whose*
  ticket it is - it always attributes captured tickets to the caller's own authenticated
  account, ignoring any employee identity the client claims. One agent's browser can never
  grant rewards to a different agent's account this way.

## Idempotency / anti-farming

See [`ARCHITECTURE.md`](ARCHITECTURE.md) and spec section 10: tickets are keyed by
`(provider, externalId)`; a ticket resynced without a status change is a no-op; a
solved→reopened→solved cycle is governed by an admin-configurable policy that defaults to
"ignore" (no extra reward) specifically to prevent XP farming via reopen/resolve loops.
The Zendesk webhook route additionally rejects requests without a valid shared secret and
malformed payloads before they ever reach the database, so replayed or forged webhook
deliveries can't create bogus tickets - and even if one did, the same idempotency logic
would prevent it from paying out more than once.

## Secrets

- Never hardcoded. `.env.example` documents every required/optional variable; `.env` is
  git-ignored (see `.gitignore`).
- The Chrome extension never holds Zendesk or database credentials - it only ever talks
  to this app's own backend with a user's own session JWT, exactly like the web app.
- Zendesk OAuth tokens and the webhook shared secret live only in backend environment
  variables (with a documented path to move them into `IntegrationSetting` if/when a full
  OAuth authorization-code flow is wired up - see `ZENDESK_INTEGRATION.md`).

## Input validation

Every mutating route validates its body with `zod` schemas
(`apps/backend/src/routes/*.ts`) before touching the database. CSV imports are parsed and
validated (row-by-row, with explicit invalid-row reporting) before any reward is granted,
with a required preview step before commit.

## Known gaps / follow-ups for a production rollout

- Rate limiting is not implemented - add it in front of `/api/auth/login` and the webhook
  endpoint before exposing this beyond an internal network.
- The Zendesk OAuth authorization-code exchange endpoint is not implemented yet (an access
  token must currently be provisioned into the environment out-of-band) - see
  `ZENDESK_INTEGRATION.md`.
- No CSRF concern currently exists because the API is a pure JSON bearer-token API with no
  cookie-based session, but if cookie auth is ever added, CSRF protection must come with it.
- `npm audit` currently reports moderate/high/critical advisories in `vite`/`vitest`
  (dev-only tooling used for local development and tests, not shipped to production) and a
  moderate one in `csv-parse`/`react-router` - all fixable via `npm audit fix --force`, left
  as a deliberate follow-up here since those are breaking major-version bumps. Re-run
  `npm audit` and address these before a production rollout. `multer` (used for CSV file
  uploads) is pinned to a patched 1.x release; migrating to `multer@2` is a reasonable
  follow-up but not urgent per the current audit.
