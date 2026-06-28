/* Headless-Vergleich für Phase 52: deterministische 100%-Runs je Seed. */
import "../js/data-tables.js";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";
import "../js/systems-bestiary.js";
import "../js/systems-combat.js";
import "../js/systems-skirmish.js";
import "../js/systems-siege.js";
import "../js/systems-battle.js";
import "../js/systems-action.js";
import "../js/systems-contracts.js";
import "../js/systems-specializations.js";
import "../js/systems-bosses.js";
import "../js/achievements.js";
import "../js/completion-planner.js";
import "../js/systems-chronicle.js";
import "../js/systems-pacing.js";

const GD = globalThis.GameData;
const GST = globalThis.GameState;
const SYS = globalThis.GameSystems;
const ACH = globalThis.GameAchievements;
const CHR = globalThis.GameChronicle;
const seeds = process.argv.slice(2).map(Number).filter(function (seed) { return Number.isFinite(seed) && seed > 0; });
if (!seeds.length) seeds.push(42, 1337, 2026);

function run(seed) {
  const originalRandom = Math.random;
  let randomSeed = seed >>> 0;
  Math.random = function () {
    randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
    return randomSeed / 4294967296;
  };
  const state = GST.createDefault();
  state.chronicle.seed = seed;
  state.chronicle.runId = "sim_0_" + seed;
  state.echoes.seed = seed;
  state.completion.enabled = true;
  state.completion.target = "all";
  SYS.syncUnlocks(state);
  try {
    for (let tick = 0; tick < 12000 && !CHR.isFullComplete(state); tick++) {
      SYS.autoPlayStep(state);
      SYS.tick(state);
    }
  } finally {
    Math.random = originalRandom;
  }
  if (ACH.unlockedCount(state) !== ACH.total() || state.seenSpecies.length !== GD.creatures.length) {
    throw new Error("Seed " + seed + " erreichte 100 % nicht innerhalb von 12.000 Ticks");
  }
  const summary = CHR.summary(state);
  return {
    seed: seed,
    ticks: summary.ticks,
    deaths: summary.deaths,
    bossAttempts: summary.bossAttempts,
    rarestSpecies: summary.rarestSpecies && summary.rarestSpecies.name
  };
}

const results = seeds.map(run).sort(function (a, b) { return a.ticks - b.ticks; });
console.log(JSON.stringify({ best: results[0], results: results }, null, 2));
