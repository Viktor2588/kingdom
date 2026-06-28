/* dev/bosses.test.js — Phase 51: Boss-Leiter, Eliten und Trophäen. */
import { test, expect } from "bun:test";
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

const GD = globalThis.GameData;
const GST = globalThis.GameState;
const SYS = globalThis.GameSystems;
const BOSS = globalThis.GameBosses;
const BATTLE = globalThis.GameBattle;
const ACTION = globalThis.GameActionCombat;

function rich(state) {
  GD.resources.forEach(function (resource) { state.resources[resource.id] = 500000; });
  state.buildings.wohnbezirk = 40;
  state.buildings.beschwoerungskreis = 7;
  state.buildings.schmiede = 3;
  state.herrscher.level = 60;
  state.herrscher.stage = 5;
  return state;
}

function champion(state, schoolId) {
  const creature = GST.newCreature(state, "katastrophendrache");
  creature.named = true;
  creature.name = "Bossbrecher";
  creature.level = 100;
  creature.job = "armee";
  creature.armyGroupId = null;
  creature.schoolId = schoolId || "commander";
  state.creatures.push(creature);
  return creature;
}

function endgame(state) {
  rich(state);
  state.claimedRegions = GD.regions.map(function (region) { return region.id; });
  state.metrics.echoBosses = 1;
  state.seenSpecies = GD.creatures.map(function (species) { return species.id; });
  state.achievements = globalThis.GameAchievements.ACHIEVEMENTS.slice(0, 25).map(function (entry) { return entry.id; });
  return state;
}

test("vier Bossprofile besitzen eindeutige Mechaniken, Quellen und exklusive Baupläne", () => {
  expect(BOSS.BOSSES).toHaveLength(4);
  expect(new Set(BOSS.BOSSES.map(function (entry) { return entry.id; })).size).toBe(4);
  expect(new Set(BOSS.BOSSES.map(function (entry) { return entry.mechanic; })).size).toBe(4);
  expect(new Set(BOSS.BOSSES.map(function (entry) { return entry.mastery; })).size).toBe(4);
  expect(new Set(BOSS.BOSSES.map(function (entry) { return entry.hardTactical.stat + ":" + entry.hardAction.stat; })).size).toBe(4);
  expect(new Set(BOSS.BOSSES.map(function (entry) { return entry.source; })).size).toBeGreaterThanOrEqual(3);
  BOSS.BOSSES.forEach(function (entry) {
    expect(GD.region(entry.regionId)).toBeTruthy();
    const recipe = GD.recipe(entry.recipeId);
    expect(recipe).toBeTruthy();
    expect(recipe.unique).toBe(true);
    expect(recipe.bossOnly).toBe(true);
    expect(SYS.canUnlockRecipe(rich(GST.createDefault()), recipe.id).ok).toBe(false);
  });
});

test("jede Meisterschaft verändert ihr Kampfprofil und beschreibt den Modifikator", () => {
  BOSS.BOSSES.forEach(function (entry) {
    const normal = endgame(GST.createDefault());
    const normalHero = champion(normal, entry.counterSchools[0]);
    expect(BOSS.startAction(normal, entry.id, [normalHero.uid], true, false, 55).ok).toBe(true);
    const normalValue = normal.actionBattle.enemies[0][entry.hardAction.stat];

    const hard = endgame(GST.createDefault());
    hard.bosses.defeated = [entry.id];
    const hardHero = champion(hard, entry.counterSchools[0]);
    expect(BOSS.startAction(hard, entry.id, [hardHero.uid], true, true, 55).ok).toBe(true);
    expect(hard.actionBattle.enemies[0][entry.hardAction.stat]).not.toBe(normalValue);
    expect(hard.actionBattle.log.join(" ")).toContain(entry.mastery);
  });
});

