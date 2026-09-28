import { describe, expect, it } from "vitest";
import { evaluateCriteria, type PlayerProgressStats } from "../src/achievements.js";

const stats: PlayerProgressStats = {
  ticketsCompleted: 12,
  bossesDefeated: 1,
  monstersDefeated: 4,
  level: 6,
  itemsPurchased: 2,
  xpEarnedInPeriod: 340,
};

describe("evaluateCriteria", () => {
  it("marks complete once target is reached", () => {
    const r = evaluateCriteria({ type: "tickets_completed", target: 10 }, stats);
    expect(r.complete).toBe(true);
    expect(r.progress).toBe(12);
  });

  it("marks incomplete below target", () => {
    const r = evaluateCriteria({ type: "level_reached", target: 25 }, stats);
    expect(r.complete).toBe(false);
    expect(r.progress).toBe(6);
  });
});
