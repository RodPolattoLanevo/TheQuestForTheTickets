# Architecture

## Goals that shaped the design

1. **Must work with zero Zendesk admin/API access.** Every gameplay system is driven by
   `RawTicket` events, not by Zendesk directly. `MockProvider` and `CSVProvider` produce
   real `RawTicket`s and feed the exact same pipeline a live Zendesk integration would.
2. **Server is authoritative.** XP, coins, inventory, stats, level and achievements are
   never trusted from the client. Every mutation goes through `apps/backend/src/engine/*`.
3. **Idempotent by construction.** A ticket can be synced, re-synced, reopened and
   re-solved without ever double-rewarding an agent unless an admin explicitly opts into
   that (`ticket_reopen_policy`).
4. **Everything configurable ends up in the database**, not in code - reward amounts,
   category rules, level curve, feature flags, monster stats, shop prices, quests,
   achievements. Admin panel writes go straight to Postgres/SQLite; nothing needs a
   redeploy.

## Request flow: a ticket becomes XP

```
TicketDataProvider.fetchTickets()          <- Mock queue / CSV rows / Zendesk API / Sheets
        │  RawTicket[] (normalized: externalId, employeeExternalId, status, fields)
        ▼
ingestRawTickets(provider, tickets)         apps/backend/src/engine/rewardPipeline.ts
        │  for each ticket:
        │    - upsert Ticket by (provider, externalId)
        │    - detect status transition (solved / reopened / no-op)
        │    - idempotency + reopen-policy check
        │    - resolveTicketReward(ticket, activeCategoryRules)   packages/game-engine
        ▼
grantReward(...)                            apps/backend/src/engine/rewards.ts
        │    - updates Character.xp/coins inside a DB transaction
        │    - writes an immutable RewardTransaction (the audit log)
        ▼
resolveTicketCombat(userId, ticketId)       apps/backend/src/engine/ticketCombat.ts
        │    - lands exactly one combat round on the character's current monster
        │    - on a kill: grants a COMBAT reward too, then advances the world if cleared
        ▼
refreshProgressForUser(userId)              apps/backend/src/engine/progress.ts
        │    - re-evaluates Achievements (lifetime stats) and Quests (period stats)
        │    - auto-unlocks/grants Achievements; marks Quests completed (claimed separately)
        ▼
addTeamEventDamage(userId, xp)              apps/backend/src/engine/teamEvents.ts
             - contributes to any active collaborative Team Event
```

`POST /api/dev/simulate-ticket`, the CSV import commit route, and the (future) Zendesk
webhook/API sync all call `ingestRawTickets` - there is exactly one reward code path, and
therefore exactly one combat code path too (see "Combat model" below).

## The `TicketDataProvider` interface

```ts
interface TicketDataProvider {
  readonly id: string;
  readonly displayName: string;
  isConfigured(): boolean;
  fetchTickets(params: { cursor?: string | null }): Promise<{ tickets: RawTicket[]; nextCursor?: string | null }>;
}
```

Implementations (`packages/providers/src`):

| Provider | Mode | Needs |
|---|---|---|
| `MockProvider` | in-memory queue, drained by sync | nothing - always configured |
| `CSVProvider` | file upload, drained by sync | nothing - always configured |
| `ZendeskApiProvider` | polling, cursor-based incremental export | OAuth access token (see ZENDESK_INTEGRATION.md) |
| `ZendeskWebhookProvider` | push (own endpoint, not polled) | shared secret |
| `GoogleSheetsProvider` | polling | service-account credentials (see GOOGLE_SHEETS_INTEGRATION.md) |
| `BrowserCaptureProvider` | push (own endpoint, not polled) | feature flag, extension content-script |

The Admin panel's Providers tab lets an admin pick which provider is "active" for the
scheduled sync and trigger manual/full syncs per provider - switching providers later
never requires code changes.

## Data model

See [`packages/database/prisma/schema.prisma`](../packages/database/prisma/schema.prisma)
for the full schema. Highlights:

- `Ticket` + `TicketEvent` + `RewardTransaction` together implement the idempotent reward
  ledger (spec section 10): `Ticket.solvedCount` tracks how many times a ticket has
  actually paid out, `TicketEvent` records every transition (even skipped ones, with a
  `skippedReason`) for dispute debugging, `RewardTransaction` is the append-only audit log
  referenced everywhere (grants, combat, quests, achievements, shop purchases all write one).
- `World` → `Stage` → `Monster` model the adventure map; `CombatSession` tracks an
  in-progress or resolved fight; a character's `currentWorldId`/`currentStageId` advance
  automatically once every monster in a world (including its boss) is defeated.
- `Item` + `InventoryItem` cover both pure cosmetics and gameplay-affecting upgrades
  (`isGameplayUpgrade` + `statBonuses` JSON, summed into combat power in
  `apps/backend/src/engine/character.ts`).
- `TicketCategoryRule` is the reward rule engine (spec section 28): ordered, field-source-
  agnostic conditions (`type`/`group`/`form`/`tags`/`priority`/`custom_field`/`status`)
  evaluated by the pure function `resolveTicketReward` in `packages/game-engine`.
- `IntegrationSetting` is a generic key/value config store (level curve, feature flags,
  reopen policy, leaderboard visibility, active provider) so Admin panel changes apply
  immediately without a schema migration per setting.

