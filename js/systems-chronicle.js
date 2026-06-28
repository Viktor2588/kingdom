/* ============================================================
   systems-chronicle.js — Chronik-Abschluss, New Game+, Meta-
   Freischaltungen und Challenge-Runs (Phase 52). DOM-frei.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var SYS = root.GameSystems, GST = root.GameState;
  if (!SYS || !GST) throw new Error('systems-chronicle.js muss nach den Spielsystemen geladen werden');

  function GD() { return root.GameData; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function num(value) { value = Number(value); return isFinite(value) ? value : 0; }

  var VARIANTS = [
    { id: 'slime', icon: '🟦', name: 'Jura-Gründung', desc: 'Schleim und Goblins wie im ersten Run.', unlockAt: 0, species: ['schleim', 'goblin', 'goblin'] },
    { id: 'undead', icon: '💀', name: 'Totenwacht', desc: 'Skelette und Zombies gründen das neue Tempest.', unlockAt: 1, species: ['skelett', 'skelett', 'zombie'] },
    { id: 'spirit', icon: '🧚', name: 'Geisterhain', desc: 'Feen beginnen mit arkaner Ausrichtung.', unlockAt: 2, species: ['fee', 'fee', 'fee'] },
    { id: 'kobold', icon: '🐕', name: 'Jägerbund', desc: 'Ein schneller Koboldbund übernimmt den Auftakt.', unlockAt: 3, species: ['kobold', 'kobold', 'kobold'] }
  ];
  var VARIANT_BY = {};
  VARIANTS.forEach(function (entry) { VARIANT_BY[entry.id] = entry; });

  var CHALLENGES = [
    { id: 'standard', icon: '📘', name: 'Freie Chronik', desc: 'Vollende Erfolge und Bestiarium erneut.', objective: '100 % Chronik' },
    { id: 'undead_only', icon: '💀', name: 'Nur Untote', desc: 'Beschwörung, Köder und Rekrutierung sind auf die Untotenlinie begrenzt.', objective: 'Alle Regionen erobern' },
    { id: 'no_trade', icon: '🚫', name: 'Kein Handel', desc: 'Kein Markt, Handelshafen, Basar, Handelsjob oder Handelsdoktrin.', objective: 'Alle Regionen erobern' },
    { id: 'aggressive_rivals', icon: '⚠️', name: 'Rivalen aggressiv', desc: 'Bedrohung steigt 2,5-mal so schnell; besiege alle Rivalen nach der Kampagne.', objective: 'Kampagne und alle Rivalen' },
    { id: 'bestiary_speedrun', icon: '📖', name: 'Bestiarium-Speedrun', desc: 'Der Completion-Planer fokussiert ausschließlich alle 78 Formen.', objective: 'Bestiarium vervollständigen' },
    { id: 'permadeath', icon: '☠️', name: 'Riskanter Permadeath', desc: 'Expeditionen, Feldzüge und Echos laufen immer riskant.', objective: 'Alle Regionen erobern' }
  ];
  var CHALLENGE_BY = {};
  CHALLENGES.forEach(function (entry) { CHALLENGE_BY[entry.id] = entry; });

  function ensure(state) {
    if (!state.chronicle || typeof state.chronicle !== 'object') state.chronicle = GST.createDefault().chronicle;
    if (!state.chronicle.meta || typeof state.chronicle.meta !== 'object') state.chronicle.meta = GST.createDefault().chronicle.meta;
    return state.chronicle;
  }
  function challenge(state) { return CHALLENGE_BY[ensure(state).challengeId] || CHALLENGE_BY.standard; }
  function isFullComplete(state) {
    var achievements = root.GameAchievements;
    return !!(achievements && achievements.unlockedCount(state) >= achievements.total() &&
      (state.seenSpecies || []).length >= GD().creatures.length);
  }
  function campaignComplete(state) { return (state.claimedRegions || []).length >= GD().regions.length; }
  function challengeComplete(state) {
    var id = challenge(state).id;
    if (id === 'standard') return isFullComplete(state);
    if (id === 'bestiary_speedrun') return (state.seenSpecies || []).length >= GD().creatures.length;
    if (id === 'aggressive_rivals') return campaignComplete(state) && (state.rivalsDefeated || []).length >= GD().rivals.length;
    return campaignComplete(state);
  }
  function observeCompletion(state) {
    var chronicle = ensure(state), tick = Math.max(0, Math.floor(state.tick || 0));
    if (chronicle.objectiveCompletionTick == null && challengeComplete(state)) chronicle.objectiveCompletionTick = tick;
    if (chronicle.fullCompletionTick == null && isFullComplete(state)) chronicle.fullCompletionTick = tick;
    return chronicle;
  }
  function objectiveProgress(state) {
    var id = challenge(state).id;
    if (id === 'standard') {
      var total = (root.GameAchievements ? root.GameAchievements.total() : 0) + GD().creatures.length;
      return { done: (root.GameAchievements ? root.GameAchievements.unlockedCount(state) : 0) + (state.seenSpecies || []).length, total: total };
    }
    if (id === 'bestiary_speedrun') return { done: (state.seenSpecies || []).length, total: GD().creatures.length };
    if (id === 'aggressive_rivals') {
      return { done: (state.claimedRegions || []).length + (state.rivalsDefeated || []).length, total: GD().regions.length + GD().rivals.length };
    }
    return { done: (state.claimedRegions || []).length, total: GD().regions.length };
  }
  function bossAttempts(state) {
    var total = 0;
    for (var id in (state.bosses && state.bosses.attempts || {})) total += Math.max(0, Math.floor(num(state.bosses.attempts[id])));
    return total;
  }
  function rarestSpecies(state) {
    var seen = (state.seenSpecies || []).map(function (id) { return GD().creature(id); }).filter(Boolean);
    seen.sort(function (a, b) {
      return GD().rankIndex(b.rank) - GD().rankIndex(a.rank) || (b.power || 0) - (a.power || 0) || a.id.localeCompare(b.id);
    });
    return seen.length ? { id: seen[0].id, name: seen[0].name, icon: seen[0].icon, rank: seen[0].rank } : null;
  }
  function summary(state) {
    var chronicle = observeCompletion(state), selected = challenge(state);
    var objectiveTick = chronicle.objectiveCompletionTick == null ? Math.max(0, Math.floor(state.tick || 0)) : chronicle.objectiveCompletionTick;
    var id = 'chronicle_' + chronicle.generation + '_' + chronicle.seed + '_' + Math.max(0, Math.floor(state.tick || 0));
    return {
      id: id,
      generation: chronicle.generation,
      seed: chronicle.seed,
      challengeId: selected.id,
      challengeName: selected.name,
      objective: selected.objective,
      ticks: objectiveTick,
      fullCompletionTick: chronicle.fullCompletionTick,
      startedAt: chronicle.startedAt,
      completedAt: Date.now(),
      durationMs: Math.max(0, Date.now() - chronicle.startedAt),
      achievements: root.GameAchievements ? root.GameAchievements.unlockedCount(state) : (state.achievements || []).length,
      bestiary: (state.seenSpecies || []).length,
      regions: (state.claimedRegions || []).length,
      deaths: Math.max(0, Math.floor(num(state.metrics && state.metrics.creaturesLost))),
      bossAttempts: bossAttempts(state),
      bosses: (state.bosses && state.bosses.defeated || []).length,
      masteries: (state.bosses && state.bosses.hardDefeated || []).length,
      rarestSpecies: rarestSpecies(state)
    };
  }
  function maxSimSpeed(seals) { return seals >= 3 ? 4 : (seals >= 1 ? 2 : 1); }
  function availableVariants(state) {
    var seals = (ensure(state).meta.seals || 0) + (challengeComplete(state) ? 1 : 0);
    return VARIANTS.filter(function (entry) { return entry.unlockAt <= seals; });
  }
  function nextMaxSimSpeed(state) {
    var chronicle = ensure(state);
    return maxSimSpeed((chronicle.meta.seals || 0) + (challengeComplete(state) ? 1 : 0));
  }
  function applyVariant(state, variantId) {
    var variant = VARIANT_BY[variantId] || VARIANT_BY.slime;
    state.uidCounter = 0; state.creatures = []; state.seenSpecies = [];
    state.armyGroups = [{
      id: GST.RULER_ARMY_ID, leaderUid: null, rulerLed: true, name: 'Armee des Herrschers',
      troops: {}, position: 'hauptstadt', movement: 3, wardCharges: 0, battlesWon: 0
    }];
    variant.species.forEach(function (speciesId) {
      var stack = state.creatures.filter(function (entry) { return !entry.named && entry.speciesId === speciesId; })[0];
      if (stack) stack.count++;
      else state.creatures.push(GST.newCreature(state, speciesId));
      state.armyGroups[0].troops[speciesId] = (state.armyGroups[0].troops[speciesId] || 0) + 1;
      if (state.seenSpecies.indexOf(speciesId) < 0) state.seenSpecies.push(speciesId);
    });
    state.log = [{ t: 0, text: variant.icon + ' ' + variant.name + ' eröffnet eine neue Chronik von Tempest.', kind: 'gold' }];
    return variant;
  }
  function nextSeed(state, requested) {
    var value = Math.floor(num(requested));
    if (value > 0) return Math.min(2147483646, value);
    value = ((ensure(state).seed * 1664525 + 1013904223) >>> 0) % 2147483646;
    return Math.max(1, value);
  }
  function startNewRun(state, options) {
    options = options || {};
    if (!challengeComplete(state)) return { ok: false, reason: 'Das aktuelle Chronik-Ziel ist noch nicht abgeschlossen.' };
    var current = ensure(state), oldSummary = summary(state);
    var archive = { id: oldSummary.id, summary: clone(oldSummary), run: clone(state) };
    var meta = clone(current.meta), selectedChallenge = CHALLENGE_BY[options.challengeId] || CHALLENGE_BY.standard;
    meta.seals = Math.max(0, Math.floor(num(meta.seals))) + 1;
    meta.maxSimSpeed = maxSimSpeed(meta.seals);
    meta.unlockedVariants = VARIANTS.filter(function (entry) { return entry.unlockAt <= meta.seals; }).map(function (entry) { return entry.id; });
    meta.unlockedBanners = Array.from(new Set((meta.unlockedBanners || []).concat(state.bosses && state.bosses.hardDefeated || [])));
    meta.bestTicks = meta.bestTicks || {};
    var prior = num(meta.bestTicks[oldSummary.challengeId]);
    if (!prior || oldSummary.ticks < prior) meta.bestTicks[oldSummary.challengeId] = oldSummary.ticks;
    meta.archives = (meta.archives || []).filter(function (entry) { return entry.id !== oldSummary.id; });
    meta.archives.push(oldSummary);

    var fresh = GST.createDefault(), seed = nextSeed(state, options.seed), generation = current.generation + 1;
    var variantId = selectedChallenge.id === 'undead_only' ? 'undead' : options.variantId;
    if (meta.unlockedVariants.indexOf(variantId) < 0) variantId = 'slime';
    var speed = [1, 2, 4].indexOf(Number(options.simSpeed)) >= 0 ? Number(options.simSpeed) : 1;
    speed = Math.min(speed, meta.maxSimSpeed);
    var bannerId = meta.unlockedBanners.indexOf(options.bannerId) >= 0 ? options.bannerId : null;
    fresh.reich = state.reich || fresh.reich;
    fresh.herrscher.name = state.herrscher && state.herrscher.name || fresh.herrscher.name;
    fresh.settings.effects = state.settings && state.settings.effects || fresh.settings.effects;
    fresh.settings.watch = !!options.auto;
    fresh.echoes.seed = seed;
    fresh.chronicle = {
      generation: generation,
      runId: 'run_' + generation + '_' + seed,
      seed: seed,
      startedAt: Date.now(),
      objectiveCompletionTick: null,
      fullCompletionTick: null,
      challengeId: selectedChallenge.id,
      startVariantId: variantId,
      bannerId: bannerId,
      simSpeed: speed,
      meta: meta
    };
    applyVariant(fresh, variantId);
    if (selectedChallenge.id === 'bestiary_speedrun') {
      fresh.completion.enabled = !!options.auto;
      fresh.completion.target = 'bestiary';
    }
    SYS.syncUnlocks(fresh); SYS.syncQuests(fresh);
    return { ok: true, state: fresh, archive: archive, summary: oldSummary };
  }

  function isSpeciesAllowed(state, speciesOrId) {
    if (challenge(state).id !== 'undead_only') return true;
    var species = typeof speciesOrId === 'object' ? speciesOrId : GD().creature(speciesOrId);
    return !!(species && species.line === 'Untot');
  }
  function isBuildingAllowed(state, id) {
    return challenge(state).id !== 'no_trade' || ['markt', 'handelshafen'].indexOf(id) < 0;
  }
  function isJobAllowed(state, id) { return challenge(state).id !== 'no_trade' || id !== 'gold'; }
  function isDoctrineAllowed(state, id) { return challenge(state).id !== 'no_trade' || id !== 'trade'; }
  function isDistrictAllowed(state, id) { return challenge(state).id !== 'no_trade' || id !== 'bazaar'; }
  function threatMultiplier(state) { return challenge(state).id === 'aggressive_rivals' ? 2.5 : 1; }
  function forceRisk(state, risk) { return challenge(state).id === 'permadeath' ? 'riskant' : risk; }
  function simSpeed(state) { return Math.max(1, Math.min(4, Number(ensure(state).simSpeed) || 1)); }
  function banner(state) {
    var id = ensure(state).bannerId, boss = id && root.GameBosses ? root.GameBosses.boss(id) : null;
    return boss ? { id: id, icon: boss.icon, name: boss.name + '-Banner' } : null;
  }

  root.GameChronicle = {
    VARIANTS: VARIANTS,
    CHALLENGES: CHALLENGES,
    ensure: ensure,
    challenge: challenge,
    isFullComplete: isFullComplete,
    challengeComplete: challengeComplete,
    observeCompletion: observeCompletion,
    objectiveProgress: objectiveProgress,
    summary: summary,
    rarestSpecies: rarestSpecies,
    availableVariants: availableVariants,
    nextMaxSimSpeed: nextMaxSimSpeed,
    startNewRun: startNewRun,
    applyVariant: applyVariant,
    isSpeciesAllowed: isSpeciesAllowed,
    isBuildingAllowed: isBuildingAllowed,
    isJobAllowed: isJobAllowed,
    isDoctrineAllowed: isDoctrineAllowed,
    isDistrictAllowed: isDistrictAllowed,
    threatMultiplier: threatMultiplier,
    forceRisk: forceRisk,
    simSpeed: simSpeed,
    banner: banner
  };
})();
