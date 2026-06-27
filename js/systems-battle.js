/* ============================================================
   systems-battle.js — Neues rundenbasiertes Tactical-RPG (Phase 44).
   Eigenständige, DOM-freie Kampf-Engine: 8×6-Gitter mit Terrain,
   CT-Initiative (geschwindigkeitsbasiert), Bewegung + 1 Aktion,
   Fähigkeiten-Kits (Reichweite/AoE/Element/Status), Flankieren,
   Höhen-/Deckungsboni und taktische Gegner-KI. Deterministisch
   über einen Seed. Additiv neben dem alten systems-combat.js.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var SYS = root.GameSystems, I = root.GameSystemsInternal;
  if (!SYS || !I) throw new Error('systems-battle.js muss nach systems.js geladen werden');
  var GD = I.GD, round = I.round, clamp = I.clamp;

  var BW = 8, BH = 6, CT_MAX = 100, MAX_TURNS = 80;

  // Terrain: pass=begehbar, def=Verteidigungsbonus, high=Höhenvorteil (+Schaden/+Reichweite).
  var TERRAIN = [
    { id: 0, key: 'ebene', name: 'Ebene', icon: '·', pass: true, def: 0, high: false, moveCost: 1 },
    { id: 1, key: 'wald', name: 'Wald', icon: '🌲', pass: true, def: 0.25, high: false, moveCost: 2 },
    { id: 2, key: 'hügel', name: 'Hügel', icon: '⛰️', pass: true, def: 0.1, high: true, moveCost: 2 },
    { id: 3, key: 'fels', name: 'Fels', icon: '🪨', pass: false, def: 0, high: false, moveCost: 99 },
    { id: 4, key: 'wasser', name: 'Wasser', icon: '🌊', pass: false, def: 0, high: false, moveCost: 99 }
  ];
  function terrain(id) { return TERRAIN[id] || TERRAIN[0]; }

  // Fähigkeiten: kind damage/heal/guard; stat atk/mag; aoe single/cross/blast2; target enemy/ally/self.
  var ABILITIES = {
    schlag:     { id: 'schlag', name: 'Schlag', icon: '⚔️', kind: 'damage', stat: 'atk', power: 1.0, range: 1, aoe: 'single', element: 'physisch', mp: 0, target: 'enemy' },
    wuchthieb:  { id: 'wuchthieb', name: 'Wuchthieb', icon: '🪓', kind: 'damage', stat: 'atk', power: 1.35, range: 1, aoe: 'cross', element: 'physisch', mp: 4, target: 'enemy' },
    pfeil:      { id: 'pfeil', name: 'Pfeilschuss', icon: '🏹', kind: 'damage', stat: 'atk', power: 0.95, range: 4, aoe: 'single', element: 'physisch', mp: 2, target: 'enemy' },
    feuerstoss: { id: 'feuerstoss', name: 'Feuerstoß', icon: '🔥', kind: 'damage', stat: 'mag', power: 1.25, range: 3, aoe: 'single', element: 'feuer', mp: 4, status: 'brand', target: 'enemy' },
    frostlanze: { id: 'frostlanze', name: 'Frostlanze', icon: '❄️', kind: 'damage', stat: 'mag', power: 1.15, range: 3, aoe: 'single', element: 'wasser', mp: 4, status: 'frost', target: 'enemy' },
    sturmnova:  { id: 'sturmnova', name: 'Sturmnova', icon: '🌩️', kind: 'damage', stat: 'mag', power: 0.95, range: 2, aoe: 'blast2', element: 'wind', mp: 7, status: 'schock', target: 'enemy' },
    heilung:    { id: 'heilung', name: 'Heilwoge', icon: '💚', kind: 'heal', stat: 'mag', power: 1.4, range: 3, aoe: 'single', element: 'licht', mp: 5, target: 'ally' },
    schildwall: { id: 'schildwall', name: 'Schildwall', icon: '🛡️', kind: 'guard', stat: 'ver', power: 0, range: 0, aoe: 'single', element: 'physisch', mp: 3, status: 'wall', target: 'self' }
  };
  function ability(id) { return ABILITIES[id] || ABILITIES.schlag; }

  // Fähigkeiten-Kit nach Rolle der Kreatur.
  function kitForRole(role) {
    if (role === 'Magie') return ['schlag', 'feuerstoss', 'frostlanze', 'heilung'];
    if (role === 'Verteidigung') return ['schlag', 'wuchthieb', 'schildwall'];
    if (role === 'Fernkampf') return ['schlag', 'pfeil', 'sturmnova'];
    return ['schlag', 'wuchthieb', 'pfeil'];      // Kampf / Default
  }

  // ---------- deterministischer RNG ----------
  function makeRng(seed) {
    var v = Math.max(1, Math.floor(seed) % 2147483647);
    return function () { v = v * 16807 % 2147483647; return (v - 1) / 2147483646; };
  }

  function statusDef(id) {
    return {
      brand: { name: 'Brand', icon: '🔥', dot: 0.08, turns: 3 },
      frost: { name: 'Frost', icon: '❄️', slow: 35, turns: 2 },
      schock: { name: 'Schock', icon: '⚡', defMod: -0.3, turns: 2 },
      wall: { name: 'Schildwall', icon: '🛡️', defMod: 0.6, turns: 2 }
    }[id] || null;
  }

  // ---------- Aufbau ----------
  function statBlock(stats) {
    return { hp: Math.max(1, stats.lp), maxHp: Math.max(1, stats.lp), mp: 20, maxMp: 20,
      atk: stats.ang || 1, def: stats.ver || 1, mag: stats.mag || 1, spd: Math.max(1, stats.tmp || 1) };
  }
  function movFor(spd) { return clamp(3 + Math.floor(spd / 14), 3, 6); }

  function partyUnit(state, key, name, icon, role, stats, weakness, element) {
    var sb = statBlock(stats);
    return {
      key: key, side: 'party', name: name, icon: icon, role: role,
      hp: sb.hp, maxHp: sb.maxHp, mp: sb.mp, maxMp: sb.maxMp,
      atk: sb.atk, def: sb.def, mag: sb.mag, spd: sb.spd, mov: movFor(sb.spd),
      facing: 'E', pos: null, ct: 0, dead: false, hasActed: false, statuses: [],
      abilities: kitForRole(role), weakness: weakness || null, element: element || 'physisch'
    };
  }

  function buildParty(state, creatureUids, rulerJoin) {
    var party = [];
    if (rulerJoin) {
      party.push(partyUnit(state, 'herrscher', state.herrscher.name, GD().rulerStages[state.herrscher.stage].icon, 'Magie', I.rulerStats(state), null, 'dunkel'));
    }
    (creatureUids || []).forEach(function (uid) {
      var c = I.findCreature(state, uid); if (!c) return;
      var sp = GD().creature(c.speciesId); if (!sp) return;
      party.push(partyUnit(state, 'c' + uid, c.named ? c.name : sp.name, sp.icon, sp.role || 'Kampf', I.creatureStats(state, c), sp.weakness, sp.element));
    });
    return party.slice(0, 6);
  }

  function buildEnemies(state, region, rng) {
    var count = clamp(2 + Math.floor(region.power / 60), 2, 6);
    var per = Math.max(8, Math.round(region.power / count));
    var roles = ['Kampf', 'Magie', 'Fernkampf', 'Verteidigung'];
    var enemies = [];
    for (var i = 0; i < count; i++) {
      var role = roles[i % roles.length];
      var hp = Math.round(per * (2.4 + rng() * 0.6));
      var atk = Math.round(per * (0.5 + rng() * 0.2));
      enemies.push({
        key: 'e' + i, side: 'enemy', name: region.icon + ' Feind ' + (i + 1), icon: ['👹', '🦇', '🐍', '💀', '🦂', '👺'][i % 6], role: role,
        hp: hp, maxHp: hp, mp: 20, maxMp: 20, atk: atk, def: Math.round(per * 0.3), mag: atk, spd: Math.max(1, Math.round(8 + rng() * 8)),
        mov: movFor(Math.round(8 + rng() * 8)), facing: 'W', pos: null, ct: 0, dead: false, hasActed: false, statuses: [],
        abilities: kitForRole(role), weakness: ['feuer', 'wasser', 'wind', null][i % 4], element: 'physisch'
      });
    }
    return enemies;
  }

  function generateTerrain(rng) {
    var grid = [];
    for (var y = 0; y < BH; y++) { grid[y] = []; for (var x = 0; x < BW; x++) grid[y][x] = 0; }
    // Streue Hindernisse/Terrain in die mittleren Spalten (Startspalten frei lassen).
    var features = [[1, 'wald'], [2, 'hügel'], [3, 'fels'], [4, 'wasser']];
    var placed = 0, guard = 0;
    while (placed < 10 && guard++ < 200) {
      var x = 2 + Math.floor(rng() * (BW - 4));   // Spalten 2..BW-3
      var y = Math.floor(rng() * BH);
      if (grid[y][x] !== 0) continue;
      var f = features[Math.floor(rng() * features.length)];
      grid[y][x] = f[0]; placed++;
    }
    return grid;
  }

  function placeSide(units, grid, column, dir) {
    var slots = [], y;
    for (y = 0; y < BH; y++) slots.push(y);
    units.forEach(function (u, i) {
      var col = column, row = slots[i % slots.length];
      var tries = 0;
      while ((!terrain(grid[row][col]).pass) && tries++ < BH * 2) { row = (row + 1) % BH; if (tries % BH === 0) col += dir; col = clamp(col, 0, BW - 1); }
      u.pos = { x: clamp(col, 0, BW - 1), y: row };
    });
  }

  // ---------- Gitter-Helfer ----------
  function tb(state) { return state.tacticalBattle || null; }
  function allUnits(b) { return b.party.concat(b.enemies); }
  function living(list) { return list.filter(function (u) { return !u.dead && u.hp > 0; }); }
  function unitAt(b, x, y) { return living(allUnits(b)).filter(function (u) { return u.pos.x === x && u.pos.y === y; })[0] || null; }
  function inBounds(x, y) { return x >= 0 && x < BW && y >= 0 && y < BH; }
  function dist(a, b2) { return Math.abs(a.x - b2.x) + Math.abs(a.y - b2.y); }
  function passable(b, x, y, mover) { return inBounds(x, y) && terrain(b.grid[y][x]).pass && !allUnits(b).some(function (u) { return u !== mover && !u.dead && u.pos.x === x && u.pos.y === y; }); }

  function reachable(b, unit) {
    var start = unit.pos, out = {}, frontier = [{ x: start.x, y: start.y, c: 0 }];
    var seen = {}; seen[start.x + ',' + start.y] = 0;
    while (frontier.length) {
      var cur = frontier.shift();
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) {
        var nx = cur.x + d[0], ny = cur.y + d[1]; if (!inBounds(nx, ny)) return;
        var t = terrain(b.grid[ny][nx]); if (!t.pass) return;
        if (allUnits(b).some(function (u) { return u !== unit && !u.dead && u.pos.x === nx && u.pos.y === ny; })) return;
        var nc = cur.c + t.moveCost; if (nc > unit.mov) return;
        var key = nx + ',' + ny; if (seen[key] != null && seen[key] <= nc) return;
        seen[key] = nc; out[key] = nc; frontier.push({ x: nx, y: ny, c: nc });
      });
    }
    delete out[start.x + ',' + start.y];
    return out;
  }

  function aoeCells(centerX, centerY, shape) {
    if (shape === 'cross') return [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(function (d) { return { x: centerX + d[0], y: centerY + d[1] }; });
    if (shape === 'blast2') {
      var cells = []; for (var dy = -1; dy <= 1; dy++) for (var dx = -1; dx <= 1; dx++) cells.push({ x: centerX + dx, y: centerY + dy }); return cells;
    }
    return [{ x: centerX, y: centerY }];
  }

  // ---------- Kampfwerte ----------
  function statusMod(unit, prop) {
    var m = 0; (unit.statuses || []).forEach(function (s) { var d = statusDef(s.id); if (d && d[prop]) m += d[prop]; }); return m;
  }
  function effectiveDef(b, unit) {
    var t = terrain(b.grid[unit.pos.y][unit.pos.x]);
    return Math.max(1, unit.def * (1 + t.def + statusMod(unit, 'defMod')));
  }
  function facingVec(f) { return { N: { x: 0, y: -1 }, S: { x: 0, y: 1 }, E: { x: 1, y: 0 }, W: { x: -1, y: 0 } }[f] || { x: 1, y: 0 }; }
  function flankMult(attacker, target) {
    var fv = facingVec(target.facing);
    var dx = attacker.pos.x - target.pos.x, dy = attacker.pos.y - target.pos.y;
    // dominante Achse bestimmen
    var ax, ay; if (Math.abs(dx) >= Math.abs(dy)) { ax = dx > 0 ? 1 : (dx < 0 ? -1 : 0); ay = 0; } else { ax = 0; ay = dy > 0 ? 1 : -1; }
    var dot = ax * fv.x + ay * fv.y;
    if (dot > 0) return { mult: 1.0, side: 'front' };
    if (dot < 0) return { mult: 1.5, side: 'rücken' };
    return { mult: 1.25, side: 'flanke' };
  }
  function elementMult(ability, target) {
    if (!ability.element || ability.element === 'physisch') return 1;
    if (target.weakness === ability.element) return 1.75;
    if (target.element === ability.element) return 0.55;
    return 1;
  }
  function faceToward(unit, tx, ty) {
    var dx = tx - unit.pos.x, dy = ty - unit.pos.y;
    if (Math.abs(dx) >= Math.abs(dy)) unit.facing = dx >= 0 ? 'E' : 'W'; else unit.facing = dy >= 0 ? 'S' : 'N';
  }
  function addStatus(unit, id) { var d = statusDef(id); if (!d) return; unit.statuses = (unit.statuses || []).filter(function (s) { return s.id !== id; }); unit.statuses.push({ id: id, turns: d.turns }); }
  function blog(b, text) { b.log = b.log || []; b.log.unshift(text); b.log = b.log.slice(0, 8); }
  function markDead(b, unit) { if (unit.hp <= 0) { unit.hp = 0; unit.dead = true; blog(b, '☠️ ' + unit.name + ' fällt.'); } }

  // ---------- Initiative (CT) ----------
  function currentUnit(b) { return b.activeKey ? allUnits(b).find(function (u) { return u.key === b.activeKey; }) || null : null; }
  function advanceInitiative(b) {
    b.activeKey = null;
    var guard = 0;
    while (!b.activeKey && guard++ < 10000) {
      var alive = living(allUnits(b)); if (!alive.length) return null;
      var ready = alive.filter(function (u) { return u.ct >= CT_MAX; }).sort(function (a, c) { return c.ct - a.ct || (a.side === 'party' ? -1 : 1); });
      if (ready.length) {
        var nu = ready[0];
        tickStatusesStartTurn(b, nu);   // DoT zu Zugbeginn
        checkBattleEnd(b); if (b.status !== 'active') return null;
        if (nu.dead) continue;          // an DoT gestorben → nächste Einheit
        b.activeKey = nu.key; nu.hasActed = false; nu.moved = false;
        return currentUnit(b);
      }
      alive.forEach(function (u) { u.ct += u.spd; });
    }
    return null;
  }
  function tickStatusesStartTurn(b, unit) {
    (unit.statuses || []).slice().forEach(function (s) {
      var d = statusDef(s.id); if (!d) return;
      if (d.dot) { var dmg = Math.max(1, round(unit.maxHp * d.dot)); unit.hp = Math.max(0, unit.hp - dmg); blog(b, d.icon + ' ' + unit.name + ' erleidet ' + dmg + ' (' + d.name + ').'); }
      s.turns--;
    });
    unit.statuses = (unit.statuses || []).filter(function (s) { return s.turns > 0; });
    markDead(b, unit);
  }
  function hpFraction(list) {
    var cur = 0, max = 0; list.forEach(function (u) { cur += Math.max(0, u.hp); max += u.maxHp; }); return max > 0 ? cur / max : 0;
  }
  function resolveByTimeout(b) {
    // Patt nach MAX_TURNS: Seite mit höherem LP-Anteil hält das Feld; Gleichstand → Angreifer (Spieler) scheitert.
    var pf = hpFraction(b.party), ef = hpFraction(b.enemies);
    b.status = pf > ef ? 'won' : 'lost'; b.activeKey = null;
    blog(b, '⌛ Die Schlacht endet nach ' + MAX_TURNS + ' Zügen (LP: Reich ' + Math.round(pf * 100) + '% vs. Feind ' + Math.round(ef * 100) + '%).');
  }
  function endTurn(b, unit, ctSpent) {
    unit.ct -= (ctSpent != null ? ctSpent : CT_MAX);
    if (unit.ct < 0) unit.ct = 0;
    b.turns = (b.turns || 0) + 1;
    checkBattleEnd(b);
    if (b.status === 'active' && b.turns >= MAX_TURNS) resolveByTimeout(b);
    if (b.status === 'active') advanceInitiative(b);
  }

  // ---------- Aktionen ----------
  function canAct(b) { return b && b.status === 'active' && currentUnit(b) && currentUnit(b).side === 'party'; }

  function moveUnit(state, x, y) {
    var b = tb(state); if (!canAct(b)) return { ok: false, reason: 'Nicht am Zug.' };
    var u = currentUnit(b); if (u.moved) return { ok: false, reason: 'Bereits bewegt.' };
    var r = reachable(b, u); if (r[x + ',' + y] == null) return { ok: false, reason: 'Feld nicht erreichbar.' };
    faceToward(u, x, y); u.pos = { x: x, y: y }; u.moved = true;
    return { ok: true };
  }

  function abilityTargets(b, unit, abId) {
    var ab = ability(abId), out = [];
    for (var y = 0; y < BH; y++) for (var x = 0; x < BW; x++) {
      if (dist(unit.pos, { x: x, y: y }) > rangeOf(b, unit, ab)) continue;
      if (ab.target === 'self' && (x !== unit.pos.x || y !== unit.pos.y)) continue;
      out.push({ x: x, y: y });
    }
    return out;
  }
  function rangeOf(b, unit, ab) {
    var t = terrain(b.grid[unit.pos.y][unit.pos.x]);
    return ab.range + (t.high && ab.range > 1 ? 1 : 0);   // Höhenvorteil: +1 Reichweite für Fernangriffe
  }

  // Kernlogik einer Fähigkeit – gilt für die aktive Einheit JEDER Seite (KI nutzt sie direkt).
  function applyAbility(b, u, abId, x, y) {
    var ab = ability(abId);
    if ((u.abilities || []).indexOf(abId) < 0) return { ok: false, reason: 'Fähigkeit nicht verfügbar.' };
    if (u.mp < ab.mp) return { ok: false, reason: 'Nicht genug MP.' };
    if (dist(u.pos, { x: x, y: y }) > rangeOf(b, u, ab)) return { ok: false, reason: 'Außer Reichweite.' };
    u.mp -= ab.mp; if (x !== u.pos.x || y !== u.pos.y) faceToward(u, x, y);
    var cells = aoeCells(x, y, ab.aoe), hits = [];
    cells.forEach(function (cell) {
      var target = unitAt(b, cell.x, cell.y); if (!target) return;
      var ally = target.side === u.side;
      if (ab.kind === 'heal') { if (!ally) return; var heal = round(u.mag * ab.power); target.hp = Math.min(target.maxHp, target.hp + heal); hits.push(target.name + ' +' + heal); return; }
      if (ab.kind === 'guard') { if (!ally) return; addStatus(target, ab.status); hits.push(target.name + ' ' + statusDef(ab.status).name); return; }
      if (ally) return;  // Schadenszauber treffen nur Gegner
      var stat = ab.stat === 'mag' ? u.mag : (ab.stat === 'ver' ? u.def : u.atk);
      var fl = flankMult(u, target), high = terrain(b.grid[u.pos.y][u.pos.x]).high ? 1.2 : 1;
      var raw = stat * ab.power * fl.mult * high * elementMult(ab, target) * (0.9 + b.rng() * 0.2);
      var dmg = Math.max(1, round(raw * (100 / (100 + effectiveDef(b, target) * 1.4))));
      target.hp = Math.max(0, target.hp - dmg);
      hits.push(target.name + ' −' + dmg + (fl.side !== 'front' ? ' (' + fl.side + ')' : ''));
      if (ab.status && !target.dead) addStatus(target, ab.status);
      markDead(b, target);
    });
    blog(b, u.icon + ' ' + ab.icon + ' ' + ab.name + (hits.length ? ': ' + hits.join(', ') : ' verfehlt.'));
    endTurn(b, u, CT_MAX);
    return { ok: true, hits: hits };
  }
  function useAbility(state, abId, x, y) {
    var b = rehydrate(state); if (!canAct(b)) return { ok: false, reason: 'Nicht am Zug.' };
    return applyAbility(b, currentUnit(b), abId, x, y);
  }

  function defend(state) {
    var b = rehydrate(state); if (!canAct(b)) return { ok: false, reason: 'Nicht am Zug.' };
    var u = currentUnit(b); addStatus(u, 'wall'); blog(b, '🛡️ ' + u.name + ' geht in Verteidigung.');
    endTurn(b, u, CT_MAX); return { ok: true };
  }
  function waitTurn(state) {
    var b = rehydrate(state); if (!canAct(b)) return { ok: false, reason: 'Nicht am Zug.' };
    var u = currentUnit(b); blog(b, '⏳ ' + u.name + ' wartet.');
    endTurn(b, u, Math.round(CT_MAX * 0.6)); return { ok: true };   // Warten ist günstiger → früher wieder dran
  }

  // ---------- Gegner-KI ----------
  function enemyTurn(state) {
    var b = rehydrate(state), u = b && currentUnit(b);
    if (!b || !u || u.side !== 'enemy' || b.status !== 'active') return { ok: false };
    var foes = living(b.party); if (!foes.length) { checkBattleEnd(b); return { ok: true }; }
    foes.sort(function (a, c) { return a.hp - c.hp; });
    // Beste sofort nutzbare Fähigkeit auf ein erreichbares Ziel suchen.
    var best = null;
    (u.abilities || []).forEach(function (abId) {
      var ab = ability(abId); if (ab.kind !== 'damage' || u.mp < ab.mp) return;
      foes.forEach(function (f) { if (dist(u.pos, f.pos) <= rangeOf(b, u, ab)) { var sc = (10 - dist(u.pos, f.pos)) + flankMult(u, f).mult * 3 + (f.weakness === ab.element ? 4 : 0) - f.hp * 0.001; if (!best || sc > best.score) best = { abId: abId, x: f.pos.x, y: f.pos.y, score: sc }; } });
    });
    if (best) { return applyAbility(b, u, best.abId, best.x, best.y); }
    // Sonst zum nächsten Ziel bewegen, dann ggf. schlagen.
    var target = foes.sort(function (a, c) { return dist(u.pos, a.pos) - dist(u.pos, c.pos); })[0];
    var reach = reachable(b, u), bestCell = null, bestD = dist(u.pos, target.pos);
    Object.keys(reach).forEach(function (k) { var p = k.split(',').map(Number), d = Math.abs(p[0] - target.pos.x) + Math.abs(p[1] - target.pos.y); if (d < bestD) { bestD = d; bestCell = { x: p[0], y: p[1] }; } });
    if (bestCell) { faceToward(u, target.pos.x, target.pos.y); u.pos = bestCell; }
    if (dist(u.pos, target.pos) <= 1) { return applyAbility(b, u, 'schlag', target.pos.x, target.pos.y); }
    blog(b, '👣 ' + u.name + ' rückt vor.');
    endTurn(b, u, CT_MAX);
    return { ok: true };
  }

  // ---------- Start / Ende ----------
  function checkBattleEnd(b) {
    if (b.status !== 'active') return;
    if (!living(b.enemies).length) { b.status = 'won'; b.activeKey = null; }
    else if (!living(b.party).length) { b.status = 'lost'; b.activeKey = null; }
  }
  function startBattle(state, regionId, creatureUids, rulerJoin, seed) {
    var region = GD().region(regionId); if (!region) return { ok: false, reason: 'Region unbekannt.' };
    var party = buildParty(state, creatureUids, rulerJoin);
    if (!party.length) return { ok: false, reason: 'Keine Einheiten für den Kampf.' };
    seed = Math.max(1, Math.floor(seed || (Number(state.tick) || 1) * 2654435761 % 2147483647 || 1));
    var rng = makeRng(seed);
    var grid = generateTerrain(rng);
    var enemies = buildEnemies(state, region, rng);
    placeSide(party, grid, 0, 1);
    placeSide(enemies, grid, BW - 1, -1);
    var b = {
      regionId: regionId, seed: seed, grid: grid, party: party, enemies: enemies,
      status: 'active', activeKey: null, log: ['Die Schlacht um ' + region.name + ' beginnt!'],
      round: 1, rulerJoined: !!rulerJoin
    };
    b.rng = rng;
    state.tacticalBattle = b;
    party.concat(enemies).forEach(function (u) { u.ct = Math.floor(u.spd * (0.5 + 0.5)); });
    advanceInitiative(b);
    return { ok: true, battle: b };
  }

  // Nach Laden den (nicht serialisierten) RNG aus dem Seed wiederherstellen.
  function rehydrate(state) {
    var b = tb(state); if (b && typeof b.rng !== 'function') b.rng = makeRng(b.seed || 1);
    return b;
  }

  function applyResult(state) {
    var b = tb(state); if (!b || b.status === 'active') return null;
    var region = GD().region(b.regionId), won = b.status === 'won';
    var result = { won: won, regionId: b.regionId, reward: null, xp: 0 };
    if (won) {
      var bonus = computeBattleBonus(b);
      var reward = {}; for (var k in region.rewards) reward[k] = round(region.rewards[k] * (1 + bonus));
      I.addResources(state, reward); I.addRulerXp(state, round(region.xp * (1 + bonus)));
      if ((state.claimedRegions || []).indexOf(region.id) < 0 && SYS.regionUnlocked && SYS.regionUnlocked(state, region.id)) state.claimedRegions.push(region.id);
      result.reward = reward; result.xp = round(region.xp * (1 + bonus));
      I.log(state, '🏆 Taktische Schlacht um ' + region.name + ' gewonnen!', 'gold');
    } else {
      I.log(state, '💥 Taktische Schlacht um ' + region.name + ' verloren.', 'bad');
    }
    state.tacticalBattle = null;
    return result;
  }
  function computeBattleBonus(b) {
    var alive = living(b.party).length, total = b.party.length;
    return 0.15 + (alive / Math.max(1, total)) * 0.25;   // mehr Überlebende → mehr Beute
  }
  function abortBattle(state) { state.tacticalBattle = null; return { ok: true }; }

  // ---------- Render-View (Kopie für die UI) ----------
  function renderView(state) {
    var b = rehydrate(state); if (!b) return null;
    function viewUnit(u) {
      return { key: u.key, side: u.side, name: u.name, icon: u.icon, role: u.role, pos: { x: u.pos.x, y: u.pos.y },
        hp: u.hp, maxHp: u.maxHp, mp: u.mp, maxMp: u.maxMp, facing: u.facing, dead: !!u.dead, moved: !!u.moved,
        boss: !!u.boss, mechanic: u.mechanic || '',
        abilities: (u.abilities || []).slice(), statuses: (u.statuses || []).map(function (s) { return s.id; }) };
    }
    var cur = currentUnit(b);
    var order = living(allUnits(b)).slice().sort(function (a, c) { return (c.ct - a.ct); }).map(function (u) { return { key: u.key, name: u.name, icon: u.icon, side: u.side, ct: Math.round(u.ct) }; });
    return {
      w: BW, h: BH, status: b.status, regionId: b.regionId,
      grid: b.grid.map(function (row) { return row.slice(); }),
      party: b.party.map(viewUnit), enemies: b.enemies.map(viewUnit),
      activeKey: b.activeKey, active: cur ? viewUnit(cur) : null, order: order, log: (b.log || []).slice()
    };
  }

  root.GameBattle = {
    BW: BW, BH: BH, TERRAIN: TERRAIN, ABILITIES: ABILITIES,
    ability: ability, terrain: terrain,
    startBattle: startBattle, renderView: renderView, rehydrate: rehydrate,
    currentUnit: function (state) { return currentUnit(rehydrate(state) || {}); },
    reachableCells: function (state) { var b = rehydrate(state), u = b && currentUnit(b); return (b && u) ? reachable(b, u) : {}; },
    abilityTargets: function (state, abId) { var b = rehydrate(state), u = b && currentUnit(b); return (b && u) ? abilityTargets(b, u, abId) : []; },
    aoePreview: function (cx, cy, abId) { return aoeCells(cx, cy, ability(abId).aoe); },
    moveUnit: moveUnit, useAbility: useAbility, defend: defend, waitTurn: waitTurn,
    enemyTurn: enemyTurn, applyResult: applyResult, abortBattle: abortBattle,
    isPlayerTurn: function (state) { return canAct(rehydrate(state)); }
  };
})();
