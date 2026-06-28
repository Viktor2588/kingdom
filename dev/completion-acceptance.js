/* Headless Phase-46 acceptance: deterministic 100% completion run. */
import "../js/data-tables.js";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";
import "../js/systems-bestiary.js";
import "../js/systems-combat.js";
import "../js/systems-skirmish.js";
import "../js/systems-siege.js";
import "../js/systems-battle.js";
import "../js/systems-contracts.js";
import "../js/systems-specializations.js";
import "../js/systems-bosses.js";
import "../js/achievements.js";
import "../js/completion-planner.js";
import "../js/systems-chronicle.js";

const GD = globalThis.GameData;
const GST = globalThis.GameState;
const SYS = globalThis.GameSystems;
const ACH = globalThis.GameAchievements;
const PLAN = globalThis.GameCompletionPlanner;

const originalRandom = Math.random;
let randomSeed = 42;
Math.random = function () {
  randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
  return randomSeed / 4294967296;
};
const state = GST.createDefault();
state.completion.enabled = true;
state.completion.target = "all";
state.echoes.seed = 1;
SYS.syncUnlocks(state);
try {
  for (let i = 0; i < 12000; i++) {
    SYS.autoPlayStep(state);
    SYS.tick(state);
    if (ACH.unlockedCount(state) === ACH.total() && state.seenSpecies.length === GD.creatures.length) break;
  }
} finally {
  Math.random = originalRandom;
}

PLAN.status(state);
const result = {
  tick: state.tick,
  achievements: PLAN.snapshot(state).achievements,
  bestiary: PLAN.snapshot(state).bestiary,
  usedCapacity: SYS.usedCapacity(state),
  capacity: SYS.capacity(state),
  diagnostic: state.completion.diagnostic
};
console.log(JSON.stringify(result));

const complete = result.achievements.done === result.achievements.total
  && result.bestiary.done === result.bestiary.total
  && result.usedCapacity <= result.capacity
  && result.diagnostic == null;
if (!complete) process.exit(1);
