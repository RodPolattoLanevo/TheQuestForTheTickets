import type { LevelCurveConfig } from "@hunt/shared";

export const DEFAULT_LEVEL_CURVE: LevelCurveConfig = { baseXp: 100, growth: 1.18 };

/** XP required to go from `level` to `level + 1`. */
export function xpToReachNextLevel(level: number, config: LevelCurveConfig = DEFAULT_LEVEL_CURVE): number {
  return Math.round(config.baseXp * Math.pow(config.growth, level - 1));
}

export interface LevelProgress {
  level: number;
  totalXp: number;
  xpIntoLevel: number;
  xpForNextLevel: number;
  xpToNextLevel: number;
}

/**
 * Derives level + progress-bar values from a character's cumulative lifetime XP.
 * Levels are computed on the fly (not stored redundantly) so changing the curve
 * in game.config / Admin UI takes effect immediately for everyone.
 */
export function computeLevelProgress(totalXp: number, config: LevelCurveConfig = DEFAULT_LEVEL_CURVE): LevelProgress {
  let level = 1;
  let remaining = Math.max(0, totalXp);

  // Safety cap: prevents a runaway loop if config is misconfigured (e.g. growth <= 0).
  for (let i = 0; i < 1000; i++) {
    const needed = xpToReachNextLevel(level, config);
    if (remaining < needed) {
      return {
        level,
        totalXp,
        xpIntoLevel: remaining,
        xpForNextLevel: needed,
        xpToNextLevel: needed - remaining,
      };
    }
    remaining -= needed;
    level += 1;
  }

  const needed = xpToReachNextLevel(level, config);
  return { level, totalXp, xpIntoLevel: remaining, xpForNextLevel: needed, xpToNextLevel: needed - remaining };
}
