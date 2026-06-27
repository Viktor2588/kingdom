/* ============================================================
   systems-contracts.js — Dynamische Aufträge, Reichskrisen und
   Pacing-Regeln (Phase 49). DOM-frei; erweitert GameSystems.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var SYS = root.GameSystems, I = root.GameSystemsInternal;
  if (!SYS || !I) throw new Error('systems-contracts.js muss nach den Systemmodulen geladen werden');
  var GD = I.GD, round = I.round;

  var BOARD_SIZE = 3;
  var REFRESH_TICKS = 240;
  var STALL_TICKS = 180;
  var CRISIS_MIN = 240;
  var AUTO_PURSUE_EVERY = 4;
  var PROFILES = [
    { id: 'safe', icon: '🛡️', name: 'Sicher', desc: 'Vermeidet Kosten, Bedrohung und riskante Kämpfe.' },
    { id: 'aggressive', icon: '⚔️', name: 'Aggressiv', desc: 'Bevorzugt Kampf, Tempo und höhere Risiken.' },
    { id: 'collector', icon: '🔎', name: 'Sammler', desc: 'Priorisiert Bestiarium, Orte und seltene Beute.' },
    { id: 'progress', icon: '📈', name: 'Fortschritt', desc: 'Wählt den direktesten Weg zu Ausbau und Kampagne.' }
  ];
  var PROFILE_BY = {};
  PROFILES.forEach(function (profile) { PROFILE_BY[profile.id] = profile; });

  function num(value) { value = Number(value); return isFinite(value) ? value : 0; }
  function metric(state, key) { return Math.max(0, num(state.metrics && state.metrics[key])); }
  function buildingTotal(state) {
    var total = 0;
    for (var id in (state.buildings || {})) total += Math.max(0, num(state.buildings[id]));
    return total;
  }
  function siteTotal(state) {
    return (state.claimedMapSites || []).length + (state.exploredMapSites || []).length;
  }
  function battleWins(state) {
    return metric(state, 'expeditionsWon') + metric(state, 'armyVictories') +
      metric(state, 'echoesCleared') + metric(state, 'tacticalWins') + metric(state, 'skirmishesWon');
  }
  function profile(state) {
    var id = state.contracts && state.contracts.autoProfile;
    return PROFILE_BY[id] || PROFILE_BY.progress;
  }
  function ensureState(state) {
    if (!state.contracts || typeof state.contracts !== 'object' || Array.isArray(state.contracts)) state.contracts = {};
    var c = state.contracts;
    if (!Array.isArray(c.board)) c.board = [];
    ['serial', 'nextRefreshTick', 'lastProgressTick', 'lastPacingTick', 'completed', 'failed', 'crisisSerial', 'nextCrisisTick'].forEach(function (key) {
      c[key] = Math.max(0, Math.floor(num(c[key])));
    });
    if (!PROFILE_BY[c.autoProfile]) c.autoProfile = 'progress';
    if (typeof c.progressSignature !== 'string') c.progressSignature = '';
    if (c.lastCrisisId != null && typeof c.lastCrisisId !== 'string') c.lastCrisisId = null;
    c.board = c.board.filter(function (contract) {
      return contract && typeof contract === 'object' && CONTRACT_BY[contract.kind] &&
        typeof contract.id === 'string' && isFinite(num(contract.startedTick)) && isFinite(num(contract.expiresTick));
    }).slice(0, BOARD_SIZE);
    c.board.forEach(function (contract) {
      contract.startedTick = Math.max(0, Math.floor(num(contract.startedTick)));
      contract.expiresTick = Math.max(contract.startedTick + 1, Math.floor(num(contract.expiresTick)));
      contract.baseline = Math.max(0, num(contract.baseline));
      contract.target = Math.max(1, Math.floor(num(contract.target) || 1));
      if (!contract.reward || typeof contract.reward !== 'object' || Array.isArray(contract.reward)) contract.reward = {};
      contract.notified = !!contract.notified;
      contract.pacing = !!contract.pacing;
    });
    if (c.crisis && (!CRISIS_BY[c.crisis.id] || !isFinite(num(c.crisis.stage)))) c.crisis = null;
    if (c.crisis) {
      c.crisis.stage = Math.max(0, Math.floor(num(c.crisis.stage)));
      if (!Array.isArray(c.crisis.history)) c.crisis.history = [];
      if (!CRISIS_BY[c.crisis.id].stages[c.crisis.stage]) c.crisis = null;
    }
    return c;
  }

  function anyBuildingAvailable(state) {
    return GD().buildings.some(function (building) {
      return SYS.buildingUnlocked(state, building.id) && SYS.canBuild(state, building.id);
    });
  }
  function anyUnsecuredSite(state) {
    return GD().strategicNodes.some(function (node) {
      return node.siteId && SYS.strategicNodeUnlocked(state, node.id) && !SYS.strategicNodeSecured(state, node.id);
    });
  }
  function anyEpicPath(state) {
    if ((state.buildings.schmiede || 0) < 2) return false;
    return (state.inventory || []).some(function (item) {
      return SYS.itemQuality(item) < 2 && SYS.canTemperItem(state, item.uid).ok;
    });
  }
  function incompleteBestiary(state) {
    return !!SYS.bestiaryLines && SYS.bestiaryLines().some(function (line) { return !SYS.bestiaryLineComplete(state, line); });
  }
  function readyCRankEvolution(state) {
    return (state.creatures || []).some(function (creature) {
      return SYS.evolveOptions(state, creature).some(function (option) {
        var target = GD().creature(option.to);
        return option.ok && target && GD().rankIndex(target.rank) >= GD().rankIndex('C');
      });
    });
  }
  function readyRiskyWin(state) {
    if (!SYS.featureUnlocked(state, 'tab_karte')) return false;
    var uids = SYS.armyAvailable(state).map(function (creature) { return creature.uid; });
    var power = SYS.expeditionPower(state, uids, true);
    return SYS.visibleRegions(state).some(function (region) {
      return SYS.regionUnlocked(state, region.id) && power >= region.power;
    });
  }
  function contractValue(state, kind) {
    if (kind === 'upgrade') return buildingTotal(state);
    if (kind === 'summon') return metric(state, 'summoned');
    if (kind === 'skirmish') return metric(state, 'skirmishesWon');
    if (kind === 'battle') return battleWins(state);
    if (kind === 'risky') return metric(state, 'riskyWins');
    if (kind === 'site') return siteTotal(state);
    if (kind === 'evolve_c') return metric(state, 'rankCEvolutions');
    if (kind === 'forge_epic') return metric(state, 'epicForged');
    if (kind === 'active_siege') return metric(state, 'activeSiegesWon');
    if (kind === 'research') return (state.research || []).length;
    if (kind === 'bestiary') return metric(state, 'bestiaryHunts');
    if (kind === 'stability') return Math.max(0, num(state.tick));
    return 0;
  }
  function scaledReward(state, base, bonus) {
    var scale = 1 + Math.max(0, state.herrscher.stage || 0) * 0.35 + (state.claimedRegions || []).length * 0.06;
    if (bonus) scale *= bonus;
    var reward = {};
    for (var resource in base) reward[resource] = Math.max(1, round(base[resource] * scale));
    return reward;
  }
  function targetFor(state, definition, pacing) {
    if (pacing) return 1;
    return typeof definition.target === 'function' ? definition.target(state) : (definition.target || 1);
  }

  var CONTRACTS = [
    { kind: 'upgrade', icon: '🏗️', title: 'Bauimpuls', desc: 'Baue oder verbessere ein Reichsgebäude.', duration: 240, reward: { gold: 150, material: 90 },
      eligible: anyBuildingAvailable },
    { kind: 'summon', icon: '✨', title: 'Neue Gefolgschaft', desc: 'Beschwöre neue Basistruppen.', duration: 220, reward: { magie: 140, nahrung: 100 },
      target: function (state) { return state.herrscher.stage >= 2 ? 2 : 1; },
      eligible: function (state) {
        return SYS.summonableSpecies(state).some(function (species) { return SYS.canSummon(state, species.id).ok; });
      } },
    { kind: 'skirmish', icon: '⚡', title: 'Grenzalarm', desc: 'Gewinne einen Sturmeinsatz.', duration: 210, reward: { gold: 130, seelen: 20 },
      eligible: function () { return !!SYS.startSkirmish; } },
    { kind: 'battle', icon: '🗡️', title: 'Feldsieg', desc: 'Gewinne einen Kampf, Feldzug oder ein Echo.', duration: 300, reward: { gold: 200, material: 120, seelen: 25 },
      eligible: function (state) { return SYS.featureUnlocked(state, 'tab_karte'); } },
    { kind: 'risky', icon: '🔥', title: 'Wagnis', desc: 'Gewinne einen Kampf mit Risikostufe „Riskant".', duration: 360, reward: { seelen: 80, material: 180 },
      eligible: readyRiskyWin },
    { kind: 'site', icon: '🧭', title: 'Außenposten', desc: 'Sichere eine Anlage oder erkunde einen Fundort.', duration: 360, reward: { gold: 240, wissen: 90 },
      eligible: anyUnsecuredSite },
    { kind: 'evolve_c', icon: '🧬', title: 'C-Rang-Wandlung', desc: 'Entwickle eine Kreatur mindestens auf Rang C.', duration: 420, reward: { seelen: 120, magie: 240 },
      eligible: readyCRankEvolution },
    { kind: 'forge_epic', icon: '⚒️', title: 'Epische Schmiedekunst', desc: 'Verbessere ein Ausrüstungsteil auf mindestens Episch.', duration: 480, reward: { material: 300, wissen: 180 },
      eligible: anyEpicPath },
    { kind: 'active_siege', icon: '🏰', title: 'Die Mauern halten', desc: 'Gewinne eine aktive Belagerungsabwehr.', duration: 180, reward: { gold: 320, seelen: 100 },
      eligible: function (state) { return !!state.raid && !!SYS.startSiege; } },
    { kind: 'research', icon: '📚', title: 'Neue Erkenntnis', desc: 'Schließe eine Forschung ab.', duration: 360, reward: { wissen: 220, magie: 160 },
      eligible: function (state) {
        return (state.buildings.forschungsgilde || 0) > 0 &&
          GD().research.some(function (node) { return SYS.canResearch(state, node.id).ok; });
      } },
    { kind: 'bestiary', icon: '🔎', title: 'Gezielte Monsterjagd', desc: 'Schließe einen Bestiarium-Jagdschritt ab.', duration: 360, reward: { wissen: 180, seelen: 55 },
      eligible: incompleteBestiary },
    { kind: 'stability', icon: '🕯️', title: 'Ruhige Wachschicht', desc: 'Halte das Reich 90 Sekunden lang stabil.', duration: 180, target: 90, reward: { gold: 120, nahrung: 100 },
      eligible: function () { return true; } }
  ];
  var CONTRACT_BY = {};
  CONTRACTS.forEach(function (definition) { CONTRACT_BY[definition.kind] = definition; });

  function createContract(state, kind, pacing) {
    var c = ensureState(state), definition = CONTRACT_BY[kind];
    if (!definition || !definition.eligible(state)) return null;
    c.serial++;
    var target = targetFor(state, definition, pacing);
    return {
      id: 'auftrag_' + c.serial,
      kind: kind,
      icon: definition.icon,
      title: pacing ? 'Pacing: ' + definition.title : definition.title,
      desc: definition.desc,
      startedTick: state.tick,
      expiresTick: state.tick + (pacing ? Math.min(180, definition.duration) : definition.duration),
      baseline: contractValue(state, kind),
      target: target,
      reward: scaledReward(state, definition.reward, pacing ? 1.25 : 1),
      pacing: !!pacing,
      notified: false
    };
  }
  function fillBoard(state) {
    var c = ensureState(state), used = {};
    c.board.forEach(function (contract) { used[contract.kind] = true; });
    var candidates = CONTRACTS.filter(function (definition) { return !used[definition.kind] && definition.eligible(state); });
    if (!candidates.length) return [];
    var added = [], offset = c.serial % candidates.length, guard = 0;
    while (c.board.length < BOARD_SIZE && guard++ < candidates.length) {
      var definition = candidates[(offset + guard - 1) % candidates.length];
      if (used[definition.kind]) continue;
      var contract = createContract(state, definition.kind, false);
      if (contract) { c.board.push(contract); added.push(contract); used[definition.kind] = true; }
    }
    c.nextRefreshTick = state.tick + REFRESH_TICKS;
    return added;
  }
  function ensureBoard(state) {
    var c = ensureState(state);
    if (c.board.length < BOARD_SIZE) fillBoard(state);
    return c.board;
  }
  function contractProgress(state, contract) {
    var current = contractValue(state, contract.kind), value = Math.max(0, current - contract.baseline);
    return {
      value: Math.min(contract.target, value),
      target: contract.target,
      ratio: Math.min(1, value / contract.target),
      complete: value >= contract.target,
      remaining: Math.max(0, contract.expiresTick - state.tick)
    };
  }
  function claimContract(state, contractId) {
    var c = ensureState(state), index = -1;
    c.board.forEach(function (contract, i) { if (contract.id === contractId) index = i; });
    if (index < 0) return { ok: false, reason: 'Auftrag nicht gefunden' };
    var contract = c.board[index], progress = contractProgress(state, contract);
    if (!progress.complete) return { ok: false, reason: 'Auftrag noch nicht erfüllt' };
    SYS.addResources(state, contract.reward);
    c.board.splice(index, 1);
    c.completed++;
    state.metrics.contractsCompleted = (state.metrics.contractsCompleted || 0) + 1;
    I.log(state, contract.icon + ' Auftrag erfüllt: ' + contract.title + '.', 'gold');
    fillBoard(state);
    return { ok: true, contract: contract, reward: contract.reward };
  }
  function progressSignature(state) {
    return [
      buildingTotal(state), (state.claimedRegions || []).length, siteTotal(state), (state.research || []).length,
      state.herrscher.stage || 0, (state.seenSpecies || []).length, metric(state, 'evolutions'),
      metric(state, 'crafted'), metric(state, 'tempered'), metric(state, 'expeditionsWon'),
      metric(state, 'armyVictories'), metric(state, 'echoesCleared'), metric(state, 'skirmishesWon'),
      metric(state, 'raidsRepelled'), metric(state, 'bestiaryHunts')
    ].join('|');
  }
  function injectPacingContract(state) {
    var c = ensureState(state);
    if (state.tick - c.lastPacingTick < STALL_TICKS) return null;
    var easy = ['upgrade', 'summon', 'skirmish', 'battle', 'bestiary', 'stability'];
    var existing = {};
    c.board.forEach(function (contract) { existing[contract.kind] = true; });
    var kind = easy.filter(function (id) { return !existing[id] && CONTRACT_BY[id].eligible(state); })[0] ||
      easy.filter(function (id) { return CONTRACT_BY[id].eligible(state); })[0];
    if (!kind) return null;
    var replacement = c.board.filter(function (contract) { return contract.kind === kind; })[0] || c.board.slice().sort(function (a, b) {
      return contractProgress(state, a).ratio - contractProgress(state, b).ratio || a.startedTick - b.startedTick;
    })[0];
    if (replacement) c.board = c.board.filter(function (contract) { return contract.id !== replacement.id; });
    var contract = createContract(state, kind, true);
    if (contract) {
      c.board.push(contract);
      c.lastPacingTick = state.tick;
      I.log(state, '📌 Neuer Impuls-Auftrag: ' + contract.title + '.', 'gold');
    }
    return contract;
  }

  var CRISES = [
    { id: 'nahrung', icon: '🌾', title: 'Nahrungsknappheit', eligible: function () { return true; }, stages: [
      { title: 'Leere Speicher', desc: 'Eine schlechte Ernte leert die Vorräte. Wie reagiert Tempest?', choices: [
        { id: 'rationieren', label: 'Rationen ausgeben', desc: '−120 Gold, +180 Nahrung, kurz weniger Produktion.', effect: { cost: { gold: 120 }, res: { nahrung: 180 }, buff: { effect: { produktionAll: -0.08 }, dauer: 70, label: 'Rationierung' } }, scores: { safe: 4, progress: 2 } },
        { id: 'jagd', label: 'Große Jagd', desc: '+260 Nahrung, aber +25 Bedrohung.', effect: { res: { nahrung: 260 }, threat: 25 }, scores: { aggressive: 5, collector: 2, progress: 3 } }
      ] },
      { title: 'Verteilung', desc: 'Die erste Not ist gebrochen. Wer erhält die verbleibenden Vorräte?', choices: [
        { id: 'arbeiter', label: 'Arbeiter versorgen', desc: '+15 % Produktion für 100 s.', effect: { buff: { effect: { produktionAll: 0.15 }, dauer: 100, label: 'Versorgte Arbeiter' } }, scores: { progress: 5, safe: 2 } },
        { id: 'armee', label: 'Armee versorgen', desc: '+20 % Armeekraft für 100 s.', effect: { buff: { effect: { armee: 0.20 }, dauer: 100, label: 'Versorgte Armee' } }, scores: { aggressive: 5, collector: 2 } }
      ] }
    ] },
    { id: 'seuche', icon: '🜏', title: 'Magische Seuche', eligible: function (state) { return metric(state, 'named') > 0; }, stages: [
      { title: 'Flackernde Magicules', desc: 'Eine arkane Seuche springt zwischen den Bezirken über.', choices: [
        { id: 'quarantaene', label: 'Quarantäne', desc: 'Sicher, aber −12 % Produktion für 90 s.', effect: { buff: { effect: { produktionAll: -0.12, verteidigung: 0.12 }, dauer: 90, label: 'Quarantäne' } }, scores: { safe: 5 } },
        { id: 'analyse', label: 'Heilritual erforschen', desc: '−160 Wissen/−180 Magie, dafür Heiltempo.', effect: { cost: { wissen: 160, magie: 180 }, buff: { effect: { heiltempo: 0.25, wissen: 0.15 }, dauer: 120, label: 'Seuchenanalyse' } }, scores: { progress: 5, collector: 3 } }
      ] },
      { title: 'Ursprung', desc: 'Die Krankheit führt zu einem instabilen Magicule-Kern.', choices: [
        { id: 'versiegeln', label: 'Kern versiegeln', desc: '+180 Wissen, Bedrohung sinkt.', effect: { res: { wissen: 180 }, threat: -15 }, scores: { safe: 5, progress: 3 } },
        { id: 'verschlingen', label: 'Kern verschlingen', desc: '+260 Magie/+45 Seelen, aber +20 Bedrohung.', effect: { res: { magie: 260, seelen: 45 }, threat: 20 }, scores: { aggressive: 5, collector: 4 } }
      ] }
    ] },
    { id: 'ultimatum', icon: '📜', title: 'Rivalen-Ultimatum', eligible: function (state) { return (state.claimedRegions || []).length >= 2; }, stages: [
      { title: 'Tributforderung', desc: 'Ein rivalisierender Lord fordert Gold und Material.', choices: [
        { id: 'zahlen', label: 'Zeit erkaufen', desc: '−260 Gold/−140 Material, −25 Bedrohung.', effect: { cost: { gold: 260, material: 140 }, threat: -25 }, scores: { safe: 5 } },
        { id: 'ablehnen', label: 'Forderung ablehnen', desc: '+35 Bedrohung, +25 % Armee für 90 s.', effect: { threat: 35, buff: { effect: { armee: 0.25 }, dauer: 90, label: 'Trotzige Mobilmachung' } }, scores: { aggressive: 5, progress: 2 } }
      ] },
      { title: 'Antwort des Hofes', desc: 'Späher entdecken den Boten auf dem Rückweg.', choices: [
        { id: 'verfolgen', label: 'Boten verfolgen', desc: '+100 Wissen/+60 Seelen, +10 Bedrohung.', effect: { res: { wissen: 100, seelen: 60 }, threat: 10 }, scores: { collector: 5, aggressive: 3 } },
        { id: 'diplomatie', label: 'Gegenvorschlag senden', desc: '+220 Gold, Bedrohung sinkt leicht.', effect: { res: { gold: 220 }, threat: -10 }, scores: { safe: 4, progress: 4 } }
      ] }
    ] },
    { id: 'fluechtlinge', icon: '🏕️', title: 'Flüchtlingsstrom', eligible: function (state) { return (state.claimedRegions || []).length >= 1; }, stages: [
      { title: 'Vor den Toren', desc: 'Monsterfamilien bitten Tempest um Schutz.', choices: [
        { id: 'lager', label: 'Notlager errichten', desc: '−180 Gold/−120 Nahrung, +6 Kapazität für 150 s.', effect: { cost: { gold: 180, nahrung: 120 }, buff: { effect: { kapazitaet: 6 }, dauer: 150, label: 'Notlager' } }, scores: { safe: 4, collector: 4 } },
        { id: 'aufnahme', label: 'Sofort aufnehmen', desc: '+1 Goblin, +1 Schleim, −100 Nahrung.', special: 'refugees', effect: { cost: { nahrung: 100 } }, scores: { progress: 4, aggressive: 2 } },
        { id: 'abweisen', label: 'Weiterziehen lassen', desc: 'Keine Kosten, aber +20 Bedrohung.', effect: { threat: 20 }, scores: { safe: 1, aggressive: 1 } }
      ] },
      { title: 'Eingliederung', desc: 'Die Neuankömmlinge suchen ihren Platz im Reich.', choices: [
        { id: 'handwerk', label: 'Handwerk fördern', desc: '+180 Material/+120 Wissen.', effect: { res: { material: 180, wissen: 120 } }, scores: { progress: 5, safe: 2 } },
        { id: 'spaeher', label: 'Späher ausbilden', desc: '+1 Bestiarium-Fährte und +15 % Armee.', special: 'track', effect: { buff: { effect: { armee: 0.15 }, dauer: 100, label: 'Neue Späher' } }, scores: { collector: 5, aggressive: 3 } }
      ] }
    ] },
    { id: 'gildenstreit', icon: '⚒️', title: 'Gildenstreit', eligible: function (state) { return (state.buildings.schmiede || 0) > 0 || (state.buildings.forschungsgilde || 0) > 0; }, stages: [
      { title: 'Schmiede gegen Gelehrte', desc: 'Beide Gilden beanspruchen die nächsten Reichsmittel.', choices: [
        { id: 'schmiede', label: 'Schmiede fördern', desc: '+220 Material, −80 Wissen.', effect: { cost: { wissen: 80 }, res: { material: 220 } }, scores: { aggressive: 3, collector: 4 } },
        { id: 'gelehrte', label: 'Gelehrte fördern', desc: '+220 Wissen, −100 Material.', effect: { cost: { material: 100 }, res: { wissen: 220 } }, scores: { progress: 5, safe: 2 } },
        { id: 'aufschub', label: 'Entscheidung vertagen', desc: 'Keine Kosten, aber −8 % Produktion für 80 s.', effect: { buff: { effect: { produktionAll: -0.08 }, dauer: 80, label: 'Gildenaufschub' } }, scores: { safe: 4 } }
      ] },
      { title: 'Gemeinsames Projekt', desc: 'Ein Ausgleich ist möglich, verlangt aber eine klare Leitung.', choices: [
        { id: 'runen', label: 'Runenwerkstatt', desc: '+15 % Wissen und +1 Material/s für 120 s.', effect: { buff: { effect: { wissen: 0.15, produce: { material: 1 } }, dauer: 120, label: 'Runenwerkstatt' } }, scores: { collector: 5, progress: 3 } },
        { id: 'produktion', label: 'Serienfertigung', desc: '+12 % Gesamtproduktion für 120 s.', effect: { buff: { effect: { produktionAll: 0.12 }, dauer: 120, label: 'Serienfertigung' } }, scores: { progress: 5, safe: 3 } }
      ] }
    ] }
  ];
  var CRISIS_BY = {};
  CRISES.forEach(function (crisis) { CRISIS_BY[crisis.id] = crisis; });

  function hasActiveCrisis(state) { return !!(state.contracts && state.contracts.crisis); }
  function crisisStatus(state) {
    var c = ensureState(state), active = c.crisis;
    if (!active) return null;
    var crisis = CRISIS_BY[active.id], stage = crisis && crisis.stages[active.stage];
    return crisis && stage ? { active: active, crisis: crisis, stage: stage } : null;
  }
  function scheduleNextCrisis(state) {
    var c = ensureState(state);
    c.nextCrisisTick = state.tick + CRISIS_MIN + (c.crisisSerial % 5) * 45;
    return c.nextCrisisTick;
  }
  function startCrisis(state, forcedId) {
    var c = ensureState(state);
    if (c.crisis || state.activeEvent) return null;
    var eligible = CRISES.filter(function (crisis) { return crisis.eligible(state) && (!c.lastCrisisId || crisis.id !== c.lastCrisisId); });
    if (!eligible.length) eligible = CRISES.filter(function (crisis) { return crisis.eligible(state); });
    var crisis = forcedId ? CRISIS_BY[forcedId] : eligible[c.crisisSerial % Math.max(1, eligible.length)];
    if (!crisis || !crisis.eligible(state)) return null;
    c.crisisSerial++;
    c.crisis = { id: crisis.id, stage: 0, startedTick: state.tick, history: [] };
    I.log(state, crisis.icon + ' Reichskrise: ' + crisis.title + ' – eine Entscheidung wartet.', 'bad');
    return crisisStatus(state);
  }
  function resolveCrisis(state, choiceId) {
    var c = ensureState(state), status = crisisStatus(state);
    if (!status) return { ok: false, reason: 'Keine Reichskrise aktiv' };
    var choice = status.stage.choices.filter(function (candidate) { return candidate.id === choiceId; })[0];
    if (!choice) return { ok: false, reason: 'Ungültige Krisenentscheidung' };
    if (choice.effect && choice.effect.cost && !SYS.canAfford(state, choice.effect.cost)) {
      return { ok: false, reason: SYS.missingCost(state, choice.effect.cost).join(', ') };
    }
    SYS.applyEventEffect(state, choice.effect || {});
    if (choice.special === 'track' && SYS.awardBestiaryTracks) SYS.awardBestiaryTracks(state, 'wald', 1);
    if (choice.special === 'refugees') {
      if (SYS.usedCapacity(state) < SYS.capacity(state)) I.addTroopStack(state, SYS.RULER_ARMY_ID, 'goblin', 1);
      if (SYS.usedCapacity(state) < SYS.capacity(state)) I.addTroopStack(state, SYS.RULER_ARMY_ID, 'schleim', 1);
    }
    c.crisis.history.push({ stage: c.crisis.stage, choiceId: choice.id, tick: state.tick });
    I.log(state, status.crisis.icon + ' ' + status.crisis.title + ': ' + choice.label + '.', 'good');
    c.crisis.stage++;
    if (status.crisis.stages[c.crisis.stage]) return { ok: true, finished: false, status: crisisStatus(state), choice: choice };
    c.lastCrisisId = status.crisis.id;
    c.crisis = null;
    state.metrics.crisesResolved = (state.metrics.crisesResolved || 0) + 1;
    scheduleNextCrisis(state);
    return { ok: true, finished: true, crisis: status.crisis, choice: choice };
  }
  function chooseCrisisForAuto(state) {
    var status = crisisStatus(state);
    if (!status) return null;
    var profileId = profile(state).id, affordable = status.stage.choices.filter(function (choice) {
      return !choice.effect || !choice.effect.cost || SYS.canAfford(state, choice.effect.cost);
    });
    var choices = affordable.length ? affordable : status.stage.choices;
    return choices.slice().sort(function (a, b) {
      return num(b.scores && b.scores[profileId]) - num(a.scores && a.scores[profileId]);
    })[0];
  }
  function stepContracts(state) {
    var c = ensureState(state), result = { offered: [], expired: [], completed: [], crisisStarted: null, pacing: null };
    var signature = progressSignature(state);
    if (!c.progressSignature) { c.progressSignature = signature; c.lastProgressTick = state.tick; }
    else if (c.progressSignature !== signature) { c.progressSignature = signature; c.lastProgressTick = state.tick; }
    c.board = c.board.filter(function (contract) {
      var progress = contractProgress(state, contract);
      if (progress.complete) {
        if (!contract.notified) { contract.notified = true; result.completed.push(contract); }
        return true;
      }
      if (state.tick >= contract.expiresTick) {
        c.failed++;
        state.metrics.contractsFailed = (state.metrics.contractsFailed || 0) + 1;
        result.expired.push(contract);
        return false;
      }
      return true;
    });
    if (c.board.length < BOARD_SIZE || state.tick >= c.nextRefreshTick) result.offered = fillBoard(state);
    if (state.tick - c.lastProgressTick >= STALL_TICKS) result.pacing = injectPacingContract(state);
    if (!c.nextCrisisTick) scheduleNextCrisis(state);
    if (!c.crisis && !state.activeEvent && state.questProgress >= 3 && state.tick >= c.nextCrisisTick) result.crisisStarted = startCrisis(state);
    return result;
  }

  function setAutoProfile(state, id) {
    var c = ensureState(state);
    if (PROFILE_BY[id]) c.autoProfile = id;
    return c.autoProfile;
  }
  function autoContractAction(state, contract) {
    if (contract.kind === 'upgrade') {
      var buildings = GD().buildings.filter(function (building) { return SYS.canBuild(state, building.id); })
        .sort(function (a, b) {
          var ac = SYS.buildingCost(state, a.id), bc = SYS.buildingCost(state, b.id);
          return Object.keys(ac).reduce(function (sum, key) { return sum + ac[key]; }, 0) -
            Object.keys(bc).reduce(function (sum, key) { return sum + bc[key]; }, 0);
        });
      if (buildings.length && SYS.build(state, buildings[0].id).ok) return buildings[0].icon + ' Auftrag: ' + buildings[0].name + ' ausgebaut.';
    }
    if (contract.kind === 'summon') {
      var species = SYS.summonableSpecies(state).filter(function (sp) { return SYS.canSummon(state, sp.id).ok; })[0];
      if (species && SYS.summon(state, species.id).ok) return '✨ Auftrag: ' + species.name + ' beschworen.';
    }
    if (contract.kind === 'research') {
      var research = GD().research.filter(function (node) { return SYS.canResearch(state, node.id).ok; })[0];
      if (research && SYS.doResearch(state, research.id).ok) return '📚 Auftrag: ' + research.name + ' erforscht.';
    }
    if (contract.kind === 'evolve_c') {
      for (var ci = 0; ci < state.creatures.length; ci++) {
        var options = SYS.evolveOptions(state, state.creatures[ci]).filter(function (option) {
          var target = GD().creature(option.to);
          return option.ok && target && GD().rankIndex(target.rank) >= GD().rankIndex('C');
        });
        if (options.length && SYS.evolve(state, state.creatures[ci].uid, options[0].to).ok) return '🧬 Auftrag: C-Rang-Evolution ausgelöst.';
      }
    }
    if (contract.kind === 'forge_epic') {
      var item = (state.inventory || []).filter(function (candidate) {
        return SYS.itemQuality(candidate) < 2 && SYS.canTemperItem(state, candidate.uid).ok;
      }).sort(function (a, b) { return SYS.itemQuality(b) - SYS.itemQuality(a); })[0];
      if (item) {
        var tempered = SYS.temperItem(state, item.uid);
        if (tempered.ok) return '⚒️ Auftrag: ' + tempered.item.name + ' verbessert.';
      }
    }
    if (contract.kind === 'active_siege' && SYS.siegeStatus) {
      var siege = SYS.siegeStatus(state);
      if (siege.pending) { var started = SYS.startSiege(state); if (started.ok) return '🏰 Auftrag: aktive Belagerung begonnen.'; }
      if (siege.active) {
        var action = siege.active.shield > 0 ? 'bannschild' : (siege.active.wallHp < siege.active.wallMax * 0.45 ? 'verstaerken' : 'ausfall');
        var siegeStep = SYS.siegeAction(state, action);
        if (siegeStep.ok) return '🏰 Auftrag: ' + action + ' in der Belagerung.';
      }
    }
    if (contract.kind === 'skirmish' && SYS.skirmishStatus) {
      var skirmish = SYS.skirmishStatus(state);
      if (!skirmish.active) {
        var mission = SYS.availableSkirmishMissions(state)[0];
        if (mission && SYS.startSkirmish(state, mission.id, 'waechter').ok) return '⚡ Auftrag: Sturmeinsatz begonnen.';
      } else {
        var actionId = skirmish.intent ? skirmish.intent.counter : 'angriff';
        var acted = SYS.skirmishAction(state, actionId);
        if (acted.ok) return '⚡ Auftrag: Sturmeinsatz gekontert.';
      }
    }
    if ((contract.kind === 'battle' || contract.kind === 'risky') && state.expeditions.length === 0) {
      var uids = SYS.armyAvailable(state).map(function (creature) { return creature.uid; });
      var power = SYS.expeditionPower(state, uids, true), regions = SYS.visibleRegions(state).filter(function (region) {
        return SYS.regionUnlocked(state, region.id) && power >= region.power;
      });
      var target = regions[regions.length - 1];
      if (target) {
        var risk = contract.kind === 'risky' ? 'riskant' : 'normal';
        var expedition = SYS.startExpedition(state, target.id, uids, true, risk);
        if (expedition.ok) return '🚩 Auftrag: ' + target.name + ' (' + risk + ').';
      }
    }
    if (contract.kind === 'bestiary' && SYS.bestiaryLines) {
      var lines = SYS.bestiaryLines();
      for (var li = 0; li < lines.length; li++) {
        var line = lines[li], status = SYS.bestiaryLineStatus(state, line);
        if (status.complete) continue;
        if (SYS.canPrepareBestiaryLure(state, line).ok) {
          SYS.prepareBestiaryLure(state, line);
          return '🪤 Auftrag: Köder für ' + line + ' gebunden.';
        }
        var unseen = SYS.bestiaryLineSpecies(state, line).filter(function (species) {
          return (state.seenSpecies || []).indexOf(species.id) < 0 && SYS.canUseBestiaryLure(state, species.id).ok;
        })[0];
        if (unseen) {
          SYS.useBestiaryLure(state, unseen.id);
          return '🔎 Auftrag: Köderjagd auf ' + unseen.name + '.';
        }
      }
    }
    return null;
  }
  function autoStep(state) {
    ensureBoard(state);
    var choice = chooseCrisisForAuto(state);
    if (choice) {
      var crisis = crisisStatus(state), resolved = resolveCrisis(state, choice.id);
      if (resolved.ok) return { text: crisis.crisis.icon + ' Krise „' + crisis.crisis.title + '“: ' + choice.label + '.' };
    }
    var c = ensureState(state), completed = c.board.filter(function (contract) { return contractProgress(state, contract).complete; })[0];
    if (completed) {
      var claimed = claimContract(state, completed.id);
      if (claimed.ok) return { text: completed.icon + ' Auftrag „' + completed.title + '“ eingelöst.' };
    }
    if (state.completion && state.completion.enabled) return null;
    if (state.tick % AUTO_PURSUE_EVERY !== 0) return null;
    var ordered = c.board.slice().sort(function (a, b) {
      var weights = { active_siege: 0, risky: profile(state).id === 'aggressive' ? 1 : 5, bestiary: profile(state).id === 'collector' ? 1 : 4 };
      return (weights[a.kind] == null ? 3 : weights[a.kind]) - (weights[b.kind] == null ? 3 : weights[b.kind]) ||
        contractProgress(state, b).ratio - contractProgress(state, a).ratio;
    });
    for (var i = 0; i < ordered.length; i++) {
      var text = autoContractAction(state, ordered[i]);
      if (text) return { text: text };
    }
    return null;
  }

  var originalTick = SYS.tick;
  SYS.tick = function (state) {
    var result = originalTick(state);
    result.contracts = state.completion && state.completion.enabled
      ? { offered: [], expired: [], completed: [], crisisStarted: null, pacing: null }
      : stepContracts(state);
    return result;
  };
  var originalOffline = SYS.offlineProgress;
  SYS.offlineProgress = function (state, seconds) {
    var result = originalOffline(state, seconds);
    result.contracts = state.completion && state.completion.enabled
      ? { offered: [], expired: [], completed: [], crisisStarted: null, pacing: null }
      : stepContracts(state);
    return result;
  };
  var originalAuto = SYS.autoPlayStep;
  SYS.autoPlayStep = function (state) {
    if (state.completion && state.completion.enabled) return originalAuto(state);
    if (state.settings && state.settings.watchDetailed && hasActiveCrisis(state)) return null;
    var contractAction = autoStep(state);
    return contractAction || originalAuto(state);
  };

  var API = {
    BOARD_SIZE: BOARD_SIZE,
    REFRESH_TICKS: REFRESH_TICKS,
    STALL_TICKS: STALL_TICKS,
    AUTO_PURSUE_EVERY: AUTO_PURSUE_EVERY,
    PROFILES: PROFILES,
    CONTRACTS: CONTRACTS,
    CRISES: CRISES,
    ensureState: ensureState,
    ensureBoard: ensureBoard,
    createContract: createContract,
    contractProgress: contractProgress,
    claimContract: claimContract,
    fillBoard: fillBoard,
    injectPacingContract: injectPacingContract,
    step: stepContracts,
    setAutoProfile: setAutoProfile,
    profile: profile,
    hasActiveCrisis: hasActiveCrisis,
    crisisStatus: crisisStatus,
    scheduleNextCrisis: scheduleNextCrisis,
    startCrisis: startCrisis,
    resolveCrisis: resolveCrisis,
    chooseCrisisForAuto: chooseCrisisForAuto,
    autoStep: autoStep
  };
  root.GameContracts = API;
  Object.assign(SYS, {
    CONTRACT_PROFILES: PROFILES,
    CONTRACT_DEFINITIONS: CONTRACTS,
    CRISIS_DEFINITIONS: CRISES,
    ensureContractBoard: ensureBoard,
    contractProgress: contractProgress,
    claimContract: claimContract,
    setContractAutoProfile: setAutoProfile,
    contractAutoProfile: profile,
    activeCrisis: crisisStatus,
    startCrisis: startCrisis,
    resolveCrisis: resolveCrisis
  });
})();
