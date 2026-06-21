/* ============================================================
   systems-combat.js — Taktischer 7×5-Rasterkampf.
   Erweitert GameSystems nach systems.js; klassisches Script ohne Build.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var I = root.GameSystemsInternal;
  if (!I || !root.GameSystems) throw new Error('systems-combat.js muss nach systems.js geladen werden');
  var GD = I.GD, rng = I.rng, round = I.round, clamp = I.clamp, RISK = I.RISK;
  var log = I.log, findCreature = I.findCreature, findArmyGroup = I.findArmyGroup, stackCount = I.stackCount;
  var creatureStats = I.creatureStats, rulerStats = I.rulerStats;
  var regionUnlocked = I.regionUnlocked, creatureBusy = I.creatureBusy, isWounded = I.isWounded;
  var computeBonuses = I.computeBonuses, addResources = I.addResources;
  var addRulerXp = I.addRulerXp, addCreatureXp = I.addCreatureXp, addSkillXp = I.addSkillXp;
  var makeDropItem = I.makeDropItem, releaseCreatureEquipment = I.releaseCreatureEquipment;

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
      line: ruler ? 'Schleim' : sp.line, speciesId: ruler ? 'herrscher' : c.speciesId,
      side: 'party', stack: count, stats: scaled, hp: scaled.lp, maxHp: scaled.lp, mp: maxMp, maxMp: maxMp,
      abilities: combatAbilitiesFor(state, holderKey), defending: false, statuses: [], dead: false,
      moveRange: clamp(2 + Math.floor((scaled.tmp || 0) / 35), 2, 4), attackRange: ranged ? 3 : 1,
      retaliated: false, waited: false, pos: null, fieldAffinity: ruler ? state.affinity : null
    };
  }
  var ENEMY_BOARD_LINES = ['Goblin', 'Wolf', 'Oger', 'Untot', 'Drache'];
  function enemyFor(region, index, count) {
    var rootPower = Math.sqrt(region.power);
    var maxHp = Math.max(45, round(rootPower * 10 / Math.sqrt(count)));
    var names = ['Vorhut', 'Hexer', 'Gebietsfürst'];
    var regionIndex = Math.max(0, GD().regions.indexOf(region));
    return {
      key: 'enemy_' + index, name: region.name + ' – ' + names[index % names.length], icon: region.icon,
      line: ENEMY_BOARD_LINES[(regionIndex + index) % ENEMY_BOARD_LINES.length],
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
      if (!a.line) {
        var creature = a.key === 'herrscher' ? null : findCreature(state, a.key);
        var species = creature ? GD().creature(creature.speciesId) : null;
        a.line = species ? species.line : 'Schleim';
      }
      if (a.moveRange == null) a.moveRange = 2; if (a.attackRange == null) a.attackRange = 1;
      if (a.retaliated == null) a.retaliated = false; if (a.waited == null) a.waited = false;
    });
    combat.enemies.forEach(function (a, i) {
      a.side = 'enemy'; if (!a.pos) a.pos = { x: BATTLE_W - 1, y: Math.min(BATTLE_H - 1, i * 2) };
      if (!a.line) {
        var region = GD().region(combat.regionId), regionIndex = Math.max(0, GD().regions.indexOf(region));
        a.line = ENEMY_BOARD_LINES[(regionIndex + i) % ENEMY_BOARD_LINES.length];
      }
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
      var b = computeBonuses(state);
      for (var res in region.rewards) {
        var gain = region.rewards[res] * rk.reward * (0.9 + rng() * 0.2);
        if (res === 'seelen') gain *= (1 + b.seelen);
        gains[res] = round(gain);
      }
      addResources(state, gains);
      var xp = round(region.xp * 1.2 * (1 + b.xp));
      cbt.party.forEach(function (a) {
        if (a.key === 'herrscher') { addRulerXp(state, round(xp * 0.7)); addSkillXp(state, state.herrscher, round(xp * 0.4)); }
        else { var pc = findCreature(state, a.key); if (pc) { addCreatureXp(state, pc, xp); if (pc.named) addSkillXp(state, pc, round(xp * 0.45)); } }
      });
      if (rng() < Math.min(0.95, region.dropChance * 1.25 * rk.drop * (1 + b.drop))) drop = makeDropItem(state, region, cbt.risk);
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
    if (drop) log(state, '🎁 Schmiedefund: ' + drop.name + '.', 'gold');
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
    var actionAbility = ability;
    var learnedActiveSpell = actor.key === 'herrscher' && (state.learnedFieldMagic || []).some(function (spellId) {
      var spell = GD().fieldSpell(spellId); return spell && spell.type === 'combat' && spell.ability === abilityId;
    });
    if (learnedActiveSpell && (computeBonuses(state).feldmagie || 0) > 0) {
      actionAbility = {};
      for (var ak in ability) actionAbility[ak] = ability[ak];
      actionAbility.power = ability.power * (1 + computeBonuses(state).feldmagie);
    }
    if (ability.kind === 'heal' && (!cbt.party[targetIndex] || cbt.party[targetIndex].dead)) return { ok: false, reason: 'Ungültiges Heilziel' };
    if (ability.kind !== 'guard' && ability.kind !== 'heal' && (!cbt.enemies[targetIndex] || cbt.enemies[targetIndex].dead)) return { ok: false, reason: 'Ungültiges Ziel' };
    if (ability.kind === 'heal' && battleDistance(actor, cbt.party[targetIndex]) > battleAbilityRange(actor, actionAbility)) return { ok: false, reason: 'Heilziel ist außer Reichweite' };
    actor.mp -= ability.cost;
    if (ability.kind === 'guard') {
      actor.defending = true; combatLog(cbt, '🛡️ ' + actor.name + ' verteidigt sich.');
    } else if (ability.kind === 'heal') {
      var ally = cbt.party[targetIndex];
      var heal = Math.max(4, round(actor.stats.mag * actionAbility.power)); ally.hp = Math.min(ally.maxHp, ally.hp + heal);
      combatLog(cbt, '✨ ' + actor.name + ' heilt ' + ally.name + ' um ' + heal + ' LP.');
    } else {
      var target = cbt.enemies[targetIndex];
      if (ability.kind === 'analyze') {
        target.analyzed = true; combatLog(cbt, '🔍 ' + target.name + ': schwach gegen ' + target.weakness + ', resistent gegen ' + target.element + '.');
      } else {
        var range = battleAbilityRange(actor, actionAbility);
        if (battleDistance(actor, target) > range) {
          var approach = bestBattleApproach(cbt, actor, target);
          if (approach && (approach.x !== actor.pos.x || approach.y !== actor.pos.y)) {
            actor.pos = { x: approach.x, y: approach.y }; combatLog(cbt, '👣 ' + actor.name + ' rückt auf ' + target.name + ' vor.');
          }
          if (battleDistance(actor, target) > range) { advanceCombatTurn(state); return { ok: true, moved: true, combat: cbt }; }
        }
        performBattleHit(cbt, actor, target, actionAbility, actionAbility.icon);
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

  // Normalisiertes, kopiertes View-Modell für Renderer. Canvas-Code erhält
  // keine Referenz auf den Spielzustand und kann Kampflogik nie verändern.
  function battleRenderState(state) {
    var combat = ensureCombatGrid(state);
    if (!combat) return null;
    var current = combat.status === 'active' ? battleCurrentActor(combat) : null;
    var reachable = current && current.side === 'party' ? battleReachableCells(combat, current) : [];
    function actorView(actor) {
      return {
        key: actor.key, renderKey: actor.side + ':' + String(actor.key),
        name: actor.name, icon: actor.icon, line: actor.line || null, side: actor.side,
        stack: Math.max(1, actor.stack || 1), hp: Math.max(0, actor.hp || 0), maxHp: Math.max(1, actor.maxHp || 1),
        hpFraction: Math.max(0, Math.min(1, (actor.hp || 0) / Math.max(1, actor.maxHp || 1))),
        mp: Math.max(0, actor.mp || 0), maxMp: Math.max(0, actor.maxMp || 0),
        dead: !!actor.dead, pos: { x: actor.pos.x, y: actor.pos.y },
        statuses: (actor.statuses || []).map(function (status) { return { id: status.id, turns: status.turns }; })
      };
    }
    var region = GD().region(combat.regionId);
    return {
      width: BATTLE_W, height: BATTLE_H, round: combat.round, status: combat.status,
      regionId: combat.regionId, element: region ? region.element : 'erde', biome: 'jura',
      currentKey: current ? current.side + ':' + String(current.key) : null,
      reachable: reachable.map(function (cell) { return { x: cell.x, y: cell.y, d: cell.d }; }),
      obstacles: (combat.obstacles || []).slice(),
      actors: combat.party.concat(combat.enemies).map(actorView)
    };
  }


  Object.assign(root.GameSystems, {
    combatAbilitiesFor: combatAbilitiesFor, canStartCombat: canStartCombat, startCombat: startCombat,
    BATTLE_W: BATTLE_W, BATTLE_H: BATTLE_H, ensureCombatGrid: ensureCombatGrid,
    battleCurrentActor: battleCurrentActor, battleDistance: battleDistance, battleReachableCells: battleReachableCells,
    battleRenderState: battleRenderState,
    battleMove: battleMove, battleWait: battleWait, battleAction: battleAction,
    fleeCombat: fleeCombat, closeCombat: closeCombat
  });
})();
