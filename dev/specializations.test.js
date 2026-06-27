/* dev/specializations.test.js — Phase 50: Doktrinen, Bezirke und Schulen. */
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

const GD = globalThis.GameData;
const GST = globalThis.GameState;
const SYS = globalThis.GameSystems;
const SPEC = globalThis.GameSpecializations;
const ACTION = globalThis.GameActionCombat;

function rich(state) {
  GD.resources.forEach(function (resource) { state.resources[resource.id] = 500000; });
  state.buildings.wohnbezirk = 30;
  state.buildings.beschwoerungskreis = 6;
  state.buildings.forschungsgilde = 5;
  state.buildings.schmiede = 3;
  return state;
}

function named(state, speciesId, level) {
  const creature = GST.newCreature(state, speciesId);
  creature.named = true;
  creature.armyGroupId = null;
  creature.level = level || 20;
  state.creatures.push(creature);
  return creature;
}

test("fünf Doktrinen verändern bevorzugte Baukosten, Boni und Auftragslohn", () => {
  expect(SPEC.DOCTRINES).toHaveLength(5);
  expect(new Set(SPEC.DOCTRINES.map(function (entry) { return entry.id; })).size).toBe(5);

  const neutral = rich(GST.createDefault());
  const arenaNeutral = SYS.buildingCost(neutral, "arena").gold;
  const libraryNeutral = SYS.buildingCost(neutral, "bibliothek").gold;

  const conquest = rich(GST.createDefault());
  expect(SYS.setDoctrine(conquest, "conquest", "Teststrategie").ok).toBe(true);
  expect(SYS.buildingCost(conquest, "arena").gold).toBeLessThan(arenaNeutral);
  expect(SYS.buildingCost(conquest, "bibliothek").gold).toBeGreaterThan(libraryNeutral);
  expect(SYS.computeBonuses(conquest).armee).toBeGreaterThan(SYS.computeBonuses(neutral).armee);
  expect(SPEC.rewardMultiplier(conquest, "contract")).toBeGreaterThan(1);
});

test("Bezirks-Slots kosten Ressourcen, brauchen Umbauzeit und werden erst danach aktiv", () => {
  const state = rich(GST.createDefault());
  state.herrscher.stage = 3;
  expect(SYS.districtSlots(state)).toBe(3);
  const beforeGold = state.resources.gold;
  const configured = SYS.configureDistrict(state, 0, "archive");
  expect(configured.ok).toBe(true);
  expect(state.resources.gold).toBeLessThan(beforeGold);
  expect(SYS.activeSpecialDistricts(state)).toHaveLength(0);
  expect(state.specializations.rebuild).toBeTruthy();
  state.tick = configured.readyTick;
  expect(SPEC.step(state).districtCompleted.id).toBe("archive");
  expect(SYS.activeSpecialDistricts(state).map(function (entry) { return entry.id; })).toEqual(["archive"]);
  expect(SYS.computeBonuses(state).wissen).toBeGreaterThan(0.5);
  expect(SYS.canConfigureDistrict(state, 1, "archive").ok).toBe(false);
});

test("Anführerschulen verändern Werte sowie Taktik- und Action-Fähigkeiten", () => {
  const state = rich(GST.createDefault());
  const leader = named(state, "hobgoblin", 20);
  const before = SYS.creatureStats(state, leader);
  const baseArmyBonus = SYS.armyLeaderBonus(state, { leaderUid: leader.uid, rulerLed: false });
  expect(SYS.assignLeaderSchool(state, leader.uid, "mage").ok).toBe(true);
  const after = SYS.creatureStats(state, leader);
  expect(after.mag).toBeGreaterThan(before.mag);
  expect(SYS.armyLeaderBonus(state, { leaderUid: leader.uid, rulerLed: false })).toBeGreaterThan(baseArmyBonus);
  expect(SYS.combatAbilitiesFor(state, leader.uid)).toContain("feuerlanze");
  const started = ACTION.start(state, "wald", [leader.uid], false, 42);
  expect(started.ok).toBe(true);
  expect(started.battle.hero.hotbar[0].id).toBe("feuer");
  expect(new Set(started.battle.hero.hotbar.map(function (slot) { return slot.id; })).size).toBe(3);
});

test("Watchmode wählt eine Doktrin, bildet Eliten aus und baut passende Bezirke ohne Quest-Starvation", () => {
  const state = rich(GST.createDefault());
  state.settings.watch = true;
  state.contracts.autoProfile = "aggressive";
  const leader = named(state, "hobgoblin", 20);
  for (let i = 0; i < 420; i++) {
    SYS.autoPlayStep(state);
    SYS.tick(state);
  }
  expect(state.specializations.doctrineId).toBe("conquest");
  expect(state.creatures.some(function (creature) { return creature.schoolId === "commander"; })).toBe(true);
  expect(leader.named).toBe(true);
  expect(state.specializations.districts).toContain("warcamp");
  expect(state.questProgress).toBeGreaterThanOrEqual(3);
});

test("Save-v17 migriert beschädigte Spezialisierungen und unbekannte Schulen auf das aktuelle Schema", () => {
  const state = GST.createDefault();
  state.version = 16;
  state.specializations = {
    doctrineId: "chaos",
    autoDoctrine: "alles",
    districts: ["archive", "archive", "bazaar", "zu-viel"],
    rebuild: { slot: "x", districtId: "nichts", readyTick: "nie" }
  };
  state.creatures[0].named = true;
  state.creatures[0].schoolId = "erfunden";
  const clean = GST.normalize(state);
  expect(clean.version).toBe(18);
  expect(clean.specializations.doctrineId).toBeNull();
  expect(clean.specializations.autoDoctrine).toBe("adaptive");
  expect(clean.specializations.districts).toEqual(["archive", null, "bazaar"]);
  expect(clean.specializations.rebuild).toBeNull();
  expect(clean.creatures[0].schoolId).toBeNull();
});

test("Eroberung, Forschung und Monsterzucht können dieselbe Hauptkampagne abschließen", () => {
  const fingerprints = [];
  ["conquest", "research", "breeding"].forEach(function (doctrineId) {
    const state = rich(GST.createDefault());
    state.herrscher.level = 60;
    state.herrscher.stage = 5;
    expect(SYS.setDoctrine(state, doctrineId, "Kampagnenprofil").ok).toBe(true);
    const schoolId = { conquest: "commander", research: "mage", breeding: "hunter" }[doctrineId];
    const uids = [];
    for (let i = 0; i < 8; i++) {
      const champion = named(state, "katastrophendrache", 100);
      champion.schoolId = schoolId;
      uids.push(champion.uid);
    }
    GD.regions.forEach(function (region) {
      expect(SYS.regionUnlocked(state, region.id)).toBe(true);
      const started = SYS.startExpedition(state, region.id, uids, true, "normal");
      expect(started.ok).toBe(true);
      expect(SYS.resolveExpedition(state, started.expedition).won).toBe(true);
      state.expeditions = [];
    });
    expect(state.claimedRegions).toHaveLength(GD.regions.length);
    const bonuses = SYS.computeBonuses(state);
    fingerprints.push([doctrineId, bonuses.armee, bonuses.wissen, bonuses.summonRabatt, SYS.buildingCost(state, "arena").gold].join("|"));
  });
  expect(new Set(fingerprints).size).toBe(3);
});
