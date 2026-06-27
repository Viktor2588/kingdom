/* dev/fuzz.test.js — Seed-basierte Varianz-/Invarianten-Tests (bun:test).
   Die Seeds steuern auch Math.random der Spielsysteme. Fehlschläge sind
   dadurch reproduzierbar. Neben Crash-/NaN-Freiheit gelten messbare
   Abdeckungsziele für Kreaturenlinien, Skills, Jobs, Risiken, Regionen und
   taktische Aktionen. (Phase 24)  NICHT Teil des Spiels.
   Aufruf: bun test dev/fuzz.test.js                                  */
import { test, expect } from "bun:test";
import "../js/data-tables.js";
import "../js/data.js";
import "../js/state.js";
import "../js/systems.js";
import "../js/systems-bestiary.js";
import "../js/systems-combat.js";
import "../js/systems-contracts.js";

const GD = globalThis.GameData, GST = globalThis.GameState, SYS = globalThis.GameSystems;
const SEEDS = [1, 7, 42, 99, 256, 1000, 31337, 65535, 104729, 999983, 0xC0FFEE, 0xDECAFBAD];
const RESOURCE_IDS = GD.resources.map(function (resource) { return resource.id; });

function lcg(seed) {
  let value = seed >>> 0;
  return function () {
    value = (value * 1664525 + 1013904223) >>> 0;
    return value / 4294967296;
  };
}

function pick(rnd, list) { return list[Math.floor(rnd() * list.length)]; }

function withSeed(seed, callback) {
  const originalRandom = Math.random;
  const rnd = lcg(seed);
  Math.random = rnd;
  try { return callback(rnd); }
  finally { Math.random = originalRandom; }
}

function addSet(target, values) {
  values.forEach(function (value) { if (value != null) target.add(value); });
}

function deepFinite(value, path, failures, seen) {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) failures.push(path + ' ist ' + value);
    return;
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return;
  seen.add(value);
  Object.keys(value).forEach(function (key) {
    deepFinite(value[key], path + '.' + key, failures, seen);
  });
}

function stateInvariantFailures(state) {
  const failures = [];
  deepFinite(state, 'state', failures, new Set());
  const creatureIds = new Set();
  (state.creatures || []).forEach(function (creature) {
    if (creatureIds.has(creature.uid)) failures.push('doppelte Kreaturen-UID ' + creature.uid);
    creatureIds.add(creature.uid);
    if (!GD.creature(creature.speciesId)) failures.push('unbekannte Spezies ' + creature.speciesId);
    if (!Number.isInteger(creature.count) || creature.count < 1) failures.push('ungültige Stapelgröße ' + creature.count);
    if (creature.named && creature.count !== 1) failures.push('benannte Kreatur ist ein Stapel');
    if (!SYS.JOB_BY[creature.job]) failures.push('unbekannter Job ' + creature.job);
    (creature.skills || []).forEach(function (skillId) {
      if (!GD.skill(skillId)) failures.push('unbekannter Skill ' + skillId);
    });
  });
  const groupIds = new Set();
  (state.armyGroups || []).forEach(function (group) {
    if (groupIds.has(group.id)) failures.push('doppelte Armee-ID ' + group.id);
    groupIds.add(group.id);
    if (!group.rulerLed && !creatureIds.has(group.leaderUid)) failures.push('fehlender Anführer ' + group.leaderUid);
    Object.keys(group.troops || {}).forEach(function (speciesId) {
      if (!GD.creature(speciesId)) failures.push('unbekannte Truppenart ' + speciesId);
      if (!Number.isInteger(group.troops[speciesId]) || group.troops[speciesId] < 1) failures.push('ungültige Truppenstärke ' + group.troops[speciesId]);
    });
  });
  const production = SYS.production(state);
  deepFinite(production, 'production', failures, new Set());
  return failures;
}

