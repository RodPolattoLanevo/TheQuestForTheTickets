# Testing

```bash
npm test
```

Runs two suites:

## `packages/game-engine` (Vitest, pure unit tests)

No database, no network - fast checks of the core game math:

- **Leveling** (`test/leveling.test.ts`): level 1 at 0 XP, exact-threshold level-ups,
  monotonicity (more XP never decreases level), custom curve configs.
- **Reward rules** (`test/rewardRules.test.ts`): equals/contains/in matching (including
  array fields like tags), case-insensitivity, inactive rules ignored, fallback reward
  when nothing matches.
- **Combat** (`test/combat.test.ts`): higher stats → higher derived attack, equipment
  bonuses stack, damage always ≥ 1 even against very high defense, forced-crit and
  forced-no-crit via an injectable RNG, a full round resolves to victory or a monster
  counter-attack correctly.
- **Achievements/quests criteria** (`test/achievements.test.ts`): progress + completion
  evaluation against a stats snapshot.

## `apps/backend` (Vitest + Supertest, integration)

Needs a reachable Postgres (`docker compose up -d` at the repo root, or point `.env` at a
Supabase project - see [`SETUP.md`](SETUP.md) prerequisites). `test/globalSetup.ts` runs
`prisma db push --force-reset` against an isolated `hunt_test` Postgres *schema* (derived
from your `DATABASE_URL`/`DIRECT_URL`, dropped and recreated on every run) so tests run
against a real Prisma-backed API, not mocks, without ever touching your dev data.

`test/e2e.test.ts` is the full spec-section-39 gameplay loop, exercised through real HTTP
requests against the actual Express app (no mocking of routes or the database):

1. Register an admin (first account → auto-ADMIN) and an employee.
2. Confirm the employee starts at level 1 with 0 XP, auto-assigned to the starting world.
3. Confirm unauthenticated requests are rejected (401).
4. `POST /api/dev/simulate-ticket` with `priority: urgent` → asserts the exact XP/coins
   granted match the configured category rule, that a `RewardTransaction` was persisted
   with the right category, and that the ticket automatically landed a hit on the
   character's current monster (there's no separate "Attack" action - see
   `combatOutcomes` in the response).
5. Re-simulating the **same** ticket ID with no status change → asserts zero additional
   reward transactions *and* zero additional combat hits (idempotency covers combat too).
6. Confirms the "First Blood" achievement auto-unlocked and granted its coin reward.
7. Forces the test monster down to 1 HP directly in the database (simulating many prior
   tickets having worn it down), then closes one more ticket → asserts the automatic hit
   lands the kill, grants the monster's XP/coin reward on top of the ticket's own reward,
   and that both totals match what `/api/me` reports afterward.
8. Confirms an admin can grant XP/coins directly and that it's visible in the admin
   action audit log; confirms a non-admin is rejected from the admin panel (403).
9. Confirms changing a category rule's reward (`PUT /api/admin/category-rules/:id`)
   changes the payout of the *next* simulated ticket of that category - proving the
   config → gameplay loop end to end (spec section 42, steps 18-20) - and that a ticket
   closed after the world is fully cleared correctly throws no punch (`attacked: false`).
10. `POST /api/browser-capture/ingest` (the Chrome extension's Zendesk auto-sync) is
    rejected with 403 while the `browserCapture` feature flag is off; once enabled, a
    captured ticket is matched by its `group` field and rewarded exactly like any other
    provider, and - critically - the reward always goes to the *caller's own* account even
    if the request body claims a different employee identity (spec section 21).
11. Region liberation (Helldivers-style shared progress): confirms `POST /api/worlds/:id/deploy`
    is rejected (403) for a region the character hasn't unlocked by XP; confirms that once
    two *independent* accounts both deploy to the same region and each closes a ticket, the
    region's `liberationPct` climbs cumulatively across both players (not reset per-account)
    - proving the meter is genuinely shared, not a per-character stat that happens to have
    the same name.

## Running just one part

```bash
npm run test --workspace=packages/game-engine
npm run test --workspace=apps/backend    # needs Postgres reachable, see above
```

## What's not covered yet

- No Playwright/browser end-to-end test of the React UI itself - the backend e2e test
  covers the same gameplay loop at the API level, which is what actually enforces the
  game's rules (the UI is a thin client over it). Adding Playwright coverage of the
  Dashboard → Simulate Ticket → Shop → Equip flow is a natural next step once the UI
  stabilizes.
- Zendesk API/webhook and Google Sheets providers aren't covered by integration tests
  since they require real external credentials; `ZendeskWebhookProvider.toRawTicket` /
  `verifySignature` and `parseTicketCsv` (which they'd share edge-case logic with) are
  unit-testable in isolation the same way `resolveTicketReward` already is.
