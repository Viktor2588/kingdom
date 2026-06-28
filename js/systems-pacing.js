/* ============================================================
   systems-pacing.js — Action-Dichte, Stall-Diagnosen und Gates.
   DOM-frei; beobachtet die final verketteten Systempfade.
   ============================================================ */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var SYS = root.GameSystems;
  if (!SYS) throw new Error('systems-pacing.js muss nach den Systemmodulen geladen werden');

  var EVENT_IDS = ['build', 'combat', 'achievement', 'bestiary', 'boss', 'contract', 'decision'];
  var EVENT_LABELS = {
    build: 'Bau', combat: 'Kampf', achievement: 'Erfolg', bestiary: 'Bestiarium',
    boss: 'Boss', contract: 'Auftrag', decision: 'Entscheidung'
  };
  var STALL_TICKS = 180;
  var SAMPLE_TICKS = 60;
  var CURVE_TICKS = 120;
  var MAX_SAMPLES = 120;
  var MAX_CURVE = 100;

  function num(value) {
    var parsed = Number(value);
    return isFinite(parsed) ? parsed : 0;
  }
  function sumObject(object) {
    var total = 0;
    for (var key in (object || {})) total += num(object[key]);
    return total;
  }
  function metrics(state, keys) {
    var total = 0;
    keys.forEach(function (key) { total += num(state.metrics && state.metrics[key]); });
    return total;
  }
  function ensure(state) {
    if (!state.pacing || typeof state.pacing !== 'object' || Array.isArray(state.pacing)) state.pacing = {};
    var pacing = state.pacing;
    if (pacing._ready) return pacing;
    if (pacing.enabled == null) pacing.enabled = true;
    if (!pacing.events || typeof pacing.events !== 'object') pacing.events = {};
    EVENT_IDS.forEach(function (id) {
      var event = pacing.events[id];
      if (!event || typeof event !== 'object') event = pacing.events[id] = {};
      event.count = Math.max(0, Math.floor(num(event.count)));
      event.lastTick = event.lastTick == null ? null : Math.max(0, Math.floor(num(event.lastTick)));
      event.totalGap = Math.max(0, Math.floor(num(event.totalGap)));
      event.maxGap = Math.max(0, Math.floor(num(event.maxGap)));
    });
    if (!pacing.actionCounts || typeof pacing.actionCounts !== 'object') pacing.actionCounts = {};
    if (!Array.isArray(pacing.samples)) pacing.samples = [];
    if (!Array.isArray(pacing.progressCurve)) pacing.progressCurve = [];
    if (!pacing.stall || typeof pacing.stall !== 'object') pacing.stall = { kind: 'warming_up', sinceTick: state.tick || 0, detail: '' };
    pacing.startedTick = Math.max(0, Math.floor(num(pacing.startedTick)));
    pacing.lastObservedTick = Math.max(0, Math.floor(num(pacing.lastObservedTick)));
    pacing.lastMeaningfulTick = Math.max(0, Math.floor(num(pacing.lastMeaningfulTick)));
    pacing.lastQuestTick = Math.max(0, Math.floor(num(pacing.lastQuestTick)));
    pacing.questIndex = Math.max(0, Math.floor(num(pacing.questIndex)));
    Object.defineProperty(pacing, '_ready', { value: true, writable: true, configurable: true });
    return pacing;
  }
  function snapshot(state) {
    var bosses = state.bosses || {};
    var specializations = state.specializations || {};
    var crisis = state.contracts && state.contracts.crisis;
    return {
      build: sumObject(state.buildings),
      combat: metrics(state, ['expeditionsWon', 'armyVictories', 'echoesCleared', 'tacticalWins', 'skirmishesPlayed', 'raidsRepelled']),
      achievement: (state.achievements || []).length,
      bestiary: (state.seenSpecies || []).length,
      boss: (bosses.defeated || []).length + (bosses.hardDefeated || []).length + (bosses.eliteDefeated || []).length,
      contract: metrics(state, ['contractsCompleted']),
      decision: metrics(state, ['crisesResolved']) + num(specializations.doctrineChanges) +
        num(specializations.districtChanges) + num(specializations.schoolsAssigned) + (state.affinity ? 1 : 0),
      decisionToken: (state.activeEvent || '') + '|' + (crisis ? crisis.id + ':' + crisis.stage : ''),
      quest: Math.max(0, Math.floor(num(state.questProgress))),
      regions: (state.claimedRegions || []).length,
      research: (state.research || []).length,
      creatures: metrics(state, ['summoned', 'named', 'evolutions']),
      tick: Math.max(0, Math.floor(num(state.tick)))
    };
  }
  function progressScore(snap) {
    return snap.build + snap.combat * 2 + snap.achievement * 4 + snap.bestiary * 2 +
      snap.boss * 8 + snap.contract * 2 + snap.decision + snap.quest * 3 +
      snap.regions * 5 + snap.research * 2 + snap.creatures;
  }
  function signature(snap) {
    return [snap.build, snap.combat, snap.achievement, snap.bestiary, snap.boss, snap.contract,
      snap.decision, snap.quest, snap.regions, snap.research, snap.creatures].join('|');
  }
  function recordEvent(pacing, id, tick) {
    var event = pacing.events[id];
    if (event.lastTick != null && tick > event.lastTick) {
      var gap = tick - event.lastTick;
      event.totalGap += gap;
      event.maxGap = Math.max(event.maxGap, gap);
    }
    event.lastTick = tick;
    event.count++;
  }
  function classifyAction(action) {
    var text = action && action.text || '';
    if (/Boss|Koloss|Hydra|Chimär|Himmelsrichter|Elite-Exemplar/i.test(text)) return 'boss';
    if (/Auftrag|Krise/i.test(text)) return 'contract';
    if (/bezw|erobert|Kampf|Expedition|Feldzug|Echo|Raid|Belager|Rivalen|Taktik/i.test(text)) return 'combat';
    if (/Stufe [0-9]|ausgebaut|Gebäude|Viertel|Bezirk|Umbau/i.test(text)) return 'build';
    if (/Forschung|Feldmagie|Zauber|Doktrin/i.test(text)) return 'research';
    if (/geschmiedet|aufgewertet|Bauplan/i.test(text)) return 'forge';
    if (/Bestiarium|Köder|Fährte|Grundform|Evolution|entwickelt|beschworen|benannt|fusioniert|Namensslot/i.test(text)) return 'creature';
    if (/Affinität|Schule|Entscheidung|Ereignis/i.test(text)) return 'decision';
    if (/→|trainiert|Talent|Seelen geopfert|Gefolge sammelt|mobilisiert|Barriere|Windmarsch|rekrutiert|zieht nach|aufgestellt|gesichert/i.test(text)) return 'management';
    return text ? 'other' : 'idle';
  }
  function recordAction(state, action) {
    if (!action) return;
    var pacing = ensure(state);
    var kind = classifyAction(action);
    pacing.actionCounts[kind] = Math.max(0, Math.floor(num(pacing.actionCounts[kind]))) + 1;
  }
  function nextBuild(state) {
    var production = SYS.production(state).rates;
    var best = null;
    (root.GameData.buildings || []).forEach(function (building) {
      if (!SYS.buildingUnlocked(state, building.id)) return;
      var cost = SYS.buildingCost(state, building.id);
      var ticks = 0, blocked = [], missing = [];
      for (var resource in cost) {
        var deficit = Math.max(0, num(cost[resource]) - num(state.resources && state.resources[resource]));
        if (!deficit) continue;
        missing.push(resource);
        var rate = num(production[resource]);
        if (rate <= 0) blocked.push(resource);
        else ticks = Math.max(ticks, Math.ceil(deficit / rate));
      }
      var candidate = { id: building.id, name: building.name, ticks: blocked.length ? Infinity : ticks, missing: missing, blocked: blocked };
      if (!best || candidate.ticks < best.ticks) best = candidate;
    });
    return best;
  }
  function lockedQuest(state) {
    var quest = SYS.activeQuest(state);
    if (!quest) return null;
    var mapQuest = ['q_expedition', 'q_expand3'].indexOf(quest.id) >= 0;
    var magicQuest = ['q_research', 'q_magic3'].indexOf(quest.id) >= 0;
    var forgeQuest = quest.id === 'q_craft';
    if (mapQuest && !SYS.tabUnlocked(state, 'karte')) return { id: quest.id, detail: quest.title + ': Kartenpfad ist gesperrt.' };
    if (magicQuest && !SYS.tabUnlocked(state, 'magie')) return { id: quest.id, detail: quest.title + ': Magiepfad ist gesperrt.' };
    if (forgeQuest && !SYS.tabUnlocked(state, 'schmiede')) return { id: quest.id, detail: quest.title + ': Schmiedepfad ist gesperrt.' };
    return null;
  }
  function blockers(state, includeForecast) {
    var pacing = ensure(state), out = [];
    var used = SYS.usedCapacity(state), capacity = SYS.capacity(state);
    if (used > capacity) out.push({ kind: 'over_capacity', severity: 'error', detail: 'Bevölkerung ' + used + '/' + capacity + '.' });
    var quest = SYS.activeQuest(state);
    if (quest && ((state.settings && state.settings.watch) || (state.completion && state.completion.enabled)) &&
        (state.tick || 0) - pacing.lastQuestTick >= 300 &&
        (state.tick || 0) - pacing.lastMeaningfulTick >= 300) {
      out.push({ kind: 'quest_stalled', severity: 'error', detail: quest.title + ' seit ' + ((state.tick || 0) - pacing.lastQuestTick) + ' Ticks unverändert.' });
    }
    var locked = lockedQuest(state);
    if (locked) out.push({ kind: 'locked_ui_path', severity: 'error', detail: locked.detail });
    if (state.completion && state.completion.diagnostic) {
      out.push({ kind: 'unsolvable_achievement', severity: 'error', detail: state.completion.diagnostic });
    }
    if (includeForecast !== false) {
      var next = nextBuild(state);
      if (next && next.blocked.length) out.push({ kind: 'missing_resource', severity: 'warn', detail: next.name + ': keine Produktion für ' + next.blocked.join(', ') + '.' });
      else if (next && next.ticks > 600) out.push({ kind: 'cost_too_high', severity: 'warn', detail: next.name + ' erst in ca. ' + next.ticks + ' Ticks.' });
    }
    return out;
  }
  function diagnose(state) {
    var pacing = ensure(state), tick = state.tick || 0, elapsed = tick - pacing.lastMeaningfulTick;
    var found = blockers(state, elapsed >= STALL_TICKS);
    var hard = found.filter(function (entry) { return entry.severity === 'error'; })[0];
    if (hard) return { kind: hard.kind, sinceTick: pacing.lastMeaningfulTick, detail: hard.detail };
    if (elapsed < STALL_TICKS) return { kind: 'healthy', sinceTick: pacing.lastMeaningfulTick, detail: 'Letzter Fortschritt vor ' + elapsed + ' Ticks.' };
    if (state.activeEvent || (state.contracts && state.contracts.crisis)) {
      return { kind: 'decision_wait', sinceTick: pacing.lastMeaningfulTick, detail: 'Eine Entscheidung wartet.' };
    }
    if (found.length) return { kind: found[0].kind, sinceTick: pacing.lastMeaningfulTick, detail: found[0].detail };
    var next = nextBuild(state);
    if (state.settings && state.settings.watch && next && next.ticks === 0) {
      return { kind: 'wrong_auto_priority', sinceTick: pacing.lastMeaningfulTick, detail: next.name + ' ist bezahlbar, Auto handelt aber nicht.' };
    }
    if (next && next.ticks > 0 && isFinite(next.ticks)) {
      return { kind: 'saving', sinceTick: pacing.lastMeaningfulTick, detail: next.name + ' in ca. ' + next.ticks + ' Ticks.' };
    }
    return { kind: 'content_gap', sinceTick: pacing.lastMeaningfulTick, detail: 'Seit ' + elapsed + ' Ticks kein messbarer Fortschritt.' };
  }
  function sample(state, snap) {
    var pacing = ensure(state), tick = state.tick || 0;
    var last = pacing.samples[pacing.samples.length - 1];
    if (!last || tick - last.tick >= SAMPLE_TICKS) {
      pacing.samples.push({ tick: tick, stall: pacing.stall.kind, score: progressScore(snap) });
      pacing.samples = pacing.samples.slice(-MAX_SAMPLES);
    }
    var point = pacing.progressCurve[pacing.progressCurve.length - 1];
    if (!point || tick - point.tick >= CURVE_TICKS) {
      pacing.progressCurve.push({
        tick: tick, score: progressScore(snap), achievements: snap.achievement,
        species: snap.bestiary, regions: snap.regions
      });
      pacing.progressCurve = pacing.progressCurve.slice(-MAX_CURVE);
    }
  }
  function observe(state) {
    var pacing = ensure(state);
    if (!pacing.enabled) return pacing;
    var current = snapshot(state), previous = pacing.snapshot;
    if (!previous) {
      pacing.startedTick = current.tick;
      pacing.lastMeaningfulTick = current.tick;
      pacing.lastQuestTick = current.tick;
      pacing.questIndex = current.quest;
    } else {
      EVENT_IDS.forEach(function (id) {
        if (current[id] > num(previous[id])) recordEvent(pacing, id, current.tick);
      });
      if (current.decisionToken !== previous.decisionToken) recordEvent(pacing, 'decision', current.tick);
      if (signature(current) !== signature(previous)) {
        pacing.lastMeaningfulTick = current.tick;
      }
      if (current.quest !== num(previous.quest)) {
        pacing.lastQuestTick = current.tick;
        pacing.questIndex = current.quest;
      }
    }
    pacing.snapshot = current;
    pacing.signature = signature(current);
    pacing.lastObservedTick = current.tick;
    if (pacing._lastDiagnosisTick == null || current.tick - pacing._lastDiagnosisTick >= 15) {
      pacing.stall = diagnose(state);
      pacing._lastDiagnosisTick = current.tick;
    }
    sample(state, current);
    return pacing;
  }
  function report(state) {
    var pacing = observe(state), tick = state.tick || 0;
    var events = EVENT_IDS.map(function (id) {
      var event = pacing.events[id];
      return {
        id: id, label: EVENT_LABELS[id], count: event.count,
        since: event.lastTick == null ? tick - pacing.startedTick : tick - event.lastTick,
        averageGap: event.count > 1 ? Math.round(event.totalGap / (event.count - 1)) : null,
        maxGap: event.maxGap
      };
    });
    var actions = Object.keys(pacing.actionCounts).map(function (id) {
      return { id: id, count: pacing.actionCounts[id] };
    }).sort(function (a, b) { return b.count - a.count; });
    var totalActions = actions.reduce(function (sum, entry) { return sum + entry.count; }, 0);
    actions.forEach(function (entry) { entry.share = totalActions ? entry.count / totalActions : 0; });
    return {
      tick: tick,
      stall: pacing.stall,
      blockers: blockers(state),
      nextBuild: nextBuild(state),
      events: events,
      actions: actions,
      totalActions: totalActions,
      progressCurve: pacing.progressCurve.slice()
    };
  }
  function evaluateRuns(runs, limits) {
    limits = limits || {};
    var maxIdle = limits.maxIdle == null ? 360 : limits.maxIdle;
    var scoreRatio = limits.scoreRatio == null ? 1.8 : limits.scoreRatio;
    var failures = [];
    (runs || []).forEach(function (run) {
      if (run.maxIdle > maxIdle) failures.push(run.id + ': ' + run.maxIdle + ' Ticks ohne Fortschritt');
      if (run.blockers && run.blockers.length) failures.push(run.id + ': ' + run.blockers[0].kind);
      if (run.requireCompletion && !run.completed) failures.push(run.id + ': 100 % nicht erreicht');
    });
    var strategyRuns = (runs || []).filter(function (run) { return run.strategy && run.score > 0; });
    if (strategyRuns.length > 1) {
      var scores = strategyRuns.map(function (run) { return run.score; });
      var min = Math.min.apply(Math, scores), max = Math.max.apply(Math, scores);
      if (min <= 0 || max / min > scoreRatio) failures.push('Strategiedominanz: ' + (min ? (max / min).toFixed(2) + '×' : 'unendlich'));
    }
    return { ok: failures.length === 0, failures: failures };
  }
  function maxIdleGap(state) {
    var curve = ensure(state).progressCurve, longest = 0, current = 0, previous = null;
    curve.forEach(function (point) {
      if (previous && point.score === previous.score) {
        current += point.tick - previous.tick;
        longest = Math.max(longest, current);
      } else current = 0;
      previous = point;
    });
    return longest;
  }

  var originalTick = SYS.tick;
  SYS.tick = function (state) {
    var result = originalTick(state);
    observe(state);
    return result;
  };
  var originalOffline = SYS.offlineProgress;
  SYS.offlineProgress = function (state, seconds) {
    var result = originalOffline(state, seconds);
    observe(state);
    return result;
  };
  var originalAuto = SYS.autoPlayStep;
  SYS.autoPlayStep = function (state) {
    var action = originalAuto(state);
    recordAction(state, action);
    observe(state);
    return action;
  };

  root.GamePacing = {
    EVENT_IDS: EVENT_IDS,
    EVENT_LABELS: EVENT_LABELS,
    STALL_TICKS: STALL_TICKS,
    ensure: ensure,
    snapshot: snapshot,
    observe: observe,
    report: report,
    blockers: blockers,
    diagnose: diagnose,
    nextBuild: nextBuild,
    classifyAction: classifyAction,
    recordAction: recordAction,
    progressScore: progressScore,
    maxIdleGap: maxIdleGap,
    evaluateRuns: evaluateRuns
  };
})();
