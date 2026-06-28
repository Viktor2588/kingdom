/* dev/pacing-report.js — Mehrseed-Dashboard für Phase 53. */
import "../js/data-tables.js";
import "../js/data.js";
import "../js/art-data.js";
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

const seeds = process.argv.slice(2).map(Number).filter(Number.isFinite);
if (!seeds.length) seeds.push(42, 1337, 2026);
const profiles = ["safe", "aggressive", "collector"];
const GS = globalThis.GameState;
const SYS = globalThis.GameSystems;
const GP = globalThis.GamePacing;

function run(seed, profile) {
  const state = GS.createDefault();
  state.chronicle.seed = seed;
  state.echoes.seed = seed;
  state.settings.watch = true;
  state.contracts.autoProfile = profile;
  GP.observe(state);
  let value = seed >>> 0;
  const originalRandom = Math.random;
  Math.random = function () {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
  try {
    for (let i = 0; i < 3600; i++) {
      SYS.tick(state);
      SYS.autoPlayStep(state);
    }
  } finally {
    Math.random = originalRandom;
  }
  const report = GP.report(state);
  return {
    id: `${seed}-${profile}`,
    strategy: profile,
    seed,
    profile,
    tick: state.tick,
    score: GP.progressScore(GP.snapshot(state)),
    maxIdle: GP.maxIdleGap(state),
    blockers: report.blockers.filter((entry) => entry.severity === "error"),
    achievements: state.achievements.length,
    species: state.seenSpecies.length,
    regions: state.claimedRegions.length,
    topActions: report.actions.slice(0, 4).map((entry) => `${entry.id}:${Math.round(entry.share * 100)}%`),
    triggerGaps: Object.fromEntries(report.events.map((event) => [event.id, event.maxGap]))
  };
}

const runs = seeds.map((seed, index) => run(seed, profiles[index % profiles.length]));
const gate = GP.evaluateRuns(runs, { maxIdle: 480, scoreRatio: 1.8 });
console.log(JSON.stringify({ gate, runs }, null, 2));
if (!gate.ok) process.exitCode = 1;
