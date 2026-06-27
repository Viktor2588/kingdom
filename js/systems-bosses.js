/* ============================================================
   systems-bosses.js — Boss-Leiter, Meisterschaft, Elite-Exemplare
   und Trophäen (Phase 51). DOM-frei; nutzt bestehende Kampf-Engines.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var SYS = root.GameSystems, I = root.GameSystemsInternal;
  var Battle = root.GameBattle, Action = root.GameActionCombat;
  if (!SYS || !I) throw new Error('systems-bosses.js muss nach den Systemmodulen geladen werden');
  var GD = I.GD, round = I.round;

  var HARD_MULT = 1.35;
  var AUTO_INTERVAL = 30;
  var BOSSES = [
    {
      id: 'jura_koloss', icon: '🌳', name: 'Jura-Koloss', title: 'Herzholz-Tyrann',
      source: 'Regionen', regionId: 'sumpf', power: 900,
      desc: 'Ein uralter Wächter versiegelt die Wege mit Wurzelwällen.',
      mechanic: 'Flankiere den Koloss oder nutze Feuer, bevor sein Ringstampf trifft.',
      mastery: 'Dornenpanzer: Seine Deckung wird härter und der Ringstampf erfasst mehr Raum.',
      counterSchools: ['hunter', 'mage'], doctrine: 'conquest',
      reward: { gold: 520, material: 280, seelen: 70 }, recipeId: 'wurzelbrecher', componentId: 'herzholz',
      unlock: function (s) { return (s.claimedRegions || []).length >= 2; },
      unlockHint: '2 Regionen erobern',
      tactical: { role: 'Verteidigung', abilities: ['schlag', 'wuchthieb', 'schildwall'], weakness: 'feuer' },
      action: { kind: 'brecher', hp: 3.0, atk: 1.3, dangerR: 15, windup: 1.2, speed: 7, adds: 1, weakness: 'feuer' },
      hardTactical: { stat: 'def', mult: 1.25 },
      hardAction: { stat: 'dangerR', add: 3 }
    },
    {
      id: 'echo_hydra', icon: '👁️', name: 'Echo-Hydra', title: 'Kern der sieben Stimmen',
      source: 'Echo-Zyklen', regionId: 'grenze', power: 2800,
      desc: 'Jeder ungebrochene Kopf wiederholt den letzten Angriff.',
      mechanic: 'Unterbrich die Fernköpfe früh; Arkana und Kommandoschulen bündeln den nötigen Fokus.',
      mastery: 'Spiegelstimmen: Zauber treffen härter und Gefahrenzonen schließen sich schneller.',
      counterSchools: ['commander', 'mage'], doctrine: 'research',
      reward: { magie: 900, wissen: 420, seelen: 180 }, recipeId: 'echoherz', componentId: 'echosplitter',
      unlock: function (s) { return (s.metrics && s.metrics.echoBosses || 0) >= 1 || (s.echoes && s.echoes.cycle >= 2); },
      unlockHint: 'Einen Echo-Kern bezwingen',
      tactical: { role: 'Magie', abilities: ['schlag', 'feuerstoss', 'sturmnova', 'heilung'], weakness: 'wind' },
      action: { kind: 'werfer', hp: 2.7, atk: 1.35, dangerR: 9, windup: 0.5, speed: 15, adds: 2, weakness: 'wind' },
      hardTactical: { stat: 'mag', mult: 1.25 },
      hardAction: { stat: 'windupTime', mult: 0.72, precise: true }
    },
    {
      id: 'chimera_alpha', icon: '🧬', name: 'Ur-Chimäre', title: 'Alpha aller Linien',
      source: 'Bestiarium', regionId: 'gebirge', power: 7200,
      desc: 'Die Chimäre wechselt zwischen Panzer, Jagd und Magie.',
      mechanic: 'Brich erst die Begleiter; Verteidiger überstehen den Wechsel, Jäger bestrafen die offene Phase.',
      mastery: 'Raubtierwechsel: Jeder Phasenwechsel beschleunigt Alpha und verstärkt seine Hiebe.',
      counterSchools: ['defender', 'hunter'], doctrine: 'breeding',
      reward: { nahrung: 1200, material: 700, seelen: 360 }, recipeId: 'chimarenhaut', componentId: 'urgenom',
      unlock: function (s) { return completeLines(s) >= 5; },
      unlockHint: '5 Bestiarium-Linien vervollständigen',
      tactical: { role: 'Kampf', abilities: ['schlag', 'wuchthieb', 'pfeil', 'frostlanze'], weakness: 'wasser' },
      action: { kind: 'verfolger', hp: 3.4, atk: 1.5, dangerR: 8, windup: 0.42, speed: 20, adds: 3, weakness: 'wasser' },
      hardTactical: { stat: 'atk', mult: 1.22 },
      hardAction: { stat: 'speed', add: 5 }
    },
    {
      id: 'himmelsrichter', icon: '⚖️', name: 'Himmelsrichter', title: 'Das letzte Urteil',
      source: 'Hauptkampagne', regionId: 'goetterthron', power: 42000,
      desc: 'Der Richter prüft Schutz, Schaden und Ausdauer in drei Urteilen.',
      mechanic: 'Bewahre Heilung für die Schlussphase; Schmiede- und Verteidigerschulen widerstehen dem Urteil.',
      mastery: 'Letztes Urteil: Sein Schutzschild hält länger und verlangt eine ausdauernde Schlussphase.',
      counterSchools: ['smith', 'defender'], doctrine: 'labyrinth',
      reward: { gold: 2600, magie: 1800, wissen: 900, seelen: 750 }, recipeId: 'richterkrone', componentId: 'urteilssiegel',
      unlock: function (s) { return (s.claimedRegions || []).length >= GD().regions.length && achievementCount(s) >= 25; },
      unlockHint: 'Hauptkampagne und 25 Erfolge abschließen',
      tactical: { role: 'Magie', abilities: ['schlag', 'sturmnova', 'heilung', 'schildwall'], weakness: 'dunkel' },
      action: { kind: 'brecher', hp: 4.0, atk: 1.7, dangerR: 17, windup: 0.9, speed: 11, adds: 2, weakness: 'dunkel' },
      hardTactical: { stat: 'maxHp', mult: 1.25 },
      hardAction: { stat: 'maxHp', mult: 1.3 }
    }
  ];
  var BOSS_BY = {};
  BOSSES.forEach(function (boss) { BOSS_BY[boss.id] = boss; });

  var COMPONENTS = {
    herzholz: { icon: '🪵', name: 'Lebendes Herzholz' },
    echosplitter: { icon: '🔷', name: 'Stabiler Echosplitter' },
    urgenom: { icon: '🧬', name: 'Urgenom' },
    urteilssiegel: { icon: '🔰', name: 'Siegel des Urteils' }
  };

  function num(value) { value = Number(value); return isFinite(value) ? value : 0; }
  function achievementCount(state) {
    return root.GameAchievements ? root.GameAchievements.unlockedCount(state) : (state.achievements || []).length;
  }
  function completeLines(state) {
    if (!SYS.bestiaryLines || !SYS.bestiaryLineComplete) return 0;
    return SYS.bestiaryLines().filter(function (line) { return SYS.bestiaryLineComplete(state, line); }).length;
  }
  function ensure(state) {
    if (!state.bosses || typeof state.bosses !== 'object' || Array.isArray(state.bosses)) state.bosses = {};
    var bosses = state.bosses;
    if (!Array.isArray(bosses.defeated)) bosses.defeated = [];
    if (!Array.isArray(bosses.hardDefeated)) bosses.hardDefeated = [];
    if (!Array.isArray(bosses.eliteDefeated)) bosses.eliteDefeated = [];
    if (!bosses.attempts || typeof bosses.attempts !== 'object' || Array.isArray(bosses.attempts)) bosses.attempts = {};
    if (!bosses.components || typeof bosses.components !== 'object' || Array.isArray(bosses.components)) bosses.components = {};
    bosses.defeated = bosses.defeated.filter(function (id, i, all) { return BOSS_BY[id] && all.indexOf(id) === i; });
    bosses.hardDefeated = bosses.hardDefeated.filter(function (id, i, all) {
      return BOSS_BY[id] && bosses.defeated.indexOf(id) >= 0 && all.indexOf(id) === i;
    });
    BOSSES.forEach(function (boss) { bosses.attempts[boss.id] = Math.max(0, Math.floor(num(bosses.attempts[boss.id]))); });
    bosses.banners = Math.max(0, Math.floor(num(bosses.banners)));
    bosses.lastAutoTick = isFinite(Number(bosses.lastAutoTick)) ? Math.floor(Number(bosses.lastAutoTick)) : -999;
    return bosses;
  }
  function boss(id) { return BOSS_BY[id] || null; }
  function unlocked(state, bossOrId) {
    var selected = typeof bossOrId === 'object' ? bossOrId : boss(bossOrId);
    return !!(selected && selected.unlock(state));
  }
  function defeated(state, id, hard) {
    var bosses = ensure(state);
    return (hard ? bosses.hardDefeated : bosses.defeated).indexOf(id) >= 0;
  }
  function challengePower(selected, hard) { return round(selected.power * (hard ? HARD_MULT : 1)); }
  function partyPower(state, uids, rulerJoin) {
    return SYS.expeditionPower(state, uids || [], !!rulerJoin);
  }
  function counterBonus(state, selected, uids) {
    var bonus = 0, seen = {};
    (uids || []).forEach(function (uid) {
      var creature = SYS.findCreature(state, uid);
      if (creature && selected.counterSchools.indexOf(creature.schoolId) >= 0 && !seen[creature.schoolId]) {
        seen[creature.schoolId] = true; bonus += 0.12;
      }
    });
    if (state.specializations && state.specializations.doctrineId === selected.doctrine) bonus += 0.10;
    return Math.min(0.34, bonus);
  }
  function canChallenge(state, id, hard) {
    var selected = boss(id);
    if (!selected) return { ok: false, reason: 'Unbekannter Boss' };
    if (!unlocked(state, selected)) return { ok: false, reason: selected.unlockHint };
    if (hard && !defeated(state, id, false)) return { ok: false, reason: 'Zuerst den normalen Boss bezwingen' };
    if (state.tacticalBattle || state.actionBattle) return { ok: false, reason: 'Ein anderer Kampf läuft bereits' };
    return { ok: true, boss: selected, hard: !!hard };
  }
  function addComponent(state, id, amount) {
    var bosses = ensure(state);
    bosses.components[id] = Math.max(0, Math.floor(num(bosses.components[id]))) + Math.max(1, Math.floor(amount || 1));
  }
  function scaledReward(source, multiplier) {
    var out = {};
    for (var id in (source || {})) out[id] = Math.max(1, round(source[id] * multiplier));
    return out;
  }
  function finalize(state, id, won, mode, hard, combatResult) {
    var selected = boss(id), bosses = ensure(state);
    if (!selected) return null;
    var first = !defeated(state, id, false), firstHard = hard && !defeated(state, id, true);
    var result = {
      bossId: id, boss: selected, won: !!won, mode: mode, hard: !!hard,
      first: first && !!won, firstHard: firstHard && !!won,
      reward: null, recipe: null, component: null,
      hint: won ? '' : selected.mechanic + (hard ? ' Meisterschaft: ' + selected.mastery : ''),
      combat: combatResult ? { regionId: combatResult.regionId, reward: combatResult.reward, xp: combatResult.xp } : null
    };
    if (won) {
      var rewardMult = hard ? (firstHard ? 1.15 : 0.45) : (first ? 1 : 0.3);
      result.reward = scaledReward(selected.reward, rewardMult);
      I.addResources(state, result.reward);
      if (first) {
        bosses.defeated.push(id);
        addComponent(state, selected.componentId, 1);
        result.component = COMPONENTS[selected.componentId];
        if ((state.unlockedRecipes || []).indexOf(selected.recipeId) < 0) {
          var unlockedRecipe = SYS.unlockRecipe(state, selected.recipeId, true);
          if (unlockedRecipe.ok) result.recipe = unlockedRecipe.recipe;
        }
      }
      if (hard && firstHard) {
        bosses.hardDefeated.push(id);
        bosses.banners++;
        addComponent(state, selected.componentId, 1);
      }
      state.metrics.bossesDefeated = (state.metrics.bossesDefeated || 0) + 1;
      I.log(state, selected.icon + ' ' + selected.name + (hard ? ' (Meisterschaft)' : '') + ' bezwungen.', 'gold');
    } else {
      I.log(state, '💥 ' + selected.name + ' widersteht dem Angriff. Hinweis: ' + selected.mechanic, 'bad');
    }
    bosses.lastResult = {
      bossId: id, won: !!won, mode: mode, hard: !!hard, tick: state.tick || 0, hint: result.hint
    };
    return result;
  }

  function prepareTactical(state, selected, hard) {
    var b = state.tacticalBattle, mult = hard ? HARD_MULT : 1;
    b.bossChallenge = { bossId: selected.id, hard: !!hard, mode: 'tactical' };
    b.log = [selected.icon + ' ' + selected.name + ': ' + selected.mechanic];
    b.enemies.forEach(function (enemy, index) {
      var isBoss = index === 0, scale = isBoss ? 2.8 : 0.78;
      enemy.name = isBoss ? selected.name : selected.title + ' · Splitter ' + index;
      enemy.icon = isBoss ? selected.icon : ['🛡️', '🔮', '🗡️', '🕯️', '⛓️'][index % 5];
      enemy.role = isBoss ? selected.tactical.role : ['Verteidigung', 'Magie', 'Fernkampf'][index % 3];
      enemy.abilities = isBoss ? selected.tactical.abilities.slice() : (enemy.role === 'Magie' ? ['schlag', 'feuerstoss'] : ['schlag', 'wuchthieb']);
      enemy.weakness = isBoss ? selected.tactical.weakness : null;
      enemy.boss = isBoss;
      enemy.mechanic = isBoss ? selected.mechanic : '';
      enemy.maxHp = Math.max(20, round(enemy.maxHp * scale * mult));
      enemy.hp = enemy.maxHp;
      enemy.atk = Math.max(4, round(enemy.atk * (isBoss ? 1.25 : 0.82) * mult));
      enemy.def = Math.max(2, round(enemy.def * (isBoss ? 1.35 : 0.8) * mult));
      enemy.mag = Math.max(4, round(enemy.mag * (isBoss ? 1.3 : 0.85) * mult));
      if (isBoss && hard && selected.hardTactical) {
        var hardMod = selected.hardTactical;
        enemy[hardMod.stat] = Math.max(1, round(enemy[hardMod.stat] * (hardMod.mult || 1) + (hardMod.add || 0)));
        if (hardMod.stat === 'maxHp') enemy.hp = enemy.maxHp;
      }
    });
    if (hard) b.log.push('🏅 Meisterschaft: ' + selected.mastery);
  }
  function startTactical(state, id, uids, rulerJoin, hard, seed) {
    if (!Battle) return { ok: false, reason: 'Taktische Kampfengine nicht geladen' };
    var check = canChallenge(state, id, hard); if (!check.ok) return check;
    var started = Battle.startBattle(state, check.boss.regionId, uids, rulerJoin, seed);
    if (!started.ok) return started;
    ensure(state).attempts[id]++;
    prepareTactical(state, check.boss, hard);
    return { ok: true, battle: state.tacticalBattle, boss: check.boss, hard: !!hard };
  }

  function prepareAction(state, selected, hard) {
    var b = state.actionBattle, cfg = selected.action, mult = hard ? HARD_MULT : 1;
    b.bossChallenge = { bossId: selected.id, hard: !!hard, mode: 'action' };
    b.wave = 1; b.totalWaves = 1;
    b.enemies = b.enemies.slice(0, Math.max(1, cfg.adds + 1));
    b.enemies.forEach(function (enemy, index) {
      var isBoss = index === 0;
      if (isBoss) {
        enemy.name = selected.name; enemy.icon = selected.icon; enemy.kind = cfg.kind; enemy.boss = true;
        enemy.r = cfg.kind === 'brecher' ? 3.6 : 3.0;
        enemy.maxHp = Math.max(30, round(enemy.maxHp * cfg.hp * mult)); enemy.hp = enemy.maxHp;
        enemy.atk = Math.max(5, round(enemy.atk * cfg.atk * mult));
        enemy.dangerR = cfg.dangerR; enemy.windupTime = cfg.windup; enemy.speed = cfg.speed;
        enemy.weakness = cfg.weakness; enemy.mechanic = selected.mechanic;
        enemy.preferRange = cfg.kind === 'werfer' ? 25 : 0;
        enemy.attackReach = cfg.kind === 'werfer' ? 34 : enemy.r + b.hero.r + 5;
        if (hard && selected.hardAction) {
          var hardMod = selected.hardAction;
          var modified = enemy[hardMod.stat] * (hardMod.mult || 1) + (hardMod.add || 0);
          enemy[hardMod.stat] = hardMod.precise ? Math.max(0.2, Math.round(modified * 100) / 100) : Math.max(1, round(modified));
          if (hardMod.stat === 'maxHp') enemy.hp = enemy.maxHp;
        }
      } else {
        enemy.name = selected.title + ' · Echo ' + index;
        enemy.maxHp = Math.max(10, round(enemy.maxHp * 0.72 * mult)); enemy.hp = enemy.maxHp;
        enemy.atk = Math.max(3, round(enemy.atk * 0.78 * mult));
      }
    });
    b.log = [selected.icon + ' ' + selected.name + ': ' + selected.mechanic];
    if (hard) b.log.push('🏅 Meisterschaft: ' + selected.mastery);
  }
  function startAction(state, id, uids, rulerJoin, hard, seed) {
    if (!Action) return { ok: false, reason: 'Action-Kampfengine nicht geladen' };
    var check = canChallenge(state, id, hard); if (!check.ok) return check;
    var started = Action.start(state, check.boss.regionId, uids, rulerJoin, seed);
    if (!started.ok) return started;
    ensure(state).attempts[id]++;
    prepareAction(state, check.boss, hard);
    return { ok: true, battle: state.actionBattle, boss: check.boss, hard: !!hard };
  }

  function resolveAuto(state, id, uids, rulerJoin, hard) {
    var check = canChallenge(state, id, hard); if (!check.ok) return check;
    var bosses = ensure(state), selected = check.boss;
    bosses.attempts[id]++;
    var raw = partyPower(state, uids, rulerJoin), bonus = counterBonus(state, selected, uids);
    var effective = round(raw * (1 + bonus)), required = challengePower(selected, hard);
    var won = effective >= required;
    var result = finalize(state, id, won, 'auto', hard, null);
    result.power = raw; result.effectivePower = effective; result.requiredPower = required; result.counterBonus = bonus;
    return { ok: true, won: won, result: result };
  }

  function eliteForLine(state, line) {
    if (!SYS.bestiaryLineStatus) return null;
    var status = SYS.bestiaryLineStatus(state, line);
    if (!status || !status.complete) return null;
    var forms = SYS.bestiaryLineSpecies(line);
    var apex = forms[forms.length - 1], rank = apex ? GD().rankIndex(apex.rank) : 0;
    return {
      id: 'elite_' + String(line).toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      line: line, icon: apex ? apex.icon : status.icon, name: line + '-Alpha',
      title: 'Seltenes Elite-Exemplar', power: 350 + rank * 780,
      componentId: 'elite_' + String(line).toLowerCase().replace(/[^a-z0-9]+/g, '_'),
      defeated: ensure(state).eliteDefeated.indexOf(line) >= 0
    };
  }
  function resolveEliteHunt(state, line, uids, rulerJoin) {
    var elite = eliteForLine(state, line);
    if (!elite) return { ok: false, reason: 'Linie noch nicht vollständig dokumentiert' };
    if (elite.defeated) return { ok: false, reason: 'Elite-Exemplar bereits als Trophäe gesichert' };
    var power = partyPower(state, uids, rulerJoin), won = power >= elite.power;
    var result = { elite: elite, won: won, power: power, requiredPower: elite.power, hint: won ? '' : 'Trainiere eine passende Jagdgruppe oder nutze eine offensive Anführerschule.' };
    if (won) {
      ensure(state).eliteDefeated.push(line);
      addComponent(state, elite.componentId, 1);
      var reward = { material: round(90 + elite.power * 0.08), seelen: round(25 + elite.power * 0.025) };
      I.addResources(state, reward); result.reward = reward;
      state.metrics.eliteHunts = (state.metrics.eliteHunts || 0) + 1;
      I.log(state, elite.icon + ' Seltenes Exemplar besiegt: ' + elite.name + '.', 'gold');
    } else I.log(state, '💥 ' + elite.name + ' entkommt. ' + result.hint, 'bad');
    return { ok: true, won: won, result: result };
  }

  function earnedTrophies(state) {
    var bosses = ensure(state), out = [];
    BOSSES.forEach(function (entry) {
      if (bosses.defeated.indexOf(entry.id) >= 0) out.push({ id: 'boss_' + entry.id, icon: entry.icon, name: entry.name, kind: 'Boss' });
      if (bosses.hardDefeated.indexOf(entry.id) >= 0) out.push({ id: 'hard_' + entry.id, icon: '🏅', name: entry.name + ' · Meisterschaft', kind: 'Banner' });
    });
    bosses.eliteDefeated.forEach(function (line) { out.push({ id: 'elite_' + line, icon: '🦴', name: line + '-Elite', kind: 'Exemplar' }); });
    if (SYS.bestiaryLines && SYS.bestiaryLineComplete) {
      SYS.bestiaryLines().forEach(function (line) {
        if (!SYS.bestiaryLineComplete(state, line)) return;
        var status = SYS.bestiaryLineStatus ? SYS.bestiaryLineStatus(state, line) : null;
        out.push({ id: 'line_' + line, icon: status ? status.icon : '📖', name: line + ' vollständig', kind: 'Bestiarium' });
      });
    }
    var contracts = state.metrics && state.metrics.contractsCompleted || 0;
    var failedContracts = state.metrics && state.metrics.contractsFailed || 0;
    [10, 25].forEach(function (goal) {
      if (contracts >= goal && failedContracts === 0) out.push({ id: 'contracts_' + goal, icon: '📜', name: goal + ' perfekte Aufträge', kind: 'Aufträge' });
    });
    if (achievementCount(state) >= (root.GameAchievements ? root.GameAchievements.total() : 999) &&
        (state.seenSpecies || []).length >= GD().creatures.length) {
      out.push({ id: 'completion', icon: '🌌', name: '100 % Chronik', kind: 'Meilenstein' });
    }
    return out;
  }

  if (Battle) {
    var originalBattleApply = Battle.applyResult;
    Battle.applyResult = function (state) {
      var challenge = state.tacticalBattle && state.tacticalBattle.bossChallenge;
      var base = originalBattleApply(state);
      if (!challenge || !base) return base;
      base.bossResult = finalize(state, challenge.bossId, base.won, 'tactical', challenge.hard, base);
      return base;
    };
  }
  if (Action) {
    var originalActionApply = Action.applyResult;
    Action.applyResult = function (state) {
      var challenge = state.actionBattle && state.actionBattle.bossChallenge;
      var base = originalActionApply(state);
      if (!challenge || !base) return base;
      base.bossResult = finalize(state, challenge.bossId, base.won, 'action', challenge.hard, base);
      return base;
    };
  }

  function availableParty(state) {
    var units = SYS.armyAvailable ? SYS.armyAvailable(state) : [];
    return units.slice(0, 6).map(function (creature) { return creature.uid; });
  }
  function autoStep(state) {
    if (!(state.settings && state.settings.watch) || (state.completion && state.completion.enabled)) return null;
    if (state.tacticalBattle || state.actionBattle || (root.GameContracts && root.GameContracts.hasActiveCrisis(state))) return null;
    var bosses = ensure(state), tick = state.tick || 0;
    if (tick - bosses.lastAutoTick < AUTO_INTERVAL) return null;
    var uids = availableParty(state); if (!uids.length) return null;
    for (var i = 0; i < BOSSES.length; i++) {
      var entry = BOSSES[i];
      if (unlocked(state, entry) && !defeated(state, entry.id, false)) {
        var power = round(partyPower(state, uids, true) * (1 + counterBonus(state, entry, uids)));
        if (power >= challengePower(entry, false)) {
          bosses.lastAutoTick = tick;
          var resolved = resolveAuto(state, entry.id, uids, true, false);
          return { text: resolved.won ? (entry.icon + ' Boss besiegt: ' + entry.name + '.') : ('💥 Bossversuch: ' + entry.name + ' — ' + entry.mechanic) };
        }
      }
    }
    var lines = SYS.bestiaryLines ? SYS.bestiaryLines() : [];
    for (var l = 0; l < lines.length; l++) {
      var elite = eliteForLine(state, lines[l]);
      if (elite && !elite.defeated && partyPower(state, uids, true) >= elite.power) {
        bosses.lastAutoTick = tick;
        var hunt = resolveEliteHunt(state, lines[l], uids, true);
        return { text: hunt.won ? (elite.icon + ' Elite-Exemplar gesichert: ' + elite.name + '.') : ('💥 Elite-Jagd gescheitert: ' + elite.name + '.') };
      }
    }
    return null;
  }
  var originalAuto = SYS.autoPlayStep;
  SYS.autoPlayStep = function (state) { return autoStep(state) || originalAuto(state); };

  var API = {
    HARD_MULT: HARD_MULT,
    AUTO_INTERVAL: AUTO_INTERVAL,
    BOSSES: BOSSES,
    COMPONENTS: COMPONENTS,
    ensure: ensure,
    boss: boss,
    unlocked: unlocked,
    defeated: defeated,
    challengePower: challengePower,
    partyPower: partyPower,
    counterBonus: counterBonus,
    canChallenge: canChallenge,
    startTactical: startTactical,
    startAction: startAction,
    resolveAuto: resolveAuto,
    eliteForLine: eliteForLine,
    resolveEliteHunt: resolveEliteHunt,
    earnedTrophies: earnedTrophies,
    completeLines: completeLines,
    achievementCount: achievementCount,
    autoStep: autoStep
  };
  root.GameBosses = API;
  Object.assign(SYS, {
    BOSS_LADDER: BOSSES,
    ensureBosses: ensure,
    bossUnlocked: unlocked,
    bossDefeated: defeated,
    bossChallengePower: challengePower,
    canChallengeBoss: canChallenge,
    startTacticalBoss: startTactical,
    startActionBoss: startAction,
    resolveBossAuto: resolveAuto,
    bossEliteForLine: eliteForLine,
    resolveBossEliteHunt: resolveEliteHunt,
    earnedTrophies: earnedTrophies
  });
})();
