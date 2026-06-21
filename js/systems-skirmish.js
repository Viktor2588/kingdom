/* ============================================================
   systems-skirmish.js — Sturmeinsätze (Phasen 40–42).
   Kurze, direkte Gefechte mit telegraphierten Gegneraktionen,
   Kontern, Fokus und Kombo. DOM-frei; erweitert GameSystems.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var SYS = root.GameSystems, I = root.GameSystemsInternal;
  if (!SYS || !I) throw new Error('systems-skirmish.js muss nach systems.js geladen werden');

  var MISSIONS = [
    { id: 'grenzalarm', profileId: 'waechter', icon: '⚔️', name: 'Grenzalarm', desc: 'Streuner brechen durch die Palisaden.', baseHp: 72, baseAttack: 8, xp: 18, reward: { gold: 55, material: 30 } },
    { id: 'bestienjagd', profileId: 'bestie', icon: '🐺', name: 'Bestienjagd', desc: 'Eine Alpha-Bestie terrorisiert die Handelswege.', baseHp: 126, baseAttack: 12, xp: 34, reward: { gold: 105, material: 55, seelen: 5 }, unlock: function (s) { return (s.claimedRegions || []).length >= 1 || (s.metrics.named || 0) >= 1; }, hint: 'Eine Region erobern oder eine Elite benennen' },
    { id: 'daemonenvorstoss', profileId: 'hexer', icon: '👿', name: 'Dämonenvorstoß', desc: 'Ein Stoßtrupp fordert Tempests Herrscher heraus.', baseHp: 215, baseAttack: 17, xp: 60, reward: { gold: 190, material: 90, seelen: 18 }, unlock: function (s) { return (s.herrscher.stage || 0) >= 3 || (s.claimedRegions || []).length >= 5; }, hint: 'Dämonenlord werden oder 5 Regionen erobern' }
  ];
  var MISSION_BY = {};
  MISSIONS.forEach(function (m) { MISSION_BY[m.id] = m; });

  var INTENTS = {
    hieb: { id: 'hieb', icon: '🗡️', name: 'Wilder Hieb', hint: 'Mit Block kontern', counter: 'block', damage: 1 },
    panzer: { id: 'panzer', icon: '🛡️', name: 'Gepanzerte Haltung', hint: 'Mit Magie brechen', counter: 'magie', damage: 0.7 },
    ritual: { id: 'ritual', icon: '🔮', name: 'Dunkles Ritual', hint: 'Mit Angriff unterbrechen', counter: 'angriff', damage: 1.4 },
    doppelhieb: { id: 'doppelhieb', icon: '🐾', name: 'Doppelhieb', hint: 'Beide Treffer mit Block abfangen', counter: 'block', damage: 1.3 },
    raserei: { id: 'raserei', icon: '🔥', name: 'Raserei', hint: 'Mit Magie die Wut brechen', counter: 'magie', damage: 1.55 },
    konterschlag: { id: 'konterschlag', icon: '⚔️', name: 'Konterschlag', hint: 'Mit Block den Gegenstoß abfangen', counter: 'block', damage: 1.45 },
    ritualkette: { id: 'ritualkette', icon: '⛓️', name: 'Ritualkette', hint: 'Mit Angriff die Kette zerreißen', counter: 'angriff', damage: 1.65 },
    seelenbrand: { id: 'seelenbrand', icon: '🜏', name: 'Seelenbrand', hint: 'Mit Magie das Siegel neutralisieren', counter: 'magie', damage: 1.3 }
  };
  var LEGACY_SEQUENCE = ['hieb', 'ritual', 'panzer', 'hieb', 'panzer', 'ritual'];
  var ACTIONS = {
    angriff: { id: 'angriff', icon: '⚔️', name: 'Angriff', focus: 1, damage: 1 },
    block: { id: 'block', icon: '🛡️', name: 'Block', focus: 1, damage: 0.35 },
    magie: { id: 'magie', icon: '✨', name: 'Magie', cost: 2, damage: 1.55 },
    finisher: { id: 'finisher', icon: '💥', name: 'Verschlingen', cost: 5, damage: 3.1 }
  };
  var MAX_FOCUS = 5, MAX_ROUNDS = 14, MAX_HEAT = 8;

  // Gegnerprofile (Phase 42): jede Mission besitzt eine sichtbare, deterministische
  // Grammatik. Unter 50 % LP wechselt sie in eine angekündigte Bossphase.
  var PROFILES = [
    { id: 'waechter', icon: '🛡️', name: 'Grenzwächter', desc: 'Wechselt zwischen Hieb, Deckung und vorbereitetem Konterschlag.',
      normal: ['hieb', 'panzer', 'konterschlag', 'panzer'], boss: ['konterschlag', 'panzer', 'ritual', 'konterschlag'],
      bossPhase: { icon: '🏰', name: 'Letztes Bollwerk', desc: 'Gegenschaden +10 %, erlittener Schaden −15 %.', attackMult: 1.1, damageTakenMult: 0.85 } },
    { id: 'bestie', icon: '🐺', name: 'Alpha-Bestie', desc: 'Jagt in Hiebfolgen und entfesselt danach eine klar lesbare Raserei.',
      normal: ['hieb', 'doppelhieb', 'panzer', 'raserei'], boss: ['raserei', 'doppelhieb', 'hieb', 'raserei'],
      bossPhase: { icon: '🔥', name: 'Blutraserei', desc: 'Gegenschaden +25 %, erleidet selbst +10 % Schaden.', attackMult: 1.25, damageTakenMult: 1.1 } },
    { id: 'hexer', icon: '🔮', name: 'Kettenhexer', desc: 'Verwebt Rituale zu Ketten; jeder Bruchpunkt wird vorab angezeigt.',
      normal: ['ritual', 'hieb', 'panzer', 'ritualkette'], boss: ['ritualkette', 'seelenbrand', 'ritual', 'ritualkette'],
      bossPhase: { icon: '🌑', name: 'Seelensturm', desc: 'Gegenschaden +20 %; Ritualketten treten häufiger auf.', attackMult: 1.2, damageTakenMult: 1 } }
  ];
  var LEGACY_PROFILE = { id: 'legacy', icon: '⚔️', name: 'Klassischer Stoßtrupp', desc: 'Fortgesetzter Einsatz aus einem älteren Spielstand.',
    normal: LEGACY_SEQUENCE, boss: LEGACY_SEQUENCE,
    bossPhase: { icon: '⚔️', name: 'Fortgesetzter Einsatz', desc: 'Keine zusätzliche Phasenwirkung.', attackMult: 1, damageTakenMult: 1 } };
  var PROFILE_BY = { legacy: LEGACY_PROFILE };
  PROFILES.forEach(function (profile) { PROFILE_BY[profile.id] = profile; });

  var MODIFIERS = [
    { id: 'sturmfront', icon: '🌩️', name: 'Sturmfront', desc: 'Gegnerangriff +12 %, Beute +15 %.', hpMult: 1, attackMult: 1.12, rewardMult: 1.15, maxRounds: 14 },
    { id: 'eiserne_reserve', icon: '⛰️', name: 'Eiserne Reserve', desc: 'Gegner-LP +18 %, Beute +18 %.', hpMult: 1.18, attackMult: 1, rewardMult: 1.18, maxRounds: 14 },
    { id: 'zeitbruch', icon: '⏳', name: 'Zeitbruch', desc: 'Nur 11 Runden, Beute +22 %.', hpMult: 1, attackMult: 1, rewardMult: 1.22, maxRounds: 11 }
  ];
  var LEGACY_MODIFIER = { id: 'legacy', icon: '•', name: 'Ohne Modifikator', desc: 'Fortgesetzter v11-Einsatz.', hpMult: 1, attackMult: 1, rewardMult: 1, maxRounds: 14 };
  var MODIFIER_BY = { legacy: LEGACY_MODIFIER };
  MODIFIERS.forEach(function (modifier) { MODIFIER_BY[modifier.id] = modifier; });

  var OBJECTIVES = [
    { id: 'ohne_finisher', icon: '🚫', name: 'Ungezähmt', desc: 'Gewinne ohne Verschlingen.', rewardRate: 0.35 },
    { id: 'perfekte_serie', icon: '🎯', name: 'Ungebrochene Lesung', desc: 'Erziele 3 perfekte Konter in Folge.', rewardRate: 0.35 },
    { id: 'blitzsieg', icon: '⚡', name: 'Blitzsieg', desc: 'Gewinne vor Runde 8.', rewardRate: 0.4 }
  ];
  var NO_OBJECTIVE = { id: 'none', icon: '•', name: 'Kein Optionalziel', desc: 'Fortgesetzter v11-Einsatz.', rewardRate: 0 };
  var OBJECTIVE_BY = { none: NO_OBJECTIVE };
  OBJECTIVES.forEach(function (objective) { OBJECTIVE_BY[objective.id] = objective; });

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
    sk.rotation = Math.max(0, Math.floor(finite(sk.rotation, 0)));
    sk.objectivesCompleted = Math.max(0, Math.floor(finite(sk.objectivesCompleted, 0)));
    if (!sk.lastResult || typeof sk.lastResult !== 'object') sk.lastResult = null;
    if (sk.active && (!mission(sk.active.missionId) || ['enemyHp', 'enemyMaxHp', 'enemyAttack', 'heroHp', 'heroMaxHp', 'heroAttack', 'round', 'focus'].some(function (key) { return !isFinite(Number(sk.active[key])); }))) sk.active = null;
    if (!STANCE_BY[sk.stance]) sk.stance = STANCES[0].id;
    if (sk.active) {
      var active = sk.active, m = mission(active.missionId), legacy = !active.profileId;
      if (!STANCE_BY[active.stanceId]) active.stanceId = sk.stance;
      active.profileId = PROFILE_BY[active.profileId] ? active.profileId : (legacy ? 'legacy' : m.profileId);
      active.modifierId = MODIFIER_BY[active.modifierId] ? active.modifierId : (legacy ? 'legacy' : MODIFIERS[0].id);
      active.objectiveId = OBJECTIVE_BY[active.objectiveId] ? active.objectiveId : (legacy ? 'none' : OBJECTIVES[0].id);
      active.phase = active.phase === 'boss' ? 'boss' : 'normal';
      active.intentStep = Math.max(0, Math.floor(finite(active.intentStep, Math.max(0, active.round - 1))));
      active.perfectStreak = Math.max(0, Math.floor(finite(active.perfectStreak, 0)));
      active.maxPerfectStreak = Math.max(active.perfectStreak, Math.floor(finite(active.maxPerfectStreak, active.perfectStreak)));
      active.finishersUsed = Math.max(0, Math.floor(finite(active.finishersUsed, 0)));
      active.objectiveComplete = !!active.objectiveComplete;
      if (!Array.isArray(active.log)) active.log = [];
      if (!INTENTS[active.intentId]) active.intentId = intentFor(active);
    }
    return sk;
  }

  function profileFor(active) { return PROFILE_BY[active && active.profileId] || LEGACY_PROFILE; }
  function modifierFor(active) { return MODIFIER_BY[active && active.modifierId] || LEGACY_MODIFIER; }
  function objectiveFor(active) { return OBJECTIVE_BY[active && active.objectiveId] || NO_OBJECTIVE; }
  function phaseFor(active) {
    var profile = profileFor(active);
    if (active && active.phase === 'boss') return profile.bossPhase;
    return { icon: profile.icon, name: 'Grundmuster', desc: profile.desc, attackMult: 1, damageTakenMult: 1 };
  }

  function intentFor(active) {
    var profile = profileFor(active), sequence = active.phase === 'boss' ? profile.boss : profile.normal;
    return sequence[(Math.abs(Math.floor(active.seed || 0)) + Math.max(0, active.intentStep || 0)) % sequence.length];
  }

  function skirmishPreview(state, missionId) {
    var sk = ensureState(state), m = mission(missionId);
    if (!m) return null;
    var missionIndex = Math.max(0, MISSIONS.indexOf(m));
    return {
      profile: PROFILE_BY[m.profileId],
      modifier: MODIFIERS[(sk.rotation + missionIndex) % MODIFIERS.length],
      objective: OBJECTIVES[(sk.rotation + missionIndex) % OBJECTIVES.length],
      rotation: sk.rotation
    };
  }

  function startSkirmish(state, missionId, stanceId) {
    var sk = ensureState(state), m = mission(missionId);
    if (sk.active) return { ok: false, reason: 'Ein Sturmeinsatz läuft bereits.' };
    if (!m) return { ok: false, reason: 'Unbekannter Einsatz.' };
    if (!missionUnlocked(state, m)) return { ok: false, reason: m.hint || 'Noch nicht freigeschaltet.' };
    var st = stanceById(STANCE_BY[stanceId] ? stanceId : sk.stance);
    var preview = skirmishPreview(state, m.id), profile = preview.profile, modifier = preview.modifier, objective = preview.objective;
    sk.stance = st.id;  // gewählte Haltung als Voreinstellung merken
    sk.rotation++;
    var heatScale = 1 + sk.heat * 0.12;
    var rulerPower = Math.max(1, SYS.rulerPower(state));
    var heroMax = Math.round((92 + (state.herrscher.level || 1) * 9 + (state.herrscher.stage || 0) * 18 + Math.sqrt(rulerPower) * 2) * st.hpMult);
    var heroAttack = Math.round((10 + (state.herrscher.level || 1) * 2.2 + (state.herrscher.stage || 0) * 4 + Math.sqrt(rulerPower) * 0.75) * st.atkMult);
    var played = (state.metrics && state.metrics.skirmishesPlayed) || 0;
    sk.active = {
      missionId: m.id,
      stanceId: st.id,
      profileId: profile.id,
      modifierId: modifier.id,
      objectiveId: objective.id,
      phase: 'normal',
      intentStep: 0,
      round: 1,
      maxRounds: modifier.maxRounds,
      heroHp: heroMax,
      heroMaxHp: heroMax,
      heroAttack: heroAttack,
      enemyHp: Math.round(m.baseHp * heatScale * modifier.hpMult),
      enemyMaxHp: Math.round(m.baseHp * heatScale * modifier.hpMult),
      enemyAttack: Math.round(m.baseAttack * (1 + sk.heat * 0.09) * modifier.attackMult),
      focus: Math.min(MAX_FOCUS, st.startFocus),
      combo: 0,
      bestCombo: 0,
      perfectStreak: 0,
      maxPerfectStreak: 0,
      finishersUsed: 0,
      objectiveComplete: false,
      seed: Math.abs(Math.floor(finite(state.tick, 0) + played * 2 + MISSIONS.indexOf(m))) % 997,
      intentId: null,
      log: ['Der Einsatz beginnt (' + st.name + ') gegen ' + profile.name + '. ' + modifier.name + ' ist aktiv.']
    };
    sk.active.enemyHp = Math.max(1, sk.active.enemyHp);
    sk.active.enemyMaxHp = sk.active.enemyHp;
    sk.active.intentId = intentFor(sk.active);
    // Ein Lauf startet nie mit einem aktuell unbezahlbaren Magie-Kontern. Die
    // deterministische Grammatik wird nur bis zum nächsten lesbaren Einstieg gedreht.
    if (INTENTS[sk.active.intentId].counter === 'magie' && sk.active.focus < ACTIONS.magie.cost) {
      sk.active.intentStep++;
      sk.active.intentId = intentFor(sk.active);
    }
    sk.lastResult = null;
    I.log(state, '⚡ Sturmeinsatz gestartet: ' + m.name + ' · ' + profile.name + ' · ' + st.name + '.', 'gold');
    return { ok: true, active: sk.active, mission: m, stance: st, profile: profile, modifier: modifier, objective: objective };
  }

  function actionAvailable(state, actionId) {
    var sk = ensureState(state), active = sk.active, action = ACTIONS[actionId];
    if (!active || !action) return false;
    return !action.cost || active.focus >= action.cost;
  }

  function objectiveSatisfied(active, won) {
    var objective = objectiveFor(active);
    if (objective.id === 'none') return false;
    if (objective.id === 'ohne_finisher') return !!won && active.finishersUsed === 0;
    if (objective.id === 'perfekte_serie') return !!won && active.maxPerfectStreak >= 3;
    if (objective.id === 'blitzsieg') return !!won && active.round < 8;
    return false;
  }

  function objectiveProgress(active) {
    var objective = objectiveFor(active);
    if (objective.id === 'ohne_finisher') return active.finishersUsed ? 'Verfehlt: Verschlingen eingesetzt' : 'Offen: noch kein Verschlingen';
    if (objective.id === 'perfekte_serie') return Math.min(3, active.maxPerfectStreak) + ' / 3 perfekte Konter';
    if (objective.id === 'blitzsieg') return 'Runde ' + active.round + ' / 7';
    return objective.desc;
  }

  function enterBossPhase(active) {
    if (!active || active.profileId === 'legacy' || active.phase === 'boss' || active.enemyHp <= 0 || active.enemyHp / active.enemyMaxHp > 0.5) return false;
    active.phase = 'boss';
    active.intentStep = 0;
    var boss = profileFor(active).bossPhase;
    active.log.unshift('⚠️ BOSSPHASE: ' + boss.name + ' — ' + boss.desc);
    return true;
  }

  function scaledReward(source, multiplier) {
    var out = {};
    for (var id in (source || {})) out[id] = Math.max(1, Math.round(source[id] * multiplier));
    return out;
  }

  function finish(state, won) {
    var sk = ensureState(state), active = sk.active, m = mission(active.missionId);
    var modifier = modifierFor(active), objective = objectiveFor(active), objectiveMet = objectiveSatisfied(active, won);
    state.metrics.skirmishesPlayed = (state.metrics.skirmishesPlayed || 0) + 1;
    var result = {
      won: !!won,
      missionId: m.id,
      profileId: active.profileId,
      modifierId: modifier.id,
      objectiveId: objective.id,
      objectiveMet: objectiveMet,
      rounds: active.round,
      combo: active.bestCombo,
      reward: null,
      objectiveReward: null,
      xp: 0,
      objectiveXp: 0,
      heatBefore: sk.heat
    };
    if (won) {
      state.metrics.skirmishesWon = (state.metrics.skirmishesWon || 0) + 1;
      state.metrics.skirmishBestCombo = Math.max(state.metrics.skirmishBestCombo || 0, active.bestCombo);
      sk.bestCombo = Math.max(sk.bestCombo, active.bestCombo);
      sk.streak++;
      var mult = (1 + sk.heat * 0.14 + Math.min(10, active.bestCombo) * 0.04 + Math.min(5, sk.streak - 1) * 0.03) * modifier.rewardMult;
      result.reward = scaledReward(m.reward, mult);
      result.xp = Math.round(m.xp * mult);
      I.addResources(state, result.reward);
      I.addRulerXp(state, result.xp);
      if (objectiveMet) {
        result.objectiveReward = scaledReward(m.reward, objective.rewardRate * modifier.rewardMult);
        result.objectiveXp = Math.max(1, Math.round(m.xp * objective.rewardRate));
        I.addResources(state, result.objectiveReward);
        I.addRulerXp(state, result.objectiveXp);
        sk.objectivesCompleted++;
        state.metrics.skirmishObjectives = (state.metrics.skirmishObjectives || 0) + 1;
      }
      sk.heat = Math.min(MAX_HEAT, sk.heat + 1);
      I.log(state, '🏆 Sturmeinsatz gewonnen: ' + m.name + ' (Kombo ' + active.bestCombo + ')' + (objectiveMet ? ' · Optionalziel erfüllt.' : '') + '.', 'gold');
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
    var st = stanceById(active.stanceId), phase = phaseFor(active);
    var correct = intent.counter === actionId;
    if (action.cost) active.focus -= action.cost;
    if (action.focus) active.focus = Math.min(MAX_FOCUS, active.focus + action.focus);
    if (actionId === 'finisher') active.finishersUsed++;
    if (correct) {
      active.combo++;
      active.perfectStreak++;
      active.focus = Math.min(MAX_FOCUS, active.focus + 1);
    } else {
      active.perfectStreak = 0;
      if (actionId !== 'finisher') active.combo = 0;
    }
    active.bestCombo = Math.max(active.bestCombo, active.combo);
    active.maxPerfectStreak = Math.max(active.maxPerfectStreak, active.perfectStreak);
    active.objectiveComplete = active.objectiveComplete || (objectiveFor(active).id === 'perfekte_serie' && active.maxPerfectStreak >= 3);

    var comboMult = 1 + Math.min(10, active.combo) * 0.09;
    var stanceDmg = actionId === 'magie' ? st.magieMult : 1;
    var hit = Math.max(1, Math.round(active.heroAttack * action.damage * comboMult * stanceDmg * (correct ? 1.45 : 1) * phase.damageTakenMult));
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

    var phaseChanged = enterBossPhase(active);

    var retaliation = 0;
    if (!correct) {
      retaliation = Math.max(1, Math.round(active.enemyAttack * intent.damage * (actionId === 'block' ? 0.45 : 1) * st.retaliationMult * phase.attackMult));
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
    if (!phaseChanged) active.intentStep++;
    active.intentId = intentFor(active);
    return { ok: true, finished: false, correct: correct, damage: hit, retaliation: retaliation, phaseChanged: phaseChanged, active: active, line: line };
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
      rotation: sk.rotation,
      objectivesCompleted: sk.objectivesCompleted,
      active: active,
      mission: active ? mission(active.missionId) : null,
      intent: active ? INTENTS[active.intentId] : null,
      profile: active ? profileFor(active) : null,
      modifier: active ? modifierFor(active) : null,
      objective: active ? objectiveFor(active) : null,
      objectiveProgress: active ? objectiveProgress(active) : null,
      phase: active ? phaseFor(active) : null,
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
    SKIRMISH_PROFILES: PROFILES,
    SKIRMISH_MODIFIERS: MODIFIERS,
    SKIRMISH_OBJECTIVES: OBJECTIVES,
    SKIRMISH_MAX_FOCUS: MAX_FOCUS,
    SKIRMISH_MAX_HEAT: MAX_HEAT,
    skirmishMission: mission,
    skirmishStance: stanceById,
    setSkirmishStance: setSkirmishStance,
    missionUnlocked: missionUnlocked,
    availableSkirmishMissions: availableMissions,
    skirmishPreview: skirmishPreview,
    skirmishStatus: skirmishStatus,
    startSkirmish: startSkirmish,
    skirmishActionAvailable: actionAvailable,
    skirmishAction: skirmishAction,
    retreatSkirmish: retreatSkirmish
  });
})();
