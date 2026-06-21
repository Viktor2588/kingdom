/* ============================================================
   systems-skirmish.js — Sturmeinsätze (Phase 40).
   Kurze, direkte Gefechte mit telegraphierten Gegneraktionen,
   Kontern, Fokus und Kombo. DOM-frei; erweitert GameSystems.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var SYS = root.GameSystems, I = root.GameSystemsInternal;
  if (!SYS || !I) throw new Error('systems-skirmish.js muss nach systems.js geladen werden');

  var MISSIONS = [
    { id: 'grenzalarm', icon: '⚔️', name: 'Grenzalarm', desc: 'Streuner brechen durch die Palisaden.', baseHp: 72, baseAttack: 8, xp: 18, reward: { gold: 55, material: 30 } },
    { id: 'bestienjagd', icon: '🐺', name: 'Bestienjagd', desc: 'Eine Alpha-Bestie terrorisiert die Handelswege.', baseHp: 126, baseAttack: 12, xp: 34, reward: { gold: 105, material: 55, seelen: 5 }, unlock: function (s) { return (s.claimedRegions || []).length >= 1 || (s.metrics.named || 0) >= 1; }, hint: 'Eine Region erobern oder eine Elite benennen' },
    { id: 'daemonenvorstoss', icon: '👿', name: 'Dämonenvorstoß', desc: 'Ein Stoßtrupp fordert Tempests Herrscher heraus.', baseHp: 215, baseAttack: 17, xp: 60, reward: { gold: 190, material: 90, seelen: 18 }, unlock: function (s) { return (s.herrscher.stage || 0) >= 3 || (s.claimedRegions || []).length >= 5; }, hint: 'Dämonenlord werden oder 5 Regionen erobern' }
  ];
  var MISSION_BY = {};
  MISSIONS.forEach(function (m) { MISSION_BY[m.id] = m; });

  var INTENTS = {
    hieb: { id: 'hieb', icon: '🗡️', name: 'Wilder Hieb', hint: 'Mit Block kontern', counter: 'block', damage: 1 },
    panzer: { id: 'panzer', icon: '🛡️', name: 'Gepanzerte Haltung', hint: 'Mit Magie brechen', counter: 'magie', damage: 0.7 },
    ritual: { id: 'ritual', icon: '🔮', name: 'Dunkles Ritual', hint: 'Mit Angriff unterbrechen', counter: 'angriff', damage: 1.4 }
  };
  var INTENT_SEQUENCE = ['hieb', 'ritual', 'panzer', 'hieb', 'panzer', 'ritual'];
  var ACTIONS = {
    angriff: { id: 'angriff', icon: '⚔️', name: 'Angriff', focus: 1, damage: 1 },
    block: { id: 'block', icon: '🛡️', name: 'Block', focus: 1, damage: 0.35 },
    magie: { id: 'magie', icon: '✨', name: 'Magie', cost: 2, damage: 1.55 },
    finisher: { id: 'finisher', icon: '💥', name: 'Verschlingen', cost: 5, damage: 3.1 }
  };
  var MAX_FOCUS = 5, MAX_ROUNDS = 14, MAX_HEAT = 8;

  // Kampfhaltungen (Phase 41): aktive Vor-Kampf-Entscheidung mit echtem Trade-off.
  // „ausgewogen" ist neutral (Mults 1.0, Startfokus 1) → identisch zum Verhalten
  // ohne Haltung, damit Default-Aufrufe (z. B. ältere Tests) unverändert bleiben.
  var STANCES = [
    { id: 'ausgewogen', icon: '⚖️', name: 'Ausgewogen', desc: 'Keine Sonderwirkung – das klassische Gefecht.',
      hpMult: 1.0, atkMult: 1.0, startFocus: 1, retaliationMult: 1.0, magieMult: 1.0 },
    { id: 'berserker', icon: '⚔️', name: 'Berserker', desc: '+30 % Angriff, aber +35 % Gegenschaden. Perfekte Konter werden Pflicht.',
      hpMult: 0.85, atkMult: 1.3, startFocus: 1, retaliationMult: 1.35, magieMult: 1.0 },
    { id: 'waechter', icon: '🛡️', name: 'Wächter', desc: '+35 % LP und −40 % Gegenschaden, dafür −15 % Angriff. Verzeihend.',
      hpMult: 1.35, atkMult: 0.85, startFocus: 1, retaliationMult: 0.6, magieMult: 1.0 },
    { id: 'arkanist', icon: '🔮', name: 'Arkanist', desc: 'Start mit 3 Fokus und +35 % Magieschaden – schneller zum Finisher.',
      hpMult: 1.0, atkMult: 0.95, startFocus: 3, retaliationMult: 1.0, magieMult: 1.35 }
  ];
  var STANCE_BY = {};
  STANCES.forEach(function (st) { STANCE_BY[st.id] = st; });
  function stanceById(id) { return STANCE_BY[id] || STANCES[0]; }

  function mission(id) { return MISSION_BY[id] || null; }
  function missionUnlocked(state, m) { return !!m && (!m.unlock || m.unlock(state)); }
  function availableMissions(state) { return MISSIONS.filter(function (m) { return missionUnlocked(state, m); }); }
  function finite(value, fallback) { value = Number(value); return isFinite(value) ? value : fallback; }

  function ensureState(state) {
    if (!state.skirmish || typeof state.skirmish !== 'object' || Array.isArray(state.skirmish)) state.skirmish = {};
    var sk = state.skirmish;
    sk.heat = Math.max(0, Math.min(MAX_HEAT, Math.floor(finite(sk.heat, 0))));
    sk.streak = Math.max(0, Math.floor(finite(sk.streak, 0)));
    sk.bestCombo = Math.max(0, Math.floor(finite(sk.bestCombo, 0)));
    if (!sk.lastResult || typeof sk.lastResult !== 'object') sk.lastResult = null;
    if (sk.active && (!mission(sk.active.missionId) || ['enemyHp', 'enemyMaxHp', 'enemyAttack', 'heroHp', 'heroMaxHp', 'heroAttack', 'round', 'focus'].some(function (key) { return !isFinite(Number(sk.active[key])); }))) sk.active = null;
    if (!STANCE_BY[sk.stance]) sk.stance = STANCES[0].id;
    if (sk.active && !STANCE_BY[sk.active.stanceId]) sk.active.stanceId = sk.stance;
    return sk;
  }

  function intentFor(active) {
    return INTENT_SEQUENCE[(active.seed + active.round - 1) % INTENT_SEQUENCE.length];
  }

  function startSkirmish(state, missionId, stanceId) {
    var sk = ensureState(state), m = mission(missionId);
    if (sk.active) return { ok: false, reason: 'Ein Sturmeinsatz läuft bereits.' };
    if (!m) return { ok: false, reason: 'Unbekannter Einsatz.' };
    if (!missionUnlocked(state, m)) return { ok: false, reason: m.hint || 'Noch nicht freigeschaltet.' };
    var st = stanceById(STANCE_BY[stanceId] ? stanceId : sk.stance);
    sk.stance = st.id;  // gewählte Haltung als Voreinstellung merken
    var heatScale = 1 + sk.heat * 0.12;
    var rulerPower = Math.max(1, SYS.rulerPower(state));
    var heroMax = Math.round((92 + (state.herrscher.level || 1) * 9 + (state.herrscher.stage || 0) * 18 + Math.sqrt(rulerPower) * 2) * st.hpMult);
    var heroAttack = Math.round((10 + (state.herrscher.level || 1) * 2.2 + (state.herrscher.stage || 0) * 4 + Math.sqrt(rulerPower) * 0.75) * st.atkMult);
    var played = (state.metrics && state.metrics.skirmishesPlayed) || 0;
    sk.active = {
      missionId: m.id,
      stanceId: st.id,
      round: 1,
      maxRounds: MAX_ROUNDS,
      heroHp: heroMax,
      heroMaxHp: heroMax,
      heroAttack: heroAttack,
      enemyHp: Math.round(m.baseHp * heatScale),
      enemyMaxHp: Math.round(m.baseHp * heatScale),
      enemyAttack: Math.round(m.baseAttack * (1 + sk.heat * 0.09)),
      focus: Math.min(MAX_FOCUS, st.startFocus),
      combo: 0,
      bestCombo: 0,
      seed: Math.abs(Math.floor(finite(state.tick, 0) + played * 2 + MISSIONS.indexOf(m))) % INTENT_SEQUENCE.length,
      intentId: null,
      log: ['Der Einsatz beginnt (' + st.name + '). Lies die Absicht und kontere!']
    };
    sk.active.intentId = intentFor(sk.active);
    sk.lastResult = null;
    I.log(state, '⚡ Sturmeinsatz gestartet: ' + m.name + ' · ' + st.name + '.', 'gold');
    return { ok: true, active: sk.active, mission: m, stance: st };
  }

  function actionAvailable(state, actionId) {
    var sk = ensureState(state), active = sk.active, action = ACTIONS[actionId];
    if (!active || !action) return false;
    return !action.cost || active.focus >= action.cost;
  }

  function finish(state, won) {
    var sk = ensureState(state), active = sk.active, m = mission(active.missionId);
    state.metrics.skirmishesPlayed = (state.metrics.skirmishesPlayed || 0) + 1;
    var result = {
      won: !!won,
      missionId: m.id,
      rounds: active.round,
      combo: active.bestCombo,
      reward: null,
      xp: 0,
      heatBefore: sk.heat
    };
    if (won) {
      state.metrics.skirmishesWon = (state.metrics.skirmishesWon || 0) + 1;
      state.metrics.skirmishBestCombo = Math.max(state.metrics.skirmishBestCombo || 0, active.bestCombo);
      sk.bestCombo = Math.max(sk.bestCombo, active.bestCombo);
      sk.streak++;
      var mult = 1 + sk.heat * 0.14 + Math.min(10, active.bestCombo) * 0.04 + Math.min(5, sk.streak - 1) * 0.03;
      result.reward = {};
      for (var id in m.reward) result.reward[id] = Math.max(1, Math.round(m.reward[id] * mult));
      result.xp = Math.round(m.xp * mult);
      I.addResources(state, result.reward);
      I.addRulerXp(state, result.xp);
      sk.heat = Math.min(MAX_HEAT, sk.heat + 1);
      I.log(state, '🏆 Sturmeinsatz gewonnen: ' + m.name + ' (Kombo ' + active.bestCombo + ').', 'gold');
    } else {
      sk.streak = 0;
      sk.heat = Math.max(0, sk.heat - 1);
      I.log(state, '💥 Sturmeinsatz verloren: ' + m.name + '.', 'bad');
    }
    result.heatAfter = sk.heat;
    sk.lastResult = result;
    sk.active = null;
    return result;
  }

  function skirmishAction(state, actionId) {
    var sk = ensureState(state), active = sk.active, action = ACTIONS[actionId];
    if (!active) return { ok: false, reason: 'Kein Sturmeinsatz aktiv.' };
    if (!action) return { ok: false, reason: 'Unbekannte Aktion.' };
    if (!actionAvailable(state, actionId)) return { ok: false, reason: 'Nicht genug Fokus.' };

    var intent = INTENTS[active.intentId] || INTENTS.hieb;
    var st = stanceById(active.stanceId);
    var correct = intent.counter === actionId;
    if (action.cost) active.focus -= action.cost;
    if (action.focus) active.focus = Math.min(MAX_FOCUS, active.focus + action.focus);
    if (correct) {
      active.combo++;
      active.focus = Math.min(MAX_FOCUS, active.focus + 1);
    } else if (actionId !== 'finisher') active.combo = 0;
    active.bestCombo = Math.max(active.bestCombo, active.combo);

    var comboMult = 1 + Math.min(10, active.combo) * 0.09;
    var stanceDmg = actionId === 'magie' ? st.magieMult : 1;
    var hit = Math.max(1, Math.round(active.heroAttack * action.damage * comboMult * stanceDmg * (correct ? 1.45 : 1)));
    active.enemyHp = Math.max(0, active.enemyHp - hit);
    var line = action.icon + ' ' + action.name + ': ' + hit + ' Schaden' + (correct ? ' — perfekter Konter!' : '.');

    if (actionId === 'finisher') {
      var healed = Math.min(14, active.heroMaxHp - active.heroHp);
      active.heroHp += healed;
      if (healed) line += ' +' + healed + ' LP.';
    }
    if (active.enemyHp <= 0) {
      active.log.unshift(line);
      return { ok: true, finished: true, won: true, result: finish(state, true), line: line };
    }

    var retaliation = 0;
    if (!correct) {
      retaliation = Math.max(1, Math.round(active.enemyAttack * intent.damage * (actionId === 'block' ? 0.45 : 1) * st.retaliationMult));
      active.heroHp = Math.max(0, active.heroHp - retaliation);
      line += ' ' + intent.icon + ' ' + retaliation + ' Gegenschaden.';
    } else line += ' Kein Gegenschaden.';
    active.log.unshift(line);
    active.log = active.log.slice(0, 7);
    if (active.heroHp <= 0) return { ok: true, finished: true, won: false, result: finish(state, false), line: line };

    active.round++;
    if (active.round > active.maxRounds) {
      active.log.unshift('Der Gegner durchbricht nach ' + active.maxRounds + ' Runden die Linie.');
      return { ok: true, finished: true, won: false, result: finish(state, false), line: line };
    }
    active.intentId = intentFor(active);
    return { ok: true, finished: false, correct: correct, damage: hit, retaliation: retaliation, active: active, line: line };
  }

  function retreatSkirmish(state) {
    var sk = ensureState(state);
    if (!sk.active) return { ok: false, reason: 'Kein Sturmeinsatz aktiv.' };
    sk.active = null;
    sk.streak = 0;
    I.log(state, '🏳️ Sturmeinsatz abgebrochen.', '');
    return { ok: true };
  }

  function skirmishStatus(state) {
    var sk = ensureState(state), active = sk.active;
    return {
      heat: sk.heat,
      streak: sk.streak,
      bestCombo: sk.bestCombo,
      active: active,
      mission: active ? mission(active.missionId) : null,
      intent: active ? INTENTS[active.intentId] : null,
      stanceId: sk.stance,
      stance: active ? stanceById(active.stanceId) : stanceById(sk.stance),
      lastResult: sk.lastResult
    };
  }

  // Gewählte Voreinstellungs-Haltung setzen (vor dem Start im Hub).
  function setSkirmishStance(state, stanceId) {
    var sk = ensureState(state);
    if (STANCE_BY[stanceId]) sk.stance = stanceId;
    return sk.stance;
  }

  Object.assign(SYS, {
    SKIRMISH_MISSIONS: MISSIONS,
    SKIRMISH_INTENTS: INTENTS,
    SKIRMISH_ACTIONS: ACTIONS,
    SKIRMISH_STANCES: STANCES,
    SKIRMISH_MAX_FOCUS: MAX_FOCUS,
    SKIRMISH_MAX_HEAT: MAX_HEAT,
    skirmishMission: mission,
    skirmishStance: stanceById,
    setSkirmishStance: setSkirmishStance,
    missionUnlocked: missionUnlocked,
    availableSkirmishMissions: availableMissions,
    skirmishStatus: skirmishStatus,
    startSkirmish: startSkirmish,
    skirmishActionAvailable: actionAvailable,
    skirmishAction: skirmishAction,
    retreatSkirmish: retreatSkirmish
  });
})();