function richScenario(seed, rnd, coverage) {
  const state = GST.createDefault();
  RESOURCE_IDS.forEach(function (id) { state.resources[id] = 250000; });
  state.buildings.wohnbezirk = 30;
  state.buildings.beschwoerungskreis = 1 + (seed % GD.RANKS.length);
  state.buildings.magieturm = 8;
  state.buildings.seelentempel = 8;
  state.herrscher.stage = seed % Math.min(4, GD.rulerStages.length);

  // Jede Session erhält eine andere, seed-gesteuerte Auswahl. Die normale
  // Beschwörungslogik bleibt zuständig für Kosten, Stapel und Kapazität.
  const summonable = SYS.summonableSpecies(state).slice();
  const wanted = Math.min(summonable.length, 5 + (seed % 5));
  const usedSpecies = new Set();
  for (let attempt = 0; attempt < wanted * 5 && usedSpecies.size < wanted; attempt++) {
    const species = pick(rnd, summonable);
    if (usedSpecies.has(species.id)) continue;
    const result = SYS.summon(state, species.id);
    if (result.ok) usedSpecies.add(species.id);
  }

  addSet(coverage.species, Array.from(usedSpecies));
  addSet(coverage.lines, Array.from(usedSpecies).map(function (id) { return GD.creature(id).line; }));

  // Jobs, Aspekte und lernbare Skills werden nicht nach fester Reihenfolge,
  // sondern aus den im jeweiligen Zustand tatsächlich gültigen Optionen gewählt.
  state.creatures.slice().forEach(function (creature) {
    const job = pick(rnd, SYS.JOBS).id;
    if (SYS.assignJob(state, creature.uid, job).ok) coverage.jobs.add(job);
  });
  const aspects = GD.aspects.map(function (aspect) { return aspect.id; });
  const candidates = state.creatures.filter(function (creature) { return !creature.named; });
  const nameAttempts = Math.min(candidates.length, 1 + (seed % 4));
  for (let i = 0; i < nameAttempts; i++) {
    const candidate = pick(rnd, candidates.filter(function (creature) { return !creature.named; }));
    if (!candidate) break;
    const aspectId = pick(rnd, aspects);
    const named = SYS.nameCreature(state, candidate.uid, '', aspectId);
    if (!named.ok) continue;
    coverage.aspects.add(aspectId);
    const available = SYS.availableSkills(state, named.creature);
    if (available.length) SYS.learnSkill(state, named.creature.uid, pick(rnd, available));
    addSet(coverage.skills, named.creature.skills);
  }

  for (let step = 0; step < 300; step++) {
    if (rnd() < 0.18) {
      RESOURCE_IDS.forEach(function (id) { state.resources[id] += Math.floor(rnd() * 900); });
    }
    const branch = rnd();
    if (branch < 0.72) {
      const action = SYS.autoPlayStep(state);
      if (action && action.text) coverage.autoActions.add(action.text.replace(/^\S+\s*/, '').split(/[.:]/)[0]);
    } else if (branch < 0.82) {
      const buildable = GD.buildings.filter(function (building) { return SYS.canBuild(state, building.id).ok; });
      if (buildable.length) SYS.build(state, pick(rnd, buildable).id);
    } else if (branch < 0.91) {
      const options = SYS.summonableSpecies(state).filter(function (species) { return SYS.canSummon(state, species.id).ok; });
      if (options.length) SYS.summon(state, pick(rnd, options).id);
    } else {
      const free = state.creatures.filter(function (creature) { return !SYS.creatureBusy(state, creature.uid); });
      if (free.length) SYS.assignJob(state, pick(rnd, free).uid, pick(rnd, SYS.JOBS).id);
    }
    SYS.tick(state);
    if (step % 50 === 0) {
      const currentFailures = stateInvariantFailures(state);
      if (currentFailures.length) throw new Error('Schritt ' + step + ': ' + currentFailures.join('; '));
    }
  }

  state.creatures.forEach(function (creature) {
    const species = GD.creature(creature.speciesId);
    if (species) { coverage.species.add(species.id); coverage.lines.add(species.line); }
    addSet(coverage.skills, creature.skills || []);
    coverage.jobs.add(creature.job);
  });
  return state;
}

test("Seed-Simulation: reproduzierbare Reichswege erreichen echte Inhaltsvarianz", () => {
  const coverage = {
    species: new Set(), lines: new Set(), skills: new Set(), jobs: new Set(), aspects: new Set(),
    autoActions: new Set()
  };
  const failures = [], fingerprints = new Set();

  SEEDS.forEach(function (seed) {
    withSeed(seed, function (rnd) {
      try {
        const state = richScenario(seed, rnd, coverage);
        const invariantFailures = stateInvariantFailures(state);
        if (invariantFailures.length) failures.push('Seed ' + seed + ': ' + invariantFailures.join('; '));
        const clone = GST.normalize(JSON.parse(JSON.stringify(state)));
        const cloneFailures = stateInvariantFailures(clone);
        if (cloneFailures.length) failures.push('Seed ' + seed + ' nach Save-Roundtrip: ' + cloneFailures.join('; '));
        fingerprints.add([
          state.creatures.map(function (creature) { return creature.speciesId; }).sort().join(','),
          state.learnedMagic.slice().sort().join(','), state.research.slice().sort().join(','),
          state.herrscher.stage, state.claimedRegions.length
        ].join('|'));
      } catch (error) {
        failures.push('Seed ' + seed + ': Ausnahme – ' + (error && error.stack || error));
      }
    });
  });

  expect(failures).toEqual([]);
  expect(fingerprints.size).toBeGreaterThanOrEqual(8);
  expect(coverage.lines.size).toBeGreaterThanOrEqual(16);
  expect(coverage.species.size).toBeGreaterThanOrEqual(20);
  expect(coverage.skills.size).toBeGreaterThanOrEqual(6);
  expect(coverage.jobs.size).toBe(SYS.JOBS.length);
  expect(coverage.aspects.size).toBe(GD.aspects.length);
  expect(coverage.autoActions.size).toBeGreaterThanOrEqual(8);
});

