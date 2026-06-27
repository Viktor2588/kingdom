/* dev/contracts.test.js — Phase 49: Aufträge, Krisen und Auto-Profile. */
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

const GD = globalThis.GameData;
const GST = globalThis.GameState;
const SYS = globalThis.GameSystems;
const GC = globalThis.GameContracts;

function rich(state) {
  GD.resources.forEach(function (resource) { state.resources[resource.id] = 500000; });
  state.buildings.wohnbezirk = 30;
  state.buildings.beschwoerungskreis = 5;
  state.buildings.schmiede = 3;
  state.buildings.forschungsgilde = 3;
  state.forgeMaterials.runenstaub = 100;
  state.forgeMaterials.magistahlkern = 100;
  state.forgeMaterials.seelenkristall = 100;
  return state;
}

test("Auftragsbrett erzeugt drei unterschiedliche, machbare Ziele mit Laufzeit und Belohnung", () => {
  const state = GST.createDefault();
  const board = GC.ensureBoard(state);
  expect(board).toHaveLength(3);
  expect(new Set(board.map(function (contract) { return contract.kind; })).size).toBe(3);
  board.forEach(function (contract) {
    const definition = GC.CONTRACTS.find(function (entry) { return entry.kind === contract.kind; });
    expect(definition.eligible(state)).toBe(true);
    expect(contract.expiresTick).toBeGreaterThan(contract.startedTick);
    expect(Object.keys(contract.reward).length).toBeGreaterThan(0);
    expect(GC.contractProgress(state, contract).complete).toBe(false);
  });

  const early = GC.createContract(GST.createDefault(), "upgrade", false);
  const lateState = rich(GST.createDefault());
  lateState.herrscher.stage = 4;
  lateState.claimedRegions = ["wald", "hoehlen", "sumpf", "ruinen"];
  const late = GC.createContract(lateState, "upgrade", false);
  expect(late.reward.gold).toBeGreaterThan(early.reward.gold);

  const evolve = GC.CONTRACTS.find(function (entry) { return entry.kind === "evolve_c"; });
  const blocked = rich(GST.createDefault());
  const apex = GST.newCreature(blocked, "katastrophendrache");
  apex.named = true;
  blocked.creatures = [apex];
  expect(evolve.eligible(blocked)).toBe(false);
  const ready = GST.newCreature(blocked, "hobgoblin");
  ready.named = true;
  ready.level = 20;
  blocked.creatures.push(ready);
  expect(evolve.eligible(blocked)).toBe(true);
});

test("erfüllter Auftrag wird genau einmal eingelöst und sofort ersetzt", () => {
  const state = rich(GST.createDefault());
  state.contracts.board = [];
  const contract = GC.createContract(state, "upgrade", false);
  state.contracts.board.push(contract);
  const beforeGold = state.resources.gold;
  expect(SYS.build(state, "magieturm").ok).toBe(true);
  expect(GC.contractProgress(state, contract).complete).toBe(true);
  const claimed = GC.claimContract(state, contract.id);
  expect(claimed.ok).toBe(true);
  expect(state.resources.gold).toBeGreaterThan(beforeGold);
  expect(state.metrics.contractsCompleted).toBe(1);
  expect(GC.claimContract(state, contract.id).ok).toBe(false);
  expect(state.contracts.board).toHaveLength(3);
});

test("abgelaufene Ziele zählen als verpasst; Stillstand erzeugt einen Impuls-Auftrag", () => {
  const state = GST.createDefault();
  GC.ensureBoard(state);
  state.contracts.board[0].expiresTick = 1;
  state.tick = 1;
  const expired = GC.step(state);
  expect(expired.expired).toHaveLength(1);
  expect(state.metrics.contractsFailed).toBe(1);

  state.contracts.lastPacingTick = 0;
  state.tick += GC.STALL_TICKS;
  const paced = GC.step(state);
  expect(paced.pacing).toBeTruthy();
  expect(paced.pacing.pacing).toBe(true);
  expect(state.contracts.board.some(function (contract) { return contract.pacing; })).toBe(true);
});

test("alle fünf Reichskrisen sind mehrstufig und vollständig entscheidbar", () => {
  expect(GC.CRISES).toHaveLength(5);
  GC.CRISES.forEach(function (crisis) {
    expect(crisis.stages.length).toBeGreaterThanOrEqual(2);
    crisis.stages.forEach(function (stage) { expect(stage.choices.length).toBeGreaterThanOrEqual(2); });
  });

  const state = rich(GST.createDefault());
  state.questProgress = 5;
  const started = GC.startCrisis(state, "nahrung");
  expect(started.crisis.id).toBe("nahrung");
  expect(GC.resolveCrisis(state, "jagd").finished).toBe(false);
  const finished = GC.resolveCrisis(state, "arbeiter");
  expect(finished.finished).toBe(true);
  expect(state.metrics.crisesResolved).toBe(1);
  expect(state.contracts.crisis).toBeNull();

  GC.CRISES.forEach(function (crisis) {
    const poor = rich(GST.createDefault());
    poor.metrics.named = 1;
    poor.claimedRegions = ["wald", "hoehlen"];
    GD.resources.forEach(function (resource) { poor.resources[resource.id] = 0; });
    expect(GC.startCrisis(poor, crisis.id)).toBeTruthy();
    while (poor.contracts.crisis) {
      const status = GC.crisisStatus(poor);
      const affordable = status.stage.choices.find(function (choice) {
        return !choice.effect || !choice.effect.cost || SYS.canAfford(poor, choice.effect.cost);
      });
      expect(affordable).toBeTruthy();
      expect(GC.resolveCrisis(poor, affordable.id).ok).toBe(true);
    }
  });
});

