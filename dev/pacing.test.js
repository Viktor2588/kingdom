/* dev/pacing.test.js — Phase 53: Action-Dichte und Stall-Gates. */
import { test, expect } from "bun:test";
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

const GS = globalThis.GameState;
const SYS = globalThis.GameSystems;
const GP = globalThis.GamePacing;

function fresh(seed = 42) {
  const state = GS.createDefault();
  state.chronicle.seed = seed;
  state.echoes.seed = seed;
  state.settings.watch = true;
  GP.observe(state);
  return state;
}

function runAuto(seed, ticks, strategy) {
  const state = fresh(seed);
  state.contracts.autoProfile = strategy;
  state.specializations.autoDoctrine = strategy === "collector" ? "monsterzucht" : "adaptive";
  let value = seed >>> 0;
  const originalRandom = Math.random;
  Math.random = function () {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
  try {
    for (let i = 0; i < ticks; i++) {
      SYS.tick(state);
      SYS.autoPlayStep(state);
    }
  } finally {
    Math.random = originalRandom;
  }
  const report = GP.report(state);
  return {
    id: `${seed}-${strategy}`,
    strategy,
    state,
    report,
    score: GP.progressScore(GP.snapshot(state)),
    maxIdle: GP.maxIdleGap(state),
    blockers: report.blockers.filter((entry) => entry.severity === "error")
  };
}

test("Save-v20 besitzt kompakte, defensiv normalisierte Pacing-Daten", () => {
  const dirty = fresh();
  dirty.version = 19;
  dirty.pacing = {
    enabled: "ja", overlay: 1, samples: [{ tick: 1 }, null],
    progressCurve: "kaputt", events: [], actionCounts: { build: -4, combat: "3" },
    stall: { kind: 7, sinceTick: -9, detail: 12 }
  };
  const clean = GS.normalize(JSON.parse(JSON.stringify(dirty)));
  expect(clean.version).toBe(20);
  expect(clean.pacing.enabled).toBe(true);
  expect(clean.pacing.overlay).toBe(true);
  expect(clean.pacing.samples).toHaveLength(1);
  expect(clean.pacing.progressCurve).toEqual([]);
  expect(clean.pacing.actionCounts).toEqual({ build: 0, combat: 3 });
  expect(clean.pacing.stall).toEqual({ kind: "warming_up", sinceTick: 0, detail: "" });
});

test("alle sieben Auslöser erfassen erste Treffer, Abstände und Maximalpause", () => {
  const state = fresh();
  state.tick = 10;
  state.buildings.magieturm++;
  state.metrics.expeditionsWon++;
  state.achievements.push("r_build8");
  state.seenSpecies.push("magieschleim");
  state.bosses.defeated.push("jura_koloss");
  state.metrics.contractsCompleted++;
  state.metrics.crisesResolved++;
  GP.observe(state);
  GP.EVENT_IDS.forEach((id) => expect(state.pacing.events[id].count).toBeGreaterThan(0));

  state.tick = 35;
  state.buildings.magieturm++;
  GP.observe(state);
  expect(state.pacing.events.build.maxGap).toBe(25);
  expect(GP.report(state).events.find((event) => event.id === "build").averageGap).toBe(25);
});

test("Auto-Aktionen werden klassifiziert und Stichproben bleiben begrenzt", () => {
  const state = fresh();
  [
    "🏰 Magieturm Stufe 2.", "⚔️ Expedition gewonnen.", "📚 Forschung: Runen.",
    "⚒️ Klinge geschmiedet.", "📜 Auftrag eingelöst.", "🧬 Goblin entwickelt."
  ].forEach((text) => GP.recordAction(state, { text }));
  expect(state.pacing.actionCounts).toMatchObject({
    build: 1, combat: 1, research: 1, forge: 1, contract: 1, creature: 1
  });
  for (let tick = 60; tick <= 9000; tick += 60) {
    state.tick = tick;
    GP.observe(state);
  }
  expect(state.pacing.samples.length).toBeLessThanOrEqual(120);
  expect(state.pacing.progressCurve.length).toBeLessThanOrEqual(100);
});

test("Stall-Diagnose trennt Sparen, offene Entscheidung und falsche Auto-Priorität", () => {
  const state = fresh();
  state.tick = 200;
  state.pacing.lastMeaningfulTick = 0;
  state.settings.watch = false;
  Object.keys(state.resources).forEach((key) => { state.resources[key] = 0; });
  expect(["saving", "missing_resource"]).toContain(GP.diagnose(state).kind);

  state.activeEvent = globalThis.GameData.events[0].id;
  expect(GP.diagnose(state).kind).toBe("decision_wait");

  state.activeEvent = null;
  Object.keys(state.resources).forEach((key) => { state.resources[key] = 100000; });
  state.settings.watch = true;
  expect(GP.diagnose(state).kind).toBe("wrong_auto_priority");
});

test("hängende Quest, Über-Kapazität, gesperrter Pfad und Completion-Blocker werden sichtbar", () => {
  const state = fresh();
  state.tick = 400;
  state.questProgress = 4;
  state.pacing.lastQuestTick = 0;
  state.metrics.named = 0;
  state.creatures[0].count = 100;
  state.completion.diagnostic = "Erfolg X besitzt keinen erreichbaren Pfad.";
  const kinds = GP.blockers(state).map((entry) => entry.kind);
  expect(kinds).toContain("over_capacity");
  expect(kinds).toContain("quest_stalled");
  expect(kinds).toContain("locked_ui_path");
  expect(kinds).toContain("unsolvable_achievement");
});

test("Report bündelt nächste Bauchance, Aktionsanteile und Fortschrittskurve", () => {
  const state = fresh();
  for (let i = 0; i < 240; i++) {
    SYS.tick(state);
    SYS.autoPlayStep(state);
  }
  const report = GP.report(state);
  expect(report.nextBuild).toBeTruthy();
  expect(report.totalActions).toBeGreaterThan(0);
  expect(report.actions.reduce((sum, entry) => sum + entry.share, 0)).toBeCloseTo(1, 6);
  expect(report.progressCurve.length).toBeGreaterThanOrEqual(3);
});

test("Balance-Gates schlagen bei langen Lücken, unmöglichen Runs und Dominanz an", () => {
  const failed = GP.evaluateRuns([
    { id: "stalled", maxIdle: 500, blockers: [], requireCompletion: false, score: 10, strategy: "safe" },
    { id: "incomplete", maxIdle: 0, blockers: [], requireCompletion: true, completed: false, score: 100, strategy: "aggressive" }
  ], { maxIdle: 360, scoreRatio: 1.8 });
  expect(failed.ok).toBe(false);
  expect(failed.failures.join(" ")).toContain("100 %");
  expect(failed.failures.join(" ")).toContain("Strategiedominanz");
  expect(GP.evaluateRuns([
    { id: "a", maxIdle: 120, blockers: [], score: 100, strategy: "safe" },
    { id: "b", maxIdle: 180, blockers: [], score: 120, strategy: "progress" }
  ]).ok).toBe(true);
});

test("Mehrseed-Langläufe zeigen Fortschrittskurven ohne Quest- oder Kapazitätsregression", () => {
  const runs = [
    runAuto(42, 1800, "safe"),
    runAuto(1337, 1800, "aggressive"),
    runAuto(2026, 1800, "collector")
  ];
  runs.forEach((run) => {
    expect(run.report.progressCurve.length).toBeGreaterThan(10);
    expect(run.report.totalActions).toBeGreaterThan(20);
    expect(run.blockers.map((entry) => entry.kind)).not.toContain("over_capacity");
    expect(run.blockers.map((entry) => entry.kind)).not.toContain("quest_stalled");
  });
  const replay = runAuto(42, 1800, "safe");
  expect(replay.score).toBe(runs[0].score);
  expect(replay.report.events).toEqual(runs[0].report.events);
  expect(GP.evaluateRuns(runs, { maxIdle: 480, scoreRatio: 1.8 }).ok).toBe(true);
});
