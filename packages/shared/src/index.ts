// Shared types/DTOs used by the backend, web app and Chrome extension.
// Keeping these in one package means the API contract can't silently drift
// between server and clients.

export type TicketStatus = "new" | "open" | "pending" | "hold" | "solved" | "closed";

export type TicketEventType = "solved" | "reopened" | "updated";

/**
 * Normalized shape every TicketDataProvider must emit, regardless of where the
 * raw data came from (Zendesk API, CSV, webhook payload, Google Sheet row...).
 */
export interface RawTicket {
  /** Ticket ID as known by the source system (Zendesk ticket ID, CSV ticket_id, ...) */
  externalId: string;
  /** Identifies who completed the ticket in the source system (email, Zendesk user id, agent name) */
  employeeExternalId: string;
  status: TicketStatus;
  /** Arbitrary source fields (priority, type, group, form, tags, custom fields...) used by the rule engine */
  fields: Record<string, unknown>;
  /** When the source system last updated this ticket */
  updatedAt: string;
  /** Optional explicit event id for dedupe, if the source provides one (e.g. webhook delivery id) */
  eventId?: string;
}

/**
 * There is no manual "Attack" action - closing a ticket IS the attack. Every ticket that
 * grants a reward also lands exactly one combat round against the character's current
 * monster, and this is what that round produced (for UI feedback: damage numbers, crits,
 * a defeated-monster moment, etc).
 */
export interface TicketCombatOutcome {
  ticketExternalId: string;
  /** false when the character has no active monster (e.g. every configured world is cleared) */
  attacked: boolean;
  monsterName?: string;
  damageDealt?: number;
  isCritical?: boolean;
  monsterDefeated?: boolean;
  monsterHpRemaining?: number;
  bossDefeated?: boolean;
  leveledUp?: boolean;
  levelBefore?: number;
  levelAfter?: number;
  /** The region's shared liberation meter (0-100) after this hit - everyone deployed there contributes to the same number. */
  regionLiberationPct?: number;
}

export interface UnlockedAchievementSummary {
  key: string;
  name: string;
  xpReward: number;
  coinsReward: number;
}

export interface ProviderSyncResult {
  provider: string;
  ticketsSeen: number;
  eventsCreated: number;
  rewardsGranted: number;
  cursor?: string | null;
  errors: string[];
  combatOutcomes: TicketCombatOutcome[];
  unlockedAchievements: UnlockedAchievementSummary[];
}

export type FieldSource = "type" | "group" | "form" | "tags" | "priority" | "custom_field" | "status";
export type RuleOperator = "equals" | "contains" | "in" | "gte" | "lte";

export interface CategoryRule {
  id: string;
  name: string;
  fieldSource: FieldSource;
  fieldKey?: string | null;
  operator: RuleOperator;
  value: unknown;
  difficulty: string;
  xp: number;
  coins: number;
  priority: number;
  active: boolean;
}

export type ReopenPolicy = "ignore" | "new_completion" | "manual_review";

export interface LevelCurveConfig {
  baseXp: number;
  growth: number;
}

export interface FeatureFlags {
  browserCapture: boolean;
  teamEvents: boolean;
  soundDefaultOn: boolean;
}

export interface CombatFormulaInput {
  attackerAttack: number;
  attackerCrit: number; // 0..1 chance
  attackerLuck: number;
  defenderDefense: number;
}

export interface CombatFormulaResult {
  damage: number;
  isCritical: boolean;
}

export const DIFFICULTY_ORDER = ["simple", "medium", "hard", "critical", "legendary"] as const;
export type Difficulty = (typeof DIFFICULTY_ORDER)[number] | string;