function lineRepresentatives() {
  const byLine = new Map();
  GD.creatures.forEach(function (species) {
    const current = byLine.get(species.line);
    if (!current || species.power > current.power) byLine.set(species.line, species);
  });
  return Array.from(byLine.values());
}

function validateBattle(combat) {
  const failures = [], occupied = new Set();
  deepFinite(combat, 'combat', failures, new Set());
  combat.party.concat(combat.enemies).forEach(function (actor) {
    if (actor.hp < 0 || actor.hp > actor.maxHp) failures.push(actor.name + ': LP außerhalb 0..max');
    if (actor.mp != null && (actor.mp < 0 || actor.mp > actor.maxMp)) failures.push(actor.name + ': MP außerhalb 0..max');
    if (!actor.pos || actor.pos.x < 0 || actor.pos.x >= SYS.BATTLE_W || actor.pos.y < 0 || actor.pos.y >= SYS.BATTLE_H) failures.push(actor.name + ': ungültige Position');
    if (!actor.dead && actor.pos) {
      const key = actor.pos.x + ',' + actor.pos.y;
      if (occupied.has(key)) failures.push('Feld doppelt belegt: ' + key);
      occupied.add(key);
    }
  });
  return failures;
}

function runTacticalScenario(species, index, coverage) {
  return withSeed(0xA11CE + index * 7919, function (rnd) {
    const state = GST.createDefault();
    RESOURCE_IDS.forEach(function (id) { state.resources[id] = 100000; });
    state.buildings.arena = index % 4;
    state.herrscher.level = 30 + index;
    state.herrscher.stage = Math.min(3, index % 4);
    state.learnedFieldMagic = GD.fieldMagic.filter(function (spell) { return spell.type === 'combat'; }).map(function (spell) { return spell.id; });

    const creature = GST.newCreature(state, species.id);
    creature.named = true;
    creature.name = 'Seed-' + index;
    creature.level = species.levelCap;
    creature.armyGroupId = null;
    creature.aspect = pick(rnd, GD.aspects).id;
    if (species.skill) creature.skills.push(species.skill);
    const commonSkills = Object.keys(GD.skills).filter(function (id) { return GD.skills[id].common; });
    creature.skills.push(pick(rnd, commonSkills));
    creature.skills.forEach(function (id) { creature.skillProgress[id] = { level: 1 + (index % 5), xp: 0 }; });
    state.creatures = [creature];
    state.armyGroups = [SYS.rulerArmyGroup(state)];
    state.armyGroups[0].troops = {};

    const regionIndex = index % GD.regions.length;
    const region = GD.regions[regionIndex];
    state.claimedRegions = GD.regions.slice(0, regionIndex).map(function (entry) { return entry.id; });
    const risk = ['sicher', 'normal', 'riskant'][index % 3];
    const rulerJoins = index % 2 === 0;
    const started = SYS.startCombat(state, region.id, [creature.uid], rulerJoins, risk);
    if (!started.ok) throw new Error('Kampfstart fehlgeschlagen: ' + started.reason);

    coverage.lines.add(species.line);
    coverage.species.add(species.id);
    addSet(coverage.skills, creature.skills);
    coverage.regions.add(region.id);
    coverage.risks.add(risk);
    started.combat.party.forEach(function (actor) { addSet(coverage.availableAbilities, actor.abilities); });

    // Ein laufender Rasterkampf muss mitsamt Positionen/Zugfolge speicherbar sein.
    if (index === 0) {
      const clone = GST.normalize(JSON.parse(JSON.stringify(state)));
      const restored = SYS.ensureCombatGrid(clone);
      if (!restored || restored.turnOrder.join(',') !== state.activeCombat.turnOrder.join(',')) throw new Error('aktiver Kampf verliert seine Zugfolge im Save-Roundtrip');
    }

    let playerTurns = 0;
    while (state.activeCombat.status === 'active' && playerTurns < 240) {
      const battleFailures = validateBattle(state.activeCombat);
      if (battleFailures.length) throw new Error('Kampfinvariante: ' + battleFailures.join('; '));
      const actor = SYS.battleCurrentActor(state.activeCombat);
      if (!actor || actor.side !== 'party') throw new Error('Spielerzug wurde nicht korrekt hergestellt');
      playerTurns++;

      if (index % 4 === 0 && playerTurns === 1) {
        const cells = SYS.battleReachableCells(state.activeCombat, actor);
        const cell = cells.length ? pick(rnd, cells) : null;
        if (cell && SYS.battleMove(state, cell.x, cell.y).ok) coverage.moves++;
        continue;
      }
      if (index % 5 === 0 && playerTurns === 2 && SYS.battleWait(state).ok) {
        coverage.waits++;
        continue;
      }

      const unseen = actor.abilities.filter(function (id) { return !coverage.usedAbilities.has(id); });
      const affordable = actor.abilities.filter(function (id) {
        const ability = GD.battleAbility(id);
        return ability && actor.mp >= ability.cost;
      });
      let abilityId = unseen.filter(function (id) { return affordable.indexOf(id) >= 0; })[0];
      if (!abilityId) {
        const damaging = affordable.filter(function (id) { const ability = GD.battleAbility(id); return ability.kind === 'damage' || ability.kind === 'drain'; });
        abilityId = damaging.length && rnd() < 0.82 ? pick(rnd, damaging) : pick(rnd, affordable.length ? affordable : ['angriff']);
      }
      const ability = GD.battleAbility(abilityId);
      let targetIndex = 0;
      if (ability.kind === 'heal') {
        const livingParty = state.activeCombat.party.map(function (entry, partyIndex) { return { entry: entry, partyIndex: partyIndex }; }).filter(function (item) { return !item.entry.dead; });
        livingParty.sort(function (a, b) { return (a.entry.hp / a.entry.maxHp) - (b.entry.hp / b.entry.maxHp); });
        targetIndex = livingParty[0].partyIndex;
      } else if (ability.kind !== 'guard') {
        const livingEnemies = state.activeCombat.enemies.map(function (entry, enemyIndex) { return { entry: entry, enemyIndex: enemyIndex }; }).filter(function (item) { return !item.entry.dead; });
        targetIndex = pick(rnd, livingEnemies).enemyIndex;
      }
      const action = SYS.battleAction(state, abilityId, targetIndex);
      if (!action.ok) {
        const fallback = SYS.battleAction(state, 'angriff', state.activeCombat.enemies.findIndex(function (enemy) { return !enemy.dead; }));
        if (!fallback.ok) throw new Error('Aktion und Fallback fehlgeschlagen: ' + action.reason);
        if (!fallback.moved) coverage.usedAbilities.add('angriff');
      } else if (!action.moved) {
        coverage.usedAbilities.add(abilityId);
      }
      state.activeCombat.party.concat(state.activeCombat.enemies).forEach(function (entry) {
        addSet(coverage.statuses, (entry.statuses || []).map(function (status) { return status.id; }));
      });
    }
    if (state.activeCombat.status === 'active') throw new Error('Kampf nach 240 Spielerzügen nicht beendet');
    coverage.outcomes.add(state.activeCombat.status);
    const finalFailures = validateBattle(state.activeCombat);
    if (finalFailures.length) throw new Error('finale Kampfinvariante: ' + finalFailures.join('; '));
  });
}

