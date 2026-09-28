import type { CategoryRule, RawTicket, RuleOperator } from "@hunt/shared";

function resolveFieldValue(ticket: RawTicket, rule: CategoryRule): unknown {
  if (rule.fieldSource === "custom_field") {
    return rule.fieldKey ? ticket.fields[rule.fieldKey] : undefined;
  }
  if (rule.fieldSource === "status") return ticket.status;
  return ticket.fields[rule.fieldSource];
}

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function matches(fieldValue: unknown, operator: RuleOperator, ruleValue: unknown): boolean {
  switch (operator) {
    case "equals":
      return normalize(fieldValue) === normalize(ruleValue);
    case "contains": {
      const haystack = Array.isArray(fieldValue) ? fieldValue.map(normalize) : [normalize(fieldValue)];
      return haystack.some((v) => v.includes(normalize(ruleValue)));
    }
    case "in": {
      const list = Array.isArray(ruleValue) ? ruleValue.map(normalize) : [normalize(ruleValue)];
      const values = Array.isArray(fieldValue) ? fieldValue.map(normalize) : [normalize(fieldValue)];
      return values.some((v) => list.includes(v));
    }
    case "gte":
      return Number(fieldValue) >= Number(ruleValue);
    case "lte":
      return Number(fieldValue) <= Number(ruleValue);
    default:
      return false;
  }
}

export interface RewardResolution {
  rule: CategoryRule | null;
  difficulty: string;
  xp: number;
  coins: number;
}

/** Default reward when no configured rule matches a ticket - keeps the pipeline useful pre-configuration. */
export const FALLBACK_REWARD: RewardResolution = { rule: null, difficulty: "unclassified", xp: 10, coins: 5 };

/**
 * Evaluates active category rules (lowest `priority` first) against a raw ticket
 * and returns the first match. Pure function - no DB access - so it's easy to unit test
 * and reused identically by every provider (mock, CSV, Zendesk, webhook, sheets).
 */
export function resolveTicketReward(ticket: RawTicket, rules: CategoryRule[]): RewardResolution {
  const sorted = [...rules].filter((r) => r.active).sort((a, b) => a.priority - b.priority);
  for (const rule of sorted) {
    const fieldValue = resolveFieldValue(ticket, rule);
    if (matches(fieldValue, rule.operator, rule.value)) {
      return { rule, difficulty: rule.difficulty, xp: rule.xp, coins: rule.coins };
    }
  }
  return FALLBACK_REWARD;
}
