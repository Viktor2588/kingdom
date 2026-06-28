/* ============================================================
   systems-bestiary.js — Bestiarium-Jagden, Fährten, Köder und
   Ökologie-Boni (Phase 48). DOM-frei; erweitert GameSystems.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var SYS = root.GameSystems, I = root.GameSystemsInternal;
  if (!SYS || !I) throw new Error('systems-bestiary.js muss nach systems.js geladen werden');

  function GD() { return root.GameData; }
  var HUNT_TRACKS_PER_LURE = 3;
  var pathCache = null;

  var LINE_RULES = [
    { line: 'Schleim', icon: '🟦', source: 'Jura-Wald und Manaquellen', sources: ['wald', 'jura', 'manaquelle'], clue: 'Magicule-Spuren im Jura-Wald reagieren auf Schleimformen.', effect: { produktionMagie: 0.03 }, bonus: '+3 % Magieproduktion' },
    { line: 'Goblin', icon: '👺', source: 'Wald von Jura', sources: ['wald', 'jura', 'jagdlager'], clue: 'Goblin-Späher hinterlassen Zeichen an Waldpfaden und Jagdlagern.', effect: { bauRabatt: 0.02 }, bonus: '-2 % Baukosten' },
    { line: 'Wolf', icon: '🐺', source: 'Waldpfade und Echo-Jura', sources: ['wald', 'jura', 'jagdlager'], clue: 'Rudelspuren liegen an schnellen Waldwegen.', effect: { expedTempo: 0.03 }, bonus: '+3 % Expeditionstempo' },
    { line: 'Oger', icon: '👿', source: 'Ruinen und Dämonengrenze', sources: ['ruinen', 'grenze', 'inferno'], clue: 'Alte Duellnarben in Ruinen weisen auf Oger-Eliten.', effect: { armee: 0.03 }, bonus: '+3 % Armee-Kampfkraft' },
    { line: 'Echse', icon: '🦎', source: 'Giftsumpf', sources: ['sumpf'], clue: 'Schuppenabdrücke sammeln sich an Sumpfufern.', effect: { verteidigung: 0.03 }, bonus: '+3 % Verteidigung' },
    { line: 'Ork', icon: '🐗', source: 'Giftsumpf und Versorgungslager', sources: ['sumpf', 'versorgung'], clue: 'Gefräßige Horden ziehen dort, wo Vorräte verschwinden.', effect: { produktionAll: 0.02 }, bonus: '+2 % Produktion' },
    { line: 'Untot', icon: '💀', source: 'Ruinen und Schattenreich', sources: ['ruinen', 'schattenreich', 'schatten', 'seelenbrunnen'], clue: 'Kalte Seelenreste führen tiefer in die Untotenlinien.', effect: { seelen: 0.04 }, bonus: '+4 % Seelenbeute' },
    { line: 'Dämon', icon: '😈', source: 'Dämonengrenze', sources: ['grenze', 'inferno', 'schattenreich'], clue: 'Dämonische Signaturen verdichten sich an der Grenze.', effect: { armee: 0.04 }, bonus: '+4 % Armee-Kampfkraft' },
    { line: 'Vampir', icon: '🧛', source: 'Schattenreich', sources: ['schattenreich', 'schatten', 'schatzhort'], clue: 'Blutrote Spuren erscheinen erst in dunklen Herrschaftsgebieten.', effect: { heiltempo: 0.04 }, bonus: '+4 % Heiltempo' },
    { line: 'Golem', icon: '🗿', source: 'Tiefe Höhlen und Magistahlmine', sources: ['hoehlen', 'kaverne', 'magistahlmine'], clue: 'Runenstaub in Höhlen verrät erwachte Golemkörper.', effect: { verteidigung: 0.04 }, bonus: '+4 % Verteidigung' },
    { line: 'Insekt', icon: '🪲', source: 'Sumpf und Ruinen', sources: ['sumpf', 'ruinen'], clue: 'Chitinspuren und Schwarmgeräusche führen zu Insektoiden.', effect: { armee: 0.025, verteidigung: 0.025 }, bonus: '+2,5 % Armee und Verteidigung' },
    { line: 'Drache', icon: '🐉', source: 'Drachengebirge', sources: ['gebirge', 'drachennest', 'goetterthron'], clue: 'Drachenblut reagiert nur auf Berg- und Hortfährten.', effect: { drop: 0.05 }, bonus: '+5 % Beutechance' },
    { line: 'Geist', icon: '🧚', source: 'Manaquellen und Geisterfeste', sources: ['wald', 'manaquelle', 'jura', 'himmel'], clue: 'Geisterfunken tanzen an Manaquellen und in Echo-Wäldern.', effect: { wissen: 0.06 }, bonus: '+6 % Wissen' },
    { line: 'Greif', icon: '🦅', source: 'Himmelsfeste und Sturmechos', sources: ['himmelsfeste', 'himmel', 'gebirge'], clue: 'Federwirbel in Höhenlagen verraten Greif- und Harpyienpfade.', effect: { bewegung: 1 }, bonus: '+1 Bewegung für Armeen' },
    { line: 'Baumhirte', icon: '🌳', source: 'Jura-Wald', sources: ['wald', 'jura', 'manaquelle'], clue: 'Wurzelmuster im Jura-Wald markieren erwachte Baumhirten.', effect: { produktionAll: 0.03 }, bonus: '+3 % Produktion' },
    { line: 'Phönix', icon: '🔥', source: 'Glutgrenze und Götterthron', sources: ['grenze', 'inferno', 'goetterthron', 'himmelsfeste'], clue: 'Asche, die nicht erkaltet, führt zur Phönixlinie.', effect: { heiltempo: 0.06 }, bonus: '+6 % Heiltempo' },
    { line: 'Kobold', icon: '🐕', source: 'Jura-Jagdlager', sources: ['wald', 'jagdlager', 'jura'], clue: 'Koboldläufer markieren Jagdpfade mit kleinen Kerben.', effect: { drop: 0.04 }, bonus: '+4 % Beutechance' },
    { line: 'Hasenmensch', icon: '🐇', source: 'Jura-Wald und Versorgungslager', sources: ['wald', 'jura', 'versorgung'], clue: 'Mondförmige Fußspuren erscheinen in ruhigen Waldlichtungen.', effect: { summonRabatt: 0.03 }, bonus: '-3 % Beschwörungskosten' },
    { line: 'Tengu', icon: '👺', source: 'Drachengebirge und Himmelsfeste', sources: ['gebirge', 'himmelsfeste', 'himmel'], clue: 'Zerschnittene Windfäden zeigen Tengu-Pfade in der Höhe.', effect: { feldmagie: 0.04 }, bonus: '+4 % aktive Feldmagie' },
    { line: 'Meervolk', icon: '🧜', source: 'Giftsumpf und Handelswege', sources: ['sumpf', 'handelsposten', 'versorgung'], clue: 'Gezeitenzeichen finden sich an feuchten Grenzwegen.', effect: { produktionAll: 0.025, verteidigung: 0.015 }, bonus: '+2,5 % Produktion und +1,5 % Verteidigung' }
  ];

  function fmtRes(id, amt) {
    var r = GD().resources.filter(function (x) { return x.id === id; })[0];
    return (amt != null ? amt + ' ' : '') + (r ? r.name : id);
  }
  function hunts(state) {
    if (!state.bestiaryHunts || typeof state.bestiaryHunts !== 'object' || Array.isArray(state.bestiaryHunts)) state.bestiaryHunts = {};
    if (!state.bestiaryHunts.tracks || typeof state.bestiaryHunts.tracks !== 'object' || Array.isArray(state.bestiaryHunts.tracks)) state.bestiaryHunts.tracks = {};
    if (!state.bestiaryHunts.lures || typeof state.bestiaryHunts.lures !== 'object' || Array.isArray(state.bestiaryHunts.lures)) state.bestiaryHunts.lures = {};
    return state.bestiaryHunts;
  }
  function lines() {
    var seen = {}, out = [];
    GD().creatures.forEach(function (sp) { if (!seen[sp.line]) { seen[sp.line] = true; out.push(sp.line); } });
    return out;
  }
  function lineInfo(line) {
    for (var i = 0; i < LINE_RULES.length; i++) if (LINE_RULES[i].line === line) return LINE_RULES[i];
    return { line: line, icon: '🔎', source: 'bekannte Regionen', sources: [], clue: 'Suche nach Fährten dieser Linie in passenden Regionen.', effect: {}, bonus: 'kleiner Reichsbonus' };
  }
  function lineSpecies(line) {
    return GD().creatures.filter(function (sp) { return sp.line === line; });
  }
  function lineComplete(state, line) {
    var forms = lineSpecies(line);
    return forms.length > 0 && forms.every(function (sp) { return (state.seenSpecies || []).indexOf(sp.id) >= 0; });
  }
  function ecologyEffects(state) {
    var effect = {};
    lines().forEach(function (line) {
      if (!lineComplete(state, line)) return;
      var eff = lineInfo(line).effect || {};
      for (var k in eff) effect[k] = (effect[k] || 0) + eff[k];
    });
    return effect;
  }
  function lineStatus(state, line) {
    var h = hunts(state), forms = lineSpecies(line), info = lineInfo(line);
    var seen = forms.filter(function (sp) { return (state.seenSpecies || []).indexOf(sp.id) >= 0; }).length;
    return {
      line: line, icon: info.icon, source: info.source, clue: info.clue,
      bonus: info.bonus, effect: info.effect || {},
      seen: seen, total: forms.length, complete: forms.length > 0 && seen >= forms.length,
      tracks: Math.max(0, Math.floor(Number(h.tracks[line]) || 0)),
      lures: Math.max(0, Math.floor(Number(h.lures[line]) || 0)),
      tracksNeeded: HUNT_TRACKS_PER_LURE
    };
  }
  function sourceMatches(sourceId, line) {
    return (lineInfo(line).sources || []).indexOf(sourceId) >= 0;
  }
  function awardTracks(state, sourceId, amount) {
    amount = Math.max(1, Math.floor(Number(amount) || 1));
    var all = lines().filter(function (line) { return !lineComplete(state, line); });
    var matched = all.filter(function (line) { return sourceMatches(sourceId, line); });
    var pool = matched.length ? matched : all;
    if (!pool.length) return null;
    var h = hunts(state);
    pool.sort(function (a, b) {
      return (h.tracks[a] || 0) - (h.tracks[b] || 0)
        || lineSpecies(a).length - lineSpecies(b).length
        || a.localeCompare(b);
    });
    var line = pool[0];
    h.tracks[line] = Math.max(0, Math.floor(Number(h.tracks[line]) || 0)) + amount;
    state.metrics.bestiaryTracks = (state.metrics.bestiaryTracks || 0) + amount;
    return { line: line, amount: amount, tracks: h.tracks[line], ready: h.tracks[line] >= HUNT_TRACKS_PER_LURE };
  }
  function canPrepareLure(state, line) {
    var status = lineStatus(state, line);
    if (!status.total) return { ok: false, reason: 'Unbekannte Linie' };
    if (status.complete) return { ok: false, reason: 'Linie bereits vollständig' };
    if (status.tracks < HUNT_TRACKS_PER_LURE) return { ok: false, reason: 'Noch ' + (HUNT_TRACKS_PER_LURE - status.tracks) + ' Fährte(n) nötig' };
    return { ok: true, status: status };
  }
  function prepareLure(state, line) {
    var check = canPrepareLure(state, line);
    if (!check.ok) return check;
    var h = hunts(state), info = lineInfo(line);
    h.tracks[line] -= HUNT_TRACKS_PER_LURE;
    h.lures[line] = (h.lures[line] || 0) + 1;
    state.metrics.bestiaryLures = (state.metrics.bestiaryLures || 0) + 1;
    I.log(state, '🪤 Köder für die ' + info.icon + ' ' + line + '-Linie gebunden.', 'gold');
    return { ok: true, line: line, lures: h.lures[line] };
  }
  function pathsBySpecies() {
    if (pathCache) return pathCache;
    pathCache = {};
    function visit(id, path) {
      if (path.indexOf(id) >= 0) return;
      var sp = GD().creature(id), next = path.concat(id);
      if (!pathCache[id]) pathCache[id] = [];
      if (!pathCache[id].some(function (saved) { return saved.join('|') === next.join('|'); })) pathCache[id].push(next);
      (sp && sp.evolvesTo || []).forEach(function (ev) { visit(ev.to, next); });
    }
    GD().creatures.filter(function (sp) { return !!sp.summon; }).forEach(function (sp) { visit(sp.id, []); });
    return pathCache;
  }
  function pathsForSpecies(speciesId) {
    return (pathsBySpecies()[speciesId] || []).map(function (path) { return path.slice(); });
  }
  function hint(state, speciesId) {
    var sp = GD().creature(speciesId);
    if (!sp) return '';
    if ((state.seenSpecies || []).indexOf(speciesId) >= 0) return 'Entdeckt.';
    var paths = pathsForSpecies(speciesId);
    var path = paths.slice().sort(function (a, b) { return a.length - b.length; })[0] || [speciesId];
    var predecessorId = path[path.length - 2], predecessor = predecessorId ? GD().creature(predecessorId) : null;
    if (predecessor && (state.seenSpecies || []).indexOf(predecessorId) >= 0) {
      var from = predecessor.evolvesTo.filter(function (ev) { return ev.to === speciesId; })[0];
      var req = from && from.req ? from.req : {}, parts = [];
      if (req.named) parts.push('benannte Elite');
      if (req.level) parts.push('Level ' + req.level);
      if (req.seelen) parts.push(req.seelen + ' Seelen');
      if (req.material) parts.push(req.material + ' Material');
      if (req.herrscherStufe) parts.push('Herrscher-Stufe ' + (GD().rulerStages[req.herrscherStufe] ? GD().rulerStages[req.herrscherStufe].name : req.herrscherStufe));
      return 'Entsteht aus ' + predecessor.name + (parts.length ? ': ' + parts.join(', ') : '.') + '.';
    }
    var info = lineInfo(sp.line);
    return info.clue + ' Quelle: ' + info.source + '.';
  }
  function pickAspectFor(inst) {
    var sp = GD().creature(inst.speciesId);
    if (sp && sp.role === 'Magie') return 'arkanist';
    if (sp && sp.role === 'Verteidigung') return 'bollwerk';
    return 'wuterich';
  }
  function huntPlan(state, speciesId) {
    var target = GD().creature(speciesId);
    if (!target) return { ok: false, reason: 'Unbekannte Form' };
    if (root.GameChronicle && !root.GameChronicle.isSpeciesAllowed(state, target)) {
      return { ok: false, reason: 'Diese Challenge erlaubt nur Untote' };
    }
    if ((state.seenSpecies || []).indexOf(speciesId) >= 0) return { ok: false, reason: 'Form bereits entdeckt' };
    var h = hunts(state);
    if ((h.lures[target.line] || 0) < 1) return { ok: false, reason: 'Kein gebundener Köder für die ' + target.line + '-Linie' };
    var paths = pathsForSpecies(speciesId);
    if (!paths.length) return { ok: false, reason: 'Keine Jagdroute bekannt' };
    var best = null;
    paths.forEach(function (path) {
      var held = null, idx = -1;
      (state.creatures || []).forEach(function (creature) {
        if (SYS.creatureBusy(state, creature.uid) || SYS.isWounded(state, creature)) return;
        var pos = path.indexOf(creature.speciesId);
        if (pos >= 0 && pos > idx && pos < path.length) { held = creature; idx = pos; }
      });
      var candidate = held
        ? { action: 'advance', path: path, creature: held, index: idx, score: path.length - idx }
        : { action: 'summon', path: path, root: GD().creature(path[0]), index: -1, score: 20 + path.length };
      if (!best || candidate.score < best.score) best = candidate;
    });
    if (!best) return { ok: false, reason: 'Keine passende Jagdroute' };
    if (best.action === 'summon') {
      if (!best.root || !best.root.summon) return { ok: false, reason: 'Grundform nicht beschwörbar' };
      if (GD().rankIndex(best.root.rank) > SYS.maxSummonRankIndex(state)) return { ok: false, reason: 'Beschwörungskreis zu niedrig für ' + best.root.name };
      if (SYS.usedCapacity(state) >= SYS.capacity(state)) return { ok: false, reason: 'Keine Kapazität (Wohnbezirk bauen)' };
      return { ok: true, action: 'summon', target: target, root: best.root, path: best.path };
    }
    if (best.creature.speciesId === speciesId) return { ok: true, action: 'record', target: target, creature: best.creature, path: best.path };
    var nextId = best.path[best.index + 1], current = GD().creature(best.creature.speciesId);
    var ev = current && (current.evolvesTo || []).filter(function (entry) { return entry.to === nextId; })[0];
    if (!ev) return { ok: false, reason: 'Jagdroute unterbrochen' };
    var req = ev.req || {};
    if (req.named && !best.creature.named) {
      var nameCheck = SYS.canName(state, best.creature);
      if (!nameCheck.ok) return { ok: false, reason: nameCheck.reason };
      return { ok: true, action: 'name', target: target, creature: best.creature, nextId: nextId, cost: nameCheck.cost, path: best.path };
    }
    var reqCheck = SYS.reqStatus(state, best.creature, req);
    if (reqCheck.ok) return { ok: true, action: 'evolve', target: target, creature: best.creature, nextId: nextId, path: best.path };
    if (req.level && best.creature.level < req.level) return { ok: true, action: 'train', target: target, creature: best.creature, nextId: nextId, req: req, path: best.path };
    var gains = {};
    if (req.seelen && (state.resources.seelen || 0) < req.seelen) gains.seelen = Math.min(req.seelen - (state.resources.seelen || 0), Math.max(20, I.round(req.seelen * 0.35)));
    if (req.material && (state.resources.material || 0) < req.material) gains.material = Math.min(req.material - (state.resources.material || 0), Math.max(30, I.round(req.material * 0.35)));
    if (Object.keys(gains).length) return { ok: true, action: 'gather', target: target, creature: best.creature, nextId: nextId, gains: gains, path: best.path };
    return { ok: false, reason: reqCheck.missing.join(', ') || 'Voraussetzungen fehlen' };
  }
  function useLure(state, speciesId) {
    var plan = huntPlan(state, speciesId);
    if (!plan.ok) return plan;
    var h = hunts(state), line = plan.target.line, result, text;
    h.lures[line] = Math.max(0, (h.lures[line] || 0) - 1);
    state.metrics.bestiaryHunts = (state.metrics.bestiaryHunts || 0) + 1;
    if (plan.action === 'summon') {
      var stack = I.addTroopStack(state, SYS.RULER_ARMY_ID, plan.root.id, 1);
      state.metrics.summoned = (state.metrics.summoned || 0) + 1;
      SYS.recordSeenSpecies(state);
      text = '🪤 Köderjagd lockt ' + plan.root.name + ' nach Tempest.';
      result = { ok: true, action: 'summon', creature: stack, speciesId: plan.root.id };
    } else if (plan.action === 'record') {
      SYS.recordSeenSpecies(state);
      text = '📖 ' + plan.target.name + ' im Bestiarium erfasst.';
      result = { ok: true, action: 'record', speciesId: plan.target.id };
    } else if (plan.action === 'name') {
      result = SYS.nameCreature(state, plan.creature.uid, null, pickAspectFor(plan.creature));
      if (!result.ok) return result;
      text = '🪤 Köderjagd bindet einen wahren Namen für ' + plan.target.name + '.';
    } else if (plan.action === 'evolve') {
      result = SYS.evolve(state, plan.creature.uid, plan.nextId);
      if (!result.ok) return result;
      SYS.recordSeenSpecies(state);
      text = '🪤 Köderjagd führt zur Evolution: ' + GD().creature(plan.nextId).name + '.';
    } else if (plan.action === 'train') {
      var steps = Math.max(1, Math.min(4, (plan.req.level || plan.creature.level) - plan.creature.level));
      var xp = 0;
      for (var li = 0; li < steps; li++) xp += SYS.xpForLevel(plan.creature.level + li);
      SYS.addCreatureXp(state, plan.creature, Math.max(20, xp));
      text = '🪤 Köderjagd trainiert ' + plan.creature.name + ' Richtung ' + GD().creature(plan.nextId).name + ' (Lv ' + plan.creature.level + ').';
      result = { ok: true, action: 'train', creature: plan.creature, xp: xp };
    } else if (plan.action === 'gather') {
      I.addResources(state, plan.gains);
      text = '🪤 Köderjagd findet Evolutionsessenz: ' + Object.keys(plan.gains).map(function (res) { return fmtRes(res, plan.gains[res]); }).join(', ') + '.';
      result = { ok: true, action: 'gather', gains: plan.gains };
    }
    I.log(state, text, 'gold');
    return Object.assign(result || { ok: true }, { line: line, target: plan.target, text: text, remainingLures: h.lures[line] || 0 });
  }

  var API = {
    HUNT_TRACKS_PER_LURE: HUNT_TRACKS_PER_LURE,
    lines: lines,
    lineInfo: lineInfo,
    lineSpecies: lineSpecies,
    lineStatus: lineStatus,
    lineComplete: lineComplete,
    ecologyEffects: ecologyEffects,
    hint: hint,
    awardTracks: awardTracks,
    canPrepareLure: canPrepareLure,
    prepareLure: prepareLure,
    canUseLure: huntPlan,
    useLure: useLure,
    pathsForSpecies: pathsForSpecies
  };
  root.GameBestiaryHunts = API;
  Object.assign(SYS, {
    HUNT_TRACKS_PER_LURE: HUNT_TRACKS_PER_LURE,
    bestiaryLines: lines,
    bestiaryLineInfo: lineInfo,
    bestiaryLineSpecies: lineSpecies,
    bestiaryLineStatus: lineStatus,
    bestiaryLineComplete: lineComplete,
    bestiaryHint: hint,
    awardBestiaryTracks: awardTracks,
    canPrepareBestiaryLure: canPrepareLure,
    prepareBestiaryLure: prepareLure,
    canUseBestiaryLure: huntPlan,
    useBestiaryLure: useLure,
    bestiaryPathsForSpecies: pathsForSpecies
  });
})();
