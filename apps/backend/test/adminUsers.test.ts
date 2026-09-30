import { beforeEach, describe, expect, it, vi } from "vitest";
import express from "express";
import "express-async-errors";
import request from "supertest";

const { prisma, tx } = vi.hoisted(() => {
  const tx = {
    user: { findUnique: vi.fn(), update: vi.fn() },
    character: { update: vi.fn() },
    rewardTransaction: { create: vi.fn() },
    adminAction: { create: vi.fn() },
  };
  return { tx, prisma: { $transaction: vi.fn() } };
});
vi.mock("@hunt/database", () => ({ getPrismaClient: () => prisma }));
vi.mock("../src/engine/gameConfig.js", () => ({
  getLevelCurve: vi.fn(async () => ({ baseXp: 100, growth: 1.18 })),
  getActiveCategoryRules: vi.fn(), getFeatureFlags: vi.fn(), getReopenPolicy: vi.fn(), setSetting: vi.fn(),
}));
import { adminRouter } from "../src/routes/admin.js";
import { signToken } from "../src/auth/jwt.js";

const app = express();
app.use(express.json());
app.use("/api/admin", adminRouter);
const admin = `Bearer ${signToken({ sub: "admin", role: "ADMIN" })}`;
const employee = `Bearer ${signToken({ sub: "employee", role: "EMPLOYEE" })}`;

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (work) => work(tx));
  tx.user.findUnique.mockResolvedValue({ id: "user", email: "a@test.local", displayName: "Agent", zendeskUserId: null, character: { id: "character", xp: 200, coins: 50, level: 2 } });
  tx.user.update.mockResolvedValue({ displayName: "Agent", email: "a@test.local", zendeskUserId: null });
});

describe("admin user corrections", () => {
  it("requires an administrator", async () => {
    expect((await request(app).put("/api/admin/users/user").send({ xp: 0, reason: "Correction" })).status).toBe(401);
    expect((await request(app).put("/api/admin/users/user").set("Authorization", employee).send({ xp: 0, reason: "Correction" })).status).toBe(403);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("rejects ambiguous, negative and unexplained corrections", async () => {
    for (const body of [{ xp: 1, level: 2, reason: "Correction" }, { xp: -1, reason: "Correction" }, { xp: 0, reason: " " }, { reason: "Correction" }]) {
      expect((await request(app).put("/api/admin/users/user").set("Authorization", admin).send(body)).status).toBe(400);
    }
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
  it("resets only the level and records the actual XP removal and before/after", async () => {
    const res = await request(app).put("/api/admin/users/user").set("Authorization", admin).send({ level: 1, reason: "Wrong import" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ xp: 0, coins: 50, level: 1 });
    expect(tx.character.update).toHaveBeenCalledWith({ where: { id: "character" }, data: { xp: 0, coins: 50, level: 1 } });
    expect(tx.rewardTransaction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ xp: -200, coins: 0, source: "ADMIN_REMOVE", actorUserId: "admin" }) });
    const audit = JSON.parse(tx.adminAction.create.mock.calls[0][0].data.payload);
    expect(audit.before.xp).toBe(200);
    expect(audit.after.xp).toBe(0);
    expect(audit.reason).toBe("Wrong import");
  });
  it("records mixed XP/coin corrections as separate ledger entries", async () => {
    expect((await request(app).put("/api/admin/users/user").set("Authorization", admin).send({ xp: 100, coins: 80, reason: "Balance correction" })).status).toBe(200);
    expect(tx.rewardTransaction.create.mock.calls.map(([v]) => v.data)).toEqual([
      expect.objectContaining({ source: "ADMIN_GRANT", xp: 0, coins: 30 }),
      expect.objectContaining({ source: "ADMIN_REMOVE", xp: -100, coins: 0 }),
    ]);
  });
  it("does not write reward entries for profile-only corrections", async () => {
    expect((await request(app).put("/api/admin/users/user").set("Authorization", admin).send({ displayName: "Corrected", reason: "Typo" })).status).toBe(200);
    expect(tx.user.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ displayName: "Corrected" }) }));
    expect(tx.rewardTransaction.create).not.toHaveBeenCalled();
  });
  it("returns missing-user, duplicate-email and concurrency errors", async () => {
    tx.user.findUnique.mockResolvedValueOnce(null);
    expect((await request(app).put("/api/admin/users/missing").set("Authorization", admin).send({ xp: 0, reason: "Correction" })).status).toBe(404);
    for (const code of ["P2002", "P2034"]) {
      prisma.$transaction.mockRejectedValueOnce({ code });
      expect((await request(app).put("/api/admin/users/user").set("Authorization", admin).send({ xp: 0, reason: "Correction" })).status).toBe(409);
    }
  });
});
