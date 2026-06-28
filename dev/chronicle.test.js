/* dev/chronicle.test.js — Phase 52: New Game+, Archive und Challenges. */
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
import "../js/completion-planner.js";
import "../js/systems-chronicle.js";

const GD = globalThis.GameData;
const GST = globalThis.GameState;
const SYS = globalThis.GameSystems;
const ACH = globalThis.GameAchievements;
const CHR = globalThis.GameChronicle;

function complete(state) {
  state.achievements = ACH.ACHIEVEMENTS.map(function (entry) { return entry.id; });
  state.seenSpecies = GD.creatures.map(function (entry) { return entry.id; });
  state.claimedRegions = GD.regions.map(function (entry) { return entry.id; });
  state.rivalsDefeated = GD.rivals.map(function (entry) { return entry.id; });
  state.tick = 6400;
  return state;
}

function rich(state) {
  GD.resources.forEach(function (resource) { state.resources[resource.id] = 500000; });
  state.buildings.wohnbezirk = 30;
  state.buildings.beschwoerungskreis = 7;
  state.herrscher.level = 60;
  state.herrscher.stage = 5;
  return state;
}

function newRun(challengeId, options) {
  const old = complete(rich(GST.createDefault()));
  return CHR.startNewRun(old, Object.assign({ challengeId: challengeId, seed: 77 }, options || {}));
}

function memoryStorage() {
  const values = new Map();
  return {
    getItem: function (key) { return values.has(key) ? values.get(key) : null; },
    setItem: function (key, value) { values.set(key, String(value)); },
    removeItem: function (key) { values.delete(key); },
    clear: function () { values.clear(); }
  };
}

test("Chronikdefinitionen und frischer Standardlauf bleiben neutral", () => {
  const state = GST.createDefault();
  expect(CHR.CHALLENGES).toHaveLength(6);
  expect(CHR.VARIANTS).toHaveLength(4);
  expect(state.version).toBe(19);
  expect(state.chronicle.generation).toBe(0);
  expect(state.chronicle.challengeId).toBe("standard");
  expect(state.chronicle.simSpeed).toBe(1);
  expect(state.chronicle.meta.seals).toBe(0);
  expect(CHR.availableVariants(state).map(function (entry) { return entry.id; })).toEqual(["slime"]);
  expect(CHR.challengeComplete(state)).toBe(false);
  expect(CHR.startNewRun(state, {}).ok).toBe(false);
  complete(state);
  expect(CHR.availableVariants(state).map(function (entry) { return entry.id; })).toEqual(["slime", "undead"]);
  expect(CHR.nextMaxSimSpeed(state)).toBe(2);
});

test("Save-v19 repariert beschädigte Meta-Daten ohne fremde Freischaltungen", () => {
  const state = GST.createDefault();
  state.version = 18;
  state.chronicle = {
    generation: "2.8",
    runId: "",
    seed: -5,
    startedAt: "kaputt",
    challengeId: "erfunden",
    startVariantId: "dragon",
    bannerId: "erfunden",
    simSpeed: 99,
    meta: {
      seals: "2.9",
      maxSimSpeed: 99,
      unlockedVariants: ["kobold", "erfunden"],
      unlockedBanners: ["jura_koloss", "erfunden", "jura_koloss"],
      bestTicks: { standard: "7000.9", erfunden: 1, no_trade: -2 },
      archives: [null, { id: "ok", ticks: 5 }, { id: "" }]
    }
  };
  const clean = GST.normalize(state);
  expect(clean.version).toBe(19);
  expect(clean.chronicle.generation).toBe(2);
  expect(clean.chronicle.challengeId).toBe("standard");
  expect(clean.chronicle.startVariantId).toBe("slime");
  expect(clean.chronicle.meta.seals).toBe(2);
  expect(clean.chronicle.meta.maxSimSpeed).toBe(2);
  expect(clean.chronicle.meta.unlockedVariants).toEqual(["slime", "undead", "spirit"]);
  expect(clean.chronicle.meta.unlockedBanners).toEqual(["jura_koloss"]);
  expect(clean.chronicle.bannerId).toBeNull();
  expect(clean.chronicle.simSpeed).toBe(1);
  expect(clean.chronicle.meta.bestTicks).toEqual({ standard: 7000 });
  expect(clean.chronicle.meta.archives).toHaveLength(1);
});