test("Auto-Profile treffen unterschiedliche, bezahlbare Krisenentscheidungen", () => {
  const safe = rich(GST.createDefault());
  safe.claimedRegions = ["wald", "hoehlen"];
  GC.setAutoProfile(safe, "safe");
  GC.startCrisis(safe, "ultimatum");
  expect(GC.chooseCrisisForAuto(safe).id).toBe("zahlen");

  const aggressive = rich(GST.createDefault());
  aggressive.claimedRegions = ["wald", "hoehlen"];
  GC.setAutoProfile(aggressive, "aggressive");
  GC.startCrisis(aggressive, "ultimatum");
  expect(GC.chooseCrisisForAuto(aggressive).id).toBe("ablehnen");
});

test("Auto-Modus löst Krisen und holt fertige Auftragsbelohnungen ab", () => {
  const state = rich(GST.createDefault());
  state.questProgress = 5;
  GC.startCrisis(state, "nahrung");
  state.settings.watch = true;
  state.settings.watchDetailed = true;
  expect(SYS.autoPlayStep(state)).toBeNull();
  expect(state.contracts.crisis.stage).toBe(0);
  state.settings.watchDetailed = false;
  expect(GC.autoStep(state).text).toContain("Krise");
  expect(GC.autoStep(state).text).toContain("Krise");
  expect(state.contracts.crisis).toBeNull();

  state.contracts.board = [];
  const contract = GC.createContract(state, "upgrade", false);
  state.contracts.board.push(contract);
  SYS.build(state, "magieturm");
  expect(GC.autoStep(state).text).toContain("eingelöst");
  expect(state.metrics.contractsCompleted).toBe(1);
});

test("Vertragsmetriken erfassen riskante Siege, C-Rang-Evolutionen und epische Schmiedestufen", () => {
  const state = rich(GST.createDefault());
  const elite = GST.newCreature(state, "hobgoblin");
  elite.named = true;
  elite.level = 20;
  elite.armyGroupId = null;
  state.creatures.push(elite);
  expect(SYS.evolve(state, elite.uid, "goblin_lord").ok).toBe(true);
  expect(state.metrics.rankCEvolutions).toBe(1);

  expect(SYS.craft(state, "magistahlklinge").ok).toBe(true);
  const item = SYS.itemForRecipe(state, "magistahlklinge");
  expect(SYS.temperItem(state, item.uid).ok).toBe(true);
  expect(SYS.temperItem(state, item.uid).ok).toBe(true);
  expect(state.metrics.epicForged).toBe(1);

  SYS.resolveExpedition(state, { regionId: "wald", creatureUids: [], rulerJoined: true, risk: "riskant", power: 9999 });
  expect(state.metrics.riskyWins).toBe(1);
});

test("Save-v16 normalisiert beschädigte Auftrags- und Krisenzustände", () => {
  const broken = GST.createDefault();
  broken.version = 15;
  broken.contracts = { board: "kaputt", autoProfile: "chaos", crisis: { id: "erfunden", stage: "x" } };
  const clean = GST.normalize(broken);
  expect(clean.version).toBe(GST.VERSION);
  expect(clean.contracts.board).toEqual([]);
  expect(clean.contracts.autoProfile).toBe("progress");
  expect(clean.contracts.crisis).toBeNull();
  expect(clean.metrics.contractsCompleted).toBe(0);
});

test("langer Zuschauer-Lauf verarbeitet Aufträge und Krisen ohne Deadlock", () => {
  const state = GST.createDefault();
  state.settings.watch = true;
  for (let tick = 0; tick < 1500; tick++) {
    SYS.autoPlayStep(state);
    SYS.tick(state);
  }
  for (let settle = 0; settle < 4; settle++) SYS.autoPlayStep(state);
  expect(state.contracts.board).toHaveLength(3);
  expect(state.metrics.contractsCompleted).toBeGreaterThan(0);
  expect(state.metrics.crisesResolved).toBeGreaterThan(0);
  expect(state.contracts.crisis).toBeNull();
  GD.resources.forEach(function (resource) { expect(Number.isFinite(state.resources[resource.id])).toBe(true); });
  expect(SYS.usedCapacity(state)).toBeLessThanOrEqual(SYS.capacity(state));
});
