import { describe, expect, it } from "vitest";
import { resolveTicketReward, FALLBACK_REWARD } from "../src/rewardRules.js";
import type { CategoryRule, RawTicket } from "@hunt/shared";

const rules: CategoryRule[] = [
  { id: "1", name: "Simple", fieldSource: "priority", operator: "equals", value: "low", difficulty: "simple", xp: 25, coins: 10, priority: 10, active: true },
  { id: "2", name: "Critical", fieldSource: "priority", operator: "equals", value: "urgent", difficulty: "critical", xp: 200, coins: 100, priority: 40, active: true },
  { id: "3", name: "Tech tag", fieldSource: "tags", operator: "contains", value: "technical", difficulty: "medium", xp: 50, coins: 25, priority: 20, active: true },
  { id: "4", name: "Inactive rule", fieldSource: "priority", operator: "equals", value: "low", difficulty: "legendary", xp: 9999, coins: 9999, priority: 1, active: false },
];

function ticket(overrides: Partial<RawTicket["fields"]>): RawTicket {
  return {
    externalId: "1",
    employeeExternalId: "john",
    status: "solved",
    updatedAt: new Date().toISOString(),
    fields: overrides,
  };
}

describe("resolveTicketReward", () => {
  it("matches an equals rule on priority", () => {
    const result = resolveTicketReward(ticket({ priority: "urgent" }), rules);
    expect(result.difficulty).toBe("critical");
    expect(result.xp).toBe(200);
    expect(result.coins).toBe(100);
  });

  it("matches a contains rule on an array field (tags)", () => {
    const result = resolveTicketReward(ticket({ priority: "normal", tags: ["technical", "vip"] }), rules);
    expect(result.difficulty).toBe("medium");
  });

  it("ignores inactive rules", () => {
    const result = resolveTicketReward(ticket({ priority: "low" }), rules);
    // Should hit rule "1" (active, priority 10), not the inactive legendary rule.
    expect(result.xp).toBe(25);
  });

  it("falls back to the default reward when nothing matches", () => {
    const result = resolveTicketReward(ticket({ priority: "unknown-value" }), rules);
    expect(result).toEqual(FALLBACK_REWARD);
  });

  it("is case-insensitive", () => {
    const result = resolveTicketReward(ticket({ priority: "URGENT" }), rules);
    expect(result.difficulty).toBe("critical");
  });
});