test("Versiegeln liefert Vollarchiv und einen frischen Run mit kleinen Meta-Freischaltungen", () => {
  const old = complete(rich(GST.createDefault()));
  old.reich = "Alt-Tempest";
  old.herrscher.name = "Rimuru";
  old.bosses.hardDefeated = ["jura_koloss"];
  old.bosses.defeated = ["jura_koloss"];
  old.bosses.attempts.jura_koloss = 4;
  old.metrics.creaturesLost = 7;
  const result = CHR.startNewRun(old, {
    challengeId: "undead_only",
    variantId: "undead",
    bannerId: "jura_koloss",
    simSpeed: 2,
    seed: 12345,
    auto: true
  });
  expect(result.ok).toBe(true);
  expect(result.archive.run.tick).toBe(6400);
  expect(result.archive.run.seenSpecies).toHaveLength(GD.creatures.length);
  expect(result.summary.deaths).toBe(7);
  expect(result.summary.bossAttempts).toBe(4);
  expect(result.summary.fullCompletionTick).toBe(6400);
  expect(result.state.tick).toBe(0);
  expect(result.state.reich).toBe("Alt-Tempest");
  expect(result.state.herrscher.name).toBe("Rimuru");
  expect(result.state.chronicle.generation).toBe(1);
  expect(result.state.chronicle.objectiveCompletionTick).toBeNull();
  expect(result.state.chronicle.fullCompletionTick).toBeNull();
  expect(result.state.chronicle.meta.seals).toBe(1);
  expect(result.state.chronicle.meta.maxSimSpeed).toBe(2);
  expect(result.state.chronicle.meta.bestTicks.standard).toBe(6400);
  expect(result.state.chronicle.meta.unlockedVariants).toContain("undead");
  expect(result.state.chronicle.meta.unlockedBanners).toContain("jura_koloss");
  expect(result.state.chronicle.bannerId).toBe("jura_koloss");
  expect(result.state.chronicle.simSpeed).toBe(2);
  expect(result.state.settings.watch).toBe(true);
  expect(result.state.creatures.every(function (creature) { return GD.creature(creature.speciesId).line === "Untot"; })).toBe(true);
});

test("erster Ziel- und 100%-Tick bleiben trotz späterer Versiegelung erhalten", () => {
  const state = complete(GST.createDefault());
  state.tick = 7000;
  CHR.observeCompletion(state);
  state.tick = 9000;
  CHR.observeCompletion(state);
  const result = CHR.summary(state);
  expect(result.ticks).toBe(7000);
  expect(result.fullCompletionTick).toBe(7000);
  expect(result.durationMs).toBeGreaterThanOrEqual(0);
});

test("Offline-Fortschritt wertet 100 % am Bündel-Endtick aus", () => {
  const state = GST.createDefault();
  state.achievements = ACH.ACHIEVEMENTS.filter(function (entry) { return entry.id !== "h_play1h"; }).map(function (entry) { return entry.id; });
  state.seenSpecies = GD.creatures.map(function (entry) { return entry.id; });
  state.tick = 3598;
  SYS.offlineProgress(state, 5);
  expect(state.tick).toBe(3603);
  expect(state.chronicle.objectiveCompletionTick).toBe(3603);
  expect(state.chronicle.fullCompletionTick).toBe(3603);
});

test("separater Archivspeicher erhält den alten Run bis der neue Save atomar geschrieben ist", () => {
  const original = globalThis.localStorage;
  Object.defineProperty(globalThis, "localStorage", { value: memoryStorage(), configurable: true });
  try {
    const old = complete(GST.createDefault());
    expect(GST.saveResult(old).ok).toBe(true);
    const result = CHR.startNewRun(old, { seed: 88 });
    expect(result.ok).toBe(true);
    expect(GST.storeChronicleArchive(result.archive).ok).toBe(true);
    expect(GST.load().tick).toBe(6400);
    expect(JSON.parse(GST.exportChronicleArchive(result.archive.id)).tick).toBe(6400);
    expect(GST.listChronicleArchives()).toHaveLength(1);
    expect(GST.saveResult(result.state).ok).toBe(true);
    expect(GST.load().tick).toBe(0);
    expect(JSON.parse(GST.exportChronicleArchive(result.archive.id)).seenSpecies).toHaveLength(GD.creatures.length);
    for (let index = 0; index < 22; index++) {
      expect(GST.storeChronicleArchive({ id: "extra_" + index, summary: { id: "extra_" + index }, run: { tick: index } }).ok).toBe(true);
    }
    expect(GST.listChronicleArchives()).toHaveLength(23);
    expect(JSON.parse(GST.exportChronicleArchive("extra_0")).tick).toBe(0);
    GST.reset();
    expect(globalThis.localStorage.getItem(GST.SAVE_KEY)).toBeNull();
    expect(globalThis.localStorage.getItem(GST.CHRONICLE_KEY)).toBeNull();
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, "localStorage", { value: original, configurable: true });
  }
});

