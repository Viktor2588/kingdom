/* ============================================================
   systems.js — Spiellogik (DOM-frei). Reine Funktionen, die auf
   einem übergebenen state-Objekt arbeiten → unter Node testbar.
   Bereitgestellt als window.GameSystems / globalThis.GameSystems.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  function GD() { return root.GameData; }
  function GS() { return root.GameState; }
  var RULER_ARMY_ID = 0;
  var MAX_NAMED_CREATURES = 20;

  // ---------- kleine Helfer ----------
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function round(v) { return Math.round(v); }
  function rng() { return Math.random(); }

  function log(state, text, kind) {
    state.log.push({ t: state.tick, text: text, kind: kind || '' });
    if (state.log.length > 60) state.log.splice(0, state.log.length - 60);
  }

  function canAfford(state, cost) {
    if (!cost) return true;
    for (var k in cost) { if ((state.resources[k] || 0) < cost[k]) return false; }
    return true;
  }
  function pay(state, cost) {
    if (!cost) return;
    for (var k in cost) { state.resources[k] = (state.resources[k] || 0) - cost[k]; }
  }
  function addResources(state, gains) {
    if (!gains) return;
    for (var k in gains) {
      state.resources[k] = (state.resources[k] || 0) + gains[k];
      if (k === 'seelen' && gains[k] > 0) {
        state.metrics.seelenGesamt = (state.metrics.seelenGesamt || 0) + gains[k];
      }
    }
  }
  function missingCost(state, cost) {
    var miss = [];
    if (!cost) return miss;
    for (var k in cost) {
      var have = state.resources[k] || 0;
      if (have < cost[k]) miss.push(fmtRes(k, Math.ceil(cost[k] - have)) + ' fehlt');
    }
    return miss;
  }
  function fmtRes(id, amt) {
    var r = GD().resources.filter(function (x) { return x.id === id; })[0];
    return (amt != null ? amt + ' ' : '') + (r ? r.name : id);
  }

  function findCreature(state, uid) {
    for (var i = 0; i < state.creatures.length; i++) {
      if (state.creatures[i].uid === uid) return state.creatures[i];
    }
    return null;
  }
  function stackCount(inst) { return inst && !inst.named ? Math.max(1, Math.floor(inst.count || 1)) : (inst ? 1 : 0); }
  function totalCreatureCount(state) {
    return (state.creatures || []).reduce(function (sum, c) { return sum + stackCount(c); }, 0);
  }
  function rulerArmyGroup(state) {
    var groups = state.armyGroups || (state.armyGroups = []);
    for (var i = 0; i < groups.length; i++) if (groups[i].rulerLed || groups[i].id === RULER_ARMY_ID) return groups[i];
    var group = { id: RULER_ARMY_ID, leaderUid: null, rulerLed: true, name: 'Armee des Herrschers', troops: {}, position: 'hauptstadt', movement: 3, wardCharges: 0, battlesWon: 0 };
    groups.unshift(group); return group;
  }
  function findTroopStack(state, groupId, speciesId) {
    for (var i = 0; i < state.creatures.length; i++) {
      var c = state.creatures[i];
      if (!c.named && c.armyGroupId === groupId && c.speciesId === speciesId) return c;
    }
    return null;
  }
  function addTroopStack(state, groupId, speciesId, amount) {
    amount = Math.max(1, Math.floor(amount || 1));
    var group = findArmyGroup(state, groupId) || rulerArmyGroup(state);
    var stack = findTroopStack(state, group.id, speciesId);
    if (!stack) {
      stack = GS().newCreature(state, speciesId);
      stack.count = 0; stack.job = 'frei'; stack.armyGroupId = group.id;
      state.creatures.push(stack);
    }
    stack.count += amount;
    group.troops[speciesId] = (group.troops[speciesId] || 0) + amount;
    return stack;
  }
  function removeTroopStack(state, groupId, speciesId, amount) {
    var group = findArmyGroup(state, groupId), stack = findTroopStack(state, groupId, speciesId);
    if (!group || !stack) return 0;
    amount = Math.min(stackCount(stack), Math.max(1, Math.floor(amount || 1)));
    stack.count -= amount;
    group.troops[speciesId] = Math.max(0, (group.troops[speciesId] || 0) - amount);
    if (!group.troops[speciesId]) delete group.troops[speciesId];
    if (stack.count <= 0) state.creatures = state.creatures.filter(function (c) { return c !== stack; });
    return amount;
  }
  function findItem(state, uid) {
    for (var i = 0; i < state.inventory.length; i++) {
      if (state.inventory[i].uid === uid) return state.inventory[i];
    }
    return null;
  }
  // Verwundung: temporär reduzierte Werte, nicht expeditionsfähig.
  function isWounded(state, inst) { return !!(inst && inst.woundedUntil && inst.woundedUntil > state.tick); }
  function woundRemaining(state, inst) { return isWounded(state, inst) ? (inst.woundedUntil - state.tick) : 0; }
  var WOUND_PENALTY = 0.5;

  // ---------- Boni (Magie, Forschung, Herrscher-Stufe, Signatur) ----------
  // Verrechnet eine Effekt-Map in den Bonus-Akkumulator. 'produce' ist eine
  // Direkt-Produktions-Map (pro Tick) und wird gesondert behandelt.
  function addEffect(b, eff, mult) {
    if (!eff) return;
    mult = (mult == null) ? 1 : mult;
    for (var k in eff) {
      if (k === 'produce') {
        for (var r in eff.produce) b.produce[r] = (b.produce[r] || 0) + eff.produce[r] * mult;
      } else {
        b[k] = (b[k] || 0) + eff[k] * mult;
      }
    }
  }
  function computeBonuses(state) {
    var b = { produktionAll: 0, produktionMagie: 0, armee: 0, verteidigung: 0, summonRang: 0, wissen: 0.5,
              xp: 0, seelen: 0, drop: 0, summonRabatt: 0, bauRabatt: 0,
              kapazitaet: 0, expedTempo: 0, heiltempo: 0, threatRuhe: 0, beuteRang: 0, evoRabatt: 0,
              produce: {} };
    var aff = state.affinity ? GD().affinity(state.affinity) : null;
    (state.learnedMagic || []).forEach(function (id) {
      var m = GD().spell(id);
      if (m && m.effect) {
        var boost = (aff && m.schule === aff.school) ? 1.25 : 1;  // Affinität verstärkt Schul-Zauber
        addEffect(b, m.effect, boost);
      }
    });
    (state.research || []).forEach(function (id) {
      var r = GD().researchNode(id);
      if (r && r.unlocks && r.unlocks.effect) addEffect(b, r.unlocks.effect, 1);
    });
    // Gebäude mit prozentualem Bonus (z. B. Arena, Bibliothek), skaliert mit Stufe
    GD().buildings.forEach(function (bd) {
      if (bd.effect) {
        var lvl = state.buildings[bd.id] || 0;
        if (lvl > 0) addEffect(b, bd.effect, lvl);
      }
    });
    var stage = GD().rulerStages[state.herrscher.stage];
    if (stage) addEffect(b, stage.bonus, 1);
    // Dauerhafte Boni endgültig besiegter Rivalen
    (state.rivalsDefeated || []).forEach(function (rid) {
      var rv = GD().rival(rid);
      if (rv) addEffect(b, rv.defeatBonus, 1);
    });
    // Affinitäts-Bonus (dauerhaft)
    if (aff) addEffect(b, aff.bonus, 1);
    // Temporäre Buffs/Debuffs (Events) – nur aktive
    (state.tempBuffs || []).forEach(function (tb) {
      if (tb.untilTick > state.tick) addEffect(b, tb.effect, 1);
    });
    return b;
  }

  // ---------- Forschung ----------
  function unlockedMagicTier(state) {
    var t = 1;
    (state.research || []).forEach(function (id) {
      var r = GD().researchNode(id);
      if (r && r.unlocks && r.unlocks.magicTier) t = Math.max(t, r.unlocks.magicTier);
    });
    return t;
  }
  function isResearched(state, id) { return (state.research || []).indexOf(id) >= 0; }
  function researchReqStatus(state, node) {
    var miss = [];
    var req = node.req || {};
    (req.research || []).forEach(function (rid) {
      if (!isResearched(state, rid)) { var rn = GD().researchNode(rid); miss.push('Forschung „' + (rn ? rn.name : rid) + '"'); }
    });
    if (req.herrscherStufe && state.herrscher.stage < req.herrscherStufe) {
      miss.push('Herrscher-Stufe ' + (GD().rulerStages[req.herrscherStufe] ? GD().rulerStages[req.herrscherStufe].name : req.herrscherStufe));
    }
    return { ok: miss.length === 0, missing: miss };
  }
  function canResearch(state, id) {
    var node = GD().researchNode(id); if (!node) return { ok: false };
    if (isResearched(state, id)) return { ok: false, reason: 'Bereits erforscht' };
    var rs = researchReqStatus(state, node);
    if (!rs.ok) return { ok: false, reason: rs.missing.join(', ') };
    if (!canAfford(state, node.cost)) return { ok: false, reason: missingCost(state, node.cost).join(', ') };
    return { ok: true };
  }
  function doResearch(state, id) {
    var check = canResearch(state, id);
    if (!check.ok) return { ok: false, reason: check.reason };
    var node = GD().researchNode(id);
    pay(state, node.cost);
    state.research.push(id);
    log(state, node.icon + ' Forschung abgeschlossen: ' + node.name + '.', 'gold');
    return { ok: true };
  }

  // ---------- Gebäude ----------
  function buildingCost(state, id) {
    var bd = GD().building(id); if (!bd) return null;
    var lvl = state.buildings[id] || 0;
    var rab = computeBonuses(state).bauRabatt || 0;
    var cost = {};
    for (var k in bd.cost) cost[k] = Math.max(1, round(bd.cost[k] * Math.pow(bd.growth, lvl) * (1 - rab)));
    return cost;
  }
  function canBuild(state, id) { return canAfford(state, buildingCost(state, id)); }
  function build(state, id) {
    var bd = GD().building(id); if (!bd) return { ok: false };
    var cost = buildingCost(state, id);
    if (!canAfford(state, cost)) return { ok: false, missing: missingCost(state, cost) };
    pay(state, cost);
    state.buildings[id] = (state.buildings[id] || 0) + 1;
    log(state, bd.icon + ' ' + bd.name + ' auf Stufe ' + state.buildings[id] + ' gebracht.', 'good');
    return { ok: true, level: state.buildings[id] };
  }

  function capacity(state) {
    var cap = 5;
    GD().buildings.forEach(function (bd) {
      if (bd.capacityPer) cap += (state.buildings[bd.id] || 0) * bd.capacityPer;
    });
    cap += Math.round(computeBonuses(state).kapazitaet || 0);   // Magie-Kapazitätsboni
    return cap;
  }
  function usedCapacity(state) { return totalCreatureCount(state); }

  // ---------- Produktion / Tick ----------
  var JOBS = [
    { id: 'frei',     name: 'Frei',       icon: '💤', res: null },
    { id: 'magie',    name: 'Magiekanal', icon: '🔮', res: 'magie',   f: 0.50 },
    { id: 'material', name: 'Bergbau',    icon: '⛏️', res: 'material', f: 0.50 },
    { id: 'gold',     name: 'Handel',     icon: '🪙', res: 'gold',     f: 0.45 },
    { id: 'nahrung',  name: 'Jagd',       icon: '🍖', res: 'nahrung',  f: 0.50 },
    { id: 'wissen',   name: 'Studium',    icon: '📚', res: 'wissen',   f: 0.40 },
    { id: 'armee',    name: 'Armee',      icon: '⚔️', res: null }
  ];
  var JOB_BY = {}; JOBS.forEach(function (j) { JOB_BY[j.id] = j; });

  function workValue(state, inst) {
    var s = creatureStats(state, inst);
    return (s.ang + s.ver + s.mag) / 3 + s.lp * 0.05;
  }

  function production(state) {
    var b = computeBonuses(state);
    var rates = { magie: 0, gold: 0, nahrung: 0, material: 0, seelen: 0, wissen: 0 };
    // Gebäude
    GD().buildings.forEach(function (bd) {
      var lvl = state.buildings[bd.id] || 0;
      if (lvl > 0 && bd.producePer) {
        for (var res in bd.producePer) rates[res] += bd.producePer[res] * lvl;
      }
    });
    // Beanspruchte Regionen (Territorium-Boni)
    (state.claimedRegions || []).forEach(function (id) {
      var r = GD().region(id);
      if (r && r.claimBonus) { for (var res in r.claimBonus) rates[res] += r.claimBonus[res]; }
    });
    // Eroberte Anlagen der Abenteuerkarte produzieren pro Ausbaustufe.
    (state.claimedMapSites || []).forEach(function (id) {
      var site = GD().strategicSite(id), level = (state.mapSiteLevels && state.mapSiteLevels[id]) || 1;
      if (site && site.produce) for (var sr in site.produce) rates[sr] += site.produce[sr] * level;
    });
    // Arbeitende Kreaturen
    state.creatures.forEach(function (c) {
      var job = JOB_BY[c.job];
      if (job && job.res && !creatureBusy(state, c.uid)) {
        rates[job.res] += workValue(state, c) * job.f * stackCount(c);
      }
    });
    // Multiplikatoren
    var all = 1 + b.produktionAll;
    rates.magie    *= all * (1 + b.produktionMagie);
    rates.gold     *= all;
    rates.material *= all;
    rates.nahrung  *= all;
    rates.seelen   *= all;
    rates.wissen   *= all * (1 + b.wissen);

    var grossNahrung = rates.nahrung;
    var consumption = totalCreatureCount(state) * 0.4;
    rates.nahrung = grossNahrung - consumption;

    var hunger = (state.resources.nahrung <= 0 && rates.nahrung < 0);
    if (hunger) {
      rates.magie *= 0.5; rates.gold *= 0.5; rates.material *= 0.5;
      rates.seelen *= 0.5; rates.wissen *= 0.5;
    }
    // Direkt-Produktion aus Magie (flach & verlässlich – unabhängig von Multiplikatoren/Hunger)
    if (b.produce) { for (var pk in b.produce) rates[pk] = (rates[pk] || 0) + b.produce[pk]; }
    return { rates: rates, grossNahrung: grossNahrung, consumption: consumption, hunger: hunger, bonuses: b };
  }

  function tick(state) {
    state.tick++;
    var mapRefresh = stepArmyMap(state);
    var p = production(state);
    for (var res in p.rates) {
      state.resources[res] = Math.max(0, (state.resources[res] || 0) + p.rates[res]);
      if (res === 'seelen' && p.rates[res] > 0) {
        state.metrics.seelenGesamt = (state.metrics.seelenGesamt || 0) + p.rates[res];
      }
    }
    var results = [];
    var still = [];
    state.expeditions.forEach(function (exp) {
      if (state.tick >= exp.returnsAtTick) results.push(resolveExpedition(state, exp));
      else still.push(exp);
    });
    state.expeditions = still;
    var threat = stepThreat(state);
    var ev = stepEvents(state);
    var questsDone = checkQuests(state, false);
    return { production: p, expeditionResults: results, raidWarning: threat.raidWarning, raidResult: threat.raidResult, event: ev, questsCompleted: questsDone, mapRefresh: mapRefresh };
  }

  // Offline-Fortschritt (gebündelt, gedeckelt).
  function offlineProgress(state, seconds) {
    var ticks = clamp(Math.floor(seconds), 0, 8 * 3600); // max 8h
    if (ticks <= 0) return { ticks: 0, results: [] };
    var p = production(state);
    for (var res in p.rates) {
      var add = p.rates[res] * ticks;
      state.resources[res] = Math.max(0, (state.resources[res] || 0) + add);
      if (res === 'seelen' && add > 0) state.metrics.seelenGesamt = (state.metrics.seelenGesamt || 0) + add;
    }
    var results = [];
    var still = [];
    state.tick += ticks;
    stepArmyMap(state);
    state.expeditions.forEach(function (exp) {
      if (state.tick >= exp.returnsAtTick) results.push(resolveExpedition(state, exp));
      else still.push(exp);
    });
    state.expeditions = still;
    // anstehenden Rivalen-Angriff offline auflösen
    var raidResult = null;
    if (state.raid && state.tick >= state.raid.atTick) raidResult = resolveRaid(state);
    return { ticks: ticks, results: results, production: p, raidResult: raidResult };
  }

  // ---------- Kreaturen: Werte & Kampfkraft ----------
  function creatureStats(state, inst) {
    var sp = GD().creature(inst.speciesId);
    if (!sp) return { lp: 0, ang: 0, ver: 0, mag: 0, tmp: 0 };
    var lf = 1 + 0.05 * (inst.level - 1);
    var nf = inst.named ? 1.12 : 1;
    var ff = 1 + 0.15 * (inst.fusionLevel || 0);   // Chimära-Fusion: +15 % Werte je Stufe
    var asp = inst.aspect ? GD().aspect(inst.aspect) : null;
    var stats = {};
    ['lp', 'ang', 'ver', 'mag', 'tmp'].forEach(function (k) {
      var am = (asp && asp.statMod && asp.statMod[k]) ? asp.statMod[k] : 1;
      stats[k] = round(sp.base[k] * lf * nf * ff * am);
    });
    // Ausrüstung
    if (inst.equipment) {
      for (var slot in inst.equipment) {
        var uid = inst.equipment[slot];
        if (uid != null) {
          var item = findItem(state, uid);
          if (item && item.stats) { for (var st in item.stats) stats[st] = (stats[st] || 0) + item.stats[st]; }
        }
      }
    }
    // Set-Boni (flache Werte)
    var sb = equippedSetBonus(state, inst.equipment);
    for (var ss in sb.stats) stats[ss] = (stats[ss] || 0) + sb.stats[ss];
    // Verwundung: reduzierte Werte bis zur Heilung
    if (isWounded(state, inst)) {
      ['lp', 'ang', 'ver', 'mag', 'tmp'].forEach(function (k) { stats[k] = round((stats[k] || 0) * WOUND_PENALTY); });
    }
    return stats;
  }
  function creatureKampfMult(state, inst) {
    var m = 1;
    (inst.skills || []).forEach(function (id) {
      var sk = GD().skill(id);
      var p = inst.skillProgress && inst.skillProgress[id];
      var mastery = 1 + 0.18 * Math.max(0, ((p && p.level) || 1) - 1);
      if (sk && sk.kampf) m += sk.kampf * mastery;
    });
    m += equippedSetBonus(state, inst.equipment).kampf;
    return m;
  }
  function creaturePower(state, inst) {
    return GD().combatPower(creatureStats(state, inst), 1, creatureKampfMult(state, inst)) * stackCount(inst);
  }
  function creatureLevelCap(inst) {
    var sp = GD().creature(inst.speciesId);
    return sp ? sp.levelCap : 40;
  }
  function xpForLevel(level) { return round(20 * Math.pow(level, 1.5)); }
  function addCreatureXp(state, inst, amount) {
    if (!inst || !inst.named) return;
    var cap = creatureLevelCap(inst);
    inst.xp += amount;
    while (inst.level < cap && inst.xp >= xpForLevel(inst.level)) {
      inst.xp -= xpForLevel(inst.level);
      inst.level++;
    }
    if (inst.level >= cap) inst.xp = Math.min(inst.xp, xpForLevel(cap));
  }

  // ---------- Beschwören ----------
  function maxSummonRankIndex(state) {
    var allowed = (state.buildings.beschwoerungskreis || 0) - 1 + computeBonuses(state).summonRang;
    return clamp(allowed, 0, GD().RANKS.length - 1);
  }
  function summonCost(state, speciesId) {
    var sp = GD().creature(speciesId);
    if (!sp || !sp.summon) return null;
    var lvl = state.buildings.beschwoerungskreis || 1;
    var rab = computeBonuses(state).summonRabatt || 0;
    var disc = Math.max(0.3, (1 - 0.05 * (lvl - 1)) * (1 - rab));
    var cost = {};
    for (var k in sp.summon) cost[k] = round(sp.summon[k] * disc);
    return cost;
  }
  function summonableSpecies(state) {
    var maxIdx = maxSummonRankIndex(state);
    return GD().creatures.filter(function (sp) {
      return sp.summon && GD().rankIndex(sp.rank) <= maxIdx;
    });
  }
  function canSummon(state, speciesId) {
    var sp = GD().creature(speciesId);
    if (!sp || !sp.summon) return { ok: false, reason: 'Nicht beschwörbar' };
    if (GD().rankIndex(sp.rank) > maxSummonRankIndex(state)) return { ok: false, reason: 'Beschwörungskreis zu niedrig' };
    if (usedCapacity(state) >= capacity(state)) return { ok: false, reason: 'Keine Kapazität (Wohnbezirk bauen)' };
    var cost = summonCost(state, speciesId);
    if (!canAfford(state, cost)) return { ok: false, reason: missingCost(state, cost).join(', ') };
    return { ok: true };
  }
  function summon(state, speciesId) {
    var check = canSummon(state, speciesId);
    if (!check.ok) return { ok: false, reason: check.reason };
    pay(state, summonCost(state, speciesId));
    var c = addTroopStack(state, RULER_ARMY_ID, speciesId, 1);
    state.metrics.summoned = (state.metrics.summoned || 0) + 1;
    var sp = GD().creature(speciesId);
    log(state, sp.icon + ' ' + sp.name + ' beschworen und in der Herrscherarmee gestapelt (' + stackCount(c) + '×).', 'good');
    return { ok: true, creature: c, stack: c, count: stackCount(c) };
  }

  // ---------- Namensgebung ----------
  function namedCount(state) {
    return state.creatures.filter(function (c) { return c.named; }).length;
  }
  function nameCapacity(state) {
    // Ein wahrer Name bindet einen Teil der Herrscheressenz. Auch im Endgame
    // dürfen höchstens 40 % des Gefolges benannt sein: Named bleibt Elite.
    var progression = 1 + (state.herrscher.stage || 0) * 2
      + Math.floor((state.buildings.seelentempel || 0) / 2)
      + Math.floor((state.buildings.magieturm || 0) / 4);
    var rosterLimit = Math.max(1, Math.floor(totalCreatureCount(state) * 0.4));
    return Math.min(MAX_NAMED_CREATURES, Math.max(namedCount(state), Math.min(progression, rosterLimit)));
  }
  function nameCost(stateOrInst, maybeInst) {
    var state = maybeInst ? stateOrInst : null;
    var inst = maybeInst || stateOrInst;
    var sp = GD().creature(inst.speciesId);
    var n = state ? namedCount(state) : 0;
    var escalation = Math.pow(1.85, n);
    var cost = { magie: round(30 * (GD().RANK_POWER[sp.rank] || 1) * escalation) };
    if (n > 0) cost.seelen = round(8 * n * n * (1 + GD().rankIndex(sp.rank) * 0.5));
    return cost;
  }
  function canName(state, inst) {
    if (inst.named) return { ok: false, reason: 'Bereits benannt' };
    var used = namedCount(state), cap = nameCapacity(state);
    if (used >= cap) return { ok: false, reason: 'Namenssiegel erschöpft (' + used + '/' + cap + '). Vergrößere dein Gefolge oder stärke Herrscher, Magieturm und Seelentempel.' };
    var cost = nameCost(state, inst);
    if (!canAfford(state, cost)) return { ok: false, reason: missingCost(state, cost).join(', ') };
    return { ok: true, cost: cost };
  }
  var RANDOM_NAMES = {
    Schleim: ['Rimuru', 'Mizu', 'Puru', 'Aoi', 'Nami'], Goblin: ['Rigur', 'Gobta', 'Kurobe', 'Mido', 'Garm'],
    Wolf: ['Ranga', 'Kiba', 'Yoru', 'Raiga', 'Gin'], Oger: ['Benimaru', 'Shuna', 'Shion', 'Soei', 'Hakurou'],
    Echse: ['Gabiru', 'Soka', 'Ryuu', 'Naga', 'Kairi'], Ork: ['Geld', 'Boran', 'Dorga', 'Malk'],
    Untot: ['Adalman', 'Luna', 'Mord', 'Veyr'], Daemon: ['Diablo', 'Noir', 'Venom', 'Moss'], 'Dämon': ['Diablo', 'Noir', 'Venom', 'Moss'],
    Vampir: ['Luminous', 'Roy', 'Gunther', 'Vera'], Golem: ['Beretta', 'Doran', 'Rune', 'Gant'],
    Insekt: ['Zegion', 'Apito', 'Karna', 'Vesp'], Drache: ['Veldra', 'Gaia', 'Ryuon', 'Tempest'],
    Geist: ['Ramiris', 'Treyni', 'Drys', 'Sylph'], Greif: ['Aquila', 'Skye', 'Gale', 'Talon'],
    Baumhirte: ['Treant', 'Elder', 'Mori', 'Ygg'], 'Phönix': ['Hinoko', 'Enya', 'Sol', 'Ignis'],
    Kobold: ['Kiba', 'Pochi', 'Ruff', 'Keen'], Hasenmensch: ['Lop', 'Mina', 'Tsuki', 'Usa'],
    Tengu: ['Hayate', 'Karasu', 'Fuujin', 'Sora'], Meervolk: ['Neris', 'Marin', 'Kai', 'Coral']
  };
  function randomCreatureName(state, inst) {
    var sp = GD().creature(inst.speciesId), pool = RANDOM_NAMES[sp && sp.line] || ['Astra', 'Kira', 'Nox', 'Vega', 'Liora'];
    var used = {};
    (state.creatures || []).forEach(function (c) { if (c.named) used[c.name] = true; });
    var available = pool.filter(function (n) { return !used[n]; });
    var base = (available.length ? available : pool)[Math.floor(rng() * (available.length ? available.length : pool.length))];
    if (!used[base]) return base;
    var suffix = 2; while (used[base + ' ' + suffix]) suffix++;
    return base + ' ' + suffix;
  }
  function nameCreature(state, uid, newName, aspectId) {
    var inst = findCreature(state, uid);
    if (!inst) return { ok: false };
    var check = canName(state, inst);
    if (!check.ok) return { ok: false, reason: check.reason };
    pay(state, check.cost);
    var sourceGroupId = inst.armyGroupId == null ? RULER_ARMY_ID : inst.armyGroupId;
    var sourceGroup = findArmyGroup(state, sourceGroupId) || rulerArmyGroup(state);
    var remaining = stackCount(inst) - 1;
    if (sourceGroup.troops[inst.speciesId]) {
      sourceGroup.troops[inst.speciesId]--;
      if (sourceGroup.troops[inst.speciesId] <= 0) delete sourceGroup.troops[inst.speciesId];
    }
    if (remaining > 0) {
      var rest = GS().newCreature(state, inst.speciesId);
      rest.count = remaining; rest.job = inst.job; rest.armyGroupId = sourceGroupId;
      state.creatures.push(rest);
    }
    inst.named = true;
    inst.count = 1; inst.armyGroupId = null;
    inst.name = (newName && ('' + newName).trim()) ? ('' + newName).trim().slice(0, 24) : randomCreatureName(state, inst);
    var asp = aspectId ? GD().aspect(aspectId) : null;
    if (asp) {
      inst.aspect = asp.id;
      if (asp.skill && inst.skills.indexOf(asp.skill) < 0) inst.skills.push(asp.skill);
    } else {
      var sp = GD().creature(inst.speciesId);  // Rückfall: Linien-Signaturskill
      if (sp.skill && inst.skills.indexOf(sp.skill) < 0) inst.skills.push(sp.skill);
    }
    if (!inst.skillProgress) inst.skillProgress = {};
    inst.skills.forEach(function (id) { if (!inst.skillProgress[id]) inst.skillProgress[id] = { level: 1, xp: 0 }; });
    state.metrics.named = (state.metrics.named || 0) + 1;
    var autoArmy = null;
    if (!(state.armyGroups || []).some(function (g) { return !g.rulerLed && g.id !== RULER_ARMY_ID; })) {
      autoArmy = formArmyGroup(state, inst.uid, null, true).group || null;
    }
    log(state, '✨ „' + inst.name + '" benannt' + (asp ? ' (' + asp.icon + ' ' + asp.name + ')' : '') + ' – Kräfte erwachen!', 'gold');
    return { ok: true, creature: inst, autoArmy: autoArmy };
  }

  // ---------- Skill-Slots ----------
  function skillCapacity(inst) {
    if (!inst || !inst.named) return 0;
    var sp = GD().creature(inst.speciesId);
    var idx = sp ? GD().rankIndex(sp.rank) : 0;
    return [2, 2, 3, 4, 4, 5, 6][idx] || 2;   // E,D,C,B,A,S,SS
  }
  function skillSlotsUsed(inst) {
    return (inst.skills || []).filter(function (id) { var sk = GD().skill(id); return !sk || !sk.followup; }).length;
  }
  function availableSkills(state, inst) {
    if (!inst || !inst.named) return [];
    return Object.keys(GD().skills).filter(function (id) {
      var sk = GD().skills[id];
      return sk.common && (inst.skills || []).indexOf(id) < 0;
    });
  }
  function learnSkillCost(inst) {
    var n = (inst.skills || []).length;
    return { magie: 40 * (n + 1), seelen: 10 * (n + 1) };
  }
  function canLearnSkill(state, uid, skillId) {
    var inst = findCreature(state, uid); if (!inst) return { ok: false };
    if (!inst.named) return { ok: false, reason: 'Nur Benannte erlernen erweiterte Fähigkeiten' };
    var sk = GD().skills[skillId];
    if (!sk || !sk.common) return { ok: false, reason: 'Nicht lernbar' };
    if ((inst.skills || []).indexOf(skillId) >= 0) return { ok: false, reason: 'Bereits gelernt' };
    if (skillSlotsUsed(inst) >= skillCapacity(inst)) return { ok: false, reason: 'Keine freien Skill-Slots' };
    var cost = learnSkillCost(inst);
    if (!canAfford(state, cost)) return { ok: false, reason: missingCost(state, cost).join(', ') };
    return { ok: true, cost: cost };
  }
  function learnSkill(state, uid, skillId) {
    var check = canLearnSkill(state, uid, skillId);
    if (!check.ok) return { ok: false, reason: check.reason };
    var inst = findCreature(state, uid);
    pay(state, check.cost);
    inst.skills.push(skillId);
    if (!inst.skillProgress) inst.skillProgress = {};
    inst.skillProgress[skillId] = { level: 1, xp: 0 };
    var sk = GD().skills[skillId];
    log(state, '📖 „' + inst.name + '" erlernt ' + sk.icon + ' ' + sk.name + '.', 'good');
    return { ok: true };
  }

  function skillXpForLevel(level) { return round(45 * Math.pow(level, 1.55)); }
  function skillProgress(holder, skillId) {
    if (!holder.skillProgress) holder.skillProgress = {};
    if (!holder.skillProgress[skillId]) holder.skillProgress[skillId] = { level: 1, xp: 0 };
    return holder.skillProgress[skillId];
  }
  function unlockFollowup(state, holder, skillId) {
    var sk = GD().skill(skillId);
    if (!sk || !sk.next || (holder.skills || []).indexOf(sk.next) >= 0) return null;
    holder.skills.push(sk.next);
    skillProgress(holder, sk.next);
    log(state, '🌟 Folgefähigkeit freigeschaltet: ' + GD().skill(sk.next).icon + ' ' + GD().skill(sk.next).name + '!', 'gold');
    return sk.next;
  }
  function addSkillXp(state, holder, amount) {
    var unlocked = [];
    (holder.skills || []).slice().forEach(function (id) {
      var sk = GD().skill(id); if (!sk) return;
      var p = skillProgress(holder, id);
      p.xp += Math.max(0, amount || 0);
      while (p.level < (sk.maxLevel || 5) && p.xp >= skillXpForLevel(p.level)) {
        p.xp -= skillXpForLevel(p.level);
        p.level++;
        if (p.level === 3) { var next = unlockFollowup(state, holder, id); if (next) unlocked.push(next); }
      }
      if (p.level >= (sk.maxLevel || 5)) p.xp = Math.min(p.xp, skillXpForLevel(p.level));
    });
    return unlocked;
  }
  function skillTrainingCost(holder, skillId) {
    var p = skillProgress(holder, skillId);
    return { magie: 35 * p.level, seelen: 12 * p.level * p.level };
  }
  function trainSkill(state, holderKey, skillId) {
    var holder = holderKey === 'herrscher' ? state.herrscher : findCreature(state, holderKey);
    if (!holder || (holder.skills || []).indexOf(skillId) < 0) return { ok: false, reason: 'Fähigkeit nicht erlangt' };
    if (holderKey !== 'herrscher' && !holder.named) return { ok: false, reason: 'Nur Benannte können Fähigkeiten meistern' };
    var sk = GD().skill(skillId), p = skillProgress(holder, skillId);
    if (p.level >= (sk.maxLevel || 5)) return { ok: false, reason: 'Bereits gemeistert' };
    var cost = skillTrainingCost(holder, skillId);
    if (!canAfford(state, cost)) return { ok: false, reason: missingCost(state, cost).join(', ') };
    pay(state, cost);
    p.xp += skillXpForLevel(p.level);
    addSkillXp(state, holder, 0);
    log(state, '📈 ' + sk.name + ' erreicht Stufe ' + p.level + '.', 'good');
    return { ok: true, level: p.level };
  }

  // ---------- Evolution ----------
  function reqStatus(state, inst, req) {
    var miss = [];
    if (req.named && !inst.named) miss.push('muss benannt sein');
    if (req.level && inst.level < req.level) miss.push('Level ' + req.level + ' (aktuell ' + inst.level + ')');
    if (req.herrscherStufe && state.herrscher.stage < req.herrscherStufe) {
      miss.push('Herrscher-Stufe ' + (GD().rulerStages[req.herrscherStufe] ? GD().rulerStages[req.herrscherStufe].name : req.herrscherStufe));
    }
    if (req.seelen && (state.resources.seelen || 0) < req.seelen) miss.push(req.seelen + ' Seelen');
    if (req.material && (state.resources.material || 0) < req.material) miss.push(req.material + ' Material');
    return { ok: miss.length === 0, missing: miss };
  }
  function evolveOptions(state, inst) {
    if (!inst || !inst.named) return [];
    var sp = GD().creature(inst.speciesId);
    if (!sp || !sp.evolvesTo) return [];
    return sp.evolvesTo.map(function (ev) {
      var target = GD().creature(ev.to);
      var st = reqStatus(state, inst, ev.req || {});
      return { to: ev.to, target: target, req: ev.req || {}, ok: st.ok, missing: st.missing };
    });
  }
  function evolve(state, uid, toId) {
    var inst = findCreature(state, uid);
    if (!inst) return { ok: false };
    if (!inst.named) return { ok: false, reason: 'Nur benannte Kreaturen können sich entwickeln' };
    var sp = GD().creature(inst.speciesId);
    var ev = (sp.evolvesTo || []).filter(function (e) { return e.to === toId; })[0];
    if (!ev) return { ok: false, reason: 'Unbekannte Evolution' };
    var st = reqStatus(state, inst, ev.req || {});
    if (!st.ok) return { ok: false, reason: st.missing.join(', ') };
    // Kosten (Seelen/Material) verbrauchen – Magie kann sie verbilligen (evoRabatt)
    var rab = computeBonuses(state).evoRabatt || 0;
    var cost = {};
    if (ev.req && ev.req.seelen) cost.seelen = round(ev.req.seelen * (1 - rab));
    if (ev.req && ev.req.material) cost.material = round(ev.req.material * (1 - rab));
    pay(state, cost);
    var fromName = sp.name;
    inst.speciesId = toId;
    var target = GD().creature(toId);
    // Level auf neuen Cap begrenzen, Skill ergänzen
    if (inst.level > target.levelCap) inst.level = target.levelCap;
    if (target.skill && inst.skills.indexOf(target.skill) < 0) {
      inst.skills.push(target.skill);
      skillProgress(inst, target.skill);
    }
    state.metrics.evolutions = (state.metrics.evolutions || 0) + 1;
    log(state, '🧬 ' + fromName + ' entwickelt sich zu ' + target.icon + ' ' + target.name + '!', 'gold');
    return { ok: true, creature: inst };
  }

  // ---------- Jobs ----------
  function assignJob(state, uid, job) {
    if (!JOB_BY[job]) return { ok: false };
    var inst = findCreature(state, uid);
    if (!inst) return { ok: false };
    if (creatureBusy(state, uid)) return { ok: false, reason: 'Auf Expedition' };
    inst.job = job;
    return { ok: true };
  }

  // ---------- Magie / Forschung ----------
  function magicReqStatus(state, m) {
    var miss = [];
    var req = m.req || {};
    if (req.magicTier && unlockedMagicTier(state) < req.magicTier) {
      miss.push('Magie-Tier ' + req.magicTier + ' (erforschen)');
    }
    if (req.herrscherStufe && state.herrscher.stage < req.herrscherStufe) {
      miss.push('Herrscher-Stufe ' + (GD().rulerStages[req.herrscherStufe] ? GD().rulerStages[req.herrscherStufe].name : req.herrscherStufe));
    }
    if (req.gebaeude) {
      for (var g in req.gebaeude) {
        if ((state.buildings[g] || 0) < req.gebaeude[g]) {
          var bd = GD().building(g);
          miss.push((bd ? bd.name : g) + ' Stufe ' + req.gebaeude[g]);
        }
      }
    }
    return { ok: miss.length === 0, missing: miss };
  }
  function isLearned(state, id) { return (state.learnedMagic || []).indexOf(id) >= 0; }
  function canLearn(state, id) {
    var m = GD().spell(id); if (!m) return { ok: false };
    if (isLearned(state, id)) return { ok: false, reason: 'Bereits erlernt' };
    var rs = magicReqStatus(state, m);
    if (!rs.ok) return { ok: false, reason: rs.missing.join(', ') };
    if (!canAfford(state, m.cost)) return { ok: false, reason: missingCost(state, m.cost).join(', ') };
    return { ok: true };
  }
  function learnMagic(state, id) {
    var check = canLearn(state, id);
    if (!check.ok) return { ok: false, reason: check.reason };
    var m = GD().spell(id);
    pay(state, m.cost);
    state.learnedMagic.push(id);
    log(state, m.icon + ' „' + m.name + '" erforscht. ' + m.desc, 'good');
    return { ok: true };
  }

  // ---------- Aktive Feldmagie (Kampf & Abenteuer) ----------
  function isFieldMagicLearned(state, id) { return (state.learnedFieldMagic || []).indexOf(id) >= 0; }
  function fieldMagicReqStatus(state, spell) {
    var level = state.buildings.arkane_akademie || 0;
    if (level < spell.academy) return { ok: false, reason: 'Arkane Akademie Stufe ' + spell.academy + ' nötig' };
    return { ok: true };
  }
  function canLearnFieldMagic(state, id) {
    var spell = GD().fieldSpell(id); if (!spell) return { ok: false, reason: 'Unbekannter Feldzauber' };
    if (isFieldMagicLearned(state, id)) return { ok: false, reason: 'Bereits gelernt' };
    var req = fieldMagicReqStatus(state, spell); if (!req.ok) return req;
    if (!canAfford(state, spell.cost)) return { ok: false, reason: missingCost(state, spell.cost).join(', ') };
    return { ok: true };
  }
  function learnFieldMagic(state, id) {
    var check = canLearnFieldMagic(state, id); if (!check.ok) return check;
    var spell = GD().fieldSpell(id); pay(state, spell.cost);
    state.learnedFieldMagic = state.learnedFieldMagic || []; state.learnedFieldMagic.push(id);
    log(state, spell.icon + ' Aktiver ' + (spell.type === 'combat' ? 'Kampfzauber' : 'Abenteuerzauber') + ' gelernt: ' + spell.name + '.', 'gold');
    return { ok: true, spell: spell };
  }
  function adventureMagicCooldown(state, id) {
    return Math.max(0, ((state.adventureMagicCooldowns && state.adventureMagicCooldowns[id]) || 0) - state.tick);
  }
  function canCastAdventureMagic(state, id, groupId) {
    var spell = GD().fieldSpell(id), group = findArmyGroup(state, groupId);
    if (!spell || spell.type !== 'adventure') return { ok: false, reason: 'Kein Abenteuerzauber' };
    if (!isFieldMagicLearned(state, id)) return { ok: false, reason: 'Zauber noch nicht gelernt' };
    if (!group) return { ok: false, reason: 'Armee nicht gefunden' };
    var cd = adventureMagicCooldown(state, id); if (cd > 0) return { ok: false, reason: 'Abklingzeit: ' + cd + ' s' };
    if (!canAfford(state, spell.castCost)) return { ok: false, reason: missingCost(state, spell.castCost).join(', ') };
    if (spell.effect === 'movement' && group.movement >= armyMovementMax(state, group)) return { ok: false, reason: 'Bewegung ist bereits voll' };
    if (spell.effect === 'ward' && (group.wardCharges || 0) > 0) return { ok: false, reason: 'Diese Armee ist bereits geschützt' };
    if (spell.effect === 'return' && group.position === 'hauptstadt') return { ok: false, reason: 'Armee steht bereits in Tempest' };
    return { ok: true, spell: spell, group: group };
  }
  function castAdventureMagic(state, id, groupId) {
    var check = canCastAdventureMagic(state, id, groupId); if (!check.ok) return check;
    var spell = check.spell, group = check.group; pay(state, spell.castCost);
    if (spell.effect === 'movement') group.movement = armyMovementMax(state, group);
    else if (spell.effect === 'ward') group.wardCharges = 1;
    else if (spell.effect === 'return') { group.position = 'hauptstadt'; group.movement = 0; }
    state.adventureMagicCooldowns = state.adventureMagicCooldowns || {};
    state.adventureMagicCooldowns[id] = state.tick + (spell.cooldown || 30);
    log(state, spell.icon + ' ' + spell.name + ' auf ' + group.name + ' gewirkt.', 'gold');
    return { ok: true, spell: spell, group: group, cooldown: spell.cooldown || 30 };
  }

  // ---------- Schmieden / Ausrüstung ----------
  function craftableRecipes(state) {
    var lvl = state.buildings.schmiede || 0;
    return GD().recipes.filter(function (r) {
      if (lvl < r.schmiede) return false;
      if (r.req && r.req.research && !isResearched(state, r.req.research)) return false;
      return true;
    });
  }
  function rollRarity(state) {
    var lvl = state.buildings.schmiede || 1;
    var br = computeBonuses(state).beuteRang || 0;   // Magie verschiebt Beute nach oben
    var rs = GD().rarities;
    var weights = rs.map(function (r, i) { return r.weight * (1 + 0.15 * lvl * i) * (1 + 0.8 * br * i); });
    var sum = weights.reduce(function (a, b) { return a + b; }, 0);
    var roll = rng() * sum;
    for (var i = 0; i < rs.length; i++) { roll -= weights[i]; if (roll <= 0) return rs[i]; }
    return rs[0];
  }
  function makeItem(state, recipe, rarity) {
    var stats = {};
    for (var k in recipe.stats) stats[k] = round(recipe.stats[k] * rarity.mult);
    var item = {
      uid: GS().nextUid(state),
      recipeId: recipe.id,
      name: recipe.name,
      icon: recipe.icon,
      slot: recipe.slot,
      rarity: rarity.id,
      stats: stats,
      equippedBy: null
    };
    state.inventory.push(item);
    return item;
  }
  function canCraft(state, recipeId) {
    var r = GD().recipe(recipeId); if (!r) return { ok: false };
    if ((state.buildings.schmiede || 0) < r.schmiede) return { ok: false, reason: 'Schmiede Stufe ' + r.schmiede + ' nötig' };
    if (r.req && r.req.research && !isResearched(state, r.req.research)) {
      var rn = GD().researchNode(r.req.research);
      return { ok: false, reason: 'Forschung „' + (rn ? rn.name : r.req.research) + '" nötig' };
    }
    if (!canAfford(state, r.cost)) return { ok: false, reason: missingCost(state, r.cost).join(', ') };
    return { ok: true };
  }
  function craft(state, recipeId) {
    var check = canCraft(state, recipeId);
    if (!check.ok) return { ok: false, reason: check.reason };
    var r = GD().recipe(recipeId);
    pay(state, r.cost);
    var rarity = r.fixedRarity ? GD().rarity(r.fixedRarity) : rollRarity(state);
    var item = makeItem(state, r, rarity);
    state.metrics.crafted = (state.metrics.crafted || 0) + 1;
    log(state, '⚒️ ' + GD().rarity(rarity.id).name + 'e ' + item.name + ' geschmiedet.', rarity.id === 'gewoehnlich' ? 'good' : 'gold');
    return { ok: true, item: item, rarity: rarity };
  }
  function equipmentObjFor(state, holderKey) {
    if (holderKey === 'herrscher') return state.herrscher.equipment;
    var c = findCreature(state, holderKey);
    return c && c.named ? c.equipment : null;
  }
  function slotPos(id) {
    var list = GD().equipSlots;
    for (var i = 0; i < list.length; i++) { if (list[i].id === id) return list[i]; }
    return null;
  }
  function slotUnlocked(state, posId) {
    var p = slotPos(posId); if (!p) return false;
    if (p.base) return true;
    var rid = GD().slotResearch[posId];
    return rid ? isResearched(state, rid) : false;
  }
  function positionsForType(state, type, onlyUnlocked) {
    return GD().equipSlots.filter(function (p) { return p.type === type && (!onlyUnlocked || slotUnlocked(state, p.id)); });
  }
  function findItemPosition(eq, itemUid) {
    for (var k in eq) { if (eq[k] === itemUid) return k; }
    return null;
  }
  function unequipItem(state, itemUid) {
    var item = findItem(state, itemUid);
    if (!item || item.equippedBy == null) return;
    var eq = equipmentObjFor(state, item.equippedBy);
    if (eq) { var pos = findItemPosition(eq, item.uid); if (pos) eq[pos] = null; }
    item.equippedBy = null;
  }
  function equipItem(state, itemUid, holderKey, posId) {
    var item = findItem(state, itemUid);
    if (!item) return { ok: false };
    if (holderKey !== 'herrscher') {
      var creatureHolder = findCreature(state, holderKey);
      if (!creatureHolder || !creatureHolder.named) return { ok: false, reason: 'Nur benannte Kreaturen dürfen Ausrüstung tragen' };
    }
    var eq = equipmentObjFor(state, holderKey);
    if (!eq) return { ok: false };
    var positions = positionsForType(state, item.slot, true);
    if (!positions.length) return { ok: false, reason: 'Slot nicht freigeschaltet (erst erforschen)' };
    var target = null;
    if (posId) target = positions.filter(function (p) { return p.id === posId; })[0] || null;
    if (!target) target = positions.filter(function (p) { return eq[p.id] == null; })[0] || positions[0];
    unequipItem(state, itemUid);                          // aus altem Halter lösen
    if (eq[target.id] != null) {                           // belegte Position freigeben
      var prev = findItem(state, eq[target.id]); if (prev) prev.equippedBy = null;
    }
    eq[target.id] = item.uid;
    item.equippedBy = (holderKey === 'herrscher') ? 'herrscher' : holderKey;
    return { ok: true, position: target.id };
  }
  // Set-Boni eines Halters (höchster erreichter Schwellenwert je Set)
  function equippedSetBonus(state, eq) {
    var counts = {}, res = { stats: {}, kampf: 0 };
    if (!eq) return res;
    for (var k in eq) {
      var uid = eq[k]; if (uid == null) continue;
      var it = findItem(state, uid); if (!it) continue;
      var rc = GD().recipe(it.recipeId);
      if (rc && rc.set) counts[rc.set] = (counts[rc.set] || 0) + 1;
    }
    for (var setId in counts) {
      var set = GD().set(setId); if (!set) continue;
      var n = counts[setId], best = null;
      Object.keys(set.bonus).forEach(function (thr) { if (n >= parseInt(thr, 10)) best = set.bonus[thr]; });
      if (best) {
        if (best.kampf) res.kampf += best.kampf;
        if (best.stats) for (var st in best.stats) res.stats[st] = (res.stats[st] || 0) + best.stats[st];
      }
    }
    return res;
  }

  // ---------- Herrscher ----------
  function rulerStats(state) {
    var h = state.herrscher;
    var base = { lp: 60, ang: 14, ver: 10, mag: 16, tmp: 10 };
    var stageMult = 1 + h.stage * 0.6;
    var lf = 1 + 0.08 * (h.level - 1);
    var stats = {};
    ['lp', 'ang', 'ver', 'mag', 'tmp'].forEach(function (k) { stats[k] = round(base[k] * stageMult * lf); });
    if (h.equipment) {
      for (var slot in h.equipment) {
        var uid = h.equipment[slot];
        if (uid != null) { var it = findItem(state, uid); if (it && it.stats) { for (var st in it.stats) stats[st] = (stats[st] || 0) + it.stats[st]; } }
      }
    }
    var sb = equippedSetBonus(state, h.equipment);
    for (var ss in sb.stats) stats[ss] = (stats[ss] || 0) + sb.stats[ss];
    return stats;
  }
  function rulerPower(state) {
    var sb = equippedSetBonus(state, state.herrscher.equipment);
    var sm = 0;
    (state.herrscher.skills || []).forEach(function (id) {
      var sk = GD().skill(id), p = skillProgress(state.herrscher, id);
      if (sk && sk.kampf) sm += sk.kampf * (1 + 0.18 * (p.level - 1));
    });
    return GD().combatPower(rulerStats(state), 1, 1 + sb.kampf + sm);
  }
  function rulerXpForLevel(level) { return round(40 * Math.pow(level, 1.6)); }
  var RULER_LEVELCAP = 60;
  function checkRulerStage(state) {
    var stages = GD().rulerStages;
    while (state.herrscher.stage < stages.length - 1) {
      var next = stages[state.herrscher.stage + 1];
      var seelenG = state.metrics.seelenGesamt || 0;
      if (state.herrscher.level >= (next.reqLevel || 1) && seelenG >= (next.reqSeelen || 0)) {
        state.herrscher.stage++;
        log(state, '🌟 Erwachen! Du entwickelst dich zu ' + next.icon + ' ' + next.name + '!', 'gold');
      } else break;
    }
  }
  function addRulerXp(state, amount) {
    if (amount <= 0) return;
    var h = state.herrscher;
    h.xp += amount;
    while (h.level < RULER_LEVELCAP && h.xp >= rulerXpForLevel(h.level)) {
      h.xp -= rulerXpForLevel(h.level);
      h.level++;
      log(state, '⬆️ Herrscher erreicht Level ' + h.level + '.', 'good');
    }
    if (h.level >= RULER_LEVELCAP) h.xp = Math.min(h.xp, rulerXpForLevel(RULER_LEVELCAP));
    checkRulerStage(state);
  }
  function sacrificeSouls(state, amount) {
    amount = Math.min(amount, state.resources.seelen || 0);
    if (amount <= 0) return { ok: false, reason: 'Keine Seelen' };
    pay(state, { seelen: amount });
    var xp = amount * 2;
    log(state, '🩸 ' + amount + ' Seelen geopfert (+' + xp + ' Herrscher-EP).', 'gold');
    addRulerXp(state, xp);
    return { ok: true, xp: xp };
  }

  // ============================================================
  //  Armeegruppen & strategische Karte (Heroes-artig)
  // ============================================================
  var MAP_DAY_TICKS = 30;
  var MAX_TROOP_TYPES = 4;
  var TROOP_COMMAND = [1, 2, 4, 8, 14, 24, 40];

  function findArmyGroup(state, id) {
    for (var i = 0; i < (state.armyGroups || []).length; i++) if (state.armyGroups[i].id === id) return state.armyGroups[i];
    return null;
  }
  function leaderArmyGroup(state, uid) {
    for (var i = 0; i < (state.armyGroups || []).length; i++) if (state.armyGroups[i].leaderUid === uid) return state.armyGroups[i];
    return null;
  }
  function maxArmyGroups(state) {
    // Die Herrscherarmee belegt den festen ersten Slot. Ein weiterer Slot steht
    // für die erste benannte Elite bereit; Fortschritt schafft zusätzliche Helden.
    return 2 + (state.herrscher.stage || 0) + Math.floor((state.buildings.arena || 0) / 3);
  }
  function troopCommandCost(speciesId) {
    var sp = GD().creature(speciesId), idx = sp ? GD().rankIndex(sp.rank) : 0;
    return TROOP_COMMAND[idx] || 1;
  }
  function armyCommandCapacity(state, groupOrLeader) {
    if (groupOrLeader && groupOrLeader.rulerLed) {
      return 100 + (state.herrscher.level || 1) * 5 + (state.herrscher.stage || 0) * 25 + (state.buildings.arena || 0) * 5;
    }
    var leader = typeof groupOrLeader === 'object' && Object.prototype.hasOwnProperty.call(groupOrLeader, 'leaderUid')
      ? findCreature(state, groupOrLeader.leaderUid) : groupOrLeader;
    if (!leader) return 0;
    var sp = GD().creature(leader.speciesId), rank = sp ? GD().rankIndex(sp.rank) : 0;
    return 50 + rank * 25 + (leader.level || 1) * 3 + (state.herrscher.stage || 0) * 10 + (state.buildings.arena || 0) * 5;
  }
  function armyCommandUsed(group) {
    var used = 0;
    for (var id in (group.troops || {})) used += Math.max(0, group.troops[id] || 0) * troopCommandCost(id);
    return used;
  }
  function armyMovementMax(state, group) {
    var leader = group && group.rulerLed ? state.herrscher : findCreature(state, group.leaderUid);
    var stats = group && group.rulerLed ? rulerStats(state) : (leader ? creatureStats(state, leader) : { tmp: 0 });
    return clamp(3 + Math.floor((stats.tmp || 0) / 80), 3, 6);
  }
  function eligibleArmyLeaders(state) {
    return state.creatures.filter(function (c) {
      return c.named && !isWounded(state, c) && !creatureBusyWithoutArmy(state, c.uid) && !leaderArmyGroup(state, c.uid);
    });
  }
  function creatureBusyWithoutArmy(state, uid) {
    for (var i = 0; i < state.expeditions.length; i++) if (state.expeditions[i].creatureUids.indexOf(uid) >= 0) return true;
    if (state.activeCombat && state.activeCombat.status === 'active') {
      for (var j = 0; j < state.activeCombat.party.length; j++) if (state.activeCombat.party[j].key === uid) return true;
    }
    return false;
  }
  function canCreateArmyGroup(state, leaderUid) {
    var leader = findCreature(state, leaderUid);
    if (!leader || !leader.named) return { ok: false, reason: 'Eine benannte Kreatur als Anführer wählen' };
    if (leaderArmyGroup(state, leaderUid)) return { ok: false, reason: 'Dieser Anführer führt bereits eine Armee' };
    if (creatureBusyWithoutArmy(state, leaderUid) || isWounded(state, leader)) return { ok: false, reason: 'Anführer ist nicht verfügbar' };
    if ((state.armyGroups || []).length >= maxArmyGroups(state)) return { ok: false, reason: 'Armeelimit erreicht (' + maxArmyGroups(state) + ')' };
    var cost = { gold: 100, nahrung: 50 };
    if (!canAfford(state, cost)) return { ok: false, reason: missingCost(state, cost).join(', '), cost: cost };
    return { ok: true, cost: cost };
  }
  function formArmyGroup(state, leaderUid, name, free) {
    var check = free ? { ok: true, cost: null } : canCreateArmyGroup(state, leaderUid); if (!check.ok) return check;
    var leader = findCreature(state, leaderUid);
    if (!leader || !leader.named) return { ok: false, reason: 'Eine benannte Kreatur als Anführer wählen' };
    if (leaderArmyGroup(state, leaderUid)) return { ok: false, reason: 'Dieser Anführer führt bereits eine Armee' };
    if (!free) pay(state, check.cost);
    state.armyUidCounter = (state.armyUidCounter || 0) + 1;
    leader.job = 'armee';
    var group = {
      id: state.armyUidCounter, leaderUid: leaderUid,
      name: (name && String(name).trim() ? String(name).trim().slice(0, 28) : ('Armee von ' + leader.name)),
      troops: {}, position: 'hauptstadt', movement: 3, wardCharges: 0, battlesWon: 0
    };
    group.movement = armyMovementMax(state, group);
    state.armyGroups.push(group);
    log(state, '🚩 ' + group.name + ' unter ' + leader.name + (free ? ' automatisch' : '') + ' aufgestellt.', 'gold');
    return { ok: true, group: group };
  }
  function createArmyGroup(state, leaderUid, name) { return formArmyGroup(state, leaderUid, name, false); }
  function disbandArmyGroup(state, groupId) {
    var group = findArmyGroup(state, groupId); if (!group) return { ok: false };
    if (group.rulerLed || group.id === RULER_ARMY_ID) return { ok: false, reason: 'Die Herrscherarmee kann nicht aufgelöst werden' };
    var leader = findCreature(state, group.leaderUid); if (leader) leader.job = 'frei';
    var main = rulerArmyGroup(state);
    Object.keys(group.troops || {}).forEach(function (speciesId) {
      var amount = group.troops[speciesId] || 0;
      removeTroopStack(state, group.id, speciesId, amount);
      if (amount > 0) addTroopStack(state, main.id, speciesId, amount);
    });
    state.armyGroups = state.armyGroups.filter(function (g) { return g.id !== groupId; });
    log(state, '🏳️ ' + group.name + ' aufgelöst; die Truppen kehren zur Herrscherarmee zurück.', '');
    return { ok: true };
  }
  function troopRecruitCost(state, speciesId, amount) {
    var sp = GD().creature(speciesId), idx = sp ? GD().rankIndex(sp.rank) : 0;
    amount = Math.max(1, Math.floor(amount || 1));
    var scale = Math.pow(1.8, idx);
    return { gold: round(2 * scale * amount), nahrung: round(2 * scale * amount), magie: round(Math.max(1, scale * 0.7) * amount) };
  }
  function recruitableTroops(state) {
    var maxRank = maxSummonRankIndex(state);
    return GD().creatures.filter(function (sp) { return !!sp.summon && GD().rankIndex(sp.rank) <= maxRank; });
  }
  function canRecruitTroops(state, groupId, speciesId, amount) {
    var group = findArmyGroup(state, groupId), sp = GD().creature(speciesId);
    amount = Math.max(1, Math.floor(amount || 1));
    if (!group || !sp || !sp.summon) return { ok: false, reason: 'Unbekannte Armee oder Truppenart' };
    if (GD().rankIndex(sp.rank) > maxSummonRankIndex(state)) return { ok: false, reason: 'Beschwörungskreis zu niedrig' };
    var types = Object.keys(group.troops).filter(function (id) { return group.troops[id] > 0; });
    if (!group.troops[speciesId] && types.length >= MAX_TROOP_TYPES) return { ok: false, reason: 'Maximal ' + MAX_TROOP_TYPES + ' Truppentypen je Armee' };
    var used = armyCommandUsed(group), cap = armyCommandCapacity(state, group), need = troopCommandCost(speciesId) * amount;
    if (used + need > cap) return { ok: false, reason: 'Kommandolimit überschritten (' + used + ' + ' + need + ' / ' + cap + ')' };
    var cost = troopRecruitCost(state, speciesId, amount);
    if (!canAfford(state, cost)) return { ok: false, reason: missingCost(state, cost).join(', '), cost: cost };
    return { ok: true, cost: cost };
  }
  function recruitTroops(state, groupId, speciesId, amount) {
    var check = canRecruitTroops(state, groupId, speciesId, amount); if (!check.ok) return check;
    var group = findArmyGroup(state, groupId), sp = GD().creature(speciesId);
    amount = Math.max(1, Math.floor(amount || 1));
    pay(state, check.cost);
    addTroopStack(state, group.id, speciesId, amount);
    log(state, '🛡️ ' + amount + '× ' + sp.name + ' schließen sich ' + group.name + ' an.', 'good');
    return { ok: true, count: group.troops[speciesId] };
  }
  function dismissTroops(state, groupId, speciesId, amount) {
    var group = findArmyGroup(state, groupId); if (!group || !group.troops[speciesId]) return { ok: false };
    amount = Math.min(group.troops[speciesId], Math.max(1, Math.floor(amount || 1)));
    removeTroopStack(state, groupId, speciesId, amount);
    return { ok: true, removed: amount };
  }
  function armyLeaderBonus(state, group) {
    if (group && group.rulerLed) return 0.18 + (state.herrscher.stage || 0) * 0.05 + Math.max(0, (state.herrscher.level || 1) - 1) * 0.005;
    var leader = findCreature(state, group.leaderUid); if (!leader) return 0;
    var sp = GD().creature(leader.speciesId), rank = sp ? GD().rankIndex(sp.rank) : 0;
    var mastery = 0, skills = leader.skills || [];
    skills.forEach(function (id) { mastery += skillProgress(leader, id).level || 1; });
    mastery = skills.length ? mastery / skills.length : 1;
    return 0.12 + rank * 0.04 + (mastery - 1) * 0.025 + (leader.fusionLevel || 0) * 0.04;
  }
  function armyGroupPower(state, group) {
    var leader = group && group.rulerLed ? state.herrscher : findCreature(state, group.leaderUid); if (!leader) return 0;
    var leaderSpecies = group.rulerLed ? null : GD().creature(leader.speciesId), troopPower = 0;
    for (var id in group.troops) {
      var sp = GD().creature(id), count = group.troops[id] || 0; if (!sp || count <= 0) continue;
      var synergy = leaderSpecies && sp.line === leaderSpecies.line ? 1.25 : 1;
      troopPower += sp.power * count * synergy;
    }
    var heroPower = group.rulerLed ? rulerPower(state) : creaturePower(state, leader);
    return round((heroPower + troopPower * (1 + armyLeaderBonus(state, group))) * (1 + (computeBonuses(state).armee || 0)));
  }
  function strategicNode(id) {
    return GD().strategicNodes.filter(function (n) { return n.id === id; })[0] || null;
  }
  function strategicNodeIndex(id) {
    for (var i = 0; i < GD().strategicNodes.length; i++) if (GD().strategicNodes[i].id === id) return i;
    return -1;
  }
  function strategicNeighbors(id) {
    var node = strategicNode(id);
    return node ? (node.links || []).map(strategicNode).filter(Boolean) : [];
  }
  function strategicSiteNode(siteId) {
    return GD().strategicNodes.filter(function (n) { return n.siteId === siteId; })[0] || null;
  }
  function strategicNodeName(nodeOrId) {
    var node = typeof nodeOrId === 'string' ? strategicNode(nodeOrId) : nodeOrId;
    if (!node) return 'Unbekannter Ort';
    var region = GD().region(node.id), site = node.siteId ? GD().strategicSite(node.siteId) : null;
    return node.name || (region && region.name) || (site && site.name) || node.id;
  }
  function mapSiteClaimed(state, siteId) { return (state.claimedMapSites || []).indexOf(siteId) >= 0; }
  function mapSiteExplored(state, siteId) { return (state.exploredMapSites || []).indexOf(siteId) >= 0; }
  function strategicNodeSecured(state, nodeId) {
    var node = strategicNode(nodeId); if (!node) return false;
    if (node.capital || node.kind === 'capital') return true;
    if (node.kind === 'region') return state.claimedRegions.indexOf(node.id) >= 0;
    if (node.kind === 'resource') return mapSiteClaimed(state, node.siteId);
    if (node.kind === 'discovery') return mapSiteExplored(state, node.siteId);
    return false;
  }
  function strategicNodeUnlocked(state, nodeId) {
    var node = strategicNode(nodeId); if (!node) return false;
    if (node.capital || node.kind === 'capital') return true;
    if (node.kind === 'region') return regionUnlocked(state, node.id);
    return !node.requires || state.claimedRegions.indexOf(node.requires) >= 0;
  }
  // Kürzester begehbarer Weg. Ungesicherte Ziele dürfen betreten werden,
  // blockieren aber als bewachte Orte den Durchmarsch.
  function strategicPath(state, fromId, targetId) {
    if (fromId === targetId) return [fromId];
    var queue = [fromId], prev = {}; prev[fromId] = null;
    while (queue.length) {
      var cur = queue.shift(), neighbors = strategicNeighbors(cur);
      for (var i = 0; i < neighbors.length; i++) {
        var n = neighbors[i]; if (Object.prototype.hasOwnProperty.call(prev, n.id)) continue;
        if (!strategicNodeUnlocked(state, n.id)) continue;
        if (n.id !== targetId && !strategicNodeSecured(state, n.id)) continue;
        prev[n.id] = cur;
        if (n.id === targetId) {
          var path = [targetId], p = cur;
          while (p != null) { path.unshift(p); p = prev[p]; }
          return path;
        }
        queue.push(n.id);
      }
    }
    return [];
  }
  function canMoveArmyGroup(state, groupId, targetId) {
    var group = findArmyGroup(state, groupId), target = strategicNode(targetId);
    if (!group || !target) return { ok: false, reason: 'Unbekanntes Ziel' };
    if (group.movement <= 0) return { ok: false, reason: 'Keine Bewegungspunkte – nächste Erneuerung abwarten' };
    var linked = strategicNeighbors(group.position).some(function (n) { return n.id === targetId; });
    if (!linked) return { ok: false, reason: 'Ziel ist nicht über einen direkten Weg verbunden' };
    if (!strategicNodeUnlocked(state, targetId)) return { ok: false, reason: 'Der Ort liegt noch im Nebel – sichere zuerst das zugehörige Territorium' };
    if (!strategicNodeSecured(state, group.position) && !strategicNodeSecured(state, targetId)) return { ok: false, reason: 'Sichere oder verlasse zuerst den aktuellen Ort' };
    return { ok: true };
  }
  function moveArmyGroup(state, groupId, targetId) {
    var check = canMoveArmyGroup(state, groupId, targetId); if (!check.ok) return check;
    var group = findArmyGroup(state, groupId), node = strategicNode(targetId);
    group.position = targetId; group.movement--;
    var region = GD().region(targetId);
    log(state, '🗺️ ' + group.name + ' zieht nach ' + strategicNodeName(node) + '.', '');
    return { ok: true, group: group };
  }
  function mapSiteUpgradeCost(state, siteId) {
    var site = GD().strategicSite(siteId); if (!site || !site.upgradeCost) return null;
    var level = (state.mapSiteLevels && state.mapSiteLevels[siteId]) || 1, cost = {};
    for (var k in site.upgradeCost) cost[k] = round(site.upgradeCost[k] * Math.pow(1.9, level - 1));
    return cost;
  }
  function canInteractMapSite(state, groupId, siteId) {
    var group = findArmyGroup(state, groupId), node = strategicSiteNode(siteId), site = GD().strategicSite(siteId);
    if (!group || !node || !site || group.position !== node.id) return { ok: false, reason: 'Eine Armee muss auf diesem Fundort stehen' };
    if (!strategicNodeUnlocked(state, node.id)) return { ok: false, reason: 'Fundort noch nicht zugänglich' };
    if (site.kind === 'resource' && mapSiteClaimed(state, siteId)) return { ok: false, reason: 'Anlage bereits gesichert' };
    if (site.kind === 'discovery' && mapSiteExplored(state, siteId)) return { ok: false, reason: 'Fundort bereits erkundet' };
    var power = armyGroupPower(state, group);
    if (power < site.guard) return { ok: false, reason: 'Armeekraft zu niedrig (' + power + '/' + site.guard + ')', power: power };
    return { ok: true, power: power };
  }
  function interactMapSite(state, groupId, siteId) {
    var check = canInteractMapSite(state, groupId, siteId); if (!check.ok) return check;
    var site = GD().strategicSite(siteId);
    if (site.kind === 'resource') {
      state.claimedMapSites = state.claimedMapSites || [];
      state.mapSiteLevels = state.mapSiteLevels || {};
      state.claimedMapSites.push(siteId); state.mapSiteLevels[siteId] = 1;
      log(state, site.icon + ' ' + site.name + ' gesichert – die Anlage produziert nun für Tempest.', 'gold');
      return { ok: true, kind: 'resource', site: site, level: 1 };
    }
    state.exploredMapSites = state.exploredMapSites || [];
    state.exploredMapSites.push(siteId); addResources(state, site.rewards || {});
    log(state, site.icon + ' ' + site.name + ' erkundet – der Fund wurde geborgen.', 'gold');
    return { ok: true, kind: 'discovery', site: site, rewards: site.rewards || {} };
  }
  function canUpgradeMapSite(state, siteId) {
    var site = GD().strategicSite(siteId), level = (state.mapSiteLevels && state.mapSiteLevels[siteId]) || 0;
    if (!site || site.kind !== 'resource' || !mapSiteClaimed(state, siteId)) return { ok: false, reason: 'Anlage noch nicht gesichert' };
    if (level >= 3) return { ok: false, reason: 'Maximalstufe erreicht' };
    var cost = mapSiteUpgradeCost(state, siteId);
    if (!canAfford(state, cost)) return { ok: false, reason: missingCost(state, cost).join(', '), cost: cost };
    return { ok: true, cost: cost, level: level };
  }
  function upgradeMapSite(state, siteId) {
    var check = canUpgradeMapSite(state, siteId); if (!check.ok) return check;
    pay(state, check.cost); state.mapSiteLevels[siteId] = check.level + 1;
    var site = GD().strategicSite(siteId);
    log(state, '🏗️ ' + site.name + ' auf Stufe ' + state.mapSiteLevels[siteId] + ' ausgebaut.', 'good');
    return { ok: true, level: state.mapSiteLevels[siteId] };
  }
  function stepArmyMap(state) {
    if (!state.nextMapRefreshTick) state.nextMapRefreshTick = MAP_DAY_TICKS;
    if (state.tick < state.nextMapRefreshTick) return false;
    var passed = Math.max(1, Math.floor((state.tick - state.nextMapRefreshTick) / MAP_DAY_TICKS) + 1);
    state.mapDay = (state.mapDay || 1) + passed;
    state.nextMapRefreshTick += passed * MAP_DAY_TICKS;
    (state.armyGroups || []).forEach(function (g) { g.movement = armyMovementMax(state, g); });
    return true;
  }
  function attackWithArmyGroup(state, groupId, risk) {
    var group = findArmyGroup(state, groupId), region = group ? GD().region(group.position) : null;
    if (!group || !region) return { ok: false, reason: 'Die Armee steht in keiner angreifbaren Region' };
    if (!regionUnlocked(state, region.id)) return { ok: false, reason: 'Region noch nicht erreichbar' };
    if (!RISK[risk]) risk = 'normal';
    var power = armyGroupPower(state, group), won = power >= region.power, partial = !won && power >= region.power * 0.6;
    var lossRate = won ? 0.04 : (partial ? 0.18 : 0.36);
    if (risk === 'sicher') lossRate *= 0.65;
    if (risk === 'riskant') lossRate *= 1.35;
    var warded = (group.wardCharges || 0) > 0;
    if (warded) { lossRate *= 0.5; group.wardCharges--; }
    var losses = {}, totalLosses = 0;
    for (var id in group.troops) {
      var count = group.troops[id], lost = Math.min(count, Math.max(won ? 0 : 1, round(count * lossRate * (0.75 + rng() * 0.5))));
      if (won && count >= 10) lost = Math.max(1, lost);
      removeTroopStack(state, group.id, id, lost); losses[id] = lost; totalLosses += lost;
    }
    var rk = RISK[risk], mult = won ? 1 : (partial ? 0.4 : 0), gains = {};
    if (mult > 0) {
      for (var res in region.rewards) gains[res] = round(region.rewards[res] * mult * rk.reward);
      addResources(state, gains);
    }
    var leader = group.rulerLed ? null : findCreature(state, group.leaderUid), leaderDead = false;
    if (won) {
      if (state.claimedRegions.indexOf(region.id) < 0) state.claimedRegions.push(region.id);
      group.battlesWon = (group.battlesWon || 0) + 1;
      state.metrics.armyVictories = (state.metrics.armyVictories || 0) + 1;
      if (leader) { addCreatureXp(state, leader, round(region.xp * 1.15)); addSkillXp(state, leader, round(region.xp * 0.5)); }
    } else if (risk === 'riskant' && leader) {
      releaseCreatureEquipment(state, leader); leaderDead = true;
      Object.keys(group.troops || {}).forEach(function (speciesId) { removeTroopStack(state, group.id, speciesId, group.troops[speciesId]); });
      state.creatures = state.creatures.filter(function (c) { return c.uid !== leader.uid; });
      state.armyGroups = state.armyGroups.filter(function (g) { return g.id !== group.id; });
    } else if (leader) {
      leader.woundedUntil = state.tick + Math.max(8, round(region.dauer * 0.8));
      group.movement = 0;
    } else {
      group.movement = 0;
    }
    log(state, won ? ('🏆 ' + group.name + ' erobert ' + region.name + '!') : ('💥 ' + group.name + ' scheitert in ' + region.name + '.'), won ? 'good' : 'bad');
    if (totalLosses) log(state, '⚰️ Truppenverluste: ' + totalLosses + '.', won ? '' : 'bad');
    if (warded) log(state, '🛡️ Die Feldbarriere fängt einen Teil der Verluste ab.', 'good');
    if (leaderDead) log(state, '☠️ Anführer ' + leader.name + ' ist im riskanten Feldzug gefallen.', 'bad');
    return { ok: true, won: won, partial: partial, power: power, regionPower: region.power, losses: losses, totalLosses: totalLosses, gains: gains, leaderDead: leaderDead, warded: warded };
  }

  // ---------- Expeditionen ----------
  function creatureBusy(state, uid) {
    for (var i = 0; i < state.expeditions.length; i++) {
      if (state.expeditions[i].creatureUids.indexOf(uid) >= 0) return true;
    }
    if (state.activeCombat && state.activeCombat.status === 'active') {
      for (var j = 0; j < state.activeCombat.party.length; j++) {
        if (state.activeCombat.party[j].key === uid) return true;
      }
    }
    if (leaderArmyGroup(state, uid)) return true;
    return false;
  }
  function releaseCreatureEquipment(state, creature) {
    if (!creature || !creature.equipment) return;
    for (var slot in creature.equipment) {
      var item = findItem(state, creature.equipment[slot]);
      if (item) item.equippedBy = null;
      creature.equipment[slot] = null;
    }
  }
  function armyAvailable(state) {
    return state.creatures.filter(function (c) { return c.job === 'armee' && !creatureBusy(state, c.uid) && !isWounded(state, c); });
  }
  // Risikostufen für Expeditionen
  var RISK = {
    sicher:  { name: 'Sicher',  icon: '🛟', reward: 0.8, drop: 0.8, defeat: 'wound' },
    normal:  { name: 'Normal',  icon: '⚖️', reward: 1.0, drop: 1.0, defeat: 'wound' },
    riskant: { name: 'Riskant', icon: '🔥', reward: 1.4, drop: 1.4, defeat: 'death' }
  };
  function regionUnlocked(state, regionId) {
    var regions = GD().regions;
    var idx = regions.map(function (r) { return r.id; }).indexOf(regionId);
    if (idx <= 0) return true;
    return state.claimedRegions.indexOf(regions[idx - 1].id) >= 0;
  }
  function expeditionPower(state, creatureUids, rulerJoin) {
    var b = computeBonuses(state);
    var total = 0;
    creatureUids.forEach(function (uid) { var c = findCreature(state, uid); if (c) total += creaturePower(state, c); });
    if (rulerJoin) total += rulerPower(state);
    return round(total * (1 + b.armee));
  }
  function canStartExpedition(state, regionId, creatureUids, rulerJoin) {
    var r = GD().region(regionId); if (!r) return { ok: false, reason: 'Unbekannte Region' };
    if (!regionUnlocked(state, regionId)) return { ok: false, reason: 'Erst vorige Region erobern' };
    if (rulerJoin && state.activeCombat && state.activeCombat.status === 'active') return { ok: false, reason: 'Der Herrscher kämpft bereits taktisch' };
    if (!creatureUids || creatureUids.length === 0) {
      if (!rulerJoin) return { ok: false, reason: 'Wähle mindestens eine Einheit' };
    }
    for (var i = 0; i < creatureUids.length; i++) {
      if (creatureBusy(state, creatureUids[i])) return { ok: false, reason: 'Einheit bereits unterwegs' };
      if (isWounded(state, findCreature(state, creatureUids[i]))) return { ok: false, reason: 'Verwundete Einheit – erst heilen lassen' };
    }
    return { ok: true };
  }
  function startExpedition(state, regionId, creatureUids, rulerJoin, risk) {
    var check = canStartExpedition(state, regionId, creatureUids, rulerJoin);
    if (!check.ok) return { ok: false, reason: check.reason };
    var r = GD().region(regionId);
    if (!RISK[risk]) risk = 'normal';
    var power = expeditionPower(state, creatureUids, rulerJoin);
    var tempo = clamp(computeBonuses(state).expedTempo || 0, 0, 0.6);   // Magie verkürzt die Reise
    var dauer = Math.max(2, round(r.dauer * (1 - tempo)));
    var exp = {
      regionId: regionId,
      creatureUids: creatureUids.slice(),
      rulerJoined: !!rulerJoin,
      risk: risk,
      power: power,
      dauer: dauer,
      startTick: state.tick,
      returnsAtTick: state.tick + dauer
    };
    state.expeditions.push(exp);
    log(state, '🚩 Expedition nach ' + r.icon + ' ' + r.name + ' gestartet (Kraft ' + power + ' vs ' + r.power + ').', '');
    return { ok: true, expedition: exp };
  }
  function makeDropItem(state, region) {
    var pool = GD().recipes.filter(function (r) { return !r.unique; });
    var recipe = pool[Math.floor(rng() * pool.length)];
    var rarity = rollRarity(state);
    return makeItem(state, recipe, rarity);
  }
  function resolveExpedition(state, exp) {
    var r = GD().region(exp.regionId);
    var power = exp.power;
    var won = power >= r.power;
    var partial = !won && power >= r.power * 0.6;
    var mult = won ? 1 : (partial ? 0.5 : 0.2);
    var rk = RISK[exp.risk] || RISK.normal;
    var b = computeBonuses(state);
    // Belohnungen (mit etwas Varianz; Seelen-Bonus aus Magie/Forschung; Risiko-Multiplikator)
    var gains = {};
    for (var res in r.rewards) {
      var amt = r.rewards[res] * mult * rk.reward * (0.85 + rng() * 0.3);
      if (res === 'seelen') amt *= (1 + b.seelen);
      gains[res] = round(amt);
    }
    addResources(state, gains);
    // XP an Einheiten (mit XP-Bonus)
    var xpEach = round(r.xp * mult * (1 + b.xp));
    exp.creatureUids.forEach(function (uid) { var c = findCreature(state, uid); if (c) addCreatureXp(state, c, xpEach); });
    exp.creatureUids.forEach(function (uid) { var c = findCreature(state, uid); if (c && c.named) addSkillXp(state, c, Math.max(1, round(xpEach * 0.35))); });
    // Herrscher-EP
    addRulerXp(state, round(r.xp * mult * (1 + b.xp) * (exp.rulerJoined ? 0.6 : 0.35)));
    if (exp.rulerJoined) addSkillXp(state, state.herrscher, Math.max(1, round(xpEach * 0.3)));
    // Beute (mit Drop-Bonus + Risiko)
    var dchance = Math.min(0.95, r.dropChance * (1 + b.drop) * rk.drop);
    var drop = (won && rng() < dchance) ? makeDropItem(state, r) : null;
    // Niederlagen: Sicher/Normal verwunden; Riskant bedeutet endgültigen Tod.
    var wounded = [], dead = [];
    if (!won && exp.risk === 'riskant') {
      exp.creatureUids.forEach(function (uid) {
        var c = findCreature(state, uid);
        if (c) {
          releaseCreatureEquipment(state, c); dead.push(c);
          if (!c.named && c.armyGroupId != null) {
            var g = findArmyGroup(state, c.armyGroupId);
            if (g && g.troops[c.speciesId]) { g.troops[c.speciesId] = Math.max(0, g.troops[c.speciesId] - stackCount(c)); if (!g.troops[c.speciesId]) delete g.troops[c.speciesId]; }
          }
        }
      });
      if (dead.length) state.creatures = state.creatures.filter(function (c) { return dead.indexOf(c) < 0; });
    } else if (!won) {
      var heil = clamp(b.heiltempo || 0, 0, 0.8);
      var dur = Math.max(4, round(r.dauer * 0.9 * (1 - heil)));
      exp.creatureUids.forEach(function (uid) {
        var c = findCreature(state, uid);
        if (c) { c.woundedUntil = state.tick + dur; wounded.push(c); }
      });
    }
    // Eroberung
    var claimed = false;
    if (won && state.claimedRegions.indexOf(r.id) < 0) { state.claimedRegions.push(r.id); claimed = true; }
    state.metrics.expeditions = (state.metrics.expeditions || 0) + 1;
    if (won) state.metrics.expeditionsWon = (state.metrics.expeditionsWon || 0) + 1;
    // Log
    var kind = won ? 'good' : (partial ? '' : 'bad');
    var msg = won ? ('🏆 ' + r.name + ' erobert!' + (claimed ? ' (Territorium gesichert)' : ''))
                  : (partial ? ('⚔️ Teilerfolg in ' + r.name + '.') : ('💀 Niederlage in ' + r.name + '.'));
    log(state, msg, kind);
    if (drop) log(state, '🎁 Beute: ' + GD().rarity(drop.rarity).name + 'e ' + drop.name + '.', 'gold');
    if (wounded.length) log(state, '🩹 ' + wounded.length + ' Einheit(en) kehren verwundet zurück.', 'bad');
    if (dead.length) log(state, '☠️ ' + dead.length + ' Einheit(en) sind im riskanten Einsatz gefallen. Ihre Ausrüstung wurde geborgen.', 'bad');
    return { regionId: r.id, won: won, partial: partial, gains: gains, xpEach: xpEach, drop: drop, claimed: claimed, power: power, regionPower: r.power, risk: exp.risk, wounded: wounded.length, dead: dead.length };
  }

  // ---------- Rivalen & Bedrohung ----------
  var THREAT_RAID = 100;       // Schwelle, ab der ein Angriff geplant wird
  var RAID_LEAD = 18;          // Vorwarnzeit (Ticks) bis der Angriff eintrifft
  var RIVAL_COUNTER_REPELS = 3;// nötige Abwehren, bevor ein Gegenangriff möglich ist

  // Verteidigungswert = Labyrinth + stationierte (freie, unverwundete) Armee + Verteidigungsbonus
  function defenseValue(state) {
    var def = 0;
    var lab = GD().building('labyrinth');
    if (lab && lab.defensePer) def += (state.buildings.labyrinth || 0) * lab.defensePer;
    armyAvailable(state).forEach(function (c) { def += creaturePower(state, c); });
    var b = computeBonuses(state);
    return round(def * (1 + (b.verteidigung || 0)));
  }
  function threatRate(state) {
    // Bedrohung steigt erst, sobald man zu expandieren beginnt; skaliert mit Territorium.
    var claimed = (state.claimedRegions || []).length;
    if (claimed <= 0) return 0;
    var ruhe = clamp(computeBonuses(state).threatRuhe || 0, 0, 0.8);   // Magie hält Rivalen in Schach
    return (0.05 + 0.03 * claimed) * (1 - ruhe);
  }
  function pickRival(state) {
    var def = Math.max(50, defenseValue(state));
    var list = GD().rivals, chosen = list[0];
    list.forEach(function (r) { if (r.basePower <= def * 1.6) chosen = r; });
    return chosen;
  }
  function scheduleRaid(state) {
    var rv = pickRival(state);
    var prog = (state.rivalProgress && state.rivalProgress[rv.id]) || 0;
    var basePower = rv.basePower * Math.pow(rv.growth, prog);
    // an die Spielerstärke koppeln, damit es eine echte Bedrohung bleibt
    var power = round(Math.max(basePower, defenseValue(state) * 0.9) * (0.9 + rng() * 0.3));
    state.raid = { rivalId: rv.id, power: power, atTick: state.tick + RAID_LEAD, warnTick: state.tick };
    log(state, '⚠️ ' + rv.icon + ' ' + rv.name + ' rüstet zum Angriff (Kraft ~' + power + ').', 'bad');
    return { rivalId: rv.id, power: power, atTick: state.raid.atTick };
  }
  function resolveRaid(state) {
    var raid = state.raid; if (!raid) return null;
    var rv = GD().rival(raid.rivalId);
    var def = defenseValue(state);
    var repelled = def >= raid.power;
    if (repelled) {
      addResources(state, rv.reward);
      if (!state.rivalProgress) state.rivalProgress = {};
      state.rivalProgress[rv.id] = (state.rivalProgress[rv.id] || 0) + 1;
      state.metrics.raidsRepelled = (state.metrics.raidsRepelled || 0) + 1;
      log(state, '🛡️ Angriff von ' + rv.name + ' abgewehrt (Verteidigung ' + def + ' ≥ ' + raid.power + ')! Beute erbeutet.', 'good');
    } else {
      var loss = {};
      ['gold', 'material', 'magie'].forEach(function (k) { loss[k] = round((state.resources[k] || 0) * 0.1); });
      pay(state, loss);
      var army = state.creatures.filter(function (c) { return c.job === 'armee' && !isWounded(state, c) && !creatureBusy(state, c.uid); });
      var heilR = clamp(computeBonuses(state).heiltempo || 0, 0, 0.8);
      if (army.length) army[Math.floor(rng() * army.length)].woundedUntil = state.tick + Math.max(4, round(30 * (1 - heilR)));
      log(state, '💥 ' + rv.name + ' durchbricht die Verteidigung (' + def + ' < ' + raid.power + ')! Verluste erlitten.', 'bad');
    }
    var result = { rivalId: rv.id, repelled: repelled, power: raid.power, defense: def };
    state.raid = null;
    return result;
  }
  function rivalProgress(state, rivalId) { return (state.rivalProgress && state.rivalProgress[rivalId]) || 0; }
  function isRivalDefeated(state, rivalId) { return (state.rivalsDefeated || []).indexOf(rivalId) >= 0; }
  function canCounterAttack(state, rivalId) {
    var rv = GD().rival(rivalId); if (!rv) return { ok: false };
    if (isRivalDefeated(state, rivalId)) return { ok: false, reason: 'Bereits besiegt' };
    var prog = rivalProgress(state, rivalId);
    if (prog < RIVAL_COUNTER_REPELS) return { ok: false, reason: 'Erst ' + RIVAL_COUNTER_REPELS + ' Angriffe abwehren (' + prog + '/' + RIVAL_COUNTER_REPELS + ')' };
    return { ok: true };
  }
  function rivalLairPower(state, rivalId) {
    var rv = GD().rival(rivalId);
    return round(rv.basePower * Math.pow(rv.growth, rivalProgress(state, rivalId)) * 1.5);
  }
  function counterAttackRival(state, rivalId, creatureUids) {
    var chk = canCounterAttack(state, rivalId);
    if (!chk.ok) return { ok: false, reason: chk.reason };
    var rv = GD().rival(rivalId);
    var enemyPower = rivalLairPower(state, rivalId);
    var b = computeBonuses(state);
    var power = 0;
    (creatureUids || []).forEach(function (uid) {
      var c = findCreature(state, uid);
      if (c && !isWounded(state, c) && !creatureBusy(state, uid)) power += creaturePower(state, c);
    });
    power += rulerPower(state);                 // der Herrscher führt den Gegenangriff an
    power = round(power * (1 + (b.armee || 0)));
    var won = power >= enemyPower;
    if (won) {
      state.rivalsDefeated.push(rivalId);
      addResources(state, { seelen: (rv.reward.seelen || 100) * 5, gold: 1000, magie: 500 });
      log(state, '👑 ' + rv.name + ' endgültig besiegt (Kraft ' + power + ' ≥ ' + enemyPower + ')! Dauerhafter Reichsbonus.', 'gold');
    } else {
      log(state, '⚔️ Gegenangriff auf ' + rv.name + ' gescheitert (Kraft ' + power + ' < ' + enemyPower + ').', 'bad');
    }
    return { ok: true, won: won, power: power, enemyPower: enemyPower };
  }
  // In tick() aufgerufen: Bedrohung steigern / Angriff einplanen / auflösen.
  function stepThreat(state) {
    var warning = null, result = null;
    if (!state.raid) {
      state.threat = (state.threat || 0) + threatRate(state);
      if (state.threat >= THREAT_RAID) { state.threat = 0; warning = scheduleRaid(state); }
    } else if (state.tick >= state.raid.atTick) {
      result = resolveRaid(state);
    }
    return { raidWarning: warning, raidResult: result };
  }

  // ---------- Zufalls-Events ----------
  var EVENT_MIN = 120, EVENT_MAX = 300;   // Tick-Abstand zwischen Events
  function scheduleNextEvent(state) { state.nextEventTick = state.tick + EVENT_MIN + Math.floor(rng() * (EVENT_MAX - EVENT_MIN)); }
  function applyEventEffect(state, eff) {
    if (!eff) return;
    if (eff.cost) pay(state, eff.cost);
    if (eff.res) addResources(state, eff.res);
    if (eff.buff) state.tempBuffs.push({ effect: eff.buff.effect, untilTick: state.tick + (eff.buff.dauer || 60), label: eff.buff.label || '' });
    if (eff.threat) state.threat = Math.max(0, (state.threat || 0) + eff.threat);
    if (typeof eff.summon === 'string' && usedCapacity(state) < capacity(state)) {
      addTroopStack(state, RULER_ARMY_ID, eff.summon, 1);
    }
  }
  function pickEvent(state) {
    var list = GD().events;
    var sum = 0; list.forEach(function (e) { sum += (e.weight || 1); });
    var roll = rng() * sum;
    for (var i = 0; i < list.length; i++) { roll -= (list[i].weight || 1); if (roll <= 0) return list[i]; }
    return list[0];
  }
  // In tick(): nächstes Event auslösen (auto sofort, sonst zur Auswahl anbieten).
  function stepEvents(state) {
    // abgelaufene Buffs entfernen
    if (state.tempBuffs && state.tempBuffs.length) {
      state.tempBuffs = state.tempBuffs.filter(function (tb) { return tb.untilTick > state.tick; });
    }
    if (state.activeEvent) return null;                 // wartet auf Spielerwahl
    if (!state.nextEventTick) { scheduleNextEvent(state); return null; }
    if (state.tick < state.nextEventTick) return null;
    var ev = pickEvent(state);
    scheduleNextEvent(state);
    if (ev.auto || !ev.choices) {
      applyEventEffect(state, ev.effect);
      log(state, ev.icon + ' ' + ev.title + ': ' + ev.desc, 'gold');
      return { id: ev.id, auto: true };
    }
    state.activeEvent = ev.id;
    log(state, ev.icon + ' ' + ev.title + ' – eine Entscheidung wartet.', '');
    return { id: ev.id, auto: false };
  }
  function resolveEvent(state, choiceIdx) {
    if (!state.activeEvent) return { ok: false };
    var ev = GD().event(state.activeEvent);
    if (!ev || !ev.choices) { state.activeEvent = null; return { ok: false }; }
    var ch = ev.choices[choiceIdx]; if (!ch) return { ok: false, reason: 'Ungültige Wahl' };
    if (ch.effect && ch.effect.cost && !canAfford(state, ch.effect.cost)) return { ok: false, reason: missingCost(state, ch.effect.cost).join(', ') };
    applyEventEffect(state, ch.effect);
    log(state, ev.icon + ' ' + ev.title + ': ' + ch.label + '.', 'good');
    state.activeEvent = null;
    return { ok: true };
  }

  // ---------- Affinität ----------
  function canChooseAffinity(state) {
    if (state.affinity) return { ok: false, reason: 'Bereits gewählt' };
    if (state.herrscher.stage < 2) return { ok: false, reason: 'Erst ab Herrscher-Stufe „Dämonen-Schleim"' };
    return { ok: true };
  }
  function chooseAffinity(state, id) {
    var chk = canChooseAffinity(state); if (!chk.ok) return { ok: false, reason: chk.reason };
    var aff = GD().affinity(id); if (!aff) return { ok: false, reason: 'Unbekannte Affinität' };
    state.affinity = id;
    log(state, aff.icon + ' Affinität gewählt: ' + aff.name + '. ' + aff.desc, 'gold');
    return { ok: true };
  }

  // ============================================================
  //  Freischaltungen / progressive Sichtbarkeit (gegen Überforderung)
  // ============================================================
  // Tabs & Features schalten sich nach und nach frei. test(state)->bool.
  var FEATURES = {
    tab_magie:    { kind: 'tab', tab: 'magie',    name: 'Magie & Forschung', icon: '🔮',
      test: function (s) { return (s.buildings.forschungsgilde || 0) >= 1; },
      hint: 'Baue die Forschungsgilde, um Magie & Forschung zu öffnen.' },
    tab_schmiede: { kind: 'tab', tab: 'schmiede', name: 'Schmiede', icon: '⚒️',
      test: function (s) { return (s.buildings.schmiede || 0) >= 1; },
      hint: 'Baue die Schmiede, um Ausrüstung herzustellen.' },
    tab_karte:    { kind: 'tab', tab: 'karte',    name: 'Karte & Expeditionen', icon: '🗺️',
      test: function (s) { return ((s.metrics && s.metrics.named) || 0) >= 1; },
      hint: 'Benenne deine erste Kreatur, um Expeditionen & Karte freizuschalten.' },
    fusion:       { kind: 'feature', name: 'Chimära-Fusion', icon: '🧬',
      test: function (s) { return s.herrscher.stage >= 3; },
      hint: 'Erreiche die Herrscher-Stufe „Dämonenlord", um Kreaturen zu fusionieren.' },
    affinitaet:   { kind: 'feature', name: 'Affinität', icon: '🌟',
      test: function (s) { return s.herrscher.stage >= 2; },
      hint: 'Erreiche Herrscher-Stufe 2, um eine Element-Affinität zu wählen.' }
  };
  // Gebäude erscheinen nach und nach (Kern-Gebäude immer; Rest nach Fortschritt).
  var BUILDING_UNLOCK = {
    forschungsgilde: { test: function (s) { return (s.claimedRegions || []).length >= 1; }, hint: 'Erobere deine erste Region.' },
    arkane_akademie: { test: function (s) { return (s.buildings.forschungsgilde || 0) >= 1; }, hint: 'Baue zuerst die Forschungsgilde.' },
    schmiede:        { test: function (s) { return (s.claimedRegions || []).length >= 1; }, hint: 'Erobere deine erste Region.' },
    bibliothek:      { test: function (s) { return (s.buildings.forschungsgilde || 0) >= 1; }, hint: 'Baue die Forschungsgilde.' },
    labyrinth:       { test: function (s) { return (s.claimedRegions || []).length >= 2; }, hint: 'Erobere 2 Regionen.' },
    arena:           { test: function (s) { return (s.claimedRegions || []).length >= 2; }, hint: 'Erobere 2 Regionen.' },
    handelshafen:    { test: function (s) { return (s.buildings.markt || 0) >= 2; }, hint: 'Bringe den Markt auf Stufe 2.' },
    seelentempel:    { test: function (s) { return (s.buildings.labyrinth || 0) >= 1; }, hint: 'Baue das Labyrinth.' }
  };
  function featureUnlocked(state, id) { var f = FEATURES[id]; return f ? !!f.test(state) : true; }
  function featureHint(id) { var f = FEATURES[id]; return f ? f.hint : ''; }
  function buildingUnlocked(state, id) { var u = BUILDING_UNLOCK[id]; return u ? !!u.test(state) : true; }
  function buildingHint(id) { var u = BUILDING_UNLOCK[id]; return u ? u.hint : ''; }
  function tabUnlocked(state, tabId) {
    for (var id in FEATURES) { if (FEATURES[id].kind === 'tab' && FEATURES[id].tab === tabId) return FEATURES[id].test(state); }
    return true;   // nicht gegatete Tabs sind immer offen
  }
  // Aktuell freigeschaltete Kennungen (Vergleichsbasis für Ankündigungen).
  function currentUnlockSet(state) {
    var out = [];
    for (var id in FEATURES) { if (FEATURES[id].test(state)) out.push(id); }
    for (var bid in BUILDING_UNLOCK) { if (BUILDING_UNLOCK[bid].test(state)) out.push('build_' + bid); }
    return out;
  }
  // Beim Laden einmal abgleichen, damit bestehende Freischaltungen nicht als „neu" gemeldet werden.
  function syncUnlocks(state) { state.seenUnlocks = currentUnlockSet(state); return state.seenUnlocks; }
  // Neu freigeschaltete Features seit dem letzten Aufruf zurückgeben (und merken).
  function collectNewUnlocks(state) {
    if (!state.seenUnlocks) state.seenUnlocks = [];
    var fresh = [];
    currentUnlockSet(state).forEach(function (id) {
      if (state.seenUnlocks.indexOf(id) < 0) { state.seenUnlocks.push(id); fresh.push(id); }
    });
    return fresh.map(function (id) {
      if (id.indexOf('build_') === 0) { var bd = GD().building(id.slice(6)); return { id: id, icon: bd ? bd.icon : '🏗️', name: bd ? bd.name : id, kind: 'build' }; }
      var f = FEATURES[id]; return { id: id, icon: f ? f.icon : '✨', name: f ? f.name : id, kind: f ? f.kind : 'feature' };
    });
  }
  // Sichtbare Regionen: alle freigeschalteten + die nächste (eine) als Ausblick.
  function visibleRegions(state) {
    var out = [], regs = GD().regions;
    for (var i = 0; i < regs.length; i++) {
      out.push(regs[i]);
      if (!regionUnlocked(state, regs[i].id)) break;   // erste gesperrte ist der Ausblick → danach Schluss
    }
    return out;
  }
  // Grundformen des nächsthöheren (noch gesperrten) Beschwörungsrangs – als Ausblick.
  function summonTeasers(state) {
    var maxIdx = maxSummonRankIndex(state);
    return GD().creatures.filter(function (sp) { return sp.summon && GD().rankIndex(sp.rank) === maxIdx + 1; });
  }

  // ============================================================
  //  Chimära-Fusion (Endgame-Kreaturen-Verschmelzung)
  // ============================================================
  var FUSION_MAX = 5;
  function fusionCost(inst) {
    var sp = GD().creature(inst.speciesId);
    var rp = GD().RANK_POWER[sp.rank] || 1;
    var n = (inst.fusionLevel || 0) + 1;
    return { seelen: round(60 * rp * n), magie: round(120 * rp * n) };
  }
  function canFuse(state, baseUid, catalystUid) {
    if (!featureUnlocked(state, 'fusion')) return { ok: false, reason: 'Fusion noch nicht freigeschaltet' };
    if (baseUid === catalystUid) return { ok: false, reason: 'Wähle zwei verschiedene Kreaturen' };
    var base = findCreature(state, baseUid), cat = findCreature(state, catalystUid);
    if (!base || !cat) return { ok: false, reason: 'Kreatur nicht gefunden' };
    if (!base.named) return { ok: false, reason: 'Die Basis muss benannt sein' };
    if (!cat.named) return { ok: false, reason: 'Auch der Katalysator muss benannt sein' };
    if ((base.fusionLevel || 0) >= FUSION_MAX) return { ok: false, reason: 'Maximale Fusionsstufe erreicht' };
    if (creatureBusy(state, baseUid) || creatureBusy(state, catalystUid)) return { ok: false, reason: 'Einheit ist auf Expedition' };
    var cost = fusionCost(base);
    if (!canAfford(state, cost)) return { ok: false, reason: missingCost(state, cost).join(', ') };
    return { ok: true, cost: cost };
  }
  function fuse(state, baseUid, catalystUid) {
    var chk = canFuse(state, baseUid, catalystUid);
    if (!chk.ok) return { ok: false, reason: chk.reason };
    var base = findCreature(state, baseUid), cat = findCreature(state, catalystUid);
    pay(state, chk.cost);
    base.fusionLevel = (base.fusionLevel || 0) + 1;
    // Einen Skill des Katalysators erben, wenn ein Slot frei ist
    var learned = null, catSkills = cat.skills || [];
    for (var i = 0; i < catSkills.length; i++) {
      if (base.skills.indexOf(catSkills[i]) < 0 && skillSlotsUsed(base) < skillCapacity(base)) {
        base.skills.push(catSkills[i]); skillProgress(base, catSkills[i]); learned = catSkills[i]; break;
      }
    }
    addCreatureXp(state, base, round(50 * (cat.level || 1)));        // etwas Erfahrung übertragen
    if (cat.equipment) { for (var sl in cat.equipment) { if (cat.equipment[sl] != null) unequipItem(state, cat.equipment[sl]); } }
    state.creatures = state.creatures.filter(function (c) { return c.uid !== catalystUid; });
    state.metrics.fused = (state.metrics.fused || 0) + 1;
    log(state, '🧬 ' + base.name + ' verschmilzt mit ' + (cat.named ? cat.name : GD().creature(cat.speciesId).name) + ' und erstarkt (Fusion ' + base.fusionLevel + '/' + FUSION_MAX + ')!', 'gold');
    return { ok: true, base: base, learnedSkill: learned };
  }

  // ============================================================
  //  Zuschauer-/Auto-Modus (das Reich spielt sich selbst)
  // ============================================================
  function affordReserve(state, cost, factor) {
    if (!cost) return true;
    for (var k in cost) { if ((state.resources[k] || 0) < cost[k] * factor) return false; }
    return true;
  }
  function pickAspectFor(inst) {
    var sp = GD().creature(inst.speciesId);
    if (sp && sp.role === 'Magie') return 'arkanist';
    if (sp && sp.role === 'Verteidigung') return 'bollwerk';
    return 'wuterich';
  }
  var RES_JOB = { magie: 'magie', material: 'material', gold: 'gold', nahrung: 'nahrung', wissen: 'wissen' };
  function pickJobFor(state, inst) {
    var army = state.creatures.filter(function (c) { return c.job === 'armee'; }).length;
    var wantArmy = Math.ceil(state.creatures.length * 0.35);
    if (featureUnlocked(state, 'tab_karte') && army < Math.max(2, wantArmy)) return 'armee';
    // sonst: Job zur knappsten Produktionsressource
    var keys = ['magie', 'material', 'gold', 'nahrung', 'wissen'];
    var lowest = keys[0], lo = Infinity;
    keys.forEach(function (k) { var v = state.resources[k] || 0; if (v < lo) { lo = v; lowest = k; } });
    return RES_JOB[lowest] || 'magie';
  }
  function bestSummon(state) {
    var list = summonableSpecies(state).slice().sort(function (a, b) { return b.power - a.power; });
    for (var i = 0; i < list.length; i++) { if (affordReserve(state, summonCost(state, list[i].id), 1.5) && canSummon(state, list[i].id).ok) return list[i]; }
    return null;
  }
  function bestBuildingUpgrade(state) {
    var best = null, bestScore = Infinity;
    GD().buildings.forEach(function (bd) {
      if (!buildingUnlocked(state, bd.id)) return;
      var cost = buildingCost(state, bd.id);
      if (!affordReserve(state, cost, 1.8)) return;
      var total = 0; for (var k in cost) total += cost[k];
      var lvl = state.buildings[bd.id] || 0;
      var score = total * (1 + lvl * 0.5);   // günstige & niedrigstufige Bauten bevorzugen
      if (score < bestScore) { bestScore = score; best = bd.id; }
    });
    return best;
  }
  function pickAffinityFor(state) {
    var count = {};
    (state.learnedMagic || []).forEach(function (id) { var m = GD().spell(id); if (m) count[m.schule] = (count[m.schule] || 0) + 1; });
    var bestSchool = null, bestN = -1;
    GD().affinities.forEach(function (a) { var n = count[a.school] || 0; if (n > bestN) { bestN = n; bestSchool = a.id; } });
    return bestSchool || 'tod';
  }
  // Führt EINE sinnvolle Aktion aus und beschreibt sie (oder null, wenn nichts ansteht).
  function autoPlayStep(state) {
    // 0) offenes Wahl-Event automatisch entscheiden
    if (state.activeEvent) {
      var ev = GD().event(state.activeEvent);
      if (ev && ev.choices) {
        var idx = 0;
        for (var ci = 0; ci < ev.choices.length; ci++) { var eff = ev.choices[ci].effect || {}; if (!eff.cost || canAfford(state, eff.cost)) { idx = ci; break; } }
        if (resolveEvent(state, idx).ok) return { text: 'Ereignis „' + ev.title + '" entschieden.' };
      } else { state.activeEvent = null; }
    }
    // 1) Hungersnot abwenden
    var prod = production(state);
    if ((prod.hunger || prod.rates.nahrung < 0) && canBuild(state, 'farm')) { build(state, 'farm'); return { text: '🌾 Farm ausgebaut.' }; }
    // 2) Kapazität voll → Wohnbezirk
    if (usedCapacity(state) >= capacity(state) && canBuild(state, 'wohnbezirk')) { build(state, 'wohnbezirk'); return { text: '🏘️ Wohnbezirk ausgebaut.' }; }
    // 3) unbenannte Kreatur benennen
    var unnamed = state.creatures.filter(function (c) { return !c.named && !creatureBusy(state, c.uid); });
    for (var u = 0; u < unnamed.length; u++) { if (canName(state, unnamed[u]).ok) { var r3 = nameCreature(state, unnamed[u].uid, null, pickAspectFor(unnamed[u])); if (r3.ok) return { text: '✨ „' + r3.creature.name + '" benannt.' }; } }
    // 4) bereite Evolution durchführen
    for (var e = 0; e < state.creatures.length; e++) {
      var c = state.creatures[e]; if (creatureBusy(state, c.uid)) continue;
      var ready = evolveOptions(state, c).filter(function (o) { return o.ok; });
      if (ready.length) { var r4 = evolve(state, c.uid, ready[0].to); if (r4.ok) return { text: '🧬 Evolution zu ' + GD().creature(ready[0].to).name + '.' }; }
    }
    // 4b) Benannte Elite als strategische Armee aufstellen und auf der Karte führen.
    if ((state.armyGroups || []).length < maxArmyGroups(state)) {
      var leaders = eligibleArmyLeaders(state);
      if (leaders.length && canCreateArmyGroup(state, leaders[0].uid).ok) {
        var agr = createArmyGroup(state, leaders[0].uid);
        if (agr.ok) return { text: '🚩 ' + agr.group.name + ' aufgestellt.' };
      }
    }
    for (var agi = 0; agi < (state.armyGroups || []).length; agi++) {
      var ag = state.armyGroups[agi], usedCmd = armyCommandUsed(ag), capCmd = armyCommandCapacity(state, ag);
      if (usedCmd < capCmd * 0.6) {
        var lead = findCreature(state, ag.leaderUid), leadSp = lead ? GD().creature(lead.speciesId) : null;
        var pool = recruitableTroops(state).slice().sort(function (a, b) {
          var as = leadSp && a.line === leadSp.line ? 1 : 0, bs = leadSp && b.line === leadSp.line ? 1 : 0;
          return bs - as || troopCommandCost(a.id) - troopCommandCost(b.id);
        });
        for (var api = 0; api < pool.length; api++) {
          if (canRecruitTroops(state, ag.id, pool[api].id, 10).ok) {
            recruitTroops(state, ag.id, pool[api].id, 10);
            return { text: '🛡️ 10× ' + pool[api].name + ' für ' + ag.name + ' rekrutiert.' };
          }
        }
      }
      var agNode = strategicNode(ag.position), agSite = agNode && agNode.siteId ? GD().strategicSite(agNode.siteId) : null;
      if (agSite && !strategicNodeSecured(state, agNode.id)) {
        var siteAction = canInteractMapSite(state, ag.id, agSite.id);
        if (siteAction.ok) {
          var siteResult = interactMapSite(state, ag.id, agSite.id);
          if (siteResult.ok) return { text: agSite.icon + ' ' + agSite.name + (agSite.kind === 'resource' ? ' gesichert.' : ' erkundet.') };
        }
      }
      var agRegion = GD().region(ag.position), agClaimed = agRegion && state.claimedRegions.indexOf(agRegion.id) >= 0;
      if (agRegion && !agClaimed && !(ag.wardCharges || 0) && canCastAdventureMagic(state, 'abenteuer_feldbarriere', ag.id).ok) {
        castAdventureMagic(state, 'abenteuer_feldbarriere', ag.id); return { text: '🛡️ Feldbarriere schützt ' + ag.name + '.' };
      }
      if (agRegion && !agClaimed && armyCommandUsed(ag) > 0 && armyGroupPower(state, ag) >= agRegion.power) {
        var ar = attackWithArmyGroup(state, ag.id, 'normal');
        if (ar.ok) return { text: ar.won ? ('🏆 ' + agRegion.name + ' mit ' + ag.name + ' erobert.') : ('💥 Feldzug in ' + agRegion.name + ' gescheitert.') };
      }
      if (ag.movement > 0 && strategicNodeSecured(state, ag.position)) {
        var candidates = GD().strategicNodes.filter(function (n) {
          if (!n.siteId || strategicNodeSecured(state, n.id) || !strategicNodeUnlocked(state, n.id)) return false;
          var site = GD().strategicSite(n.siteId); return site && armyGroupPower(state, ag) >= site.guard;
        }).map(function (n) { return { node: n, path: strategicPath(state, ag.position, n.id) }; })
          .filter(function (x) { return x.path.length > 1; })
          .sort(function (a, b) { return a.path.length - b.path.length; });
        var route = candidates.length ? candidates[0].path : [];
        if (!route.length) {
          var nextRegion = GD().regions.filter(function (r) { return state.claimedRegions.indexOf(r.id) < 0 && regionUnlocked(state, r.id); })[0];
          if (nextRegion) route = strategicPath(state, ag.position, nextRegion.id);
        }
        if (route.length > 1 && canMoveArmyGroup(state, ag.id, route[1]).ok) {
          moveArmyGroup(state, ag.id, route[1]); return { text: '🗺️ ' + ag.name + ' zieht nach ' + strategicNodeName(route[1]) + '.' };
        }
      }
      if (ag.movement <= 0 && canCastAdventureMagic(state, 'abenteuer_windmarsch', ag.id).ok) {
        castAdventureMagic(state, 'abenteuer_windmarsch', ag.id); return { text: '🌬️ Windmarsch erneuert ' + ag.name + '.' };
      }
    }
    // Ab hier zuerst die „Meilenstein"-Aktionen (selbstbegrenzend), damit sie nicht
    // von Dauer-Aktionen (Schmieden/Ausbau) verhungern und das Reich sichtbar wächst.
    // 5) Expedition starten (höchste gewinnbare Region, eine zur Zeit) → Beute, Seelen, Herrscher-EP, Territorium
    if (state.expeditions.length === 0) {
      var avail = armyAvailable(state).map(function (cc) { return cc.uid; });
      if (avail.length) {
        var regs = visibleRegions(state).filter(function (rg) { return regionUnlocked(state, rg.id); });
        var pw = expeditionPower(state, avail, true);
        var target = null;
        for (var gi = regs.length - 1; gi >= 0; gi--) { if (pw >= regs[gi].power) { target = regs[gi]; break; } }
        if (!target && regs.length) target = regs[0];   // sonst die leichteste versuchen
        if (target) { var r5 = startExpedition(state, target.id, avail, true, 'normal'); if (r5.ok) return { text: '🚩 Expedition: ' + target.name + '.' }; }
      }
    }
    // 6) Gegenangriff, wenn stark genug
    var rivals = GD().rivals;
    for (var vi = 0; vi < rivals.length; vi++) {
      if (canCounterAttack(state, rivals[vi].id).ok) {
        var uids = state.creatures.filter(function (cc) { return !creatureBusy(state, cc.uid) && !isWounded(state, cc); }).map(function (cc) { return cc.uid; });
        var pwc = round((uids.reduce(function (a, uid) { return a + creaturePower(state, findCreature(state, uid)); }, 0) + rulerPower(state)) * (1 + (computeBonuses(state).armee || 0)));
        if (pwc >= rivalLairPower(state, rivals[vi].id)) { var r6 = counterAttackRival(state, rivals[vi].id, uids); if (r6.ok && r6.won) return { text: '👑 ' + rivals[vi].name + ' besiegt!' }; }
      }
    }
    // 7) Affinität wählen (einmalig, ab Stufe 2)
    if (canChooseAffinity(state).ok) { var aff = pickAffinityFor(state); if (chooseAffinity(state, aff).ok) return { text: '🌟 Affinität: ' + GD().affinity(aff).name + '.' }; }
    // 8) Klaren Seelen-Überschuss opfern → Herrscher-EP (Reserve für Evolutionen lassen)
    if ((state.resources.seelen || 0) > 1500) { var amt = Math.floor(state.resources.seelen - 800); if (amt > 0 && sacrificeSouls(state, amt).ok) return { text: '🩸 ' + amt + ' Seelen geopfert.' }; }
    // 9) freie Kreatur einem Job zuweisen
    var frei = state.creatures.filter(function (cc) { return cc.job === 'frei' && !creatureBusy(state, cc.uid); });
    if (frei.length) { var job = pickJobFor(state, frei[0]); if (assignJob(state, frei[0].uid, job).ok) return { text: (frei[0].named ? frei[0].name : GD().creature(frei[0].speciesId).name) + ' → ' + (JOB_BY[job] ? JOB_BY[job].name : job) + '.' }; }
    // 10) günstigste sinnvolle Forschung
    var rlist = GD().research.slice().sort(function (a, b) { return (a.cost.wissen || 0) - (b.cost.wissen || 0); });
    for (var ri = 0; ri < rlist.length; ri++) { if (canResearch(state, rlist[ri].id).ok && affordReserve(state, rlist[ri].cost, 1.2)) { if (doResearch(state, rlist[ri].id).ok) return { text: '📚 Forschung: ' + rlist[ri].name + '.' }; } }
    // 11) aktive Kampf-/Abenteuerzauber der Akademie lernen
    var flist = GD().fieldMagic.slice().sort(function (a, b) { return a.academy - b.academy; });
    for (var fi = 0; fi < flist.length; fi++) {
      if (canLearnFieldMagic(state, flist[fi].id).ok && affordReserve(state, flist[fi].cost, 1.25)) {
        if (learnFieldMagic(state, flist[fi].id).ok) return { text: flist[fi].icon + ' Feldmagie: ' + flist[fi].name + '.' };
      }
    }
    // 12) günstigstes Reichsritual verankern
    var mlist = GD().magic.slice().sort(function (a, b) { return a.tier - b.tier; });
    for (var mi = 0; mi < mlist.length; mi++) { if (canLearn(state, mlist[mi].id).ok && affordReserve(state, mlist[mi].cost, 1.2)) { if (learnMagic(state, mlist[mi].id).ok) return { text: '🔮 Zauber: ' + mlist[mi].name + '.' }; } }
    // 13) Fusion im Endgame (überzählige Kreaturen verschmelzen)
    if (featureUnlocked(state, 'fusion') && state.creatures.length >= 8) {
      var named = state.creatures.filter(function (cc) { return cc.named && !creatureBusy(state, cc.uid) && (cc.fusionLevel || 0) < FUSION_MAX; }).sort(function (a, b) { return (a.fusionLevel || 0) - (b.fusionLevel || 0); });
      var fodder = state.creatures.filter(function (cc) { return cc.named && !creatureBusy(state, cc.uid); }).sort(function (a, b) { return creaturePower(state, a) - creaturePower(state, b); });
      if (named.length && fodder.length) {
        var baseC = named[0];
        var catC = fodder.filter(function (cc) { return cc.uid !== baseC.uid; })[0];
        if (catC && affordReserve(state, fusionCost(baseC), 1.4)) { var r12 = fuse(state, baseC.uid, catC.uid); if (r12.ok) return { text: '🧬 ' + baseC.name + ' fusioniert (' + baseC.fusionLevel + '/' + FUSION_MAX + ').' }; }
      }
    }
    // 14) beschwören (wenn Kapazität frei)
    if (usedCapacity(state) < capacity(state)) { var sp = bestSummon(state); if (sp) { var r13 = summon(state, sp.id); if (r13.ok) return { text: '✨ ' + sp.name + ' beschworen.' }; } }
    // 15) Gebäude ausbauen (Lückenfüller mit Reserve)
    var bup = bestBuildingUpgrade(state);
    if (bup) { var r14 = build(state, bup); if (r14.ok) return { text: GD().building(bup).icon + ' ' + GD().building(bup).name + ' Stufe ' + r14.level + '.' }; }
    // 16) Ausrüstung schmieden – sparsam (Inventar klein halten), dann anlegen
    if ((state.buildings.schmiede || 0) >= 1 && (state.inventory || []).length < 12) {
      var recs = craftableRecipes(state).filter(function (rc) { return !rc.unique; });
      for (var rci = 0; rci < recs.length; rci++) { if (canCraft(state, recs[rci].id).ok && affordReserve(state, recs[rci].cost, 2.0)) { var rcc = craft(state, recs[rci].id); if (rcc.ok) { autoEquip(state, rcc.item); return { text: '⚒️ ' + recs[rci].name + ' geschmiedet.' }; } } }
    }
    return null;
  }
  // Auto-Ausrüsten: legt ein Item dem ersten Träger mit freiem passenden Slot an (Herrscher bevorzugt).
  function autoEquip(state, item) {
    if (!item) return;
    if (!positionsForType(state, item.slot, true).length) return;
    var holders = ['herrscher'].concat(state.creatures.map(function (c) { return c.uid; }));
    for (var i = 0; i < holders.length; i++) {
      var eq = equipmentObjFor(state, holders[i]); if (!eq) continue;
      var free = positionsForType(state, item.slot, true).filter(function (p) { return eq[p.id] == null; })[0];
      if (free) { equipItem(state, item.uid, holders[i], free.id); return; }
    }
  }

  // ============================================================
  //  Taktischer Kampf (rundenbasiert, elementar, statusbasiert)
  // ============================================================
  var ELEMENT_OPPOSITE = {
    feuer: 'wasser', wasser: 'wind', wind: 'erde', erde: 'feuer',
    licht: 'dunkel', dunkel: 'licht', geist: 'dunkel', physisch: null
  };
  function combatAbilitiesFor(state, holderKey) {
    var ids = ['angriff', 'verteidigen'];
    if (holderKey === 'herrscher') {
      ids.push('analysieren');
      (state.learnedFieldMagic || []).forEach(function (id) {
        var spell = GD().fieldSpell(id);
        if (spell && spell.type === 'combat' && spell.ability && ids.indexOf(spell.ability) < 0) ids.push(spell.ability);
      });
      return ids;
    }
    var c = findCreature(state, holderKey), sp = c ? GD().creature(c.speciesId) : null;
    var line = sp ? sp.line : '';
    if (c && !c.named) {
      var basic = ['angriff'];
      if (/Phönix|Dämon|Drache|Oger/.test(line)) basic.push('feuerlanze');
      else if (/Geist|Schleim|Echse/.test(line)) basic.push('frostsplitter');
      else if (/Greif|Wolf|Insekt|Kobold|Hasenmensch|Tengu/.test(line)) basic.push('sturmstoss');
      else if (/Meervolk/.test(line)) basic.push('frostsplitter');
      else if (/Untot|Vampir/.test(line)) basic.push('seelensog');
      else basic.push('verteidigen');
      return basic;
    }
    if (/Phönix|Dämon|Drache|Oger/.test(line)) ids.push('feuerlanze');
    if (/Geist|Schleim|Echse/.test(line)) ids.push('frostsplitter');
    if (/Greif|Wolf|Insekt|Kobold|Hasenmensch|Tengu/.test(line)) ids.push('sturmstoss');
    if (/Meervolk/.test(line)) ids.push('frostsplitter');
    if (/Untot|Vampir/.test(line)) ids.push('seelensog');
    if (/Baumhirte|Geist/.test(line) || (c && c.aspect === 'arkanist')) ids.push('lichtsegen');
    if (c && c.named) ids.push('analysieren');
    return ids.filter(function (id, i, a) { return a.indexOf(id) === i; });
  }
  function battleActor(state, holderKey) {
    var ruler = holderKey === 'herrscher';
    var c = ruler ? null : findCreature(state, holderKey);
    var stats = ruler ? rulerStats(state) : creatureStats(state, c);
    var sp = c ? GD().creature(c.speciesId) : null;
    var count = ruler ? 1 : stackCount(c), scaled = {};
    for (var sk in stats) scaled[sk] = stats[sk];
    scaled.lp *= count; scaled.ang *= count; scaled.mag *= Math.max(1, Math.sqrt(count));
    var maxMp = Math.max(10, round((scaled.mag || 1) * 1.6 + 12));
    var ranged = ruler || (sp && sp.role === 'Magie') || (c && c.aspect === 'arkanist');
    return {
      key: holderKey, name: ruler ? state.herrscher.name : (c.named ? c.name : sp.name),
      icon: ruler ? GD().rulerStages[state.herrscher.stage].icon : sp.icon,
      side: 'party', stack: count, stats: scaled, hp: scaled.lp, maxHp: scaled.lp, mp: maxMp, maxMp: maxMp,
      abilities: combatAbilitiesFor(state, holderKey), defending: false, statuses: [], dead: false,
      moveRange: clamp(2 + Math.floor((scaled.tmp || 0) / 35), 2, 4), attackRange: ranged ? 3 : 1,
      retaliated: false, waited: false, pos: null, fieldAffinity: ruler ? state.affinity : null
    };
  }
  function enemyFor(region, index, count) {
    var rootPower = Math.sqrt(region.power);
    var maxHp = Math.max(45, round(rootPower * 10 / Math.sqrt(count)));
    var names = ['Vorhut', 'Hexer', 'Gebietsfürst'];
    return {
      key: 'enemy_' + index, name: region.name + ' – ' + names[index % names.length], icon: region.icon,
      side: 'enemy', stack: Math.max(1, round(rootPower / (4 + index * 2))),
      element: region.element || 'erde', weakness: ELEMENT_OPPOSITE[region.element] || 'feuer', analyzed: false,
      stats: { lp: maxHp, ang: Math.max(8, round(rootPower * 1.65)), ver: Math.max(4, round(rootPower * 0.55)), mag: Math.max(7, round(rootPower * 1.5)), tmp: 8 + index * 2 },
      hp: maxHp, maxHp: maxHp, statuses: [], dead: false, defending: false,
      intent: index % 3 === 1 ? 'arkane_salbe' : 'hieb', moveRange: index % 3 === 1 ? 2 : 3,
      attackRange: index % 3 === 1 ? 3 : 1, retaliated: false, waited: false, pos: null
    };
  }
  var BATTLE_W = 7, BATTLE_H = 5;
  function battleToken(side, index) { return (side === 'party' ? 'p' : 'e') + index; }
  function battleActorByToken(combat, token) {
    if (!token) return null;
    var index = parseInt(token.slice(1), 10);
    return token.charAt(0) === 'p' ? combat.party[index] : combat.enemies[index];
  }
  function battleDistance(a, b) { return Math.abs(a.pos.x - b.pos.x) + Math.abs(a.pos.y - b.pos.y); }
  function battleCellKey(x, y) { return x + ',' + y; }
  function battleOccupied(combat, x, y, ignore) {
    if ((combat.obstacles || []).indexOf(battleCellKey(x, y)) >= 0) return true;
    return combat.party.concat(combat.enemies).some(function (a) { return a !== ignore && !a.dead && a.pos && a.pos.x === x && a.pos.y === y; });
  }
  function battleReachableCells(combat, actor) {
    if (!actor || !actor.pos) return [];
    var max = actor.moveRange || 2, queue = [{ x: actor.pos.x, y: actor.pos.y, d: 0 }], seen = {};
    seen[battleCellKey(actor.pos.x, actor.pos.y)] = true;
    var out = [];
    while (queue.length) {
      var cur = queue.shift();
      [[1,0],[-1,0],[0,1],[0,-1]].forEach(function (delta) {
        var x = cur.x + delta[0], y = cur.y + delta[1], key = battleCellKey(x, y), d = cur.d + 1;
        if (x < 0 || x >= BATTLE_W || y < 0 || y >= BATTLE_H || seen[key] || d > max || battleOccupied(combat, x, y, actor)) return;
        seen[key] = true; out.push({ x: x, y: y, d: d }); queue.push({ x: x, y: y, d: d });
      });
    }
    return out;
  }
  function battleCurrentActor(combat) { return combat ? battleActorByToken(combat, (combat.turnOrder || [])[combat.turnCursor || 0]) : null; }
  function buildBattleTurnOrder(combat) {
    var entries = [];
    combat.party.forEach(function (a, i) { if (!a.dead) entries.push({ token: battleToken('party', i), speed: a.stats.tmp || 0, side: 0 }); });
    combat.enemies.forEach(function (a, i) { if (!a.dead) entries.push({ token: battleToken('enemy', i), speed: a.stats.tmp || 0, side: 1 }); });
    entries.sort(function (a, b) { return b.speed - a.speed || a.side - b.side; });
    combat.turnOrder = entries.map(function (e) { return e.token; }); combat.turnCursor = 0;
  }
  function ensureCombatGrid(state) {
    var combat = state.activeCombat; if (!combat) return null;
    combat.board = combat.board || { w: BATTLE_W, h: BATTLE_H };
    if (!Array.isArray(combat.obstacles)) combat.obstacles = ['3,1', '3,3'];
    combat.party.forEach(function (a, i) {
      a.side = 'party'; if (!a.pos) a.pos = { x: 0, y: Math.min(BATTLE_H - 1, i * 2) };
      if (a.moveRange == null) a.moveRange = 2; if (a.attackRange == null) a.attackRange = 1;
      if (a.retaliated == null) a.retaliated = false; if (a.waited == null) a.waited = false;
    });
    combat.enemies.forEach(function (a, i) {
      a.side = 'enemy'; if (!a.pos) a.pos = { x: BATTLE_W - 1, y: Math.min(BATTLE_H - 1, i * 2) };
      if (a.moveRange == null) a.moveRange = 2; if (a.attackRange == null) a.attackRange = 1;
      if (a.retaliated == null) a.retaliated = false; if (a.waited == null) a.waited = false;
    });
    if (!Array.isArray(combat.turnOrder) || !combat.turnOrder.length) buildBattleTurnOrder(combat);
    if (typeof combat.turnCursor !== 'number') combat.turnCursor = 0;
    var current = battleCurrentActor(combat);
    if (current && current.side === 'party') combat.turnIndex = combat.party.indexOf(current);
    return combat;
  }
  function canStartCombat(state, regionId, creatureUids, rulerJoin) {
    if (state.activeCombat && state.activeCombat.status === 'active') return { ok: false, reason: 'Ein taktischer Kampf läuft bereits' };
    var r = GD().region(regionId); if (!r) return { ok: false, reason: 'Unbekannte Region' };
    if (!regionUnlocked(state, regionId)) return { ok: false, reason: 'Erst vorige Region erobern' };
    if ((!creatureUids || !creatureUids.length) && !rulerJoin) return { ok: false, reason: 'Wähle mindestens einen Kämpfer' };
    if ((creatureUids || []).length + (rulerJoin ? 1 : 0) > 4) return { ok: false, reason: 'Die taktische Gruppe hat maximal 4 Plätze' };
    for (var i = 0; i < (creatureUids || []).length; i++) {
      var c = findCreature(state, creatureUids[i]);
      if (!c || creatureBusy(state, c.uid) || isWounded(state, c)) return { ok: false, reason: 'Ein Kämpfer ist nicht verfügbar' };
    }
    return { ok: true };
  }
  function firstLivingPartyIndex(combat) {
    for (var i = 0; i < combat.party.length; i++) if (!combat.party[i].dead) return i;
    return -1;
  }
  function startCombat(state, regionId, creatureUids, rulerJoin, risk) {
    var check = canStartCombat(state, regionId, creatureUids, rulerJoin);
    if (!check.ok) return check;
    if (!RISK[risk]) risk = 'normal';
    var r = GD().region(regionId), party = [];
    if (rulerJoin) party.push(battleActor(state, 'herrscher'));
    (creatureUids || []).forEach(function (uid) { party.push(battleActor(state, uid)); });
    var regionIndex = GD().regions.indexOf(r), count = Math.min(3, 1 + Math.floor(regionIndex / 3));
    var enemies = [];
    for (var i = 0; i < count; i++) enemies.push(enemyFor(r, i, count));
    state.activeCombat = {
      regionId: regionId, risk: risk, party: party, enemies: enemies, round: 1, turnIndex: 0,
      status: 'active', log: ['⚔️ Der taktische Rasterkampf beginnt.'], result: null,
      board: { w: BATTLE_W, h: BATTLE_H }, obstacles: regionIndex % 2 ? ['3,0', '3,3'] : ['3,1', '3,3'],
      turnOrder: [], turnCursor: 0
    };
    ensureCombatGrid(state); buildBattleTurnOrder(state.activeCombat); processCombatUntilPlayer(state);
    log(state, '⚔️ Taktischer Kampf in ' + r.name + ' begonnen.', 'gold');
    return { ok: true, combat: state.activeCombat };
  }
  function elementalMultiplier(ability, target) {
    if (!ability || ability.element === 'physisch') return 1;
    if (target.weakness === ability.element) return 1.75;
    if (target.element === ability.element) return 0.55;
    return 1;
  }
  function findStatus(actor, id) {
    return (actor.statuses || []).filter(function (s) { return s.id === id; })[0] || null;
  }
  function addStatus(actor, id, turns) {
    var old = findStatus(actor, id);
    if (old) old.turns = Math.max(old.turns, turns); else actor.statuses.push({ id: id, turns: turns });
  }
  function rollDamage(source, target, ability) {
    var stat = ability.stat === 'mag' ? source.stats.mag : source.stats.ang;
    if (findStatus(source, 'frost')) stat *= 0.72;
    var defense = Math.max(1, target.stats.ver || 1);
    var affinityBoost = source.fieldAffinity && ability.element === source.fieldAffinity ? 1.25 : 1;
    var raw = stat * ability.power * affinityBoost * (0.88 + rng() * 0.24);
    var damage = Math.max(1, round(raw * (100 / (100 + defense * 1.4)) * elementalMultiplier(ability, target)));
    if (target.defending) { damage = Math.max(1, round(damage * 0.48)); target.defending = false; }
    return damage;
  }
  function living(list) { return list.filter(function (x) { return !x.dead && x.hp > 0; }); }
  function combatLog(combat, text) {
    combat.log.push(text); if (combat.log.length > 12) combat.log.splice(0, combat.log.length - 12);
  }
  function markDead(actor) { if (actor.hp <= 0) { actor.hp = 0; actor.dead = true; } }
  function tickBattleStatuses(combat, actor) {
    (actor.statuses || []).slice().forEach(function (st) {
      if (st.id === 'brand' && !actor.dead) {
        var d = Math.max(1, round(actor.maxHp * 0.06)); actor.hp -= d; combatLog(combat, '🔥 ' + actor.name + ' erleidet ' + d + ' Brandschaden.'); markDead(actor);
      }
      st.turns--;
    });
    actor.statuses = (actor.statuses || []).filter(function (st) { return st.turns > 0; });
  }
  function finishCombat(state, won, fled) {
    var cbt = state.activeCombat, region = GD().region(cbt.regionId), rk = RISK[cbt.risk] || RISK.normal;
    var gains = {}, drop = null, dead = [], wounded = [];
    if (won) {
      for (var res in region.rewards) gains[res] = round(region.rewards[res] * rk.reward * (0.9 + rng() * 0.2));
      addResources(state, gains);
      var b = computeBonuses(state), xp = round(region.xp * 1.2 * (1 + b.xp));
      cbt.party.forEach(function (a) {
        if (a.key === 'herrscher') { addRulerXp(state, round(xp * 0.7)); addSkillXp(state, state.herrscher, round(xp * 0.4)); }
        else { var pc = findCreature(state, a.key); if (pc) { addCreatureXp(state, pc, xp); if (pc.named) addSkillXp(state, pc, round(xp * 0.45)); } }
      });
      if (rng() < Math.min(0.95, region.dropChance * 1.25 * rk.drop)) drop = makeDropItem(state, region);
      if (state.claimedRegions.indexOf(region.id) < 0) state.claimedRegions.push(region.id);
      state.metrics.expeditions = (state.metrics.expeditions || 0) + 1;
      state.metrics.expeditionsWon = (state.metrics.expeditionsWon || 0) + 1;
      state.metrics.tacticalWins = (state.metrics.tacticalWins || 0) + 1;
      // Gefallene im gewonnenen Gefecht überleben schwer verwundet.
      cbt.party.forEach(function (a) { if (a.dead && a.key !== 'herrscher') { var pc = findCreature(state, a.key); if (pc) { pc.woundedUntil = state.tick + Math.max(8, region.dauer); wounded.push(pc); } } });
    } else if (!fled && cbt.risk === 'riskant') {
      cbt.party.forEach(function (a) { if (a.key !== 'herrscher') { var pc = findCreature(state, a.key); if (pc) {
        releaseCreatureEquipment(state, pc); dead.push(pc);
        if (!pc.named && pc.armyGroupId != null) {
          var pg = findArmyGroup(state, pc.armyGroupId);
          if (pg && pg.troops[pc.speciesId]) { pg.troops[pc.speciesId] = Math.max(0, pg.troops[pc.speciesId] - stackCount(pc)); if (!pg.troops[pc.speciesId]) delete pg.troops[pc.speciesId]; }
        }
      } } });
      state.creatures = state.creatures.filter(function (pc) { return dead.indexOf(pc) < 0; });
    } else {
      cbt.party.forEach(function (a) { if (a.key !== 'herrscher') { var pc = findCreature(state, a.key); if (pc) { pc.woundedUntil = state.tick + Math.max(6, region.dauer); wounded.push(pc); } } });
    }
    cbt.status = won ? 'victory' : (fled ? 'fled' : 'defeat');
    cbt.result = { won: won, fled: !!fled, gains: gains, drop: drop, dead: dead.length, wounded: wounded.length };
    combatLog(cbt, won ? '🏆 Sieg! Das Gebiet ist bezwungen.' : (fled ? '🏳️ Die Gruppe zieht sich zurück.' : '☠️ Die Gruppe wurde besiegt.'));
    log(state, won ? ('🏆 Taktischer Sieg in ' + region.name + '!') : ('☠️ Taktische Niederlage in ' + region.name + '.'), won ? 'good' : 'bad');
    return cbt.result;
  }
  function battleAbilityRange(actor, ability) {
    if (!ability || ability.kind === 'guard') return 0;
    if (ability.kind === 'heal') return 4;
    if (ability.kind === 'analyze') return 6;
    return ability.element === 'physisch' ? (actor.attackRange || 1) : 6;
  }
  function bestBattleApproach(combat, actor, target) {
    var cells = [{ x: actor.pos.x, y: actor.pos.y, d: 0 }].concat(battleReachableCells(combat, actor));
    cells.sort(function (a, b) {
      var da = Math.abs(a.x - target.pos.x) + Math.abs(a.y - target.pos.y);
      var db = Math.abs(b.x - target.pos.x) + Math.abs(b.y - target.pos.y);
      return da - db || a.d - b.d;
    });
    return cells[0];
  }
  function performBattleHit(combat, source, target, ability, label) {
    var distance = battleDistance(source, target), dmg = rollDamage(source, target, ability);
    target.hp -= dmg; markDead(target);
    if (ability.kind === 'drain') source.hp = Math.min(source.maxHp, source.hp + round(dmg * 0.35));
    if (ability.status && !target.dead && rng() < (ability.chance || 0)) addStatus(target, ability.status, 2);
    var mult = elementalMultiplier(ability, target);
    combatLog(combat, (label || ability.icon || '⚔️') + ' ' + source.name + ' verursacht ' + dmg + ' Schaden' + (mult > 1 ? ' – SCHWÄCHE!' : (mult < 1 ? ' – resistiert.' : '.')));
    // Heroes-artige einmalige Gegenwehr je Runde bei einem Nahkampftreffer.
    if (!target.dead && !source.dead && ability.element === 'physisch' && distance === 1 && !target.retaliated) {
      target.retaliated = true;
      var counter = { power: 0.55, stat: 'ang', element: 'physisch', kind: 'damage' };
      var retaliation = rollDamage(target, source, counter); source.hp -= retaliation; markDead(source);
      combatLog(combat, '↩️ ' + target.name + ' schlägt zurück: ' + retaliation + ' Schaden.');
    }
    return dmg;
  }
  function finishBattleRound(state) {
    var combat = state.activeCombat;
    combat.party.forEach(function (a) { tickBattleStatuses(combat, a); });
    combat.enemies.forEach(function (a) { tickBattleStatuses(combat, a); });
    if (!living(combat.party).length) { finishCombat(state, false, false); return; }
    if (!living(combat.enemies).length) { finishCombat(state, true, false); return; }
    combat.round++;
    living(combat.party).concat(living(combat.enemies)).forEach(function (a) {
      a.retaliated = false; a.waited = false; a.defending = false;
      if (a.side === 'party') a.mp = Math.min(a.maxMp, a.mp + Math.max(2, round(a.maxMp * 0.08)));
    });
    buildBattleTurnOrder(combat);
  }
  function enemyBattleTurn(state, enemy) {
    var combat = state.activeCombat, targets = living(combat.party); if (!targets.length) return;
    targets.sort(function (a, b) { return battleDistance(enemy, a) - battleDistance(enemy, b) || a.hp - b.hp; });
    var target = targets[0], elemental = enemy.intent === 'arkane_salbe';
    var ability = { power: elemental ? 1.15 : 0.95, stat: elemental ? 'mag' : 'ang', element: elemental ? enemy.element : 'physisch', kind: 'damage' };
    var range = elemental ? 6 : (enemy.attackRange || 1);
    if (battleDistance(enemy, target) > range) {
      var approach = bestBattleApproach(combat, enemy, target);
      if (approach && (approach.x !== enemy.pos.x || approach.y !== enemy.pos.y)) {
        enemy.pos = { x: approach.x, y: approach.y }; combatLog(combat, '👣 ' + enemy.name + ' rückt vor.');
      }
    }
    if (battleDistance(enemy, target) <= range) performBattleHit(combat, enemy, target, ability, enemy.icon);
    else combatLog(combat, '⏳ ' + enemy.name + ' erreicht kein Ziel.');
    enemy.intent = rng() < 0.45 ? 'arkane_salbe' : 'hieb';
  }
  function processCombatUntilPlayer(state) {
    var combat = ensureCombatGrid(state), guard = 0; if (!combat || combat.status !== 'active') return;
    while (combat.status === 'active' && guard++ < 40) {
      if (!living(combat.party).length) { finishCombat(state, false, false); return; }
      if (!living(combat.enemies).length) { finishCombat(state, true, false); return; }
      if (combat.turnCursor >= combat.turnOrder.length) { finishBattleRound(state); if (combat.status !== 'active') return; continue; }
      var actor = battleCurrentActor(combat);
      if (!actor || actor.dead) { combat.turnCursor++; continue; }
      if (findStatus(actor, 'schock') && rng() < 0.5) {
        combatLog(combat, '⚡ ' + actor.name + ' ist geschockt und verliert den Zug.'); combat.turnCursor++; continue;
      }
      if (actor.side === 'party') { combat.turnIndex = combat.party.indexOf(actor); return; }
      enemyBattleTurn(state, actor); combat.turnCursor++;
    }
  }
  function advanceCombatTurn(state) {
    var combat = state.activeCombat; if (!combat || combat.status !== 'active') return;
    combat.turnCursor++; processCombatUntilPlayer(state);
  }
  function battleMove(state, x, y) {
    var combat = ensureCombatGrid(state), actor = battleCurrentActor(combat);
    if (!combat || combat.status !== 'active' || !actor || actor.side !== 'party') return { ok: false, reason: 'Keine eigene Einheit am Zug' };
    x = Math.floor(x); y = Math.floor(y);
    var reachable = battleReachableCells(combat, actor).some(function (c) { return c.x === x && c.y === y; });
    if (!reachable) return { ok: false, reason: 'Feld ist nicht erreichbar' };
    actor.pos = { x: x, y: y }; combatLog(combat, '👣 ' + actor.name + ' bewegt sich auf Feld ' + (x + 1) + '/' + (y + 1) + '.');
    advanceCombatTurn(state); return { ok: true, combat: combat };
  }
  function battleWait(state) {
    var combat = ensureCombatGrid(state), actor = battleCurrentActor(combat);
    if (!combat || combat.status !== 'active' || !actor || actor.side !== 'party') return { ok: false, reason: 'Keine eigene Einheit am Zug' };
    if (actor.waited) return { ok: false, reason: 'Diese Einheit hat bereits gewartet' };
    actor.waited = true;
    var token = combat.turnOrder.splice(combat.turnCursor, 1)[0]; combat.turnOrder.push(token);
    combatLog(combat, '⏳ ' + actor.name + ' wartet und handelt später.'); processCombatUntilPlayer(state);
    return { ok: true, combat: combat };
  }
  function battleAction(state, abilityId, targetIndex) {
    var cbt = ensureCombatGrid(state);
    if (!cbt || cbt.status !== 'active') return { ok: false, reason: 'Kein aktiver Kampf' };
    var actor = battleCurrentActor(cbt), ability = GD().battleAbility(abilityId);
    if (!actor || actor.side !== 'party') return { ok: false, reason: 'Der Gegner ist am Zug' };
    if (!actor || actor.dead || !ability || actor.abilities.indexOf(abilityId) < 0) return { ok: false, reason: 'Aktion nicht verfügbar' };
    if (actor.mp < ability.cost) return { ok: false, reason: 'Nicht genug MP' };
    if (ability.kind === 'heal' && (!cbt.party[targetIndex] || cbt.party[targetIndex].dead)) return { ok: false, reason: 'Ungültiges Heilziel' };
    if (ability.kind !== 'guard' && ability.kind !== 'heal' && (!cbt.enemies[targetIndex] || cbt.enemies[targetIndex].dead)) return { ok: false, reason: 'Ungültiges Ziel' };
    if (ability.kind === 'heal' && battleDistance(actor, cbt.party[targetIndex]) > battleAbilityRange(actor, ability)) return { ok: false, reason: 'Heilziel ist außer Reichweite' };
    actor.mp -= ability.cost;
    if (ability.kind === 'guard') {
      actor.defending = true; combatLog(cbt, '🛡️ ' + actor.name + ' verteidigt sich.');
    } else if (ability.kind === 'heal') {
      var ally = cbt.party[targetIndex];
      var heal = Math.max(4, round(actor.stats.mag * ability.power)); ally.hp = Math.min(ally.maxHp, ally.hp + heal);
      combatLog(cbt, '✨ ' + actor.name + ' heilt ' + ally.name + ' um ' + heal + ' LP.');
    } else {
      var target = cbt.enemies[targetIndex];
      if (ability.kind === 'analyze') {
        target.analyzed = true; combatLog(cbt, '🔍 ' + target.name + ': schwach gegen ' + target.weakness + ', resistent gegen ' + target.element + '.');
      } else {
        var range = battleAbilityRange(actor, ability);
        if (battleDistance(actor, target) > range) {
          var approach = bestBattleApproach(cbt, actor, target);
          if (approach && (approach.x !== actor.pos.x || approach.y !== actor.pos.y)) {
            actor.pos = { x: approach.x, y: approach.y }; combatLog(cbt, '👣 ' + actor.name + ' rückt auf ' + target.name + ' vor.');
          }
          if (battleDistance(actor, target) > range) { advanceCombatTurn(state); return { ok: true, moved: true, combat: cbt }; }
        }
        performBattleHit(cbt, actor, target, ability, ability.icon);
      }
    }
    advanceCombatTurn(state);
    return { ok: true, combat: cbt };
  }
  function fleeCombat(state) {
    if (!state.activeCombat || state.activeCombat.status !== 'active') return { ok: false };
    return { ok: true, result: finishCombat(state, false, true) };
  }
  function closeCombat(state) { state.activeCombat = null; }

  // ============================================================
  //  Ziele / Quests (geführte, belohnte Aufgabenkette)
  // ============================================================
  // Strikt sequenziell: immer genau ein Ziel aktiv. Erfüllt → Belohnung + nächstes.
  // check(state)->bool; optional progress(state)->"x/y". Führt Neulinge durch die Systeme.
  var QUESTS = [
    { id: 'q_magieturm', icon: '🔮', title: 'Funken der Macht', desc: 'Bringe den Magieturm auf Stufe 2.',
      check: function (s) { return (s.buildings.magieturm || 0) >= 2; }, reward: { gold: 120 } },
    { id: 'q_jobs', icon: '🛠️', title: 'Hände für die Arbeit', desc: 'Weise 2 Kreaturen eine Aufgabe zu (nicht „Frei").',
      check: function (s) { return s.creatures.filter(function (c) { return c.job && c.job !== 'frei'; }).length >= 2; },
      progress: function (s) { return Math.min(2, s.creatures.filter(function (c) { return c.job && c.job !== 'frei'; }).length) + '/2'; }, reward: { magie: 80 } },
    { id: 'q_summon', icon: '✨', title: 'Verstärkung', desc: 'Beschwöre eine weitere Kreatur.',
      check: function (s) { return (s.metrics.summoned || 0) >= 1; }, reward: { magie: 60, nahrung: 60 } },
    { id: 'q_name', icon: '🔤', title: 'Ein wahrer Name', desc: 'Benenne eine Kreatur – das weckt ihre Kräfte.',
      check: function (s) { return (s.metrics.named || 0) >= 1; }, reward: { seelen: 25 } },
    { id: 'q_expedition', icon: '🚩', title: 'Erste Eroberung', desc: 'Gewinne eine Expedition auf der Karte.',
      check: function (s) { return (s.metrics.expeditionsWon || 0) >= 1; }, reward: { gold: 150, material: 80 } },
    { id: 'q_forschungsgilde', icon: '📚', title: 'Wissensdurst', desc: 'Baue die Forschungsgilde.',
      check: function (s) { return (s.buildings.forschungsgilde || 0) >= 1; }, reward: { wissen: 100 } },
    { id: 'q_research', icon: '🧠', title: 'Erste Erkenntnis', desc: 'Schließe eine Forschung ab.',
      check: function (s) { return (s.research || []).length >= 1; }, reward: { magie: 150, wissen: 60 } },
    { id: 'q_craft', icon: '⚒️', title: 'Gerüstet', desc: 'Schmiede ein Ausrüstungsstück.',
      check: function (s) { return (s.metrics.crafted || 0) >= 1; }, reward: { material: 150 } },
    { id: 'q_evolve', icon: '🧬', title: 'Wandlung', desc: 'Entwickle eine Kreatur zur nächsten Form.',
      check: function (s) { return (s.metrics.evolutions || 0) >= 1; }, reward: { seelen: 60 } },
    { id: 'q_magic3', icon: '🌟', title: 'Arkanes Arsenal', desc: 'Erlerne 3 Zauber.',
      check: function (s) { return (s.learnedMagic || []).length >= 3; },
      progress: function (s) { return Math.min(3, (s.learnedMagic || []).length) + '/3'; }, reward: { magie: 300 } },
    { id: 'q_expand3', icon: '🗺️', title: 'Expansion', desc: 'Erobere 3 Regionen.',
      check: function (s) { return (s.claimedRegions || []).length >= 3; },
      progress: function (s) { return Math.min(3, (s.claimedRegions || []).length) + '/3'; }, reward: { gold: 400, seelen: 120 } },
    { id: 'q_stage2', icon: '🟣', title: 'Erwachen', desc: 'Erreiche die Herrscher-Stufe „Dämonen-Schleim".',
      check: function (s) { return s.herrscher.stage >= 2; }, reward: { magie: 500, wissen: 200 } },
    { id: 'q_repel', icon: '🛡️', title: 'Standhaft', desc: 'Wehre den Angriff eines Rivalen ab.',
      check: function (s) { return (s.metrics.raidsRepelled || 0) >= 1; }, reward: { material: 300, gold: 200 } },
    { id: 'q_fusion', icon: '🧪', title: 'Chimären-Meister', desc: 'Führe eine Chimära-Fusion durch.',
      check: function (s) { return (s.metrics.fused || 0) >= 1; }, reward: { seelen: 300 } },
    { id: 'q_stage3', icon: '😈', title: 'Dämonenlord', desc: 'Steige zum Dämonenlord auf (Herrscher-Stufe 3).',
      check: function (s) { return s.herrscher.stage >= 3; }, reward: { magie: 1000, gold: 1000, seelen: 300 } }
  ];
  function activeQuestIndex(state) { return state.questProgress || 0; }
  function activeQuest(state) { var i = activeQuestIndex(state); return i < QUESTS.length ? QUESTS[i] : null; }
  function questCount() { return QUESTS.length; }
  // Erfüllte Ziele abschließen. silent=true → nur vorrücken (kein Reward/Log), für Save-Migration.
  function checkQuests(state, silent) {
    if (typeof state.questProgress !== 'number') state.questProgress = 0;
    var completed = [], guard = 0;
    while (state.questProgress < QUESTS.length && guard++ <= QUESTS.length) {
      var q = QUESTS[state.questProgress];
      if (!q.check(state)) break;
      state.questProgress++;
      if (!silent) {
        if (q.reward) addResources(state, q.reward);
        log(state, '🎯 Ziel erfüllt: ' + q.title + '.', 'gold');
        completed.push(q);
      }
    }
    return completed;
  }
  // Beim Laden still bis zum tatsächlich erreichten Stand vorrücken (keine Belohnungsflut).
  function syncQuests(state) { checkQuests(state, true); return state.questProgress; }

  root.GameSystems = {
    JOBS: JOBS, JOB_BY: JOB_BY, RISK: RISK,
    MAP_DAY_TICKS: MAP_DAY_TICKS, MAX_TROOP_TYPES: MAX_TROOP_TYPES,
    RULER_ARMY_ID: RULER_ARMY_ID, MAX_NAMED_CREATURES: MAX_NAMED_CREATURES,
    QUESTS: QUESTS, activeQuest: activeQuest, activeQuestIndex: activeQuestIndex, questCount: questCount,
    checkQuests: checkQuests, syncQuests: syncQuests,
    FEATURES: FEATURES, BUILDING_UNLOCK: BUILDING_UNLOCK,
    featureUnlocked: featureUnlocked, featureHint: featureHint, buildingUnlocked: buildingUnlocked, buildingHint: buildingHint,
    tabUnlocked: tabUnlocked, currentUnlockSet: currentUnlockSet, syncUnlocks: syncUnlocks, collectNewUnlocks: collectNewUnlocks,
    visibleRegions: visibleRegions, summonTeasers: summonTeasers,
    FUSION_MAX: FUSION_MAX, fusionCost: fusionCost, canFuse: canFuse, fuse: fuse,
    autoPlayStep: autoPlayStep,
    isWounded: isWounded, woundRemaining: woundRemaining,
    applyEventEffect: applyEventEffect, pickEvent: pickEvent, stepEvents: stepEvents, resolveEvent: resolveEvent, scheduleNextEvent: scheduleNextEvent,
    canChooseAffinity: canChooseAffinity, chooseAffinity: chooseAffinity,
    clamp: clamp, log: log,
    canAfford: canAfford, pay: pay, addResources: addResources, missingCost: missingCost,
    findCreature: findCreature, findItem: findItem, stackCount: stackCount, totalCreatureCount: totalCreatureCount,
    rulerArmyGroup: rulerArmyGroup, findTroopStack: findTroopStack,
    computeBonuses: computeBonuses,
    buildingCost: buildingCost, canBuild: canBuild, build: build,
    capacity: capacity, usedCapacity: usedCapacity,
    production: production, tick: tick, offlineProgress: offlineProgress,
    creatureStats: creatureStats, creatureKampfMult: creatureKampfMult, creaturePower: creaturePower,
    creatureLevelCap: creatureLevelCap, xpForLevel: xpForLevel, addCreatureXp: addCreatureXp,
    maxSummonRankIndex: maxSummonRankIndex, summonCost: summonCost, summonableSpecies: summonableSpecies,
    canSummon: canSummon, summon: summon,
    namedCount: namedCount, nameCapacity: nameCapacity, nameCost: nameCost, canName: canName, nameCreature: nameCreature,
    skillCapacity: skillCapacity, skillSlotsUsed: skillSlotsUsed, availableSkills: availableSkills, learnSkillCost: learnSkillCost,
    canLearnSkill: canLearnSkill, learnSkill: learnSkill, skillProgress: skillProgress,
    skillXpForLevel: skillXpForLevel, skillTrainingCost: skillTrainingCost, trainSkill: trainSkill, addSkillXp: addSkillXp,
    reqStatus: reqStatus, evolveOptions: evolveOptions, evolve: evolve,
    assignJob: assignJob,
    isLearned: isLearned, canLearn: canLearn, learnMagic: learnMagic, magicReqStatus: magicReqStatus,
    isFieldMagicLearned: isFieldMagicLearned, fieldMagicReqStatus: fieldMagicReqStatus,
    canLearnFieldMagic: canLearnFieldMagic, learnFieldMagic: learnFieldMagic,
    adventureMagicCooldown: adventureMagicCooldown, canCastAdventureMagic: canCastAdventureMagic, castAdventureMagic: castAdventureMagic,
    craftableRecipes: craftableRecipes, rollRarity: rollRarity, canCraft: canCraft, craft: craft,
    equipItem: equipItem, unequipItem: unequipItem, equipmentObjFor: equipmentObjFor,
    slotUnlocked: slotUnlocked, positionsForType: positionsForType, equippedSetBonus: equippedSetBonus, slotPos: slotPos,
    unlockedMagicTier: unlockedMagicTier, isResearched: isResearched, canResearch: canResearch, doResearch: doResearch, researchReqStatus: researchReqStatus,
    rulerStats: rulerStats, rulerPower: rulerPower, rulerXpForLevel: rulerXpForLevel,
    RULER_LEVELCAP: RULER_LEVELCAP, addRulerXp: addRulerXp, sacrificeSouls: sacrificeSouls, checkRulerStage: checkRulerStage,
    findArmyGroup: findArmyGroup, leaderArmyGroup: leaderArmyGroup, maxArmyGroups: maxArmyGroups,
    troopCommandCost: troopCommandCost, armyCommandCapacity: armyCommandCapacity, armyCommandUsed: armyCommandUsed,
    armyMovementMax: armyMovementMax, eligibleArmyLeaders: eligibleArmyLeaders,
    canCreateArmyGroup: canCreateArmyGroup, createArmyGroup: createArmyGroup, disbandArmyGroup: disbandArmyGroup,
    troopRecruitCost: troopRecruitCost, recruitableTroops: recruitableTroops, canRecruitTroops: canRecruitTroops,
    recruitTroops: recruitTroops, dismissTroops: dismissTroops, armyLeaderBonus: armyLeaderBonus, armyGroupPower: armyGroupPower,
    strategicNode: strategicNode, strategicNodeName: strategicNodeName, strategicNeighbors: strategicNeighbors,
    strategicNodeUnlocked: strategicNodeUnlocked, strategicNodeSecured: strategicNodeSecured, strategicPath: strategicPath,
    mapSiteClaimed: mapSiteClaimed, mapSiteExplored: mapSiteExplored, mapSiteUpgradeCost: mapSiteUpgradeCost,
    canInteractMapSite: canInteractMapSite, interactMapSite: interactMapSite,
    canUpgradeMapSite: canUpgradeMapSite, upgradeMapSite: upgradeMapSite,
    canMoveArmyGroup: canMoveArmyGroup, moveArmyGroup: moveArmyGroup,
    stepArmyMap: stepArmyMap, attackWithArmyGroup: attackWithArmyGroup,
    creatureBusy: creatureBusy, armyAvailable: armyAvailable, regionUnlocked: regionUnlocked,
    expeditionPower: expeditionPower, canStartExpedition: canStartExpedition, startExpedition: startExpedition,
    resolveExpedition: resolveExpedition,
    combatAbilitiesFor: combatAbilitiesFor, canStartCombat: canStartCombat, startCombat: startCombat,
    BATTLE_W: BATTLE_W, BATTLE_H: BATTLE_H, ensureCombatGrid: ensureCombatGrid,
    battleCurrentActor: battleCurrentActor, battleDistance: battleDistance, battleReachableCells: battleReachableCells,
    battleMove: battleMove, battleWait: battleWait, battleAction: battleAction, fleeCombat: fleeCombat, closeCombat: closeCombat,
    THREAT_RAID: THREAT_RAID, RAID_LEAD: RAID_LEAD, RIVAL_COUNTER_REPELS: RIVAL_COUNTER_REPELS,
    defenseValue: defenseValue, threatRate: threatRate, scheduleRaid: scheduleRaid, resolveRaid: resolveRaid, stepThreat: stepThreat,
    rivalProgress: rivalProgress, isRivalDefeated: isRivalDefeated, canCounterAttack: canCounterAttack,
    rivalLairPower: rivalLairPower, counterAttackRival: counterAttackRival
  };
})();