test("jedes Bossprofil besitzt einen erreichbaren Auto-Ausgang und eine eigene einmalige Belohnung", () => {
  const state = endgame(GST.createDefault());
  const schools = ["hunter", "mage", "commander", "defender", "smith", "mage", "hunter", "defender"];
  const party = schools.map(function (school) { return champion(state, school).uid; });
  BOSS.BOSSES.forEach(function (entry) {
    expect(BOSS.unlocked(state, entry)).toBe(true);
    const resolved = BOSS.resolveAuto(state, entry.id, party, true, false);
    expect(resolved.ok).toBe(true);
    expect(resolved.won).toBe(true);
    expect(resolved.result.recipe.id).toBe(entry.recipeId);
  });
  expect(new Set(state.unlockedRecipes.filter(function (id) {
    return BOSS.BOSSES.some(function (entry) { return entry.recipeId === id; });
  })).size).toBe(4);

  state.metrics.contractsCompleted = 25;
  state.metrics.contractsFailed = 1;
  expect(BOSS.earnedTrophies(state).some(function (entry) { return entry.id === "contracts_25"; })).toBe(false);
  state.metrics.contractsFailed = 0;
  expect(BOSS.earnedTrophies(state).some(function (entry) { return entry.id === "contracts_25"; })).toBe(true);
});

test("Auto-Auflösung liefert Lernhinweis bei Niederlage und einmalige Beute bei Sieg", () => {
  const weak = GST.createDefault();
  weak.claimedRegions = ["wald", "hoehlen"];
  const weakResult = BOSS.resolveAuto(weak, "jura_koloss", weak.creatures.map(function (c) { return c.uid; }), false, false);
  expect(weakResult.ok).toBe(true);
  expect(weakResult.won).toBe(false);
  expect(weakResult.result.hint).toContain("Feuer");

  const state = rich(GST.createDefault());
  state.claimedRegions = ["wald", "hoehlen"];
  const hero = champion(state, "mage");
  const won = BOSS.resolveAuto(state, "jura_koloss", [hero.uid], true, false);
  expect(won.won).toBe(true);
  expect(state.bosses.defeated).toContain("jura_koloss");
  expect(state.unlockedRecipes).toContain("wurzelbrecher");
  expect(state.bosses.components.herzholz).toBe(1);
  const repeated = BOSS.resolveAuto(state, "jura_koloss", [hero.uid], true, false);
  expect(repeated.won).toBe(true);
  expect(state.unlockedRecipes.filter(function (id) { return id === "wurzelbrecher"; })).toHaveLength(1);
  expect(state.bosses.components.herzholz).toBe(1);
  const mastery = BOSS.resolveAuto(state, "jura_koloss", [hero.uid], true, true);
  expect(mastery.won).toBe(true);
  expect(state.bosses.hardDefeated).toContain("jura_koloss");
  expect(state.bosses.banners).toBe(1);
  expect(state.bosses.components.herzholz).toBe(2);
});

test("Taktik-Adapter baut ein handgefertigtes Bossprofil und wertet über dieselbe Engine aus", () => {
  const state = rich(GST.createDefault());
  state.claimedRegions = ["wald", "hoehlen"];
  const hero = champion(state, "hunter");
  const started = BOSS.startTactical(state, "jura_koloss", [hero.uid], true, false, 42);
  expect(started.ok).toBe(true);
  expect(state.tacticalBattle.bossChallenge.bossId).toBe("jura_koloss");
  expect(state.tacticalBattle.enemies[0].boss).toBe(true);
  expect(state.tacticalBattle.enemies[0].abilities).toContain("schildwall");
  expect(state.tacticalBattle.log[0]).toContain("Ringstampf");
  state.tacticalBattle.status = "won";
  const result = BATTLE.applyResult(state);
  expect(result.bossResult.won).toBe(true);
  expect(result.bossResult.mode).toBe("tactical");
  expect(state.tacticalBattle).toBeNull();
});

