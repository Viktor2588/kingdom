/* ============================================================
   systems-action.js — Echtzeit-Action-Kampf (Phase 45, Schritt 1).
   Eigenständige, DOM-freie Engine: kontinuierliche Arena mit
   Float-Positionen statt Gitterzellen, deterministischer
   Fixed-Step-Update (30 Hz), Held-Bewegung per Intent, Auto-
   Angriff, ein Gegnertyp (Verfolger), Treffer/Tod, Wellen-Ende
   und garantierte Terminierung. Deterministisch über Seed.
   Additiv neben systems-battle.js (rundenbasiert, Phase 44) —
   keine geteilten Zustände, kein Save-Schema-Eingriff.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var SYS = root.GameSystems, I = root.GameSystemsInternal;
  if (!SYS || !I) throw new Error('systems-action.js muss nach systems.js geladen werden');
  var GD = I.GD, round = I.round, clamp = I.clamp;

  // Arena in abstrakten Einheiten (16:9); der Renderer skaliert beliebig.
  var AW = 100, AH = 56;
  var STEP_MS = 1000 / 30;          // feste Simulations-Tickrate, entkoppelt von Render-FPS
  var MAX_STEPS_PER_CALL = 12;      // Spirale-of-Death-Schutz bei großen dt (Tab-Wechsel)
  var MAX_SECONDS = 90;             // harte Terminierung gegen Endlosgefechte
  var HERO_R = 2.4, ENEMY_R = 2.2;
  // Ausweichrolle: kurzer Dash mit Unverwundbarkeitsfenster (i-Frames) + Cooldown.
  var IFRAME_TIME = 0.35, DODGE_CD = 0.9, DASH_TIME = 0.16, DASH_MULT = 2.6;
  // Telegraf: Gegner kündigt den Schlag an (lesbare Gefahrenzone), bevor er trifft → ausweichbar.
  var WINDUP_TIME = 0.55;

  // ---------- deterministischer RNG (aus Seed rehydrierbar, nicht serialisiert) ----------
  function makeRng(seed) {
    var v = Math.max(1, Math.floor(seed) % 2147483647);
    return function () { v = v * 16807 % 2147483647; return (v - 1) / 2147483646; };
  }

  // ---------- Fähigkeiten-Hotbar (Cooldown statt MP — Echtzeit) ----------
  // Auto-Ziel: Schadenszauber zielen aufs nächste Ziel in Reichweite; aoeR>0 trifft alle in dessen Umkreis.
  var ACTION_ABILITIES = {
    wirbel: { id: 'wirbel', name: 'Klingenwirbel', icon: '🌀', kind: 'damage', stat: 'atk', power: 1.5, range: 12, aoeR: 9, element: 'physisch', status: null, cd: 3.0 },
    schuss: { id: 'schuss', name: 'Schnellschuss', icon: '🏹', kind: 'damage', stat: 'atk', power: 1.25, range: 42, aoeR: 0, element: 'physisch', status: null, cd: 1.6 },
    feuer: { id: 'feuer', name: 'Feuerstoß', icon: '🔥', kind: 'damage', stat: 'mag', power: 1.5, range: 40, aoeR: 6, element: 'feuer', status: 'brand', cd: 3.2 },
    frost: { id: 'frost', name: 'Frostlanze', icon: '❄️', kind: 'damage', stat: 'mag', power: 1.3, range: 40, aoeR: 0, element: 'wasser', status: 'frost', cd: 2.6 },
    heilen: { id: 'heilen', name: 'Heilwoge', icon: '💚', kind: 'heal', stat: 'mag', power: 1.6, range: 0, aoeR: 0, element: 'licht', status: null, cd: 9.0 }
  };
  function actionKit(role) {
    if (role === 'Magie') return ['feuer', 'frost', 'heilen'];
    if (role === 'Verteidigung') return ['wirbel', 'heilen', 'frost'];
    if (role === 'Fernkampf') return ['schuss', 'feuer', 'wirbel'];
    return ['wirbel', 'schuss', 'heilen'];   // Kampf / Default
  }
  function makeSlot(id) {
    var a = ACTION_ABILITIES[id] || ACTION_ABILITIES.wirbel;
    return { id: a.id, name: a.name, icon: a.icon, kind: a.kind, stat: a.stat, power: a.power, range: a.range, aoeR: a.aoeR, element: a.element, status: a.status, cd: a.cd, cdLeft: 0 };
  }

  // ---------- Statuswirkungen (Echtzeit, sekundenbasiert) ----------
  function statusDef(id) {
    return { brand: { icon: '🔥', dot: 0.05, dur: 3 }, frost: { icon: '❄️', slow: 0.5, dur: 2 }, schock: { icon: '⚡', defMod: -0.3, dur: 2 } }[id] || null;
  }
  function addStatus(e, id) {
    var d = statusDef(id); if (!d) return;
    e.statuses = (e.statuses || []).filter(function (s) { return s.id !== id; });
    e.statuses.push({ id: id, t: d.dur });
  }
  function statusMod(e, prop) { var m = 0; (e.statuses || []).forEach(function (s) { var d = statusDef(s.id); if (d && d[prop]) m += d[prop]; }); return m; }
  function enemyDef(e) { return Math.max(1, e.def * (1 + statusMod(e, 'defMod'))); }
  function elementMult(element, target) {
    if (!element || element === 'physisch') return 1;
    if (target.weakness === element) return 1.75;
    if (target.element === element) return 0.55;
    return 1;
  }

  // ---------- Aufbau ----------
  function statOf(stats) {
    return { lp: Math.max(1, stats.lp | 0), ang: stats.ang || 1, ver: stats.ver || 1, mag: stats.mag || 1, tmp: Math.max(1, stats.tmp || 1) };
  }
  // Der Held bündelt die Gruppe zu einem steuerbaren Avatar (LP summiert, Offensive = bestes Mitglied).
  function buildHero(state, creatureUids, rulerJoin) {
    var blocks = [], name = 'Held', icon = '🦸', role = rulerJoin ? 'Magie' : 'Kampf';
    if (rulerJoin) {
      blocks.push(statOf(I.rulerStats(state)));
      name = state.herrscher.name; icon = GD().rulerStages[state.herrscher.stage].icon;
    }
    (creatureUids || []).forEach(function (uid) {
      var c = I.findCreature(state, uid); if (!c) return;
      var sp = GD().creature(c.speciesId); if (!sp) return;
      blocks.push(statOf(I.creatureStats(state, c)));
      if (!rulerJoin && blocks.length === 1) { name = c.named ? c.name : sp.name; icon = sp.icon; role = sp.role || 'Kampf'; }
    });
    if (!blocks.length) return null;
    var hp = 0, atk = 1, def = 1, mag = 1, tmp = 1;
    blocks.forEach(function (b) { hp += b.lp; atk = Math.max(atk, b.ang); def = Math.max(def, b.ver); mag = Math.max(mag, b.mag); tmp = Math.max(tmp, b.tmp); });
    return {
      side: 'hero', name: name, icon: icon,
      x: AW * 0.2, y: AH * 0.5, r: HERO_R,
      hp: hp, maxHp: hp, atk: atk, def: def, mag: mag, tmp: tmp,
      speed: 22 + tmp * 0.28,          // Einheiten/Sekunde
      atkRange: 8, atkCd: 0, atkRate: 0.55, atkDamage: atk,
      invuln: 0, dodgeCd: 0, dashT: 0, dashX: 1, dashY: 0,
      role: role, hotbar: actionKit(role).map(makeSlot),
      facing: 1, dead: false, hits: 0, dodges: 0
    };
  }

  // Gegnertypen mit lesbar unterschiedlichem Verhalten (alle telegrafieren → ausweichbar).
  var ENEMY_KINDS = {
    verfolger: { label: 'Stürmer', speed: [13, 19], hp: 1.6, atk: 1.0, atkRate: 0.85, windup: 0.55, dangerR: 6, reach: ENEMY_R + HERO_R + 3, prefer: 0, r: ENEMY_R, icons: ['👹', '🐗', '🦂', '🕷️'] },
    werfer: { label: 'Werfer', speed: [9, 13], hp: 1.2, atk: 0.95, atkRate: 1.1, windup: 0.7, dangerR: 7, reach: 34, prefer: 26, r: 2.0, icons: ['🏹', '🦇', '🐍', '💀'] },
    brecher: { label: 'Brecher', speed: [8, 11], hp: 2.6, atk: 1.7, atkRate: 1.6, windup: 0.95, dangerR: 11, reach: ENEMY_R + HERO_R + 6, prefer: 0, r: 3.0, icons: ['👺', '🗿', '🐂', '👿'] }
  };
  function kindParams(kind) { return ENEMY_KINDS[kind] || ENEMY_KINDS.verfolger; }

  function waveScale(wave) { return 1 + (wave - 1) * 0.35; }   // spätere Wellen sind stärker

  function buildEnemies(region, rng, wave, withBoss) {
    var power = region.power * waveScale(wave);
    var count = clamp(2 + Math.floor(power / 55), 2, 7);
    var per = Math.max(8, Math.round(power / count));
    var order = ['verfolger', 'werfer', 'brecher'], enemies = [];
    for (var i = 0; i < count; i++) {
      var kind = order[i % order.length], k = kindParams(kind);
      var hp = Math.round(per * k.hp * (1 + rng() * 0.25));
      var atk = Math.round(per * 0.45 * k.atk);
      var ex = AW * (0.58 + rng() * 0.38);
      var ey = AH * (0.12 + (i + 0.5) / count * 0.76);
      enemies.push({
        side: 'enemy', kind: kind, key: 'w' + wave + 'e' + i,
        name: region.icon + ' ' + k.label + ' ' + (i + 1), icon: k.icons[i % k.icons.length],
        x: ex, y: ey, r: k.r,
        hp: hp, maxHp: hp, atk: atk, def: Math.round(per * 0.28),
        speed: k.speed[0] + rng() * (k.speed[1] - k.speed[0]), atkCd: 0, atkRate: k.atkRate, dead: false,
        state: 'chase', windup: 0, dangerX: 0, dangerY: 0, dangerR: k.dangerR, windupTime: k.windup,
        attackReach: k.reach, preferRange: k.prefer, statuses: [],
        weakness: ['feuer', 'wasser', 'wind', null][i % 4], element: 'physisch', boss: false, enraged: false
      });
    }
    // Boss nur in der Schlusswelle starker Regionen: verstärkt den letzten Gegner (Phase < 50 % LP).
    if (withBoss && region.power >= 200 && enemies.length) {
      var bo = enemies[enemies.length - 1], bk = kindParams('brecher');
      bo.boss = true; bo.kind = 'brecher'; bo.name = region.icon + ' ' + region.name + '-Fürst'; bo.icon = '👑';
      bo.r = 3.4; bo.hp = Math.round(bo.maxHp * 2.4); bo.maxHp = bo.hp; bo.atk = Math.round(bo.atk * 1.4);
      bo.dangerR = bk.dangerR; bo.windupTime = bk.windup; bo.attackReach = bk.reach; bo.preferRange = 0; bo.speed = bk.speed[0];
    }
    return enemies;
  }

  // ---------- Geometrie ----------
  function dist(a, b) { var dx = a.x - b.x, dy = a.y - b.y; return Math.sqrt(dx * dx + dy * dy); }
  function nearestEnemy(b) {
    var best = null, bd = Infinity;
    b.enemies.forEach(function (e) { if (e.dead) return; var d = dist(b.hero, e); if (d < bd) { bd = d; best = e; } });
    return best;
  }
  function clampPos(o, r) { o.x = clamp(o.x, r, AW - r); o.y = clamp(o.y, r, AH - r); }

  // ---------- Schaden ----------
  function dealDamage(target, raw, defStat) {
    var dmg = Math.max(1, round(raw * (100 / (100 + defStat * 1.4))));
    target.hp = Math.max(0, target.hp - dmg);
    if (target.hp <= 0) target.dead = true;
    return dmg;
  }

  function alog(b, text) { b.log = b.log || []; b.log.unshift(text); b.log = b.log.slice(0, 6); }

  // Combo/Schwung: Treffer ohne Schaden zu nehmen steigern den Schaden (gedeckelt); ein Treffer bricht sie.
  function comboMult(b) { return 1 + Math.min(b.combo || 0, 25) * 0.012; }
  function addCombo(b, n) { b.combo = (b.combo || 0) + n; if (b.combo > (b.comboBest || 0)) b.comboBest = b.combo; }

  // Hotbar-Fähigkeit feuern (Auto-Ziel). Gibt true zurück, wenn ausgelöst.
  function fireAbility(b, idx) {
    var hero = b.hero, slot = hero.hotbar[idx];
    if (!slot || slot.cdLeft > 0) return false;
    if (slot.kind === 'heal') {
      var heal = round(hero.mag * slot.power);
      hero.hp = Math.min(hero.maxHp, hero.hp + heal); slot.cdLeft = slot.cd;
      alog(b, hero.icon + ' ' + slot.icon + ' ' + slot.name + ' (+' + heal + ').');
      return true;
    }
    var tgt = nearestEnemy(b); if (!tgt || dist(hero, tgt) > slot.range) return false;
    slot.cdLeft = slot.cd; hero.facing = tgt.x >= hero.x ? 1 : -1;
    var stat = slot.stat === 'mag' ? hero.mag : hero.atk;
    var hitList = slot.aoeR > 0 ? b.enemies.filter(function (e) { return !e.dead && dist({ x: tgt.x, y: tgt.y }, e) <= slot.aoeR; }) : [tgt];
    var killed = 0;
    hitList.forEach(function (e) {
      var dmg = dealDamage(e, stat * slot.power * comboMult(b) * elementMult(slot.element, e) * (0.9 + b.rng() * 0.2), enemyDef(e));
      if (slot.status && !e.dead) addStatus(e, slot.status);
      if (e.dead) killed++;
    });
    addCombo(b, hitList.length);
    alog(b, hero.icon + ' ' + slot.icon + ' ' + slot.name + (hitList.length > 1 ? ' (×' + hitList.length + ')' : '') + (killed ? ' ☠️' + killed : ''));
    return true;
  }

  // ---------- ein fester Simulations-Tick (dt in Sekunden) ----------
  function tick(b, dt) {
    if (b.status !== 'active') return;
    b.elapsed += dt;
    var hero = b.hero, intent = b.intent || {};

    // Timer für Ausweichrolle/i-Frames herunterzählen.
    hero.invuln = Math.max(0, hero.invuln - dt);
    hero.dodgeCd = Math.max(0, hero.dodgeCd - dt);
    hero.dashT = Math.max(0, hero.dashT - dt);

    var mx = clamp(intent.moveX || 0, -1, 1), my = clamp(intent.moveY || 0, -1, 1);
    var ml = Math.sqrt(mx * mx + my * my);

    // Ausweichrolle starten: Dash in Bewegungs-/Blickrichtung + Unverwundbarkeitsfenster.
    if (intent.dodge && hero.dodgeCd <= 0 && hero.dashT <= 0) {
      if (ml > 1e-4) { hero.dashX = mx / ml; hero.dashY = my / ml; }
      else { hero.dashX = hero.facing; hero.dashY = 0; }
      hero.dashT = DASH_TIME; hero.invuln = IFRAME_TIME; hero.dodgeCd = DODGE_CD; hero.dodges++;
      hero.facing = hero.dashX >= 0 ? 1 : -1;
    }

    // Bewegung: während des Dashs schneller in Dash-Richtung, sonst normaler Intent (normalisiert).
    if (hero.dashT > 0) {
      hero.x += hero.dashX * hero.speed * DASH_MULT * dt;
      hero.y += hero.dashY * hero.speed * DASH_MULT * dt;
      clampPos(hero, hero.r);
    } else if (ml > 1e-4) {
      hero.x += (mx / ml) * hero.speed * dt;
      hero.y += (my / ml) * hero.speed * dt;
      hero.facing = mx >= 0 ? 1 : -1;
      clampPos(hero, hero.r);
    }

    // Held-Auto-Angriff: nächstes Ziel in Reichweite, getaktet über Cooldown.
    hero.atkCd = Math.max(0, hero.atkCd - dt);
    if (intent.attack !== false && hero.atkCd <= 0) {
      var tgt = nearestEnemy(b);
      if (tgt && dist(hero, tgt) <= hero.atkRange + tgt.r) {
        hero.atkCd = hero.atkRate;
        hero.facing = tgt.x >= hero.x ? 1 : -1;
        var dmg = dealDamage(tgt, hero.atkDamage * comboMult(b) * (0.9 + b.rng() * 0.2), enemyDef(tgt));
        hero.hits++; addCombo(b, 1);
        if (tgt.dead) alog(b, hero.icon + ' erlegt ' + tgt.name + ' (−' + dmg + ').');
      }
    }

    // Fähigkeiten-Hotbar: Cooldowns herunterzählen, gedrückte Slots feuern (Cooldown-gegated).
    hero.hotbar.forEach(function (s) { s.cdLeft = Math.max(0, s.cdLeft - dt); });
    (intent.skills || []).forEach(function (idx) { fireAbility(b, idx | 0); });

    // Gegner: Verfolger jagen den Helden, kündigen den Schlag an (Telegraf) und treffen erst danach.
    b.enemies.forEach(function (e) {
      if (e.dead) return;
      // Statuswirkungen: Brand-DoT, Frost-Verlangsamung, Schock (Verteidigung) — sekundenbasiert.
      var slow = 0;
      e.statuses = (e.statuses || []).filter(function (st) {
        var d = statusDef(st.id); if (!d) return false;
        if (d.dot) e.hp = Math.max(0, e.hp - Math.max(0.5, e.maxHp * d.dot * dt));
        if (d.slow) slow = Math.max(slow, d.slow);
        st.t -= dt; return st.t > 0;
      });
      if (e.hp <= 0) { e.dead = true; alog(b, '🔥 ' + e.name + ' erliegt dem Statuseffekt.'); return; }
      var spd = e.speed * (1 - slow);
      e.atkCd = Math.max(0, e.atkCd - dt);
      // Boss-Phase unter 50 % LP: einmalige Entfesselung (schneller, härter, größere Zone).
      if (e.boss && !e.enraged && e.hp <= e.maxHp * 0.5) {
        e.enraged = true; e.atkRate *= 0.6; e.atk = round(e.atk * 1.25); e.dangerR += 2;
        alog(b, '⚡ ' + e.name + ' entfesselt seine Wut!');
      }
      if (e.state === 'windup') {
        // Telegraf läuft: Gegner ist festgelegt (steht), Gefahrenzone bleibt am angekündigten Punkt.
        e.windup -= dt;
        if (e.windup <= 0) {
          e.state = 'chase'; e.atkCd = e.atkRate;
          var inZone = dist({ x: hero.x, y: hero.y }, { x: e.dangerX, y: e.dangerY }) <= e.dangerR;
          if (inZone && hero.invuln <= 0) {
            var hd = dealDamage(hero, e.atk, hero.def); b.combo = 0;   // getroffen → Schwung bricht
            if (hero.dead) alog(b, '💀 ' + hero.name + ' fällt durch ' + e.name + ' (−' + hd + ').');
          }
        }
        return;
      }
      var d = dist(e, hero);
      if (d <= e.attackReach && e.atkCd <= 0) {
        // Schlag ankündigen: Gefahrenzone am aktuellen Heldenpunkt verankern (Wegrennen/Ausweichen kontert).
        e.state = 'windup'; e.windup = e.windupTime || WINDUP_TIME; e.dangerX = hero.x; e.dangerY = hero.y;
      } else {
        // Werfer halten Abstand (kiten); Stürmer/Brecher rücken vor.
        var dir = 1;
        if (e.preferRange > 0) { if (d < e.preferRange - 3) dir = -1; else if (d <= e.preferRange + 3) dir = 0; }
        if (dir !== 0) {
          var dx = (hero.x - e.x) * dir, dy = (hero.y - e.y) * dir, dl = d || 1;
          e.x += (dx / dl) * spd * dt;
          e.y += (dy / dl) * spd * dt;
          clampPos(e, e.r);
        }
      }
    });

    // Aufräumen der toten Gegner aus der Liste (klein halten).
    b.enemies = b.enemies.filter(function (e) { return !e.dead; });

    // Terminierung / Wellenwechsel.
    if (hero.dead) { b.status = 'lost'; alog(b, '💥 Niederlage.'); return; }
    if (!b.enemies.length) {
      if (b.wave < b.totalWaves) {
        b.wave++;
        var region = GD().region(b.regionId);
        hero.hp = Math.min(hero.maxHp, hero.hp + Math.round(hero.maxHp * 0.15));   // kurze Atempause
        b.enemies = buildEnemies(region, b.rng, b.wave, b.wave === b.totalWaves);
        alog(b, '🌊 Welle ' + b.wave + '/' + b.totalWaves + ' rückt an! (+15 % LP)');
        return;
      }
      b.status = 'won'; alog(b, '🏆 Alle Wellen bezwungen!'); return;
    }
    if (b.elapsed >= MAX_SECONDS) { resolveTimeout(b); }
  }

  function resolveTimeout(b) {
    var pf = b.hero.maxHp > 0 ? b.hero.hp / b.hero.maxHp : 0;
    var ec = 0, em = 0; b.enemies.forEach(function (e) { ec += Math.max(0, e.hp); em += e.maxHp; });
    var ef = em > 0 ? ec / em : 0;
    b.status = pf >= ef ? 'won' : 'lost';
    alog(b, '⌛ Zeit abgelaufen (Held ' + Math.round(pf * 100) + '% vs. Feind ' + Math.round(ef * 100) + '%).');
  }

  // ---------- öffentliche Schrittfunktion ----------
  function ab(state) { return state.actionBattle || null; }
  function rehydrate(state) {
    var b = ab(state); if (b && typeof b.rng !== 'function') b.rng = makeRng(b.seed || 1);
    return b;
  }
  // Treibt die Sim um echte Zeit (dtMs) voran; akkumuliert auf feste Ticks → reproduzierbar.
  function step(state, dtMs) {
    var b = rehydrate(state); if (!b || b.status !== 'active') return b ? b.status : null;
    b.acc = (b.acc || 0) + Math.max(0, dtMs || 0);
    var steps = 0;
    // Epsilon gegen Float-Drift an der Tick-Grenze → 6×kleiner Schritt == 1×großer Schritt.
    while (b.acc >= STEP_MS - 1e-9 && steps < MAX_STEPS_PER_CALL && b.status === 'active') {
      b.acc -= STEP_MS; steps++; tick(b, STEP_MS / 1000);
    }
    if (b.acc > STEP_MS * MAX_STEPS_PER_CALL) b.acc = 0;   // bei sehr großem dt nicht aufstauen
    return b.status;
  }
  function setIntent(state, intent) {
    var b = ab(state); if (!b) return;
    b.intent = { moveX: intent && intent.moveX || 0, moveY: intent && intent.moveY || 0,
      attack: !intent || intent.attack !== false, dodge: !!(intent && intent.dodge),
      skills: (intent && intent.skills) ? intent.skills.slice() : [] };
  }

  // ---------- Start / Ergebnis ----------
  function start(state, regionId, creatureUids, rulerJoin, seed) {
    var region = GD().region(regionId); if (!region) return { ok: false, reason: 'Region unbekannt.' };
    var hero = buildHero(state, creatureUids, rulerJoin); if (!hero) return { ok: false, reason: 'Keine Einheiten für das Gefecht.' };
    seed = Math.max(1, Math.floor(seed || (Number(state.tick) || 1) * 2654435761 % 2147483647 || 1));
    var rng = makeRng(seed);
    var totalWaves = clamp(2 + Math.floor(region.power / 260), 2, 3);
    var enemies = buildEnemies(region, rng, 1, totalWaves === 1);
    var b = {
      regionId: regionId, seed: seed, status: 'active', elapsed: 0, acc: 0, combo: 0, comboBest: 0,
      wave: 1, totalWaves: totalWaves,
      hero: hero, enemies: enemies, intent: { moveX: 0, moveY: 0, attack: true, dodge: false, skills: [] },
      rulerJoined: !!rulerJoin, log: ['⚔️ Echtzeit-Gefecht um ' + region.name + ' beginnt! (Welle 1/' + totalWaves + ')']
    };
    b.rng = rng;
    state.actionBattle = b;
    return { ok: true, battle: b };
  }

  function applyResult(state) {
    var b = ab(state); if (!b || b.status === 'active') return null;
    var region = GD().region(b.regionId), won = b.status === 'won';
    var result = { won: won, regionId: b.regionId, reward: null, xp: 0 };
    if (won) {
      var bonus = 0.15 + clamp(b.hero.hp / Math.max(1, b.hero.maxHp), 0, 1) * 0.3 + ((b.totalWaves || 1) - 1) * 0.12;   // mehr Rest-LP & mehr Wellen → mehr Beute
      var reward = {}; for (var k in region.rewards) reward[k] = round(region.rewards[k] * (1 + bonus));
      I.addResources(state, reward); I.addRulerXp(state, round(region.xp * (1 + bonus)));
      if ((state.claimedRegions || []).indexOf(region.id) < 0 && SYS.regionUnlocked && SYS.regionUnlocked(state, region.id)) state.claimedRegions.push(region.id);
      result.reward = reward; result.xp = round(region.xp * (1 + bonus));
      I.log(state, '🏆 Echtzeit-Gefecht um ' + region.name + ' gewonnen!', 'gold');
    } else {
      I.log(state, '💥 Echtzeit-Gefecht um ' + region.name + ' verloren.', 'bad');
    }
    state.actionBattle = null;
    return result;
  }
  function abort(state) { state.actionBattle = null; return { ok: true }; }

  // Kopfloses Auto-Gefecht für Zuschauer-/Auto-Modus: startet, spielt mit simpler KI
  // (auf Ziel zu, ausweichen wenn eine Zone gleich trifft, bereite Skills feuern) und wertet aus.
  // Deterministisch über den Seed, feste Ticks. Gibt das applyResult-Ergebnis zurück.
  function autoResolve(state, regionId, uids, rulerJoin, seed) {
    var r = start(state, regionId, uids, rulerJoin, seed); if (!r.ok) return r;
    var b = state.actionBattle, guard = 0;
    while (b.status === 'active' && guard++ < 20000) {
      var hero = b.hero, tgt = nearestEnemy(b), intent = { moveX: 0, moveY: 0, attack: true, skills: [] };
      if (tgt) { intent.moveX = tgt.x - hero.x; intent.moveY = tgt.y - hero.y; }
      var threat = null;
      b.enemies.forEach(function (e) { if (e.state === 'windup' && e.windup <= 0.15 && dist(hero, { x: e.dangerX, y: e.dangerY }) <= e.dangerR) threat = e; });
      if (threat && hero.dodgeCd <= 0) { intent.dodge = true; intent.moveX = hero.x - threat.dangerX; intent.moveY = hero.y - threat.dangerY; }
      hero.hotbar.forEach(function (slot, i) { if (slot.cdLeft <= 0 && slot.kind === 'damage' && tgt && dist(hero, tgt) <= slot.range) intent.skills.push(i); });
      setIntent(state, intent);
      step(state, STEP_MS);
    }
    return applyResult(state);
  }

  // ---------- Render-View (reine Kopie für die UI; verändert nie Zustand) ----------
  function renderView(state) {
    var b = rehydrate(state); if (!b) return null;
    var h = b.hero;
    return {
      w: AW, h: AH, status: b.status, regionId: b.regionId, elapsed: round(b.elapsed * 10) / 10, combo: b.combo || 0, comboBest: b.comboBest || 0, wave: b.wave || 1, totalWaves: b.totalWaves || 1,
      hero: { name: h.name, icon: h.icon, role: h.role, x: round(h.x * 100) / 100, y: round(h.y * 100) / 100, r: h.r, hp: h.hp, maxHp: h.maxHp, facing: h.facing, atkRange: h.atkRange, atkCd: round(h.atkCd * 100) / 100, invuln: round(h.invuln * 100) / 100, dodgeCd: round(h.dodgeCd * 100) / 100, dashing: h.dashT > 0,
        cooldowns: h.hotbar.map(function (s) { return { id: s.id, name: s.name, icon: s.icon, kind: s.kind, cdLeft: round(s.cdLeft * 100) / 100, cd: s.cd, ready: s.cdLeft <= 0 }; }) },
      enemies: b.enemies.map(function (e) {
        var v = { key: e.key, name: e.name, icon: e.icon, kind: e.kind, boss: !!e.boss, enraged: !!e.enraged, x: round(e.x * 100) / 100, y: round(e.y * 100) / 100, r: e.r, hp: e.hp, maxHp: e.maxHp, state: e.state, statuses: (e.statuses || []).map(function (s) { return s.id; }) };
        if (e.state === 'windup') { v.windup = round(e.windup * 100) / 100; v.windupMax = e.windupTime || WINDUP_TIME; v.danger = { x: round(e.dangerX * 100) / 100, y: round(e.dangerY * 100) / 100, r: e.dangerR }; }
        return v;
      }),
      log: (b.log || []).slice()
    };
  }

  root.GameActionCombat = {
    AW: AW, AH: AH, STEP_MS: STEP_MS, MAX_SECONDS: MAX_SECONDS, ABILITIES: ACTION_ABILITIES,
    start: start, step: step, setIntent: setIntent, rehydrate: rehydrate, autoResolve: autoResolve,
    renderView: renderView, applyResult: applyResult, abort: abort,
    nearestEnemy: function (state) { var b = rehydrate(state); return b ? nearestEnemy(b) : null; }
  };
})();
