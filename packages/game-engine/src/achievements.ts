export interface PlayerProgressStats {
  ticketsCompleted: number;
  bossesDefeated: number;
  monstersDefeated: number;
  level: number;
  itemsPurchased: number;
  xpEarnedInPeriod: number;
}

export interface Criteria {
  type: keyof PlayerProgressStats | "tickets_completed" | "bosses_defeated" | "monsters_defeated" | "level_reached" | "items_purchased" | "xp_earned";
  target: number;
}

const CRITERIA_TO_STAT: Record<string, keyof PlayerProgressStats> = {
  tickets_completed: "ticketsCompleted",
  bosses_defeated: "bossesDefeated",
  monsters_defeated: "monstersDefeated",
  level_reached: "level",
  items_purchased: "itemsPurchased",
  xp_earned: "xpEarnedInPeriod",
};

/** Returns current progress value + whether the criteria is satisfied. Used by both achievements and quests. */
export function evaluateCriteria(criteria: Criteria, stats: PlayerProgressStats): { progress: number; complete: boolean } {
  const statKey = CRITERIA_TO_STAT[criteria.type as string] ?? (criteria.type as keyof PlayerProgressStats);
  const progress = stats[statKey] ?? 0;
  return { progress, complete: progress >= criteria.target };
}
