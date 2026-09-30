import { beforeEach, expect, it, vi } from "vitest";

const { prisma, tx } = vi.hoisted(() => {
  const tx = { $queryRaw: vi.fn(), character: { findUniqueOrThrow: vi.fn(), update: vi.fn() }, rewardTransaction: { create: vi.fn() } };
  return { tx, prisma: { $transaction: vi.fn() } };
});
vi.mock("@hunt/database", () => ({ getPrismaClient: () => prisma }));
vi.mock("../src/engine/gameConfig.js", () => ({ getLevelCurve: async () => ({ baseXp: 100, growth: 1.18 }) }));
import { grantReward } from "../src/engine/rewards.js";

beforeEach(() => {
  vi.clearAllMocks();
  prisma.$transaction.mockImplementation(async (work) => work(tx));
  tx.character.findUniqueOrThrow.mockResolvedValue({ xp: 25, coins: 10 });
  tx.rewardTransaction.create.mockResolvedValue({ id: "reward" });
});
it("locks the balance before reading and records only the amount actually removed", async () => {
  const result = await grantReward({ userId: "user", source: "ADMIN_REMOVE", xp: -100, coins: -50 });
  expect(tx.$queryRaw.mock.invocationCallOrder[0]).toBeLessThan(tx.character.findUniqueOrThrow.mock.invocationCallOrder[0]);
  expect(tx.rewardTransaction.create).toHaveBeenCalledWith({ data: expect.objectContaining({ xp: -25, coins: -10 }) });
  expect(result).toMatchObject({ xp: -25, coins: -10, totalXp: 0, totalCoins: 0, levelAfter: 1 });
});
it("adds XP and coins and recalculates the level", async () => {
  const result = await grantReward({ userId: "user", source: "ADMIN_GRANT", xp: 100, coins: 20 });
  expect(result).toMatchObject({ xp: 100, coins: 20, totalXp: 125, totalCoins: 30, levelAfter: 2 });
});