test("Action-Adapter erzeugt einen telegraphierten Boss mit eigener Gefahrenzone", () => {
  const state = rich(GST.createDefault());
  state.claimedRegions = ["wald", "hoehlen"];
  const hero = champion(state, "mage");
  const started = BOSS.startAction(state, "jura_koloss", [hero.uid], true, false, 43);
  expect(started.ok).toBe(true);
  expect(state.actionBattle.totalWaves).toBe(1);
  expect(state.actionBattle.enemies[0].boss).toBe(true);
  expect(state.actionBattle.enemies[0].dangerR).toBe(15);
  expect(state.actionBattle.enemies[0].windupTime).toBe(1.2);
  state.actionBattle.status = "won";
  const result = ACTION.applyResult(state);
  expect(result.bossResult.won).toBe(true);
  expect(result.bossResult.mode).toBe("action");
  expect(state.actionBattle).toBeNull();
});

test("vollständige Bestiarium-Linien öffnen Elite-Exemplare mit Komponente und Trophäe", () => {
  const state = rich(GST.createDefault());
  const goblinForms = SYS.bestiaryLineSpecies("Goblin");
  state.seenSpecies = Array.from(new Set(state.seenSpecies.concat(goblinForms.map(function (entry) { return entry.id; }))));
  const elite = BOSS.eliteForLine(state, "Goblin");
  expect(elite).toBeTruthy();
  expect(elite.defeated).toBe(false);
  const hero = champion(state, "hunter");
  const hunted = BOSS.resolveEliteHunt(state, "Goblin", [hero.uid], true);
  expect(hunted.won).toBe(true);
  expect(state.bosses.eliteDefeated).toContain("Goblin");
  expect(state.bosses.components[elite.componentId]).toBe(1);
  expect(BOSS.earnedTrophies(state).some(function (entry) { return entry.id === "elite_Goblin"; })).toBe(true);
  expect(BOSS.earnedTrophies(state).some(function (entry) { return entry.id === "line_Goblin"; })).toBe(true);
});

test("Save-v18 migriert beschädigte Bossdaten und schützt Meisterschaftskonsistenz", () => {
  const state = GST.createDefault();
  state.version = 17;
  state.bosses = {
    defeated: ["jura_koloss", "erfunden", "jura_koloss"],
    hardDefeated: ["echo_hydra", "jura_koloss"],
    attempts: { jura_koloss: "3.9", erfunden: -4 },
    eliteDefeated: ["Goblin", "Unbekannt", "Goblin"],
    components: { herzholz: "2.8", kaputt: -5 },
    banners: "2.2",
    lastResult: "kaputt"
  };
  const clean = GST.normalize(state);
  expect(clean.version).toBe(21);
  expect(clean.bosses.defeated).toEqual(["jura_koloss"]);
  expect(clean.bosses.hardDefeated).toEqual(["jura_koloss"]);
  expect(clean.bosses.attempts.jura_koloss).toBe(3);
  expect(clean.bosses.eliteDefeated).toEqual(["Goblin"]);
  expect(clean.bosses.components.herzholz).toBe(2);
  expect(clean.bosses.components.kaputt).toBeUndefined();
  expect(clean.bosses.banners).toBe(2);
  expect(clean.bosses.lastResult).toBeNull();
});

test("Watchmode bezwingt einen machbaren offenen Boss ohne Completion-Ziel zu verdrängen", () => {
  const state = rich(GST.createDefault());
  state.claimedRegions = ["wald", "hoehlen"];
  state.settings.watch = true;
  state.tick = 30;
  champion(state, "mage");
  const action = SYS.autoPlayStep(state);
  expect(action.text).toContain("Jura-Koloss");
  expect(state.bosses.defeated).toContain("jura_koloss");

  const completion = rich(GST.createDefault());
  completion.claimedRegions = ["wald", "hoehlen"];
  completion.settings.watch = true;
  completion.completion.enabled = true;
  completion.completion.target = "bestiary";
  champion(completion, "mage");
  SYS.autoPlayStep(completion);
  expect(completion.bosses.defeated).not.toContain("jura_koloss");
});
