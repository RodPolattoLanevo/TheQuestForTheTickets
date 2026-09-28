import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { getPrismaClient } from "@hunt/database";
import { createApp } from "../src/app.js";

const prisma = getPrismaClient();
const app = createApp();

describe("full gameplay loop: mock ticket -> reward -> level -> combat -> victory -> loot -> achievement", () => {
  let adminToken: string;
  let employeeToken: string;
  let employeeUserId: string;
  let worldId: string;

  beforeAll(async () => {
    // Minimal fixtures - deliberately not using the full seed script so this test stays
    // fast and self-contained. The monster starts with a lot of HP (1000) so early tickets
    // in this test chip away at it without landing the killing blow - that keeps the
    // ticket-only reward assertions below clean and predictable. A later test drops its HP
    // to 1 directly to deterministically trigger a kill.
    const world = await prisma.world.create({ data: { key: "e2e-world", name: "E2E World", description: "test", order: 1, xpRequirement: 0 } });
    worldId = world.id;
    await prisma.stage.create({ data: { worldId: world.id, key: "main", name: "Main", order: 1 } });
    await prisma.monster.create({
      data: { key: "e2e-slime", name: "Test Slime", description: "test", level: 1, hp: 1000, attack: 1, defense: 0, xpReward: 40, coinReward: 20, worldId: world.id },
    });
    await prisma.ticketCategoryRule.create({
      data: { name: "E2E Urgent", fieldSource: "priority", operator: "equals", value: JSON.stringify("urgent"), difficulty: "critical", xp: 200, coins: 100, priority: 1, active: true },
    });
    await prisma.achievement.create({
      data: { key: "e2e-first-blood", name: "First Blood", description: "Complete your first ticket.", criteria: JSON.stringify({ type: "tickets_completed", target: 1 }), xpReward: 0, coinsReward: 15 },
    });

    const adminRes = await request(app).post("/api/auth/register").send({ email: "e2e-admin@test.local", password: "password123", displayName: "E2E Admin" });
    expect(adminRes.status).toBe(201);
    expect(adminRes.body.user.role).toBe("ADMIN");
    adminToken = adminRes.body.token;

    const empRes = await request(app).post("/api/auth/register").send({ email: "e2e-employee@test.local", password: "password123", displayName: "E2E Employee" });
    expect(empRes.status).toBe(201);
    expect(empRes.body.user.role).toBe("EMPLOYEE");
    employeeToken = empRes.body.token;
    employeeUserId = empRes.body.user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("starts the employee at level 1 with 0 xp and assigned to the starting world", async () => {
    const res = await request(app).get("/api/me").set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.level).toBe(1);
    expect(res.body.xp).toBe(0);
    expect(res.body.world.id).toBe(worldId);
  });

  it("rejects requests with no auth token", async () => {
    const res = await request(app).get("/api/me");
    expect(res.status).toBe(401);
  });

  let xpAfterTicket = 0;
  let coinsAfterTicket = 0;

  it("simulating a mock ticket grants XP and coins through the real reward pipeline, and automatically lands a hit on the current monster", async () => {
    const res = await request(app)
      .post("/api/dev/simulate-ticket")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ priority: "urgent" });

    expect(res.status).toBe(200);
    expect(res.body.syncResult.rewardsGranted).toBe(1);
    expect(res.body.character.xp).toBe(200);
    // 100 base coins from the ticket + 15 from the First Blood achievement, which unlocks
    // synchronously as part of the same reward-pipeline call (ticketsCompleted just hit 1).
    expect(res.body.character.coins).toBe(115);
    xpAfterTicket = res.body.character.xp;
    coinsAfterTicket = res.body.character.coins;

    // There's no "Attack" button - closing the ticket itself throws a punch. The 1000 HP
    // slime survives it, so no combat reward is granted yet, but the hit itself must show up.
    const combat = res.body.syncResult.combatOutcomes[0];
    expect(combat.attacked).toBe(true);
    expect(combat.damageDealt).toBeGreaterThan(0);
    expect(combat.monsterDefeated).toBe(false);

    const tx = await prisma.rewardTransaction.findFirst({ where: { userId: employeeUserId, source: "ZENDESK_TICKET" } });
    expect(tx?.xp).toBe(200);
    expect(tx?.category).toBe("critical");
  });

  it("does not re-reward the exact same ticket if synced again (idempotency)", async () => {
    // Re-running sync with an empty mock queue must not touch existing tickets/rewards.
    const res = await request(app).post("/api/dev/simulate-ticket").set("Authorization", `Bearer ${employeeToken}`).send({ priority: "low", externalId: "DUPLICATE-1" });
    expect(res.status).toBe(200);

    const before = await prisma.rewardTransaction.count({ where: { userId: employeeUserId } });

    // Simulate the *same* external ticket id solving again without a status change in between.
    const dupAgain = await request(app)
      .post("/api/dev/simulate-ticket")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ priority: "low", externalId: "DUPLICATE-1" });
    expect(dupAgain.status).toBe(200);
    expect(dupAgain.body.syncResult.rewardsGranted).toBe(0);
    // A no-op resync must not throw a second punch either.
    expect(dupAgain.body.syncResult.combatOutcomes).toHaveLength(0);

    const after = await prisma.rewardTransaction.count({ where: { userId: employeeUserId } });
    expect(after).toBe(before);
  });

  it("unlocked the First Blood achievement and granted its coin reward", async () => {
    const res = await request(app).get("/api/achievements").set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(200);
    const firstBlood = res.body.find((a: { key: string }) => a.key === "e2e-first-blood");
    expect(firstBlood.unlockedAt).not.toBeNull();
  });

  it("closing the ticket that lands the finishing blow defeats the monster and grants combat rewards", async () => {
    // Force the monster down to 1 HP, as if many prior tickets had already worn it down -
    // combat always deals at least 1 damage (see packages/game-engine combat tests), so the
    // next ticket's automatic hit is guaranteed to land the kill.
    const character = await prisma.character.findUniqueOrThrow({ where: { userId: employeeUserId } });
    const session = await prisma.combatSession.findFirstOrThrow({ where: { characterId: character.id, status: "IN_PROGRESS" } });
    await prisma.combatSession.update({ where: { id: session.id }, data: { monsterHp: 1 } });

    const before = await request(app).get("/api/me").set("Authorization", `Bearer ${employeeToken}`);
    const coinsBefore = before.body.coins;
    const xpBefore = before.body.xp;

    const res = await request(app)
      .post("/api/dev/simulate-ticket")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ priority: "low", externalId: "FINISH-THE-SLIME" });

    expect(res.status).toBe(200);
    const combat = res.body.syncResult.combatOutcomes[0];
    expect(combat.attacked).toBe(true);
    expect(combat.monsterDefeated).toBe(true);
    expect(combat.monsterName).toBe("Test Slime");

    // The ticket itself pays the low-priority fallback (10 xp / 5 coins - "low" doesn't match
    // the seeded urgent-only rule); the monster kill pays its own reward on top (40 xp / >=20
    // coins, monster.xpReward/coinReward from the fixture).
    expect(res.body.character.xp).toBe(xpBefore + 10 + 40);
    expect(res.body.character.coins).toBeGreaterThanOrEqual(coinsBefore + 5 + 20);

    const combatTx = await prisma.rewardTransaction.findFirst({ where: { userId: employeeUserId, source: "COMBAT" } });
    expect(combatTx?.xp).toBe(40);
  });

  it("persists everything: a fresh /api/me reflects the combined ticket + combat rewards", async () => {
    const res = await request(app).get("/api/me").set("Authorization", `Bearer ${employeeToken}`);
    expect(res.body.xp).toBe(
      xpAfterTicket +
        10 /* DUPLICATE-1 low-priority fallback ticket */ +
        10 /* FINISH-THE-SLIME low-priority fallback ticket */ +
        40 /* combat kill reward */
    );
    expect(res.body.coins).toBeGreaterThanOrEqual(coinsAfterTicket + 5 + 5 + 20);
  });

  it("admin can grant/remove XP and coins directly, fully logged", async () => {
    const grant = await request(app)
      .post("/api/admin/grant")
      .set("Authorization", `Bearer ${adminToken}`)
      .send({ userId: employeeUserId, xp: 50, coins: 25, reason: "e2e test grant" });
    expect(grant.status).toBe(200);
    expect(grant.body.xp).toBe(50);

    const log = await request(app).get("/api/admin/audit-log/admin-actions").set("Authorization", `Bearer ${adminToken}`);
    expect(log.body.some((a: { actionType: string }) => a.actionType === "grant")).toBe(true);
  });

  it("a non-admin cannot access the admin panel", async () => {
    const res = await request(app).get("/api/admin/overview").set("Authorization", `Bearer ${employeeToken}`);
    expect(res.status).toBe(403);
  });

  it("changing a category rule's reward changes what the next simulated ticket pays out", async () => {
    const rules = await request(app).get("/api/admin/category-rules").set("Authorization", `Bearer ${adminToken}`);
    const rule = rules.body.find((r: { name: string }) => r.name === "E2E Urgent");

    await request(app).put(`/api/admin/category-rules/${rule.id}`).set("Authorization", `Bearer ${adminToken}`).send({ xp: 999, coins: 999 });

    const before = await request(app).get("/api/me").set("Authorization", `Bearer ${employeeToken}`);
    const sim = await request(app)
      .post("/api/dev/simulate-ticket")
      .set("Authorization", `Bearer ${employeeToken}`)
      .send({ priority: "urgent", externalId: "AFTER-RULE-CHANGE" });

    // The world's only monster is already dead and no further world is configured in this
    // fixture, so this ticket shouldn't throw a punch at anything - xp should be exactly the
    // new rule's reward, with no combat bonus mixed in.
    expect(sim.body.syncResult.combatOutcomes[0].attacked).toBe(false);
    expect(sim.body.character.xp).toBe(before.body.xp + 999);
  });

  describe("browser capture ingestion (Chrome extension content script)", () => {
    it("is rejected while the feature flag is off (the default)", async () => {
      const res = await request(app)
        .post("/api/browser-capture/ingest")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ tickets: [{ ticketId: "BC-1", status: "solved", priority: "urgent" }] });
      expect(res.status).toBe(403);
    });

    it("rewards a captured ticket once enabled, matched by its group, and always attributes it to the caller's own account", async () => {
      await prisma.ticketCategoryRule.create({
        data: { name: "E2E Group Rule", fieldSource: "group", operator: "equals", value: JSON.stringify("BR Support LVL2"), difficulty: "medium", xp: 60, coins: 30, priority: 5, active: true },
      });
      await request(app).put("/api/admin/feature-flags").set("Authorization", `Bearer ${adminToken}`).send({ browserCapture: true, teamEvents: true, soundDefaultOn: false });

      const before = await request(app).get("/api/me").set("Authorization", `Bearer ${employeeToken}`);

      const res = await request(app)
        .post("/api/browser-capture/ingest")
        .set("Authorization", `Bearer ${employeeToken}`)
        // A malicious/buggy client claiming to be someone else must be ignored entirely -
        // the route only ever uses the caller's own authenticated identity.
        .send({ tickets: [{ ticketId: "BC-2", status: "solved", group: "BR Support LVL2", employeeEmail: "someone-else@test.local" }] });

      expect(res.status).toBe(200);
      expect(res.body.rewardsGranted).toBe(1);

      const after = await request(app).get("/api/me").set("Authorization", `Bearer ${employeeToken}`);
      expect(after.body.xp).toBe(before.body.xp + 60);

      const tx = await prisma.rewardTransaction.findFirst({ where: { userId: employeeUserId, provider: "browser-capture" } });
      expect(tx?.xp).toBe(60);

      await request(app).put("/api/admin/feature-flags").set("Authorization", `Bearer ${adminToken}`).send({ browserCapture: false, teamEvents: true, soundDefaultOn: false });
    });
  });

  describe("region liberation (Helldivers-style shared regional progress)", () => {
    it("accumulates across different players deployed to the same region, and gates deployment by XP", async () => {
      const region = await prisma.world.create({
        data: { key: "e2e-region", name: "E2E Region", description: "test", order: 99, xpRequirement: 1_000_000, liberationTarget: 100 },
      });
      await prisma.stage.create({ data: { worldId: region.id, key: "main", name: "Main", order: 1 } });
      // Very tanky monster - nobody should land a killing blow in this test, so every hit
      // is purely about the shared liberation number, not individual combat rewards.
      await prisma.monster.create({
        data: { key: "e2e-region-guardian", name: "Region Guardian", description: "test", level: 1, hp: 1_000_000, attack: 1, defense: 0, xpReward: 999, coinReward: 999, worldId: region.id },
      });

      // Locked - the employee hasn't reached the (deliberately absurd) XP requirement yet.
      const lockedDeploy = await request(app).post(`/api/worlds/${region.id}/deploy`).set("Authorization", `Bearer ${employeeToken}`);
      expect(lockedDeploy.status).toBe(403);

      // Unlock it for this test, then deploy two independent players there.
      await prisma.world.update({ where: { id: region.id }, data: { xpRequirement: 0 } });

      const emp2Res = await request(app).post("/api/auth/register").send({ email: "e2e-employee-2@test.local", password: "password123", displayName: "E2E Employee 2" });
      expect(emp2Res.status).toBe(201);
      const employee2Token = emp2Res.body.token;

      const deploy1 = await request(app).post(`/api/worlds/${region.id}/deploy`).set("Authorization", `Bearer ${employeeToken}`);
      expect(deploy1.status).toBe(200);
      const deploy2 = await request(app).post(`/api/worlds/${region.id}/deploy`).set("Authorization", `Bearer ${employee2Token}`);
      expect(deploy2.status).toBe(200);

      const worldsBefore = await request(app).get("/api/worlds").set("Authorization", `Bearer ${employeeToken}`);
      const regionBefore = worldsBefore.body.find((w: { id: string }) => w.id === region.id);
      expect(regionBefore.liberationPct).toBe(0);
      expect(regionBefore.isCurrent).toBe(true);

      // Player 1 closes a ticket - contributes to the shared meter.
      const sim1 = await request(app)
        .post("/api/dev/simulate-ticket")
        .set("Authorization", `Bearer ${employeeToken}`)
        .send({ priority: "low", externalId: "REGION-1" });
      const pctAfterPlayer1 = sim1.body.syncResult.combatOutcomes[0].regionLiberationPct;
      expect(pctAfterPlayer1).toBeGreaterThan(0);

      // Player 2, a completely different account, closes a ticket in the *same* region -
      // the meter must keep climbing from player 1's contribution, not reset per-player.
      const sim2 = await request(app)
        .post("/api/dev/simulate-ticket")
        .set("Authorization", `Bearer ${employee2Token}`)
        .send({ priority: "low", externalId: "REGION-2" });
      const pctAfterPlayer2 = sim2.body.syncResult.combatOutcomes[0].regionLiberationPct;
      expect(pctAfterPlayer2).toBeGreaterThan(pctAfterPlayer1);

      const worldsAfter = await request(app).get("/api/worlds").set("Authorization", `Bearer ${employee2Token}`);
      const regionAfter = worldsAfter.body.find((w: { id: string }) => w.id === region.id);
      expect(regionAfter.liberationPct).toBe(pctAfterPlayer2);
    });
  });
});
