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
  var CHRONICLE_KEY = 'tempest_kingdom_chronicles_v1';
  var VERSION = 21;
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
      schoolId: null,
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
    var runSeed = Math.max(1, Math.floor(Date.now() % 2147483646));
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
        talents: {},
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
      echoes: {
        cycle: 1,
        seed: runSeed,
        nodes: [],
        completed: [],
        stability: 0,
        mapsCompleted: 0,
        lastAutoTick: -999
      },
      inventory: [],
      unlockedRecipes: ['magistahlklinge', 'magistahlpanzer', 'magieamulett'],
      forgeMaterials: { runenstaub: 0, magistahlkern: 0, seelenkristall: 0, drachenessenz: 0 },
      threat: 0,
      raid: null,
      rivalProgress: {},
      rivalsDefeated: [],
      tempBuffs: [],
      nextEventTick: 0,
      activeEvent: null,
      affinity: null,
      skirmish: { active: null, heat: 0, streak: 0, bestCombo: 0, rotation: 0, objectivesCompleted: 0, lastResult: null },
      siege: { active: null, lastResult: null },
      tacticalBattle: null,
      uidCounter: 0,
      seenUnlocks: [],
      questProgress: 0,
      achievements: [],
      seenSpecies: [],
      bestiaryHunts: { tracks: {}, lures: {} },
      contracts: {
        board: [],
        serial: 0,
        nextRefreshTick: 0,
        lastProgressTick: 0,
        lastPacingTick: 0,
        progressSignature: '',
        completed: 0,
        failed: 0,
        autoProfile: 'progress',
        crisis: null,
        crisisSerial: 0,
        nextCrisisTick: 0,
        lastCrisisId: null
      },
      specializations: {
        doctrineId: null,
        doctrineLockedUntil: 0,
        autoDoctrine: 'adaptive',
        districts: [null, null, null],
        rebuild: null,
        lastDoctrineReason: '',
        doctrineChanges: 0,
        districtChanges: 0,
        schoolsAssigned: 0
      },
      bosses: {
        defeated: [],
        hardDefeated: [],
        attempts: {},
        eliteDefeated: [],
        components: {},
        banners: 0,
        lastResult: null,
        lastAutoTick: -999
      },
      chronicle: {
        generation: 0,
        runId: 'run_0_' + runSeed,
        seed: runSeed,
        startedAt: Date.now(),
        objectiveCompletionTick: null,
        fullCompletionTick: null,
        challengeId: 'standard',
        startVariantId: 'slime',
        bannerId: null,
        simSpeed: 1,
        meta: {
          seals: 0,
          maxSimSpeed: 1,
          unlockedVariants: ['slime'],
          unlockedBanners: [],
          bestTicks: {},
          archives: []
        }
      },
      pacing: {
        enabled: true,
        overlay: false,
        startedTick: 0,
        lastObservedTick: 0,
        lastMeaningfulTick: 0,
        lastQuestTick: 0,
        questIndex: 0,
        signature: '',
        snapshot: null,
        events: {},
        actionCounts: {},
        samples: [],
        progressCurve: [],
        stall: { kind: 'warming_up', sinceTick: 0, detail: '' }
      },
      director: {
        feed: [],
        milestones: [],
        currentGroup: null,
        snapshot: null,
        cameraTab: null,
        stopReason: null,
        seen: []
      },
      completion: {
        enabled: false,
        target: 'all',
        lastProgressTick: 0,
        lastSignature: '',
        diagnostic: null
      },
      settings: { watch: false, watchDetailed: false, watchCooldownUntil: 0, watchHistory: [], watchPauseDecision: true, effects: 'full' },
      log: [],
      metrics: { summoned: 0, named: 0, evolutions: 0, rankCEvolutions: 0, expeditions: 0, expeditionsWon: 0, riskyWins: 0, creaturesLost: 0, crafted: 0, tempered: 0, epicForged: 0, recipesUnlocked: 0, salvaged: 0, raidsRepelled: 0, activeSiegesWon: 0, fused: 0, armyVictories: 0, echoesCleared: 0, echoBosses: 0, bossesDefeated: 0, eliteHunts: 0, tacticalWins: 0, skirmishesPlayed: 0, skirmishesWon: 0, skirmishBestCombo: 0, skirmishObjectives: 0, bestiaryTracks: 0, bestiaryLures: 0, bestiaryHunts: 0, contractsCompleted: 0, contractsFailed: 0, crisesResolved: 0, seelenGesamt: 0 }
    };
    var slime = newCreature(s, 'schleim');
    var goblins = newCreature(s, 'goblin');
    goblins.count = 2;
    s.creatures.push(slime, goblins);
    s.seenSpecies = ['schleim', 'goblin'];
    s.armyGroups[0].troops = { schleim: 1, goblin: 2 };
    s.log.push({ t: 0, text: 'Du erwachst als Schleim am Großen Jura-Wald. Vereine die Monster und errichte Tempest!', kind: 'gold' });
    return s;
  }

  // Fehlende Felder ergänzen (Vorwärtskompatibilität alter Spielstände).
  function normalize(s) {
    if (!s || typeof s !== 'object') return createDefault();
    var sourceVersion = Math.max(1, Math.floor(Number(s.version) || 1));
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
    if (!s.forgeMaterials || typeof s.forgeMaterials !== 'object' || Array.isArray(s.forgeMaterials)) s.forgeMaterials = {};
    fill(s.forgeMaterials, def.forgeMaterials);
    GD().forgeMaterials.forEach(function (material) {
      s.forgeMaterials[material.id] = Math.max(0, Math.floor(Number(s.forgeMaterials[material.id]) || 0));
    });
    if (!Array.isArray(s.unlockedRecipes)) s.unlockedRecipes = [];
    // v1–v6 konnten alle durch Gebäude/Forschung sichtbaren Rezepte direkt
    // schmieden. Diese Baupläne bleiben bei der Migration selbstverständlich bekannt.
    if (sourceVersion < 7) {
      GD().recipes.forEach(function (recipe) {
        var researchOk = !recipe.req || !recipe.req.research || (s.research || []).indexOf(recipe.req.research) >= 0;
        if (!recipe.bossOnly && (recipe.starter || ((s.buildings && s.buildings.schmiede) || 0) >= recipe.schmiede) && researchOk) s.unlockedRecipes.push(recipe.id);
      });
    }
    GD().recipes.forEach(function (recipe) { if (recipe.starter) s.unlockedRecipes.push(recipe.id); });
    s.unlockedRecipes = s.unlockedRecipes.filter(function (id, i, all) { return !!GD().recipe(id) && all.indexOf(id) === i; });
    if (!Array.isArray(s.inventory)) s.inventory = [];
    s.inventory.forEach(function (item) {
      var recipe = GD().recipe(item.recipeId), quality = Number(item.quality);
      if (!isFinite(quality)) {
        quality = 0;
        GD().rarities.forEach(function (rarity, idx) { if (rarity.id === item.rarity) quality = idx; });
      }
      quality = Math.max(0, Math.min(GD().rarities.length - 1, Math.floor(quality)));
      item.quality = quality;
      item.rarity = GD().rarities[quality].id;
      if (!Array.isArray(item.forgeHistory)) item.forgeHistory = [];
      if (recipe) {
        item.name = recipe.name; item.icon = recipe.icon; item.slot = recipe.slot;
        item.stats = {};
        for (var stat in recipe.stats) item.stats[stat] = Math.round(recipe.stats[stat] * GD().rarities[quality].mult);
        if (s.unlockedRecipes.indexOf(recipe.id) < 0) s.unlockedRecipes.push(recipe.id);
      }
    });
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
      if (['commander', 'hunter', 'mage', 'defender', 'smith'].indexOf(c.schoolId) < 0 || !c.named) c.schoolId = null;
      if (typeof c.woundedUntil !== 'number') c.woundedUntil = 0;
      if (typeof c.fusionLevel !== 'number') c.fusionLevel = 0;
      if (typeof c.count !== 'number' || c.count < 1) c.count = 1;
      c.count = c.named ? 1 : Math.max(1, Math.floor(c.count));
      if (c.armyGroupId === undefined) c.armyGroupId = c.named ? null : RULER_ARMY_ID;
    });
    if (!Array.isArray(s.seenUnlocks)) s.seenUnlocks = [];
    if (!Array.isArray(s.achievements)) s.achievements = [];
    if (root.GameAchievements) {
      s.achievements = s.achievements.filter(function (id, i, a) { return root.GameAchievements.get(id) && a.indexOf(id) === i; });
    }
    // Bestiarium-Fortschritt: aktuell gehaltene Spezies gelten als entdeckt,
    // damit auch Alt-Spielstände einen gefüllten Zähler erhalten.
    if (!Array.isArray(s.seenSpecies)) s.seenSpecies = [];
    (s.creatures || []).forEach(function (c) { if (c && c.speciesId && s.seenSpecies.indexOf(c.speciesId) < 0) s.seenSpecies.push(c.speciesId); });
    s.seenSpecies = s.seenSpecies.filter(function (id, i, a) { return !!GD().creature(id) && a.indexOf(id) === i; });
    // Bestiarium-Jagden v15: Fährten und gebundene Köder je Kreaturenlinie.
    if (!s.bestiaryHunts || typeof s.bestiaryHunts !== 'object' || Array.isArray(s.bestiaryHunts)) {
      s.bestiaryHunts = JSON.parse(JSON.stringify(def.bestiaryHunts));
    }
    fill(s.bestiaryHunts, def.bestiaryHunts);
    if (!s.bestiaryHunts.tracks || typeof s.bestiaryHunts.tracks !== 'object' || Array.isArray(s.bestiaryHunts.tracks)) s.bestiaryHunts.tracks = {};
    if (!s.bestiaryHunts.lures || typeof s.bestiaryHunts.lures !== 'object' || Array.isArray(s.bestiaryHunts.lures)) s.bestiaryHunts.lures = {};
    var validLines = {};
    GD().creatures.forEach(function (sp) { validLines[sp.line] = true; });
    ['tracks', 'lures'].forEach(function (bucket) {
      for (var line in s.bestiaryHunts[bucket]) {
        if (!validLines[line]) delete s.bestiaryHunts[bucket][line];
        else s.bestiaryHunts[bucket][line] = Math.max(0, Math.floor(Number(s.bestiaryHunts[bucket][line]) || 0));
      }
    });
    // Dynamische Aufträge und Krisen v16. Detailvalidierung übernimmt das
    // nachgeladene DOM-freie Vertragsmodul; hier bleibt die Save-Struktur heil.
    if (!s.contracts || typeof s.contracts !== 'object' || Array.isArray(s.contracts)) {
      s.contracts = JSON.parse(JSON.stringify(def.contracts));
    }
    fill(s.contracts, def.contracts);
    if (!Array.isArray(s.contracts.board)) s.contracts.board = [];
    s.contracts.serial = Math.max(0, Math.floor(Number(s.contracts.serial) || 0));
    s.contracts.nextRefreshTick = Math.max(0, Math.floor(Number(s.contracts.nextRefreshTick) || 0));
    s.contracts.lastProgressTick = Math.max(0, Math.floor(Number(s.contracts.lastProgressTick) || 0));
    s.contracts.lastPacingTick = Math.max(0, Math.floor(Number(s.contracts.lastPacingTick) || 0));
    s.contracts.completed = Math.max(0, Math.floor(Number(s.contracts.completed) || 0));
    s.contracts.failed = Math.max(0, Math.floor(Number(s.contracts.failed) || 0));
    s.contracts.crisisSerial = Math.max(0, Math.floor(Number(s.contracts.crisisSerial) || 0));
    s.contracts.nextCrisisTick = Math.max(0, Math.floor(Number(s.contracts.nextCrisisTick) || 0));
    if (['safe', 'aggressive', 'collector', 'progress'].indexOf(s.contracts.autoProfile) < 0) s.contracts.autoProfile = 'progress';
    if (typeof s.contracts.progressSignature !== 'string') s.contracts.progressSignature = '';
    if (s.contracts.lastCrisisId != null && typeof s.contracts.lastCrisisId !== 'string') s.contracts.lastCrisisId = null;
    if (s.contracts.crisis != null && (typeof s.contracts.crisis !== 'object' || Array.isArray(s.contracts.crisis) ||
        typeof s.contracts.crisis.id !== 'string' || !isFinite(Number(s.contracts.crisis.stage)) ||
        (root.GameContracts && !root.GameContracts.CRISES.some(function (crisis) { return crisis.id === s.contracts.crisis.id; })))) s.contracts.crisis = null;
    // Strategische Spezialisierungen v17: Doktrin, aktive Bezirke,
    // laufender Umbau und Anführerschulen bleiben save-kompatibel.
    if (!s.specializations || typeof s.specializations !== 'object' || Array.isArray(s.specializations)) {
      s.specializations = JSON.parse(JSON.stringify(def.specializations));
    }
    fill(s.specializations, def.specializations);
    var doctrineIds = ['conquest', 'research', 'trade', 'breeding', 'labyrinth'];
    var districtIds = ['warcamp', 'archive', 'bazaar', 'hatchery', 'bastion', 'runeforge'];
    if (doctrineIds.indexOf(s.specializations.doctrineId) < 0) s.specializations.doctrineId = null;
    if (['adaptive'].concat(doctrineIds).indexOf(s.specializations.autoDoctrine) < 0) s.specializations.autoDoctrine = 'adaptive';
    s.specializations.doctrineLockedUntil = Math.max(0, Math.floor(Number(s.specializations.doctrineLockedUntil) || 0));
    s.specializations.doctrineChanges = Math.max(0, Math.floor(Number(s.specializations.doctrineChanges) || 0));
    s.specializations.districtChanges = Math.max(0, Math.floor(Number(s.specializations.districtChanges) || 0));
    s.specializations.schoolsAssigned = Math.max(0, Math.floor(Number(s.specializations.schoolsAssigned) || 0));
    if (typeof s.specializations.lastDoctrineReason !== 'string') s.specializations.lastDoctrineReason = '';
    if (!Array.isArray(s.specializations.districts)) s.specializations.districts = [];
    s.specializations.districts = s.specializations.districts.slice(0, 3);
    while (s.specializations.districts.length < 3) s.specializations.districts.push(null);
    s.specializations.districts = s.specializations.districts.map(function (id) { return districtIds.indexOf(id) >= 0 ? id : null; });
    var seenDistricts = {};
    s.specializations.districts = s.specializations.districts.map(function (id) {
      if (!id || seenDistricts[id]) return null;
      seenDistricts[id] = true;
      return id;
    });
    if (s.specializations.rebuild != null) {
      var rebuild = s.specializations.rebuild;
      if (!rebuild || typeof rebuild !== 'object' || Array.isArray(rebuild) ||
          districtIds.indexOf(rebuild.districtId) < 0 || !isFinite(Number(rebuild.slot)) ||
          !isFinite(Number(rebuild.readyTick))) s.specializations.rebuild = null;
      else {
        rebuild.slot = Math.max(0, Math.min(2, Math.floor(Number(rebuild.slot) || 0)));
        rebuild.readyTick = Math.max(s.tick || 0, Math.floor(Number(rebuild.readyTick) || 0));
      }
    }
    // Boss-Leiter v18: Siege, Meisterschaft, Elite-Exemplare und
    // einmalige Trophäenkomponenten.
    if (!s.bosses || typeof s.bosses !== 'object' || Array.isArray(s.bosses)) {
      s.bosses = JSON.parse(JSON.stringify(def.bosses));
    }
    fill(s.bosses, def.bosses);
    var bossIds = ['jura_koloss', 'echo_hydra', 'chimera_alpha', 'himmelsrichter'];
    if (!Array.isArray(s.bosses.defeated)) s.bosses.defeated = [];
    if (!Array.isArray(s.bosses.hardDefeated)) s.bosses.hardDefeated = [];
    s.bosses.defeated = s.bosses.defeated.filter(function (id, i, all) { return bossIds.indexOf(id) >= 0 && all.indexOf(id) === i; });
    s.bosses.hardDefeated = s.bosses.hardDefeated.filter(function (id, i, all) {
      return bossIds.indexOf(id) >= 0 && s.bosses.defeated.indexOf(id) >= 0 && all.indexOf(id) === i;
    });
    if (!s.bosses.attempts || typeof s.bosses.attempts !== 'object' || Array.isArray(s.bosses.attempts)) s.bosses.attempts = {};
    bossIds.forEach(function (id) { s.bosses.attempts[id] = Math.max(0, Math.floor(Number(s.bosses.attempts[id]) || 0)); });
    if (!Array.isArray(s.bosses.eliteDefeated)) s.bosses.eliteDefeated = [];
    s.bosses.eliteDefeated = s.bosses.eliteDefeated.filter(function (line, i, all) { return !!validLines[line] && all.indexOf(line) === i; });
    if (!s.bosses.components || typeof s.bosses.components !== 'object' || Array.isArray(s.bosses.components)) s.bosses.components = {};
    for (var componentId in s.bosses.components) {
      s.bosses.components[componentId] = Math.max(0, Math.floor(Number(s.bosses.components[componentId]) || 0));
      if (!s.bosses.components[componentId]) delete s.bosses.components[componentId];
    }
    s.bosses.banners = Math.max(0, Math.floor(Number(s.bosses.banners) || 0));
    s.bosses.lastAutoTick = isFinite(Number(s.bosses.lastAutoTick)) ? Math.floor(Number(s.bosses.lastAutoTick)) : -999;
    if (s.bosses.lastResult != null && (typeof s.bosses.lastResult !== 'object' || Array.isArray(s.bosses.lastResult))) s.bosses.lastResult = null;
    // Chronik-Runs v19: Der aktive Save enthält nur Meta-Fortschritt und
    // Zusammenfassungen; vollständige versiegelte Runs liegen separat.
    if (!s.chronicle || typeof s.chronicle !== 'object' || Array.isArray(s.chronicle)) {
      s.chronicle = JSON.parse(JSON.stringify(def.chronicle));
    }
    fill(s.chronicle, def.chronicle);
    var challengeIds = ['standard', 'undead_only', 'no_trade', 'aggressive_rivals', 'bestiary_speedrun', 'permadeath'];
    var variantIds = ['slime', 'undead', 'spirit', 'kobold'];
    s.chronicle.generation = Math.max(0, Math.floor(Number(s.chronicle.generation) || 0));
    s.chronicle.seed = Math.max(1, Math.min(2147483646, Math.floor(Number(s.chronicle.seed) || def.chronicle.seed)));
    s.chronicle.startedAt = Math.max(0, Math.floor(Number(s.chronicle.startedAt) || Date.now()));
    ['objectiveCompletionTick', 'fullCompletionTick'].forEach(function (key) {
      if (s.chronicle[key] == null) s.chronicle[key] = null;
      else {
        s.chronicle[key] = Math.floor(Number(s.chronicle[key]));
        if (!isFinite(s.chronicle[key]) || s.chronicle[key] < 0) s.chronicle[key] = null;
      }
    });
    if (challengeIds.indexOf(s.chronicle.challengeId) < 0) s.chronicle.challengeId = 'standard';
    if (variantIds.indexOf(s.chronicle.startVariantId) < 0) s.chronicle.startVariantId = 'slime';
    if (typeof s.chronicle.runId !== 'string' || !s.chronicle.runId) s.chronicle.runId = 'run_' + s.chronicle.generation + '_' + s.chronicle.seed;
    if (!s.chronicle.meta || typeof s.chronicle.meta !== 'object' || Array.isArray(s.chronicle.meta)) {
      s.chronicle.meta = JSON.parse(JSON.stringify(def.chronicle.meta));
    }
    fill(s.chronicle.meta, def.chronicle.meta);
    var meta = s.chronicle.meta;
    meta.seals = Math.max(0, Math.floor(Number(meta.seals) || 0));
    meta.maxSimSpeed = meta.seals >= 3 ? 4 : (meta.seals >= 1 ? 2 : 1);
    meta.unlockedVariants = variantIds.filter(function (id, index) {
      return index === 0 || meta.seals >= index;
    });
    if (!Array.isArray(meta.unlockedBanners)) meta.unlockedBanners = [];
    meta.unlockedBanners = meta.unlockedBanners.filter(function (id, i, all) { return bossIds.indexOf(id) >= 0 && all.indexOf(id) === i; });
    if (s.chronicle.bannerId != null && meta.unlockedBanners.indexOf(s.chronicle.bannerId) < 0) s.chronicle.bannerId = null;
    s.chronicle.simSpeed = [1, 2, 4].indexOf(Number(s.chronicle.simSpeed)) >= 0 ? Number(s.chronicle.simSpeed) : 1;
    if (s.chronicle.simSpeed > meta.maxSimSpeed) s.chronicle.simSpeed = meta.maxSimSpeed;
    if (!meta.bestTicks || typeof meta.bestTicks !== 'object' || Array.isArray(meta.bestTicks)) meta.bestTicks = {};
    for (var challengeId in meta.bestTicks) {
      if (challengeIds.indexOf(challengeId) < 0 || !isFinite(Number(meta.bestTicks[challengeId])) || Number(meta.bestTicks[challengeId]) <= 0) delete meta.bestTicks[challengeId];
      else meta.bestTicks[challengeId] = Math.floor(Number(meta.bestTicks[challengeId]));
    }
    if (!Array.isArray(meta.archives)) meta.archives = [];
    meta.archives = meta.archives.filter(function (entry) {
      return entry && typeof entry === 'object' && typeof entry.id === 'string' && entry.id;
    });
    if (!s.pacing || typeof s.pacing !== 'object' || Array.isArray(s.pacing)) {
      s.pacing = JSON.parse(JSON.stringify(def.pacing));
    }
    fill(s.pacing, def.pacing);
    s.pacing.enabled = s.pacing.enabled !== false;
    s.pacing.overlay = !!s.pacing.overlay;
    ['startedTick', 'lastObservedTick', 'lastMeaningfulTick', 'lastQuestTick', 'questIndex'].forEach(function (key) {
      s.pacing[key] = Math.max(0, Math.floor(Number(s.pacing[key]) || 0));
    });
    if (typeof s.pacing.signature !== 'string') s.pacing.signature = '';
    if (!s.pacing.snapshot || typeof s.pacing.snapshot !== 'object' || Array.isArray(s.pacing.snapshot)) s.pacing.snapshot = null;
    if (!s.pacing.events || typeof s.pacing.events !== 'object' || Array.isArray(s.pacing.events)) s.pacing.events = {};
    if (!s.pacing.actionCounts || typeof s.pacing.actionCounts !== 'object' || Array.isArray(s.pacing.actionCounts)) s.pacing.actionCounts = {};
    for (var pacingAction in s.pacing.actionCounts) {
      s.pacing.actionCounts[pacingAction] = Math.max(0, Math.floor(Number(s.pacing.actionCounts[pacingAction]) || 0));
    }
    if (!Array.isArray(s.pacing.samples)) s.pacing.samples = [];
    s.pacing.samples = s.pacing.samples.filter(function (entry) { return entry && typeof entry === 'object'; }).slice(-120);
    if (!Array.isArray(s.pacing.progressCurve)) s.pacing.progressCurve = [];
    s.pacing.progressCurve = s.pacing.progressCurve.filter(function (entry) { return entry && typeof entry === 'object'; }).slice(-100);
    if (!s.pacing.stall || typeof s.pacing.stall !== 'object' || Array.isArray(s.pacing.stall)) s.pacing.stall = JSON.parse(JSON.stringify(def.pacing.stall));
    if (typeof s.pacing.stall.kind !== 'string') s.pacing.stall.kind = 'warming_up';
    s.pacing.stall.sinceTick = Math.max(0, Math.floor(Number(s.pacing.stall.sinceTick) || 0));
    if (typeof s.pacing.stall.detail !== 'string') s.pacing.stall.detail = '';
    if (!s.director || typeof s.director !== 'object' || Array.isArray(s.director)) {
      s.director = JSON.parse(JSON.stringify(def.director));
    }
    fill(s.director, def.director);
    if (!Array.isArray(s.director.feed)) s.director.feed = [];
    s.director.feed = s.director.feed.filter(function (entry) { return entry && typeof entry === 'object'; }).slice(0, 30);
    if (!Array.isArray(s.director.milestones)) s.director.milestones = [];
    s.director.milestones = s.director.milestones.filter(function (entry) { return entry && typeof entry === 'object'; }).slice(0, 20);
    if (s.director.currentGroup != null && (typeof s.director.currentGroup !== 'object' || Array.isArray(s.director.currentGroup))) s.director.currentGroup = null;
    if (s.director.snapshot != null && (typeof s.director.snapshot !== 'object' || Array.isArray(s.director.snapshot))) s.director.snapshot = null;
    if (s.director.cameraTab != null && typeof s.director.cameraTab !== 'string') s.director.cameraTab = null;
    if (s.director.stopReason != null && typeof s.director.stopReason !== 'string') s.director.stopReason = null;
    if (!Array.isArray(s.director.seen)) s.director.seen = [];
    s.director.seen = s.director.seen.filter(function (id, index, all) { return typeof id === 'string' && all.indexOf(id) === index; }).slice(-200);
    if (!s.completion || typeof s.completion !== 'object' || Array.isArray(s.completion)) {
      s.completion = JSON.parse(JSON.stringify(def.completion));
    }
    fill(s.completion, def.completion);
    s.completion.enabled = !!s.completion.enabled;
    if (['all', 'achievements', 'bestiary'].indexOf(s.completion.target) < 0) s.completion.target = 'all';
    s.completion.lastProgressTick = Math.max(0, Math.floor(Number(s.completion.lastProgressTick) || 0));
    if (typeof s.completion.lastSignature !== 'string') s.completion.lastSignature = '';
    if (s.completion.diagnostic != null && typeof s.completion.diagnostic !== 'string') s.completion.diagnostic = null;
    if (!Array.isArray(s.learnedFieldMagic)) s.learnedFieldMagic = [];
    s.learnedFieldMagic = s.learnedFieldMagic.filter(function (id, i, a) { return !!GD().fieldSpell(id) && a.indexOf(id) === i; });
    if (!s.adventureMagicCooldowns || typeof s.adventureMagicCooldowns !== 'object') s.adventureMagicCooldowns = {};
    if (typeof s.questProgress !== 'number') s.questProgress = 0;
    if (!Array.isArray(s.herrscher.skills)) s.herrscher.skills = ['verschlinger'];
    if (!s.herrscher.skillProgress || typeof s.herrscher.skillProgress !== 'object') s.herrscher.skillProgress = {};
    s.herrscher.skills.forEach(function (id) {
      if (!s.herrscher.skillProgress[id]) s.herrscher.skillProgress[id] = { level: 1, xp: 0 };
    });
    // Talentbaum v6: nur bekannte Knoten und gültige Ränge übernehmen. Ein
    // beschädigter/älterer Spielstand kann niemals mehr Punkte behalten, als
    // sein Herrscher durch Level und Evolutionsstufen verdient hat.
    if (!s.herrscher.talents || typeof s.herrscher.talents !== 'object' || Array.isArray(s.herrscher.talents)) s.herrscher.talents = {};
    var cleanTalents = {};
    GD().talents.forEach(function (talent) {
      var rank = Math.max(0, Math.min(talent.maxRank, Math.floor(Number(s.herrscher.talents[talent.id]) || 0)));
      if (rank > 0) cleanTalents[talent.id] = rank;
    });
    var earnedTalentPoints = Math.max(0, (s.herrscher.level || 1) - 1) + Math.max(0, s.herrscher.stage || 0) * 2;
    var spentTalentPoints = Object.keys(cleanTalents).reduce(function (sum, id) { return sum + cleanTalents[id]; }, 0);
    for (var ti = GD().talents.length - 1; ti >= 0 && spentTalentPoints > earnedTalentPoints; ti--) {
      var tid = GD().talents[ti].id, remove = Math.min(cleanTalents[tid] || 0, spentTalentPoints - earnedTalentPoints);
      if (remove) { cleanTalents[tid] -= remove; spentTalentPoints -= remove; if (!cleanTalents[tid]) delete cleanTalents[tid]; }
    }
    s.herrscher.talents = cleanTalents;
    if (!s.settings || typeof s.settings !== 'object') s.settings = { watch: false };
    fill(s.settings, def.settings);
    if (!Array.isArray(s.settings.watchHistory)) s.settings.watchHistory = [];
    s.settings.watchPauseDecision = s.settings.watchPauseDecision !== false;
    if (['off', 'reduced', 'full'].indexOf(s.settings.effects) < 0) s.settings.effects = 'full';
    // Sturmeinsätze v11: laufende Gefechte bleiben speicherbar, beschädigte
    // Werte werden defensiv begrenzt. Die Systemlogik validiert Missions-IDs.
    if (!s.skirmish || typeof s.skirmish !== 'object' || Array.isArray(s.skirmish)) s.skirmish = JSON.parse(JSON.stringify(def.skirmish));
    fill(s.skirmish, def.skirmish);
    s.skirmish.heat = Math.max(0, Math.min(8, Math.floor(Number(s.skirmish.heat) || 0)));
    s.skirmish.streak = Math.max(0, Math.floor(Number(s.skirmish.streak) || 0));
    s.skirmish.bestCombo = Math.max(0, Math.floor(Number(s.skirmish.bestCombo) || 0));
    s.skirmish.rotation = Math.max(0, Math.floor(Number(s.skirmish.rotation) || 0));
    s.skirmish.objectivesCompleted = Math.max(0, Math.floor(Number(s.skirmish.objectivesCompleted) || 0));
    if (!s.skirmish.lastResult || typeof s.skirmish.lastResult !== 'object' || Array.isArray(s.skirmish.lastResult)) s.skirmish.lastResult = null;
    if (s.skirmish.active && typeof s.skirmish.active === 'object') {
      var sa = s.skirmish.active;
      var skirmishNumbers = ['round', 'maxRounds', 'heroHp', 'heroMaxHp', 'heroAttack', 'enemyHp', 'enemyMaxHp', 'enemyAttack', 'focus', 'combo', 'bestCombo', 'seed'];
      skirmishNumbers.forEach(function (key) {
        sa[key] = Number(sa[key]);
      });
      if (!sa.missionId || skirmishNumbers.some(function (key) { return !isFinite(sa[key]); })) s.skirmish.active = null;
      else {
        sa.round = Math.max(1, Math.floor(sa.round || 1));
        sa.maxRounds = Math.max(sa.round, Math.floor(sa.maxRounds || 14));
        sa.heroMaxHp = Math.max(1, sa.heroMaxHp || sa.heroHp || 1);
        sa.enemyMaxHp = Math.max(1, sa.enemyMaxHp || sa.enemyHp || 1);
        sa.heroHp = Math.max(0, Math.min(sa.heroMaxHp, sa.heroHp));
        sa.enemyHp = Math.max(0, Math.min(sa.enemyMaxHp, sa.enemyHp));
        sa.focus = Math.max(0, Math.min(5, Math.floor(sa.focus || 0)));
        sa.combo = Math.max(0, Math.floor(sa.combo || 0));
        sa.bestCombo = Math.max(sa.combo, Math.floor(sa.bestCombo || 0));
        ['intentStep', 'perfectStreak', 'maxPerfectStreak', 'finishersUsed'].forEach(function (key) {
          sa[key] = Math.max(0, Math.floor(Number(sa[key]) || 0));
        });
        sa.maxPerfectStreak = Math.max(sa.perfectStreak, sa.maxPerfectStreak);
        sa.objectiveComplete = !!sa.objectiveComplete;
        if (!Array.isArray(sa.log)) sa.log = [];
        sa.log = sa.log.slice(0, 7).map(function (line) { return String(line); });
      }
    } else s.skirmish.active = null;
    // Belagerung (Phase 43): laufende aktive Verteidigung absichern.
    if (!s.siege || typeof s.siege !== 'object' || Array.isArray(s.siege)) s.siege = { active: null, lastResult: null };
    if (!s.siege.lastResult || typeof s.siege.lastResult !== 'object' || Array.isArray(s.siege.lastResult)) s.siege.lastResult = null;
    if (s.siege.active && typeof s.siege.active === 'object') {
      var sgn = ['wallHp', 'wallMax', 'rivalRemaining', 'rivalPower', 'round', 'rounds', 'shield'];
      sgn.forEach(function (k) { s.siege.active[k] = Number(s.siege.active[k]); });
      if (!s.siege.active.rivalId || !s.raid || sgn.some(function (k) { return !isFinite(s.siege.active[k]); })) s.siege.active = null;
      else {
        s.siege.active.round = Math.max(1, Math.floor(s.siege.active.round || 1));
        s.siege.active.rounds = Math.max(s.siege.active.round, Math.floor(s.siege.active.rounds || 6));
        s.siege.active.wallMax = Math.max(1, s.siege.active.wallMax);
        s.siege.active.wallHp = Math.max(0, Math.min(s.siege.active.wallMax, s.siege.active.wallHp));
        s.siege.active.shield = Math.max(0, Math.floor(s.siege.active.shield || 0));
        if (!Array.isArray(s.siege.active.log)) s.siege.active.log = [];
        s.siege.active.log = s.siege.active.log.slice(0, 7).map(function (l) { return String(l); });
      }
    } else s.siege.active = null;
    // Taktische Schlacht (Phase 44): laufenden Kampf nur behalten, wenn die Struktur
    // intakt ist (Gitter + beide Seiten). Der deterministische RNG wird beim Laden
    // aus dem Seed rekonstruiert (GameBattle.rehydrate), nicht serialisiert.
    if (s.tacticalBattle && (typeof s.tacticalBattle !== 'object' || Array.isArray(s.tacticalBattle) ||
        !Array.isArray(s.tacticalBattle.party) || !Array.isArray(s.tacticalBattle.enemies) || !Array.isArray(s.tacticalBattle.grid) ||
        !GD().region(s.tacticalBattle.regionId))) s.tacticalBattle = null;
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
    if (!s.echoes || typeof s.echoes !== 'object' || Array.isArray(s.echoes)) s.echoes = JSON.parse(JSON.stringify(def.echoes));
    fill(s.echoes, def.echoes);
    s.echoes.cycle = Math.max(1, Math.floor(Number(s.echoes.cycle) || 1));
    s.echoes.seed = Math.max(1, Math.floor(Number(s.echoes.seed) || def.echoes.seed));
    s.echoes.stability = Math.max(0, Math.floor(Number(s.echoes.stability) || 0));
    s.echoes.mapsCompleted = Math.max(0, Math.floor(Number(s.echoes.mapsCompleted) || 0));
    s.echoes.lastAutoTick = Math.floor(Number(s.echoes.lastAutoTick) || -999);
    if (!Array.isArray(s.echoes.nodes)) s.echoes.nodes = [];
    s.echoes.nodes = s.echoes.nodes.filter(function (node) {
      return node && typeof node.id === 'string' && typeof node.power === 'number' && Array.isArray(node.parents) && Array.isArray(node.affixIds);
    });
    if (!Array.isArray(s.echoes.completed)) s.echoes.completed = [];
    var echoIds = {}; s.echoes.nodes.forEach(function (node) { echoIds[node.id] = true; });
    s.echoes.completed = s.echoes.completed.filter(function (id, i, all) { return echoIds[id] && all.indexOf(id) === i; });
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

  // Speichert und meldet den Grund eines Fehlschlags (z. B. volles localStorage).
  function saveResult(state) {
    state.lastSaved = Date.now();
    state.version = VERSION;
    if (!hasStorage()) return { ok: false, reason: 'unavailable' };
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      return { ok: true };
    } catch (e) {
      var quota = !!(e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014));
      return { ok: false, reason: quota ? 'quota' : 'error' };
    }
  }

  function save(state) { return saveResult(state).ok; }

  // Lädt und unterscheidet "kein Stand" von "korrupter Stand".
  function loadResult() {
    if (!hasStorage()) return { state: null, error: null };
    var raw = null;
    try {
      raw = localStorage.getItem(SAVE_KEY);
      var legacy = false;
      if (!raw) { raw = localStorage.getItem(LEGACY_SAVE_KEY); legacy = !!raw; }
      if (!raw) return { state: null, error: null };
      var state = normalize(JSON.parse(raw));
      if (legacy) {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
        localStorage.removeItem(LEGACY_SAVE_KEY);
      }
      return { state: state, error: null };
    } catch (e) {
      // Korrupten Rohstand separat sichern, statt ihn still zu verlieren.
      try { if (raw) localStorage.setItem(SAVE_KEY + '_corrupt', raw); } catch (e2) {}
      return { state: null, error: 'corrupt' };
    }
  }

  function load() { return loadResult().state; }

  // Exportiert den Spielstand als JSON-Text (Backup / Gerätewechsel).
  function exportSave(state) {
    state.version = VERSION;
    return JSON.stringify(state);
  }

  // Importiert einen exportierten/gespeicherten Spielstand aus Text.
  function importSave(text) {
    var parsed;
    try { parsed = JSON.parse(text); }
    catch (e) { return { ok: false, reason: 'Ungültige Datei – kein gültiges JSON.' }; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ok: false, reason: 'Ungültiger Spielstand – kein Objekt.' };
    }
    var state;
    try { state = normalize(parsed); }
    catch (e) { return { ok: false, reason: 'Spielstand konnte nicht gelesen werden.' }; }
    save(state); // best effort persistieren
    return { ok: true, state: state };
  }

  function chronicleStore() {
    if (!hasStorage()) return { archives: [], error: 'unavailable' };
    try {
      var raw = localStorage.getItem(CHRONICLE_KEY);
      if (!raw) return { archives: [], error: null };
      var parsed = JSON.parse(raw);
      var archives = parsed && Array.isArray(parsed.archives) ? parsed.archives.filter(function (entry) {
        return entry && typeof entry === 'object' && typeof entry.id === 'string' && entry.run && typeof entry.run === 'object';
      }) : [];
      return { archives: archives, error: null };
    } catch (e) {
      return { archives: [], error: 'corrupt' };
    }
  }

  function storeChronicleArchive(record) {
    if (!record || typeof record !== 'object' || typeof record.id !== 'string' || !record.run) return { ok: false, reason: 'invalid' };
    var loaded = chronicleStore();
    if (loaded.error) return { ok: false, reason: loaded.error };
    var archives = loaded.archives.filter(function (entry) { return entry.id !== record.id; });
    archives.push(record);
    try {
      localStorage.setItem(CHRONICLE_KEY, JSON.stringify({ version: 1, archives: archives }));
      return { ok: true, id: record.id };
    } catch (e) {
      var quota = !!(e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014));
      return { ok: false, reason: quota ? 'quota' : 'error' };
    }
  }

  function listChronicleArchives() {
    return chronicleStore().archives.map(function (entry) { return entry.summary; }).filter(Boolean);
  }

  function exportChronicleArchive(id) {
    var record = chronicleStore().archives.filter(function (entry) { return entry.id === id; })[0];
    return record ? JSON.stringify(record.run) : null;
  }

  function reset() {
    if (!hasStorage()) return;
    try {
      localStorage.removeItem(SAVE_KEY);
      localStorage.removeItem(LEGACY_SAVE_KEY);
      localStorage.removeItem(CHRONICLE_KEY);
    } catch (e) {}
  }

  root.GameState = {
    SAVE_KEY: SAVE_KEY,
    LEGACY_SAVE_KEY: LEGACY_SAVE_KEY,
    CHRONICLE_KEY: CHRONICLE_KEY,
    VERSION: VERSION,
    RULER_ARMY_ID: RULER_ARMY_ID,
    createDefault: createDefault,
    normalize: normalize,
    newCreature: newCreature,
    nextUid: nextUid,
    save: save,
    saveResult: saveResult,
    load: load,
    loadResult: loadResult,
    exportSave: exportSave,
    importSave: importSave,
    storeChronicleArchive: storeChronicleArchive,
    listChronicleArchives: listChronicleArchives,
    exportChronicleArchive: exportChronicleArchive,
    reset: reset
  };
})();
