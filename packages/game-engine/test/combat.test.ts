import { describe, expect, it } from "vitest";
import { deriveCombatPower, resolveAttack, resolveCombatRound } from "../src/combat.js";

describe("combat", () => {
  it("derives higher attack from higher strength", () => {
    const weak = deriveCombatPower({ strength: 5, defense: 5, agility: 5, magic: 5, luck: 5 });
    const strong = deriveCombatPower({ strength: 20, defense: 5, agility: 5, magic: 5, luck: 5 });
    expect(strong.attack).toBeGreaterThan(weak.attack);
  });

  it("equipment bonuses add on top of base stats", () => {
    const base = deriveCombatPower({ strength: 5, defense: 5, agility: 5, magic: 5, luck: 5 });
    const withGear = deriveCombatPower({ strength: 5, defense: 5, agility: 5, magic: 5, luck: 5 }, { strength: 10 });
    expect(withGear.attack).toBeGreaterThan(base.attack);
  });

  it("always deals at least 1 damage even against high defense", () => {
    const attacker = deriveCombatPower({ strength: 1, defense: 1, agility: 1, magic: 1, luck: 1 });
    const rng = () => 0.5; // no crit, mid random factor
    const result = resolveAttack(attacker, 9999, rng);
    expect(result.damage).toBeGreaterThanOrEqual(1);
  });

  it("forces a critical hit when rng rolls below crit chance", () => {
    const attacker = deriveCombatPower({ strength: 10, defense: 5, agility: 50, magic: 5, luck: 5 }); // crit chance capped at 0.5
    const rng = () => 0.0; // always "hits" the crit roll
    const result = resolveAttack(attacker, 5, rng);
    expect(result.isCritical).toBe(true);
  });

  it("resolves a full round: player wins outright when monster hp is depleted", () => {
    const player = deriveCombatPower({ strength: 100, defense: 20, agility: 10, magic: 10, luck: 10 });
    const rng = () => 0.5;
    const outcome = resolveCombatRound(player, 100, { hp: 10, attack: 5, defense: 0 }, rng);
    expect(outcome.victory).toBe(true);
    expect(outcome.monsterHpRemaining).toBe(0);
    expect(outcome.monsterDamageDealt).toBe(0); // dead monsters don't counter-attack
  });

  it("monster counter-attacks when it survives the round", () => {
    const player = deriveCombatPower({ strength: 5, defense: 5, agility: 5, magic: 5, luck: 5 });
    const rng = () => 0.5;
    const outcome = resolveCombatRound(player, 100, { hp: 10000, attack: 20, defense: 5 }, rng);
    expect(outcome.victory).toBe(false);
    expect(outcome.monsterDamageDealt).toBeGreaterThan(0);
    expect(outcome.playerHpRemaining).toBeLessThan(100);
  });
});
