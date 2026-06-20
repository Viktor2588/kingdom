/* ============================================================
   state.js — Spielzustand, Standardwerte, Speichern/Laden.
   DOM-frei; localStorage-Zugriffe sind gekapselt (Node-sicher).
   Bereitgestellt als window.GameState / globalThis.GameState.
   ============================================================ */
(function () {
  'use strict';
  var root = (typeof window !== 'undefined') ? window : globalThis;
  var SAVE_KEY = 'tempest_kingdom_save_v2';
  var LEGACY_SAVE_KEY = 'tempest_nazarick_save_v1';
  var VERSION = 5;
  var RULER_ARMY_ID = 0;

  function GD() { return root.GameData; }

  function nextUid(state) {
    state.uidCounter = (state.uidCounter || 0) + 1;
    return state.uidCounter;
  }

  function emptyEquipment() {
    var eq = {};
    GD().equipSlots.forEach(function (p) { eq[p.id] = null; });
    return eq;
  }

  function newCreature(state, speciesId) {
    var sp = GD().creature(speciesId);
    return {
      uid: nextUid(state),
      speciesId: speciesId,
      name: sp ? sp.name : speciesId,
      named: false,
      count: 1,
      armyGroupId: RULER_ARMY_ID,
      level: 1,
      xp: 0,
      job: 'frei',
      aspect: null,
      woundedUntil: 0,
      fusionLevel: 0,
      skills: [],
      skillProgress: {},
      equipment: emptyEquipment()
    };
  }

  function rulerArmy() {
    return {
      id: RULER_ARMY_ID,
      leaderUid: null,
      rulerLed: true,
      name: 'Armee des Herrschers',
      troops: {},
      position: 'hauptstadt',
      movement: 3,
      wardCharges: 0,
      battlesWon: 0
    };
  }

  function createDefault() {
    var s = {
      version: VERSION,
      tick: 0,
      lastSaved: Date.now(),
      reich: 'Tempest',
      herrscher: {
        name: 'Der Namenlose',
        level: 1,
        xp: 0,
        stage: 0,
        skills: ['verschlinger'],
        skillProgress: { verschlinger: { level: 1, xp: 0 } },
        equipment: emptyEquipment()
      },
      resources: { magie: 60, gold: 150, nahrung: 50, material: 80, seelen: 0, wissen: 0 },
      buildings: {
        magieturm: 1, mine: 0, farm: 1, markt: 0, forschungsgilde: 0,
        wohnbezirk: 1, beschwoerungskreis: 1, arkane_akademie: 0, schmiede: 0, labyrinth: 0,
        handelshafen: 0, bibliothek: 0, arena: 0, seelentempel: 0
      },
      creatures: [],
      learnedMagic: [],
      learnedFieldMagic: [],
      adventureMagicCooldowns: {},
      research: [],
      claimedRegions: [],
      expeditions: [],
      activeCombat: null,
      armyGroups: [rulerArmy()],
      armyUidCounter: 0,
      mapDay: 1,
      nextMapRefreshTick: 30,
      claimedMapSites: [],
      exploredMapSites: [],
      mapSiteLevels: {},
      inventory: [],
      threat: 0,
      raid: null,
      rivalProgress: {},
      rivalsDefeated: [],
      tempBuffs: [],
      nextEventTick: 0,
      activeEvent: null,
      affinity: null,
      uidCounter: 0,
      seenUnlocks: [],
      questProgress: 0,
      settings: { watch: false, watchDetailed: false, watchCooldownUntil: 0, watchHistory: [] },
      log: [],
      metrics: { summoned: 0, named: 0, evolutions: 0, expeditions: 0, expeditionsWon: 0, crafted: 0, raidsRepelled: 0, fused: 0, armyVictories: 0 }
    };
    var slime = newCreature(s, 'schleim');
    var goblins = newCreature(s, 'goblin');
    goblins.count = 2;
    s.creatures.push(slime, goblins);
    s.armyGroups[0].troops = { schleim: 1, goblin: 2 };
    s.log.push({ t: 0, text: 'Du erwachst als Schleim am Großen Jura-Wald. Vereine die Monster und errichte Tempest!', kind: 'gold' });
    return s;
  }

  // Fehlende Felder ergänzen (Vorwärtskompatibilität alter Spielstände).
  function normalize(s) {
    if (!s || typeof s !== 'object') return createDefault();
    var def = createDefault();
    function fill(target, defaults) {
      for (var k in defaults) {
        if (!Object.prototype.hasOwnProperty.call(target, k) || target[k] === undefined || target[k] === null) {
          target[k] = (typeof defaults[k] === 'object' && !Array.isArray(defaults[k]))
            ? JSON.parse(JSON.stringify(defaults[k])) : defaults[k];
        }
      }
    }
    fill(s, def);
    fill(s.resources, def.resources);
    fill(s.herrscher, def.herrscher);
    fill(s.metrics, def.metrics);
    // Gebäude: alle bekannten IDs sicherstellen
    GD().buildings.forEach(function (b) {
      if (typeof s.buildings[b.id] !== 'number') s.buildings[b.id] = 0;
    });
    // Kreaturen: Pflichtfelder absichern
    (s.creatures || []).forEach(function (c) {
      if (!c.equipment) c.equipment = { waffe: null, ruestung: null, accessoire: null };
      if (!Array.isArray(c.skills)) c.skills = [];
      if (!c.skillProgress || typeof c.skillProgress !== 'object') c.skillProgress = {};
      c.skills.forEach(function (id) {
        if (!c.skillProgress[id]) c.skillProgress[id] = { level: 1, xp: 0 };
      });
      if (typeof c.level !== 'number') c.level = 1;
      if (typeof c.xp !== 'number') c.xp = 0;
      if (!c.job) c.job = 'frei';
      if (c.aspect === undefined) c.aspect = null;
      if (typeof c.woundedUntil !== 'number') c.woundedUntil = 0;
      if (typeof c.fusionLevel !== 'number') c.fusionLevel = 0;
      if (typeof c.count !== 'number' || c.count < 1) c.count = 1;
      c.count = c.named ? 1 : Math.max(1, Math.floor(c.count));
      if (c.armyGroupId === undefined) c.armyGroupId = c.named ? null : RULER_ARMY_ID;
    });
    if (!Array.isArray(s.seenUnlocks)) s.seenUnlocks = [];
    if (!Array.isArray(s.learnedFieldMagic)) s.learnedFieldMagic = [];
    s.learnedFieldMagic = s.learnedFieldMagic.filter(function (id, i, a) { return !!GD().fieldSpell(id) && a.indexOf(id) === i; });
    if (!s.adventureMagicCooldowns || typeof s.adventureMagicCooldowns !== 'object') s.adventureMagicCooldowns = {};
    if (typeof s.questProgress !== 'number') s.questProgress = 0;
    if (!Array.isArray(s.herrscher.skills)) s.herrscher.skills = ['verschlinger'];
    if (!s.herrscher.skillProgress || typeof s.herrscher.skillProgress !== 'object') s.herrscher.skillProgress = {};
    s.herrscher.skills.forEach(function (id) {
      if (!s.herrscher.skillProgress[id]) s.herrscher.skillProgress[id] = { level: 1, xp: 0 };
    });
    if (!s.settings || typeof s.settings !== 'object') s.settings = { watch: false };
    fill(s.settings, def.settings);
    if (!Array.isArray(s.settings.watchHistory)) s.settings.watchHistory = [];
    // Alle bekannten Diablo-artigen Positionen ergänzen, ohne alte Ausrüstung zu verlieren.
    [s.herrscher].concat(s.creatures || []).forEach(function (holder) {
      if (!holder.equipment) holder.equipment = {};
      GD().equipSlots.forEach(function (p) {
        if (holder.equipment[p.id] === undefined) holder.equipment[p.id] = null;
      });
    });
    (s.creatures || []).forEach(function (c) {
      if (c.named) return;
      for (var slot in c.equipment) {
        var itemUid = c.equipment[slot];
        if (itemUid == null) continue;
        (s.inventory || []).forEach(function (it) { if (it.uid === itemUid) it.equippedBy = null; });
        c.equipment[slot] = null;
      }
    });
    if (!Array.isArray(s.armyGroups)) s.armyGroups = [];
    if (!Array.isArray(s.claimedMapSites)) s.claimedMapSites = [];
    if (!Array.isArray(s.exploredMapSites)) s.exploredMapSites = [];
    if (!s.mapSiteLevels || typeof s.mapSiteLevels !== 'object') s.mapSiteLevels = {};
    s.claimedMapSites = s.claimedMapSites.filter(function (id, i, a) { var site = GD().strategicSite(id); return site && site.kind === 'resource' && a.indexOf(id) === i; });
    s.exploredMapSites = s.exploredMapSites.filter(function (id, i, a) { var site = GD().strategicSite(id); return site && site.kind === 'discovery' && a.indexOf(id) === i; });
    s.claimedMapSites.forEach(function (id) { s.mapSiteLevels[id] = Math.max(1, Math.min(3, Math.floor(Number(s.mapSiteLevels[id]) || 1))); });
    s.armyGroups = s.armyGroups.filter(function (g) {
      return g && typeof g.id === 'number' && (g.rulerLed || g.id === RULER_ARMY_ID || (s.creatures || []).some(function (c) { return c.uid === g.leaderUid && c.named; }));
    });
    var main = s.armyGroups.filter(function (g) { return g.rulerLed || g.id === RULER_ARMY_ID; })[0];
    if (!main) { main = rulerArmy(); s.armyGroups.unshift(main); }
    main.id = RULER_ARMY_ID; main.rulerLed = true; main.leaderUid = null;
    s.armyGroups.forEach(function (g) {
      if (!g.troops || typeof g.troops !== 'object') g.troops = {};
      for (var speciesId in g.troops) g.troops[speciesId] = Math.max(0, Math.floor(Number(g.troops[speciesId]) || 0));
      if (!g.position) g.position = 'hauptstadt';
      if (typeof g.movement !== 'number') g.movement = 3;
      if (typeof g.wardCharges !== 'number') g.wardCharges = 0;
      if (!g.name) g.name = 'Armee ' + g.id;
    });
    // Alte Einzelkreaturen werden zu Stapeln zusammengeführt. Benannte bleiben
    // immer Einzel-Eliten; Unbenannte gehören standardmäßig zur Herrscherarmee.
    var merged = [], stackByKey = {};
    (s.creatures || []).forEach(function (c) {
      if (c.named) { merged.push(c); return; }
      c.skills = []; c.skillProgress = {}; c.fusionLevel = 0;
      if (c.armyGroupId == null || !s.armyGroups.some(function (g) { return g.id === c.armyGroupId; })) c.armyGroupId = RULER_ARMY_ID;
      var key = c.armyGroupId + '|' + c.speciesId;
      if (stackByKey[key]) stackByKey[key].count += c.count;
      else { stackByKey[key] = c; merged.push(c); }
    });
    s.creatures = merged;
    // Phase-11-Spielstände hielten Massentruppen nur in armyGroups.troops.
    // Für v3 je fehlendem Kontingent einen kanonischen Stapel nachziehen.
    s.armyGroups.forEach(function (g) {
      if (g.rulerLed || g.id === RULER_ARMY_ID) return;
      for (var speciesId in g.troops) {
        var present = s.creatures.filter(function (c) { return !c.named && c.armyGroupId === g.id && c.speciesId === speciesId; })
          .reduce(function (sum, c) { return sum + c.count; }, 0);
        if (present < g.troops[speciesId]) {
          var migrated = newCreature(s, speciesId);
          migrated.count = g.troops[speciesId] - present;
          migrated.job = 'frei'; migrated.armyGroupId = g.id;
          s.creatures.push(migrated);
        }
      }
    });
    // Die Hauptarmee wird aus den ihr zugeordneten Stapeln rekonstruiert.
    main.troops = {};
    s.creatures.forEach(function (c) {
      if (!c.named && c.armyGroupId === RULER_ARMY_ID) main.troops[c.speciesId] = (main.troops[c.speciesId] || 0) + c.count;
    });
    s.armyUidCounter = Math.max(s.armyUidCounter || 0, s.armyGroups.reduce(function (m, g) { return Math.max(m, g.id || 0); }, 0));
    s.version = VERSION;
    return s;
  }

  function hasStorage() {
    try { return typeof localStorage !== 'undefined' && localStorage !== null; }
    catch (e) { return false; }
  }

  function save(state) {
    state.lastSaved = Date.now();
    state.version = VERSION;
    if (!hasStorage()) return false;
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      return true;
    } catch (e) { return false; }
  }

  function load() {
    if (!hasStorage()) return null;
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      var legacy = false;
      if (!raw) { raw = localStorage.getItem(LEGACY_SAVE_KEY); legacy = !!raw; }
      if (!raw) return null;
      var state = normalize(JSON.parse(raw));
      if (legacy) {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        localStorage.removeItem(LEGACY_SAVE_KEY);
      }
      return state;
    } catch (e) { return null; }
  }

  function reset() {
    if (!hasStorage()) return;
    try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(LEGACY_SAVE_KEY); } catch (e) {}
  }

  root.GameState = {
    SAVE_KEY: SAVE_KEY,
    LEGACY_SAVE_KEY: LEGACY_SAVE_KEY,
    VERSION: VERSION,
    RULER_ARMY_ID: RULER_ARMY_ID,
    createDefault: createDefault,
    normalize: normalize,
    newCreature: newCreature,
    nextUid: nextUid,
    save: save,
    load: load,
    reset: reset
  };
})();
