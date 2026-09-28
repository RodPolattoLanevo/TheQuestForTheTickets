import { describe, expect, it } from "vitest";
import { computeLevelProgress, xpToReachNextLevel, DEFAULT_LEVEL_CURVE } from "../src/leveling.js";

describe("leveling", () => {
  it("starts at level 1 with 0 xp", () => {
    const p = computeLevelProgress(0);
    expect(p.level).toBe(1);
    expect(p.xpIntoLevel).toBe(0);
  });

  it("levels up exactly at the threshold", () => {
    const needed = xpToReachNextLevel(1, DEFAULT_LEVEL_CURVE);
    const p = computeLevelProgress(needed);
    expect(p.level).toBe(2);
    expect(p.xpIntoLevel).toBe(0);
  });

  it("does not level up one xp short of the threshold", () => {
    const needed = xpToReachNextLevel(1, DEFAULT_LEVEL_CURVE);
    const p = computeLevelProgress(needed - 1);
    expect(p.level).toBe(1);
  });

  it("is monotonic: more xp never decreases level", () => {
    let prevLevel = 1;
    for (let xp = 0; xp <= 20000; xp += 137) {
      const { level } = computeLevelProgress(xp);
      expect(level).toBeGreaterThanOrEqual(prevLevel);
      prevLevel = level;
    }
  });

  it("respects a custom curve config", () => {
    const config = { baseXp: 50, growth: 1.0 };
    const p = computeLevelProgress(50, config);
    expect(p.level).toBe(2);
  });
});