test("korrupter oder voller Archivspeicher wird nicht überschrieben", () => {
  const original = globalThis.localStorage;
  const storage = memoryStorage();
  Object.defineProperty(globalThis, "localStorage", { value: storage, configurable: true });
  try {
    storage.setItem(GST.CHRONICLE_KEY, "{defekt");
    const result = GST.storeChronicleArchive({ id: "neu", summary: { id: "neu" }, run: { tick: 1 } });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("corrupt");
    expect(storage.getItem(GST.CHRONICLE_KEY)).toBe("{defekt");
    storage.removeItem(GST.CHRONICLE_KEY);
    const old = complete(GST.createDefault());
    expect(GST.saveResult(old).ok).toBe(true);
    const write = storage.setItem;
    storage.setItem = function (key, value) {
      if (key === GST.CHRONICLE_KEY) {
        const error = new Error("voll"); error.name = "QuotaExceededError"; throw error;
      }
      write.call(storage, key, value);
    };
    const full = GST.storeChronicleArchive({ id: "voll", summary: { id: "voll" }, run: { tick: 2 } });
    expect(full.ok).toBe(false);
    expect(full.reason).toBe("quota");
    expect(GST.load().tick).toBe(6400);
  } finally {
    if (original === undefined) delete globalThis.localStorage;
    else Object.defineProperty(globalThis, "localStorage", { value: original, configurable: true });
  }
});

test("Nur-Untote beschränkt Start, Beschwörung, Rekrutierung und Köderjagd", () => {
  const state = newRun("undead_only", { auto: true }).state;
  expect(state.creatures.every(function (creature) { return GD.creature(creature.speciesId).line === "Untot"; })).toBe(true);
  expect(SYS.canSummon(state, "goblin").ok).toBe(false);
  expect(SYS.canSummon(state, "skelett").ok).toBe(true);
  expect(SYS.canRecruitTroops(state, 0, "goblin", 1).ok).toBe(false);
  state.bestiaryHunts.lures.Goblin = 1;
  expect(SYS.canUseBestiaryLure(state, "hobgoblin").ok).toBe(false);
  for (let i = 0; i < 120; i++) { SYS.autoPlayStep(state); SYS.tick(state); }
  expect(state.creatures.every(function (creature) { return GD.creature(creature.speciesId).line === "Untot"; })).toBe(true);
});

test("Kein-Handel sperrt Gebäude, Job, Doktrin und Basar auch im Auto-Modus", () => {
  const state = newRun("no_trade", { auto: true }).state;
  const worker = state.creatures[0];
  expect(SYS.buildingUnlocked(state, "markt")).toBe(false);
  expect(SYS.build(state, "markt").ok).toBe(false);
  expect(SYS.assignJob(state, worker.uid, "gold").ok).toBe(false);
  expect(globalThis.GameSpecializations.canSetDoctrine(state, "trade").ok).toBe(false);
  expect(globalThis.GameSpecializations.canConfigureDistrict(state, 0, "bazaar").ok).toBe(false);
  for (let i = 0; i < 120; i++) { SYS.autoPlayStep(state); SYS.tick(state); }
  expect(state.buildings.markt).toBe(0);
  expect(state.buildings.handelshafen).toBe(0);
  expect(state.creatures.some(function (creature) { return creature.job === "gold"; })).toBe(false);
  expect(state.specializations.doctrineId).not.toBe("trade");
});

test("aggressive Rivalen, Bestiarium-Speedrun und Permadeath besitzen echte Regeln", () => {
  const base = GST.createDefault();
  base.claimedRegions = ["wald"];
  const aggressive = newRun("aggressive_rivals").state;
  aggressive.claimedRegions = ["wald"];
  expect(SYS.threatRate(aggressive)).toBeCloseTo(SYS.threatRate(base) * 2.5, 8);
  aggressive.rivalsDefeated = GD.rivals.map(function (entry) { return entry.id; });
  aggressive.claimedRegions = GD.regions.map(function (entry) { return entry.id; });
  expect(CHR.challengeComplete(aggressive)).toBe(true);

  const bestiary = newRun("bestiary_speedrun", { auto: true }).state;
  expect(bestiary.completion.enabled).toBe(true);
  expect(bestiary.completion.target).toBe("bestiary");
  expect(bestiary.settings.watch).toBe(true);

  const permadeath = newRun("permadeath").state;
  const started = SYS.startExpedition(permadeath, "wald", [], true, "sicher");
  expect(started.ok).toBe(true);
  expect(started.expedition.risk).toBe("riskant");
  expect(CHR.forceRisk(permadeath, "normal")).toBe("riskant");

  const losses = newRun("permadeath").state;
  losses.claimedRegions = ["wald"];
  const uids = losses.creatures.map(function (creature) { return creature.uid; });
  const doomed = SYS.startExpedition(losses, "hoehlen", uids, false, "normal");
  doomed.expedition.power = 0;
  expect(SYS.resolveExpedition(losses, doomed.expedition).dead).toBe(2);
  expect(losses.metrics.creaturesLost).toBe(3);
});

test("alle Challenge-Profile können vom Zuschauer-Modus aktiv begonnen werden", () => {
  CHR.CHALLENGES.forEach(function (entry, index) {
    const result = newRun(entry.id, { auto: true, seed: 100 + index });
    expect(result.ok).toBe(true);
    const state = result.state;
    let actions = 0;
    for (let tick = 0; tick < 40; tick++) {
      if (SYS.autoPlayStep(state)) actions++;
      SYS.tick(state);
    }
    expect(actions).toBeGreaterThan(0);
    expect(state.tick).toBe(40);
  });
});