Postgres (Supabase in production, local Postgres via `docker-compose.yml` or a Supabase
dev project otherwise) - all access goes through Prisma, so this was a two-file change from
the original SQLite MVP schema (`datasource.provider`/`directUrl` in `schema.prisma`, plus
`DATABASE_URL`/`DIRECT_URL`). See [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full Vercel +
Supabase setup, including why two connection strings (pooled vs. direct) matter once the
backend runs as serverless functions.

## Combat model

There is no "Attack" button. Deliberately simple stats (Strength/Defense/Agility/Magic/
Luck - see `packages/game-engine/src/combat.ts`) decide how hard a hit lands, but the only
thing that ever throws a punch is closing a ticket: every granted `ZENDESK_TICKET` reward
triggers exactly one combat round in `apps/backend/src/engine/ticketCombat.ts`, resolved
against the character's current monster (`resolveCombatRound` - the player always attacks
first; if the monster survives, it counter-attacks once, though that counter-damage is
currently cosmetic/informational only, not persisted against the player). A monster's HP
persists across requests on its `CombatSession`, so a string of closed tickets chips away
at a boss over however long it takes in real work, never blocking anything - if a ticket
closes and there's nothing left to fight (every configured world cleared), the ticket
still pays its normal XP/coins, it just doesn't throw a punch (`attacked: false` in the
response). `GET /api/combat/current` is read-only, purely for the UI to render the current
encounter's HP bar.

## Regions & shared liberation (Helldivers-style)

Each `World` doubles as a "region" on the map (`apps/web/src/pages/WorldMap.tsx`) with two
progress numbers that move together but mean different things:

- **Personal monster HP** (`CombatSession`, described above) - your own queue of monsters
  in that region, individual loot/achievements.
- **Regional liberation** (`World.liberationCurrent` / `liberationTarget`) - a *shared*
  counter every character deployed to that region contributes to, just by landing hits
  there (`contributeToRegionLiberation` in `ticketCombat.ts`), regardless of whose personal
  monster they're fighting. More agents working the same region clears it faster - this is
  the literal Helldivers "Major Order" liberation-percentage mechanic, not a metaphor.
  Displayed as `liberationPct` (`min(100, current/target*100)`, never stored capped - a few
  contributions can land past 100% in a race, which is harmless since only the display is
  clamped).

Players aren't locked into a linear path: `POST /api/worlds/:id/deploy` lets a character
switch their `currentWorldId` to any region they've unlocked by XP (`world.xpRequirement`),
at any time - this is what "clicking a region on the map" does. Their personal monster
queue for that region resumes wherever it was (or starts fresh) via the same
`getOrCreateActiveSession` used everywhere else; deploying elsewhere and back doesn't reset
progress on either side.

The map itself (`apps/web/src/components/RegionMap.tsx` + `RegionMap.css`) is a single
pixel-art background image (`region-map.png`, bundled as a local Vite asset - no external
URL) with clickable `<button>` markers layered on top at hand-tuned `x`/`y` percentages per
region (`REGION_COORDS`, keyed by `World.key`). The image itself carries no text - every
label, lock icon, and liberation number is rendered by the site (accessible, translatable,
and stays sharp at any zoom), not baked into the art. `WorldMap.tsx` still owns all the
data-fetching/deploy logic and the region detail panel below the map; `RegionMap` is purely
presentational, driven by the same `World[]` from `GET /api/worlds`.

## Character/monster art

Original art, never copyrighted game assets (spec section 4/6). `Monster.image` (and
eventually `Item.previewImage`, character appearance layers) is just a path served from
`apps/web/public/monsters/`, referenced in `packages/database/prisma/seed.ts` per monster
row (or set via `PUT /api/admin/monsters/:id` for one that already exists).

All 13 current monsters (`packages/database/prisma/seed.ts` monster defs) have art -
`.webp` files supplied by the team and dropped straight into `public/monsters/`. These are
higher-resolution painted-pixel-style illustrations rather than true low-res pixel grids,
so the UI does **not** force `image-rendering: pixelated` on them (that class is reserved
for genuinely blocky, low-res source images, like the world map background - forcing it on
a large source image scaled down doesn't do anything useful and can look worse).

`apps/web/scripts/pixelPng.mjs` (a from-scratch PNG encoder, no image library dependency)
and `gen-boss-village-elder-troll.mjs` (its one example script) are kept as an alternative
path for genuinely from-scratch, code-generated low-res pixel art, if that's ever preferred
over a supplied image for a specific sprite - not the primary way art gets added anymore.

## Chrome extension

Deliberately dependency-free (no bundler) - `manifest.json` (MV3) + vanilla JS popup and
background service worker, both calling the same REST API as the web app. The background
worker polls `/api/me` every 5 minutes for a level-up/XP notification and badges the
toolbar icon with the current level. See `apps/extension/`.

## Deployment topology

Production is two Vercel projects (from the same git repo, different Root Directory) plus
one Supabase Postgres instance - see [`DEPLOYMENT.md`](DEPLOYMENT.md) for the full setup:

- `apps/web` deploys as a static Vite build with client-side routing.
- `apps/backend` deploys as Vercel serverless functions. `apps/backend/api/index.ts` is
  the entrypoint - it exports the same `createApp()` Express app from `src/app.ts` that
  `src/server.ts` runs locally, just without the `app.listen()`/scheduled-sync parts that
  only make sense for a long-lived process (Vercel invokes the exported app directly per
  request; there's no persistent process for a `setInterval` sync loop to live in - not a
  problem for this team, since ticket ingestion is the extension's manual browser-capture,
  not a poller).
- Both talk to the same Supabase Postgres, over its pooled ("transaction mode") connection
  string - required because serverless functions open a fresh Postgres connection per cold
  start far more often than a single long-lived Express process would.

## Future: Zendesk sidebar app

Nothing here is backend-incompatible with a future Zendesk App Framework (ZAF) sidebar -
it would just be another frontend calling the same `/api/me` and `/api/quests` endpoints,
authenticated the same way. No API redesign needed when that gets built.
