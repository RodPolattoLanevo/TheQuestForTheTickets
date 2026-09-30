# Admin Guide

Everything below is available to any account with role `ADMIN` (the first account ever
registered, or any account an admin promotes via Admin → Employees) at `/admin` in the
web app, backed by `apps/backend/src/routes/admin.ts`.

## Overview
Live counts: employees, tickets processed, reward transactions, active category rules.

## Employees
Create employee (or admin) accounts directly - useful when you don't want self-service
registration open. New characters are automatically placed in the lowest-order active
World.

## Category Rules
The reward rule engine (spec section 28). Each rule: a field source (`priority`, `type`,
`group`, `form`, `tags`, `custom_field` + key, `status`), an operator (`equals`,
`contains`, `in`, `gte`, `lte`), a match value, a difficulty label, and XP/coin rewards.
Rules are evaluated in `priority` order (lowest first); the first match wins. Disabling a
rule (rather than deleting it) keeps history intact. Changes apply to the *next* ticket
synced or simulated - nothing needs a restart.

## CSV Import
Preview then commit a ticket export. See [`CSV_IMPORT.md`](CSV_IMPORT.md).

## Providers & Sync
See which `TicketDataProvider`s are configured, pick the active one, and trigger a manual
or full sync. `SyncState` per provider shows the last run time/status/error and the
incremental cursor.

## Grant / Remove / Reset
- **Grant XP/Coins**: adds to a specific employee's character, logged as `ADMIN_GRANT`.
- **Remove XP/Coins**: subtracts (never below 0), logged as `ADMIN_REMOVE`.
- **Reset Character**: wipes XP, coins, level, stats, inventory, equipped items,
  achievements and quest progress back to defaults and re-places them in the starting
  world. Confirms before running - this cannot be undone.

Every one of these actions is also written to `AdminAction` (see Audit Log).

## Game Settings
- **Level Curve**: `baseXp` and `growth` - XP required for level *N* is
  `baseXp × growth^(N-1)`. Changing this recomputes everyone's level live (level is
  derived from lifetime XP on every read, not stored as the source of truth).
- **Reopen Policy**: what happens when a solved ticket is reopened and solved again -
  `ignore` (default, blocks farming), `new_completion` (rewards again), or
  `manual_review` (recorded but not auto-rewarded).
- **Feature Flags**: `browserCapture`, `teamEvents`, `soundDefaultOn`.
- **Leaderboard Settings**: hide the leaderboard entirely, or toggle whether display
  names (default) vs. legal names are shown - the goal is never to make it a shaming tool.

Monsters, shop items, achievements, quests and worlds also have list/update endpoints
under `/api/admin/{monsters,items,achievements,quests,worlds}` for further content tuning
beyond what's exposed in the current Admin UI tabs (e.g. `PUT /api/admin/monsters/:id`
to rebalance HP/attack/rewards, `PUT /api/admin/items/:id` to change shop prices).

## Audit Log
Two views: **Reward Transactions** (every XP/coin change, ever - ticket, combat, quest,
achievement, shop purchase, admin grant/remove - each with a unique transaction ID) and
**Admin Actions** (every admin-initiated mutation, with a JSON payload of what changed).
This is the source of truth for any "why does this person have X XP" dispute.
# Administração de usuários

Na aba **Administrar usuários**, busque e selecione uma conta. Informe o motivo da correção para habilitar as ações:

- Corrigir nome, email e ID do usuário no Zendesk.
- Adicionar ou remover XP e moedas, ou definir saldos exatos.
- Definir um nível: o servidor calcula o XP necessário usando a curva atual.
- Reiniciar apenas o nível: zera XP, preservando moedas, inventário, conquistas e combates.
- Reiniciar o personagem completo: também zera moedas/atributos e remove inventário, combates, conquistas e missões. O histórico de tickets e a liberação coletiva permanecem.

As correções de cadastro/saldo registram antes/depois e administrador responsável na auditoria. Ajustes de XP/moedas também geram lançamentos no histórico de recompensas. Tickets antigos não se tornam elegíveis a uma nova recompensa após um reset.

Os novos testes administrativos não usam banco: `npm run test --workspace=apps/backend -- --config vitest.admin.config.ts`.
