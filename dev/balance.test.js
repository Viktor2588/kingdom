/* dev/balance.test.js — Automatisierte Balance-Assertions (bun:test).
   Härtet die Heuristiken aus dev/balance.js (reine Konsolenanalyse) zu
   echten Tests, damit Balance-Regressionen in CI auffallen (Phase 29).
   NICHT Teil des Spiels.   Aufruf: bun test dev/balance.test.js        */
import { test, expect } from "bun:test";
import "../js/data-tables.js";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";

const GD = globalThis.GameData, SYS = globalThis.GameSystems;

// Kampfkraft einer Spezies bei Level (benannt, ohne Ausrüstung) — wie balance.js
function speciesPower(sp, level, named) {
  const lf = 1 + 0.05 * (level - 1);
  const nf = named ? 1.12 : 1;
  const stats = {};
  ['lp', 'ang', 'ver', 'mag', 'tmp'].forEach(k => { stats[k] = Math.round(sp.base[k] * lf * nf); });
  let km = 1;
  if (sp.skill && GD.skill(sp.skill)) km += GD.skill(sp.skill).kampf;
  return GD.combatPower(stats, 1, km);
}

test("Kreaturen: @Cap-Kampfkraft je Rang bleibt im engen Band (Spread ≤ 1.6x)", () => {
  const byRank = {};
  GD.creatures.forEach(sp => { (byRank[sp.rank] = byRank[sp.rank] || []).push(speciesPower(sp, sp.levelCap, true)); });
  const bad = [];
  GD.RANKS.forEach(rank => {
    const arr = byRank[rank];
    if (!arr || arr.length < 2) return;
    const spread = Math.max(...arr) / Math.min(...arr);
    if (spread > 1.6) bad.push(rank + ': ' + spread.toFixed(2) + 'x');
  });
  expect(bad).toEqual([]);
});

test("Regionen: Kampfkraft streng steigend, Beute/Tick monoton nicht fallend", () => {
  const perTick = r => { let s = 0; for (const k in r.rewards) s += r.rewards[k]; return s / r.dauer; };
  const powerDrops = [], rateDrops = [];
  for (let i = 1; i < GD.regions.length; i++) {
    if (GD.regions[i].power <= GD.regions[i - 1].power) powerDrops.push(GD.regions[i].id);
    if (perTick(GD.regions[i]) < perTick(GD.regions[i - 1]) - 1e-9) rateDrops.push(GD.regions[i].id);
  }
  expect(powerDrops).toEqual([]);
  expect(rateDrops).toEqual([]);
});

test("Echo-Zyklen: Kraft & Beute steigen, Affixdichte fällt nicht (1 < 3 < 5 < 10)", () => {
  const cycles = [1, 3, 5, 10].map(cycle => {
    const nodes = SYS.generateEchoMap(424242, cycle, 700);
    const powers = nodes.map(n => n.power);
    let reward = 0, affixes = 0;
    nodes.forEach(node => {
      for (const r in node.reward.resources) reward += node.reward.resources[r];
      for (const m in node.reward.forgeMaterials) reward += node.reward.forgeMaterials[m] * 100;
      affixes += node.affixIds.length;
    });
    return {
      cycle,
      avgPower: powers.reduce((a, b) => a + b, 0) / powers.length,
      boss: nodes.find(n => n.boss).power,
      avgReward: reward / nodes.length,
      avgAffix: affixes / nodes.length
    };
  });
  const bad = [];
  for (let i = 1; i < cycles.length; i++) {
    const a = cycles[i - 1], b = cycles[i];
    if (b.avgPower <= a.avgPower) bad.push('Kraft Zyklus ' + b.cycle);
    if (b.boss <= a.boss) bad.push('Boss Zyklus ' + b.cycle);
    if (b.avgReward <= a.avgReward) bad.push('Beute Zyklus ' + b.cycle);
    if (b.avgAffix < a.avgAffix - 1e-9) bad.push('Affixe Zyklus ' + b.cycle);
  }
  expect(bad).toEqual([]);
});
