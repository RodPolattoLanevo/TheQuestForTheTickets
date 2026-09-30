import { describe, expect, it } from "vitest";
import { computeLevelProgress, totalXpForLevel } from "../src/leveling.js";

describe("admin level corrections", () => {
  it("resets level to 1 with zero XP", () => {
    expect(totalXpForLevel(1)).toBe(0);
  });
  it("converts the chosen level to its exact starting XP for different curves", () => {
    for (const curve of [{ baseXp: 100, growth: 1.18 }, { baseXp: 25, growth: 1 }]) {
      for (const level of [2, 5, 20]) {
        const xp = totalXpForLevel(level, curve);
        expect(computeLevelProgress(xp, curve)).toMatchObject({ level, xpIntoLevel: 0 });
        expect(computeLevelProgress(xp - 1, curve).level).toBe(level - 1);
      }
    }
  });
  it("rejects invalid levels and values outside Postgres integer storage", () => {
    for (const level of [0, -1, 1.5, 1001, 1000]) expect(() => totalXpForLevel(level)).toThrow();
  });
});
