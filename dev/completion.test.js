/* dev/completion.test.js — Phase 46 Completion-Autopilot. */
import { test, expect } from "bun:test";
import "../js/data-tables.js";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";
import "../js/systems-combat.js";
import "../js/systems-skirmish.js";
import "../js/systems-siege.js";
import "../js/systems-battle.js";
import "../js/achievements.js";
import "../js/completion-planner.js";

const GD = globalThis.GameData;
const GST = globalThis.GameState;
const SYS = globalThis.GameSystems;
const ACH = globalThis.GameAchievements;
const PLAN = globalThis.GameCompletionPlanner;

function rich(state) {
  GD.resources.forEach(function (resource) { state.resources[resource.id] = 500000; });
  state.buildings.wohnbezirk = 40;
  state.buildings.beschwoerungskreis = 7;
  state.buildings.magieturm = 10;
  state.buildings.seelentempel = 10;
  state.herrscher.level = 100;
  state.herrscher.stage = GD.rulerStages.length - 1;
  return state;
}

test("Completion-Zustand ist save-kompatibel und defensiv normalisiert", () => {
  const state = GST.createDefault();
  expect(state.completion.enabled).toBe(false);
  expect(state.completion.target).toBe("all");

  const dirty = GST.createDefault();
  dirty.completion = { enabled: "ja", target: "kaputt", lastProgressTick: -5, diagnostic: 42 };
  const normalized = GST.normalize(dirty);
  expect(normalized.version).toBe(GST.VERSION);
  expect(normalized.completion.enabled).toBe(true);
  expect(normalized.completion.target).toBe("all");
  expect(normalized.completion.lastProgressTick).toBe(0);
  expect(normalized.completion.diagnostic).toBeNull();
});

test("Zielgraph enthält alternative Evolutionspfade", () => {
  const paths = PLAN.pathsForSpecies("goblin_schamane");
  expect(paths).toContainEqual(["goblin", "hobgoblin", "goblin_schamane"]);
  expect(PLAN.pathsForSpecies("runengolem")).toContainEqual(["lehmgolem", "eisengolem", "runengolem"]);
});

test("jede Evolution ist innerhalb des Levels der Ausgangsform erreichbar", () => {
  GD.creatures.forEach(function (species) {
    (species.evolvesTo || []).forEach(function (evolution) {
      expect(Number(evolution.req && evolution.req.level) || 0).toBeLessThanOrEqual(species.levelCap);
    });
  });
});

test("Bestiarium-Planer wählt gezielt die noch fehlende Verzweigung", () => {
  const state = rich(GST.createDefault());
  state.seenSpecies = GD.creatures.map(function (species) { return species.id; })
    .filter(function (id) { return id !== "goblin_schamane"; });
  const elite = GST.newCreature(state, "hobgoblin");
  elite.named = true;
  elite.name = "Planer";
  elite.level = 25;
  elite.armyGroupId = null;
  state.creatures.push(elite);
  state.completion.enabled = true;
  state.completion.target = "bestiary";

  const action = SYS.autoPlayStep(state);
  expect(action.goal).toEqual({ kind: "bestiary", id: "goblin_schamane", title: "Goblin-Schamane" });
  expect(elite.speciesId).toBe("goblin_schamane");
});

test("Evolutionziele werden zum Leveln in die Armee versetzt", () => {
  const state = rich(GST.createDefault());
  state.seenSpecies = GD.creatures.map(function (species) { return species.id; })
    .filter(function (id) { return id !== "goblin_lord"; });
  const elite = GST.newCreature(state, "hobgoblin");
  elite.named = true;
  elite.name = "Schüler";
  elite.level = 1;
  elite.job = "gold";
  elite.armyGroupId = null;
  state.creatures.push(elite);
  state.completion.enabled = true;
  state.completion.target = "bestiary";

  const action = SYS.autoPlayStep(state);
  expect(action.goal.id).toBe("goblin_lord");
  expect(elite.job).toBe("armee");
});

test("Completion-Modus automatisiert den sonst unerreichbaren Taktik-Erfolg", () => {
  const state = rich(GST.createDefault());
  state.seenSpecies = GD.creatures.map(function (species) { return species.id; });
  state.completion.enabled = true;
  state.completion.target = "achievements";
  state.tick = 6;

  let guard = 500;
  while ((state.metrics.tacticalWins || 0) < 1 && guard-- > 0) {
    SYS.autoPlayStep(state);
    SYS.tick(state);
  }
  expect(state.metrics.tacticalWins).toBeGreaterThanOrEqual(1);
  expect(ACH.progressOf(state, ACH.get("c_tactical10")).cur).toBeGreaterThanOrEqual(1);
});

test("besiegte Rivalen werden bei neuen Angriffen übersprungen", () => {
  const state = GST.createDefault();
  state.rivalsDefeated = ["clayron"];
  const raid = SYS.scheduleRaid(state);
  expect(raid.rivalId).toBe("glacira");
});

test("Stuck-Detection nennt nach 300 Ticks das blockierte Ziel", () => {
  const state = GST.createDefault();
  state.seenSpecies = GD.creatures.map(function (species) { return species.id; })
    .filter(function (id) { return id !== "katastrophendrache"; });
  state.resources = { magie: 0, gold: 0, nahrung: 0, material: 0, seelen: 0, wissen: 0 };
  state.completion.enabled = true;
  state.completion.target = "bestiary";

  PLAN.status(state);
  state.tick = 301;
  const status = PLAN.status(state);
  expect(status.diagnostic).toContain("Katastrophendrache");
});

test("Completion-Langlauf erreicht deterministisch 100 Prozent", () => {
  const run = Bun.spawnSync({
    cmd: [process.execPath, "dev/completion-acceptance.js"],
    cwd: import.meta.dir + "/..",
    stdout: "pipe",
    stderr: "pipe"
  });
  const stdout = new TextDecoder().decode(run.stdout);
  const stderr = new TextDecoder().decode(run.stderr);
  if (run.exitCode !== 0) throw new Error("Completion-Acceptance fehlgeschlagen:\n" + stdout + stderr);
  const result = JSON.parse(stdout);
  expect(result.achievements).toEqual({ done: ACH.total(), total: ACH.total() });
  expect(result.bestiary).toEqual({ done: GD.creatures.length, total: GD.creatures.length });
  expect(result.usedCapacity).toBeLessThanOrEqual(result.capacity);
  expect(result.diagnostic).toBeNull();
});
