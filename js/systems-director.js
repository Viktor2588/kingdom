/* ============================================================
   systems-director.js — gruppierter Watch-Feed, Meilensteine und
   gemeinsame Stop-Bedingungen für sichtbare/headless Zeitraffer.
   ============================================================ */
(function () {
  'use strict';
  var root = typeof window !== 'undefined' ? window : globalThis;
  var SYS = root.GameSystems;
  if (!SYS) throw new Error('systems-director.js muss nach den Systemmodulen geladen werden');

  var THEMES = {
    build: { label: 'Aufbau', icon: '🏗️', tab: 'reich' },
    combat: { label: 'Feldzug', icon: '⚔️', tab: 'karte' },
    boss: { label: 'Bossjagd', icon: '👑', tab: 'uebersicht' },
    contract: { label: 'Aufträge & Krisen', icon: '📜', tab: 'uebersicht' },
    creature: { label: 'Monsterzucht', icon: '🧬', tab: 'kreaturen' },
    research: { label: 'Forschung', icon: '📚', tab: 'magie' },
    forge: { label: 'Schmiede-Ziel', icon: '⚒️', tab: 'schmiede' },
    decision: { label: 'Reichsentscheidung', icon: '⚖️', tab: 'uebersicht' },
    management: { label: 'Reichsführung', icon: '🏰', tab: 'uebersicht' },
    other: { label: 'Fortschritt', icon: '✨', tab: 'uebersicht' }
  };

  function num(value) {
    var parsed = Number(value);
    return isFinite(parsed) ? parsed : 0;
  }
  function ensure(state) {
    if (!state.director || typeof state.director !== 'object' || Array.isArray(state.director)) state.director = {};
    var director = state.director;
    if (!Array.isArray(director.feed)) director.feed = [];
    if (!Array.isArray(director.milestones)) director.milestones = [];
    if (!Array.isArray(director.seen)) director.seen = [];
    return director;
  }
  function completeSets(state) {
    var held = {};
    (state.inventory || []).forEach(function (item) {
      var recipe = root.GameData.recipe(item.recipeId);
      if (recipe && recipe.set) held[recipe.set] = held[recipe.set] || {};
      if (recipe && recipe.set) held[recipe.set][recipe.id] = true;
    });
    var complete = [];
    for (var setId in held) {
      var required = root.GameData.recipes.filter(function (recipe) { return recipe.set === setId; });
      if (required.length && required.every(function (recipe) { return held[setId][recipe.id]; })) complete.push(setId);
    }
    return complete;
  }
  function snapshot(state) {
    var highest = -1;
    (state.creatures || []).forEach(function (creature) {
      var species = root.GameData.creature(creature.speciesId);
      if (species) highest = Math.max(highest, root.GameData.rankIndex(species.rank));
    });
    return {
      species: (state.seenSpecies || []).slice(),
      highestRank: highest,
      sets: completeSets(state),
      bosses: (state.bosses && state.bosses.defeated || []).slice(),
      regions: (state.claimedRegions || []).slice(),
      achievements: (state.achievements || []).slice(),
      quest: num(state.questProgress),
      tick: num(state.tick)
    };
  }
  function unseen(previous, current) {
    return current.filter(function (id) { return previous.indexOf(id) < 0; });
  }
  function milestone(id, kind, icon, title, before, after, tab, tick) {
    return { id: id, kind: kind, icon: icon, title: title, before: before, after: after, tab: tab, tick: tick, important: true };
  }
  function detectMilestones(state, previous, current) {
    if (!previous) return [];
    var out = [], tick = state.tick || 0;
    unseen(previous.species, current.species).forEach(function (id) {
      var species = root.GameData.creature(id);
      if (species) out.push(milestone('species_' + id, 'species', species.icon, 'Neue Form: ' + species.name,
        previous.species.length, current.species.length, 'kreaturen', tick));
    });
    if (previous.highestRank < 5 && current.highestRank >= 5) {
      out.push(milestone('first_s_rank', 'rank', '💠', 'Erster S-Rang', 'A oder niedriger', 'S-Rang', 'kreaturen', tick));
    }
    unseen(previous.sets, current.sets).forEach(function (id) {
      var set = root.GameData.set(id);
      out.push(milestone('set_' + id, 'set', '🛡️', 'Set vollendet: ' + (set ? set.name : id), 'unvollständig', 'vollständig', 'schmiede', tick));
    });
    unseen(previous.bosses, current.bosses).forEach(function (id) {
      var boss = root.GameBosses && root.GameBosses.boss(id);
      out.push(milestone('boss_' + id, 'boss', boss ? boss.icon : '👑', 'Boss bezwungen: ' + (boss ? boss.name : id), 'offen', 'besiegt', 'uebersicht', tick));
    });
    unseen(previous.regions, current.regions).forEach(function (id) {
      var region = root.GameData.region(id);
      out.push(milestone('region_' + id, 'region', '🚩', (region ? region.name : id) + ' erobert',
        previous.regions.length, current.regions.length, 'karte', tick));
    });
    if (current.achievements.length > previous.achievements.length) {
      var fresh = unseen(previous.achievements, current.achievements);
      var last = fresh.length ? root.GameAchievements.get(fresh[fresh.length - 1]) : null;
      out.push(milestone('achievement_' + current.achievements.length, 'achievement', '🏆',
        fresh.length + ' Erfolg' + (fresh.length === 1 ? '' : 'e') + ': ' + (last ? last.title : 'Fortschritt'),
        previous.achievements.length, current.achievements.length, 'uebersicht', tick));
    }
    if (current.quest > previous.quest) {
      out.push(milestone('quest_' + current.quest, 'quest', '🎯', 'Zielkette vorangebracht',
        previous.quest, current.quest, 'uebersicht', tick));
    }
    return out;
  }
  function addFeed(state, entry) {
    var director = ensure(state);
    director.feed.unshift(entry);
    director.feed = director.feed.slice(0, 30);
  }
  function addMilestone(state, entry) {
    var director = ensure(state);
    if (director.seen.indexOf(entry.id) >= 0) return false;
    director.seen.push(entry.id);
    director.seen = director.seen.slice(-200);
    director.milestones.unshift(entry);
    director.milestones = director.milestones.slice(0, 20);
    addFeed(state, entry);
    director.cameraTab = entry.tab;
    director.stopReason = 'milestone';
    return true;
  }
  function groupAction(state, action) {
    if (!action || !action.text) return null;
    var director = ensure(state);
    var kind = root.GamePacing ? root.GamePacing.classifyAction(action) : 'other';
    var theme = THEMES[kind] || THEMES.other;
    var top = director.feed[0];
    if (top && top.type === 'group' && top.kind === kind && (state.tick || 0) - top.lastTick <= 30) {
      top.count++;
      top.lastTick = state.tick || 0;
      top.latest = action.text;
      top.title = theme.label + ' · ' + top.count + ' Schritte';
      director.currentGroup = top;
      return top;
    }
    var group = {
      id: 'group_' + (state.tick || 0) + '_' + kind,
      type: 'group', kind: kind, icon: theme.icon, title: theme.label,
      count: 1, firstTick: state.tick || 0, lastTick: state.tick || 0,
      latest: action.text, tab: theme.tab, important: false
    };
    addFeed(state, group);
    director.currentGroup = group;
    return group;
  }
  function riskState(state) {
    if (state.raid) return { kind: 'raid', text: 'Rivalenangriff steht bevor.' };
    if (state.activeEvent || (state.contracts && state.contracts.crisis)) return { kind: 'decision', text: 'Entscheidung wartet.' };
    var risky = (state.expeditions || []).filter(function (expedition) { return expedition.risk === 'risky'; })[0];
    if (risky) return { kind: 'expedition', text: 'Riskante Expedition läuft.' };
    if (state.activeCombat && state.activeCombat.status === 'active') return { kind: 'combat', text: 'Taktischer Kampf wartet.' };
    return null;
  }
  function observe(state, action) {
    var director = ensure(state), current = snapshot(state), previous = director.snapshot;
    var milestones = detectMilestones(state, previous, current);
    milestones.forEach(function (entry) { addMilestone(state, entry); });
    var group = groupAction(state, action);
    var risk = riskState(state);
    if (risk && risk.kind === 'decision' && state.settings && state.settings.watchPauseDecision) director.stopReason = 'decision';
    director.snapshot = current;
    return { group: group, milestones: milestones, risk: risk, cameraTab: director.cameraTab };
  }
  function runUntil(state, mode, maxTicks) {
    var director = ensure(state), start = state.tick || 0, action = null, observed = null;
    director.stopReason = null;
    if (!director.snapshot) director.snapshot = snapshot(state);
    for (var i = 0; i < Math.max(1, Math.min(3600, maxTicks || 600)); i++) {
      var events = SYS.tick(state);
      var immediateRisk = riskState(state);
      if (mode === 'decision' && immediateRisk && immediateRisk.kind === 'decision') {
        director.stopReason = 'decision';
        observed = observe(state, null);
        break;
      }
      action = state.settings && state.settings.watch ? SYS.autoPlayStep(state) : null;
      observed = observe(state, action, events);
      if (mode === 'milestone' && observed.milestones.length) break;
      if (mode === 'risk' && observed.risk) { director.stopReason = observed.risk.kind; break; }
    }
    return { ticks: (state.tick || 0) - start, reason: director.stopReason || 'limit', action: action, observed: observed };
  }

  root.GameDirector = {
    THEMES: THEMES,
    ensure: ensure,
    snapshot: snapshot,
    detectMilestones: detectMilestones,
    groupAction: groupAction,
    riskState: riskState,
    observe: observe,
    runUntil: runUntil
  };
})();