test("Taktische Szenariomatrix variiert Linien, Skills, Regionen, Risiken und Aktionen", () => {
  const coverage = {
    lines: new Set(), species: new Set(), skills: new Set(), regions: new Set(), risks: new Set(),
    availableAbilities: new Set(), usedAbilities: new Set(), statuses: new Set(), outcomes: new Set(),
    moves: 0, waits: 0
  };
  const failures = [];
  lineRepresentatives().forEach(function (species, index) {
    try { runTacticalScenario(species, index, coverage); }
    catch (error) { failures.push(species.line + '/' + species.id + ': ' + (error && error.stack || error)); }
  });

  expect(failures).toEqual([]);
  expect(coverage.lines.size).toBe(lineRepresentatives().length);
  expect(coverage.lines.size).toBeGreaterThanOrEqual(20);
  expect(coverage.skills.size).toBeGreaterThanOrEqual(12);
  expect(coverage.regions.size).toBe(GD.regions.length);
  expect(coverage.risks.size).toBe(3);
  expect(coverage.availableAbilities.size).toBe(Object.keys(GD.battleAbilities).length);
  expect(coverage.usedAbilities.size).toBeGreaterThanOrEqual(7);
  expect(coverage.statuses.size).toBeGreaterThanOrEqual(2);
  expect(coverage.outcomes.size).toBeGreaterThanOrEqual(2);
  expect(coverage.moves).toBeGreaterThanOrEqual(3);
  expect(coverage.waits).toBeGreaterThanOrEqual(2);
});
